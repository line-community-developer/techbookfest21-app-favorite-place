import { describe, expect, it } from "vitest";
import { LOCATION_PICKER_URI, quickReplyFor } from "@/lib/quick-reply";

const LIFF_ID = "2000000000-AbCdEfGh";

function actionsOf(state: Parameters<typeof quickReplyFor>[0]) {
  return (quickReplyFor(state, LIFF_ID).items ?? []).flatMap((item) => (item.action ? [item.action] : []));
}

describe("quickReplyFor", () => {
  it("idle: 「登録」を送る message action と LIFF を開く URI action", () => {
    expect(actionsOf("idle")).toEqual([
      { type: "message", label: "📍 場所を登録する", text: "登録" },
      { type: "uri", label: "🗺 地図で見る", uri: `https://liff.line.me/${LIFF_ID}` },
    ]);
  });

  it("awaiting_location: 位置情報送信画面と、リッチメニューを開く「終了」", () => {
    expect(actionsOf("awaiting_location")).toEqual([
      { type: "uri", label: "📍 位置情報を送る", uri: LOCATION_PICKER_URI },
      { type: "postback", label: "✖ やめる", data: "command=終了", displayText: "終了", inputOption: "openRichMenu" },
    ]);
  });

  it("registered: キーボードを開く・cameraRoll・「終了」・LIFF", () => {
    const actions = actionsOf("registered");
    expect(actions.map((a) => a.type)).toEqual(["postback", "cameraRoll", "postback", "uri"]);
    expect(actions[0]).toMatchObject({ inputOption: "openKeyboard" });
    expect(actions[2]).toMatchObject({ data: "command=終了", inputOption: "openRichMenu" });
  });

  it("ラベルは Quick Reply の上限20文字以内", () => {
    for (const state of ["idle", "awaiting_location", "registered"] as const) {
      for (const action of actionsOf(state)) {
        expect([...(action.label ?? "")].length).toBeLessThanOrEqual(20);
      }
    }
  });
});
