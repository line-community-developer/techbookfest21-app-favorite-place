import { createClient } from "@supabase/supabase-js";

// サーバー専用クライアント。service role key は RLS をバイパスするため、
// このモジュールはAPI Route（サーバーサイド）からのみ import すること。
// クライアントコンポーネントから import すると SUPABASE_SERVICE_ROLE_KEY が
// バンドルに含まれてしまう。
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。env.sample を参考に .env.local を作成してください。"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
