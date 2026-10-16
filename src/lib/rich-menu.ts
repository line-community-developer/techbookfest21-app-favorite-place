import type { messagingApi } from "@line/bot-sdk";
import { LOCATION_PICKER_URI, endAction, liffUrl, openKeyboardAction } from "@/lib/quick-reply";
import type { ConversationState } from "@/types/db";

// リッチメニューの切り替えには2種類ある。
// 1. サーバー側: 会話の状態が変わったら Webhook がユーザーごとにメニューを差し替える（linkRichMenuIdToUser）
// 2. クライアント側: richmenuswitch アクションで、エイリアス先のメニューへ LINE アプリが切り替える（サーバー不要）
// どちらもメニューIDではなく「エイリアス」で指すので、メニューを作り直しても ID を env に書き直さなくてよい。

export const RICH_MENU_ALIAS = {
  idle: "fp-idle",
  awaiting_location: "fp-awaiting-location",
  registered: "fp-registered",
  help: "fp-help",
} as const satisfies Record<ConversationState | "help", string>;

export type RichMenuKey = keyof typeof RICH_MENU_ALIAS;

// 2500x843（コンパクトサイズ）。画像は assets/rich-menu/<key>.png
const WIDTH = 2500;
const HEIGHT = 843;
// 写真の選択画面を開く LINE URL スキーム（Quick Reply の cameraRoll action と同じ役割）
export const CAMERA_ROLL_URI = "https://line.me/R/nv/cameraRoll/single";

// 横に等分した領域にアクションを割り当てる
function columns(actions: messagingApi.Action[]): messagingApi.RichMenuArea[] {
  const width = Math.floor(WIDTH / actions.length);
  return actions.map((action, i) => ({
    bounds: { x: i * width, y: 0, width: i === actions.length - 1 ? WIDTH - i * width : width, height: HEIGHT },
    action,
  }));
}

// #@@range_begin(wow_menu_switch)
function switchTo(key: RichMenuKey, label: string): messagingApi.Action {
  return {
    type: "richmenuswitch", // サーバーを通らず、LINE アプリが切り替える
    label,
    richMenuAliasId: RICH_MENU_ALIAS[key],
    data: `richmenu=${key}`,
  };
}
// #@@range_end(wow_menu_switch)

export type RichMenuDefinition = {
  key: RichMenuKey;
  // SDK の型は全項目が任意なので、このアプリで必ず指定する項目を必須にしておく
  request: Required<Pick<messagingApi.RichMenuRequest, "size" | "selected" | "name" | "chatBarText" | "areas">>;
};

export function richMenuDefinitions(liffId: string): RichMenuDefinition[] {
  const map: messagingApi.Action = { type: "uri", label: "地図で見る", uri: liffUrl(liffId) };
  // selected: メニューを開いた状態で表示するか。registered は閉じて、コメントを打ちやすくする
  const base = (
    name: string,
    chatBarText: string,
    actions: messagingApi.Action[],
    selected = true
  ): RichMenuDefinition["request"] => ({
    size: { width: WIDTH, height: HEIGHT },
    selected,
    name: `favorite-place-${name}`,
    chatBarText,
    areas: columns(actions),
  });

  return [
    {
      key: "idle",
      request: base("idle", "メニュー", [
        { type: "message", label: "場所を登録する", text: "登録" },
        map,
        switchTo("help", "使い方"),
      ]),
    },
    {
      key: "help",
      request: base("help", "使い方", [switchTo("idle", "もどる")]),
    },
    {
      key: "awaiting_location",
      request: base("awaiting-location", "位置情報を送ってください", [
        { type: "uri", label: "位置情報を送る", uri: LOCATION_PICKER_URI },
        endAction("やめる"),
      ]),
    },
    {
      key: "registered",
      request: base(
        "registered",
        "写真やコメントを送れます",
        [
          { type: "uri", label: "写真を送る", uri: CAMERA_ROLL_URI },
          openKeyboardAction("コメントを書く"),
          endAction("終了"),
        ],
        false
      ),
    },
  ];
}

// #@@range_begin(wow_menu_alias)
// 会話の状態に合わせて、そのユーザーのリッチメニューを差し替える
export async function linkRichMenuForState(
  client: messagingApi.MessagingApiClient,
  userId: string,
  state: ConversationState
): Promise<void> {
  const { richMenuId } = await client.getRichMenuAlias(RICH_MENU_ALIAS[state]);
  await client.linkRichMenuIdToUser(userId, richMenuId);
}
// #@@range_end(wow_menu_alias)
