import type { ConversationState } from "@/types/db";

export type IncomingEvent =
  | { type: "text"; text: string }
  | { type: "location" }
  | { type: "image" };

export type StateAction =
  | { kind: "echo" }
  | { kind: "prompt_location" }
  | { kind: "reprompt_location" }
  | { kind: "location_guide" }
  | { kind: "cancel_register" }
  | { kind: "finish_register" }
  | { kind: "register_place" }
  | { kind: "attach_photo" }
  | { kind: "attach_comment" }
  | { kind: "noop" };

export type TransitionResult = {
  nextState: ConversationState;
  action: StateAction;
};

const REGISTER_KEYWORD = "登録";
export const END_KEYWORD = "終了";

function isRegisterCommand(event: IncomingEvent): boolean {
  return event.type === "text" && event.text.includes(REGISTER_KEYWORD);
}

// 「終了」は完全一致。「登録」より先に評価する
function isEndCommand(event: IncomingEvent): boolean {
  return event.type === "text" && event.text.trim() === END_KEYWORD;
}

// 状態遷移図: README の「しくみ」
export function transition(
  currentState: ConversationState,
  event: IncomingEvent
): TransitionResult {
  switch (currentState) {
    case "idle": {
      if (isRegisterCommand(event)) {
        return { nextState: "awaiting_location", action: { kind: "prompt_location" } };
      }
      if (event.type === "text") {
        return { nextState: "idle", action: { kind: "echo" } };
      }
      if (event.type === "location") {
        return { nextState: "idle", action: { kind: "location_guide" } };
      }
      return { nextState: "idle", action: { kind: "noop" } };
    }

    case "awaiting_location": {
      if (isEndCommand(event)) {
        return { nextState: "idle", action: { kind: "cancel_register" } };
      }
      if (event.type === "location") {
        return { nextState: "registered", action: { kind: "register_place" } };
      }
      return { nextState: "awaiting_location", action: { kind: "reprompt_location" } };
    }

    // #@@range_begin(wow_state)
    case "registered": {
      if (event.type === "image") {
        return { nextState: "registered", action: { kind: "attach_photo" } };
      }
      if (isEndCommand(event)) {
        return { nextState: "idle", action: { kind: "finish_register" } };
      }
      if (isRegisterCommand(event)) {
        return {
          nextState: "awaiting_location",
          action: { kind: "prompt_location" },
        };
      }
      if (event.type === "text") {
        return { nextState: "registered", action: { kind: "attach_comment" } };
      }
      if (event.type === "location") {
        return { nextState: "registered", action: { kind: "location_guide" } };
      }
      return { nextState: "registered", action: { kind: "noop" } };
    }
    // #@@range_end(wow_state)
  }
}
