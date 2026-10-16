// 状態ごとのリッチメニュー（4枚）を作成し、エイリアスを付けて、idle をデフォルトに設定するセットアップスクリプト。
// ハンズオン参加者が手元で1回だけ実行する想定（Webhookやビルドの一部ではない）。何度実行しても作り直すだけ。
//
// 実行方法:
//   npm run create-rich-menu
//
// 画像は assets/rich-menu/<key>.png（2500x843）を使う。
import { readFile } from "node:fs/promises";
import path from "node:path";
import { messagingApi } from "@line/bot-sdk";
import { RICH_MENU_ALIAS, richMenuDefinitions } from "@/lib/rich-menu";

async function main() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!channelAccessToken || !liffId) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN / NEXT_PUBLIC_LIFF_ID を .env.local に設定してください。");
    process.exit(1);
  }

  const client = new messagingApi.MessagingApiClient({ channelAccessToken });
  const blobClient = new messagingApi.MessagingApiBlobClient({ channelAccessToken });

  // 前回このスクリプトで作ったエイリアスとメニューを片付ける
  const ourAliases = new Set<string>(Object.values(RICH_MENU_ALIAS));
  const { aliases } = await client.getRichMenuAliasList();
  for (const alias of aliases.filter((a) => ourAliases.has(a.richMenuAliasId))) {
    await client.deleteRichMenuAlias(alias.richMenuAliasId);
  }
  const { richmenus } = await client.getRichMenuList();
  for (const menu of richmenus.filter((m) => m.name.startsWith("favorite-place-"))) {
    await client.deleteRichMenu(menu.richMenuId);
  }

  const created: Record<string, string> = {};
  for (const { key, request } of richMenuDefinitions(liffId)) {
    const { richMenuId } = await client.createRichMenu(request);
    const image = await readFile(path.join(process.cwd(), "assets/rich-menu", `${key}.png`));
    await blobClient.setRichMenuImage(richMenuId, new Blob([image], { type: "image/png" }));
    await client.createRichMenuAlias({ richMenuAliasId: RICH_MENU_ALIAS[key], richMenuId });
    created[key] = richMenuId;
    console.log(`作成: ${RICH_MENU_ALIAS[key]} → ${richMenuId}`);
  }

  await client.setDefaultRichMenu(created.idle);
  console.log("idle のメニューをデフォルトに設定しました。");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
