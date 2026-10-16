// Supabase の本番プロジェクトが設計どおりに守られているかを確かめるスクリプト。
// migration を適用したあとに1回実行する（Webhook やビルドの一部ではない）。
//
// 実行方法:
//   npm run check-supabase
//
// 確かめること:
//   1. anon key で各テーブルを直接読むと 0 件（RLS 有効・ポリシー0件 = 全拒否）
//   2. service role key なら読める（テーブルが存在し、migration が適用済み）
//   3. place-photos バケットが private（public URL で取得できない）

const TABLES = ["line_users", "places", "place_photos", "place_comments"] as const;

type Result = { name: string; ok: boolean; detail: string };

async function rest(url: string, key: string, table: string) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください。");
    process.exit(1);
  }

  const results: Result[] = [];

  for (const table of TABLES) {
    const anon = await rest(url, anonKey, table);
    results.push({
      name: `anon で ${table} を読む → 0件`,
      ok: anon.status === 200 && Array.isArray(anon.body) && anon.body.length === 0,
      detail: `HTTP ${anon.status} ${JSON.stringify(anon.body)}`,
    });

    const service = await rest(url, serviceRoleKey, table);
    results.push({
      name: `service role で ${table} が存在する`,
      ok: service.status === 200 && Array.isArray(service.body),
      detail: `HTTP ${service.status}`,
    });
  }

  const publicRes = await fetch(`${url}/storage/v1/object/public/place-photos/check.jpg`);
  results.push({
    name: "place-photos バケットは public URL で取得できない",
    ok: publicRes.status >= 400,
    detail: `HTTP ${publicRes.status}`,
  });

  const bucketRes = await fetch(`${url}/storage/v1/bucket/place-photos`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const bucket = (await bucketRes.json().catch(() => null)) as { public?: boolean } | null;
  results.push({
    name: "place-photos バケットが存在し public: false",
    ok: bucketRes.status === 200 && bucket?.public === false,
    detail: `HTTP ${bucketRes.status} public=${bucket?.public}`,
  });

  for (const r of results) {
    console.log(`${r.ok ? "✅" : "❌"} ${r.name}  (${r.detail})`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
  console.log("\nすべて設計どおりです。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
