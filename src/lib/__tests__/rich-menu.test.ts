import { describe, expect, it } from "vitest";
import { RICH_MENU_ALIAS, richMenuDefinitions } from "@/lib/rich-menu";

const definitions = richMenuDefinitions("2000000000-AbCdEfGh");

describe("richMenuDefinitions", () => {
  it("状態ごと + 使い方の4枚を作る", () => {
    expect(definitions.map((d) => d.key).sort()).toEqual(["awaiting_location", "help", "idle", "registered"]);
  });

  it("領域は画像（2500x843）からはみ出さず、横幅の合計がぴったり", () => {
    for (const { request } of definitions) {
      const total = request.areas.reduce((sum, area) => sum + (area.bounds?.width ?? 0), 0);
      expect(total).toBe(request.size.width);
      for (const area of request.areas) {
        expect((area.bounds?.y ?? 0) + (area.bounds?.height ?? 0)).toBeLessThanOrEqual(request.size.height ?? 0);
      }
    }
  });

  it("richmenuswitch は idle ⇄ help を行き来する", () => {
    const switches = definitions.flatMap(({ key, request }) =>
      request.areas
        .map((area) => area.action)
        .filter((action) => action?.type === "richmenuswitch")
        .map((action) => [key, (action as { richMenuAliasId: string }).richMenuAliasId])
    );
    expect(switches).toEqual([
      ["idle", RICH_MENU_ALIAS.help],
      ["help", RICH_MENU_ALIAS.idle],
    ]);
  });

  it("エイリアスは 1〜32 文字の英小文字・数字・ハイフン", () => {
    for (const alias of Object.values(RICH_MENU_ALIAS)) {
      expect(alias).toMatch(/^[a-z0-9_-]{1,32}$/);
    }
  });

  it("registered だけ閉じた状態で表示し、コメントを打ちやすくする", () => {
    const selected = Object.fromEntries(definitions.map((d) => [d.key, d.request.selected]));
    expect(selected).toEqual({ idle: true, help: true, awaiting_location: true, registered: false });
  });

  it("chatBarText は14文字以内", () => {
    for (const { request } of definitions) {
      expect([...request.chatBarText].length).toBeLessThanOrEqual(14);
    }
  });
});
