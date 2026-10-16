import { describe, expect, it } from "vitest";
import { transition } from "@/lib/state-machine";

describe("transition", () => {
  it("idle + 「登録」を含むテキスト → awaiting_location / prompt_location", () => {
    const result = transition("idle", { type: "text", text: "ここを登録したい" });
    expect(result).toEqual({
      nextState: "awaiting_location",
      action: { kind: "prompt_location" },
    });
  });

  it("idle + 通常のテキスト → idle / echo", () => {
    const result = transition("idle", { type: "text", text: "こんにちは" });
    expect(result).toEqual({ nextState: "idle", action: { kind: "echo" } });
  });

  it("idle + 位置情報 → idle / location_guide（登録せず案内だけ返す）", () => {
    const result = transition("idle", { type: "location" });
    expect(result).toEqual({ nextState: "idle", action: { kind: "location_guide" } });
  });

  it("idle + 画像 → idle / noop", () => {
    const result = transition("idle", { type: "image" });
    expect(result).toEqual({ nextState: "idle", action: { kind: "noop" } });
  });

  it("idle + 「終了」 → idle / echo（idle では特別扱いしない）", () => {
    const result = transition("idle", { type: "text", text: "終了" });
    expect(result).toEqual({ nextState: "idle", action: { kind: "echo" } });
  });

  it("awaiting_location + 「終了」 → idle / cancel_register", () => {
    const result = transition("awaiting_location", { type: "text", text: "終了" });
    expect(result).toEqual({ nextState: "idle", action: { kind: "cancel_register" } });
  });

  it("awaiting_location + 位置情報 → registered / register_place", () => {
    const result = transition("awaiting_location", { type: "location" });
    expect(result).toEqual({
      nextState: "registered",
      action: { kind: "register_place" },
    });
  });

  it("awaiting_location + テキスト → awaiting_location / reprompt_location", () => {
    const result = transition("awaiting_location", { type: "text", text: "まだです" });
    expect(result).toEqual({
      nextState: "awaiting_location",
      action: { kind: "reprompt_location" },
    });
  });

  it("registered + 画像 → registered / attach_photo", () => {
    const result = transition("registered", { type: "image" });
    expect(result).toEqual({ nextState: "registered", action: { kind: "attach_photo" } });
  });

  it("registered + 「登録」を含むテキスト → awaiting_location / prompt_location", () => {
    const result = transition("registered", { type: "text", text: "次を登録" });
    expect(result).toEqual({
      nextState: "awaiting_location",
      action: { kind: "prompt_location" },
    });
  });

  it("registered + 「終了」 → idle / finish_register", () => {
    const result = transition("registered", { type: "text", text: " 終了 " });
    expect(result).toEqual({ nextState: "idle", action: { kind: "finish_register" } });
  });

  it("registered + 「終了しました」 → registered / attach_comment（完全一致のみ）", () => {
    const result = transition("registered", { type: "text", text: "終了しました" });
    expect(result).toEqual({ nextState: "registered", action: { kind: "attach_comment" } });
  });

  it("registered + 位置情報 → registered / location_guide", () => {
    const result = transition("registered", { type: "location" });
    expect(result).toEqual({ nextState: "registered", action: { kind: "location_guide" } });
  });

  it("registered + その他のテキスト → registered / attach_comment", () => {
    const result = transition("registered", { type: "text", text: "いい景色だった" });
    expect(result).toEqual({ nextState: "registered", action: { kind: "attach_comment" } });
  });
});
