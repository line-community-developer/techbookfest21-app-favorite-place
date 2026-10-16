import type { messagingApi } from "@line/bot-sdk";
import { END_KEYWORD } from "@/lib/state-machine";
import type { ConversationState } from "@/types/db";

// 位置情報の送信画面を開く LINE URL スキーム
export const LOCATION_PICKER_URI = "https://line.me/R/nv/location";

export function liffUrl(liffId: string, path = ""): string {
  return `https://liff.line.me/${liffId}${path}`;
}

function messageItem(label: string, text: string): messagingApi.QuickReplyItem {
  return { type: "action", action: { type: "message", label, text } };
}

function uriItem(label: string, uri: string): messagingApi.QuickReplyItem {
  return { type: "action", action: { type: "uri", label, uri } };
}

// postback で「終了」を送る。displayText でトークには「終了」と表示しつつ、
// inputOption: "openRichMenu" で押した直後にリッチメニューを開く（idle のメニューに切り替わる）
export const COMMAND_PREFIX = "command=";
// #@@range_begin(wow_input_option)
export function endAction(label: string): messagingApi.PostbackAction {
  return {
    type: "postback",
    label,
    data: `${COMMAND_PREFIX}${END_KEYWORD}`,
    displayText: END_KEYWORD, // トークには「終了」と表示される
    inputOption: "openRichMenu", // 押した直後にリッチメニューを開く
  };
}

// コメントを書くためにキーボードを開く。Webhook には postback が届くが、何もしない
export const OPEN_KEYBOARD_DATA = "action=open-keyboard";
export function openKeyboardAction(
  label: string
): messagingApi.PostbackAction {
  return {
    type: "postback",
    label,
    data: OPEN_KEYBOARD_DATA,
    inputOption: "openKeyboard", // 押した直後にキーボードを開く
  };
}
// #@@range_end(wow_input_option)

// 遷移先の状態から「次に取れる操作」を Quick Reply にする。
// state-machine.ts は Quick Reply を知らず、webhook-handler.ts が nextState を渡して選ぶ。
// #@@range_begin(wow_quick_reply)
export function quickReplyFor(
  state: ConversationState,
  liffId: string
): messagingApi.QuickReply {
  switch (state) {
    case "idle":
      return {
        items: [
          messageItem("📍 場所を登録する", "登録"),
          uriItem("🗺 地図で見る", liffUrl(liffId)),
        ],
      };
    case "awaiting_location":
      return {
        items: [
          uriItem("📍 位置情報を送る", LOCATION_PICKER_URI),
          { type: "action", action: endAction("✖ やめる") },
        ],
      };
// #@@range_end(wow_quick_reply)
    case "registered":
      return {
        items: [
          { type: "action", action: openKeyboardAction("💬 コメントを書く") },
          { type: "action", action: { type: "cameraRoll", label: "📷 写真を送る" } },
          { type: "action", action: endAction("✅ 終了") },
          uriItem("🗺 地図で見る", liffUrl(liffId)),
        ],
      };
  }
}
