import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { webhook } from "@line/bot-sdk";
import {
  createMessagingApiBlobClient,
  createMessagingApiClient,
  getLineUserId,
  replyText,
  streamToBuffer,
} from "@/lib/line";
import { COMMAND_PREFIX, quickReplyFor } from "@/lib/quick-reply";
import { linkRichMenuForState } from "@/lib/rich-menu";
import { transition, type IncomingEvent } from "@/lib/state-machine";
import type { LineUser } from "@/types/db";

function getLiffId(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  if (!liffId) {
    throw new Error("NEXT_PUBLIC_LIFF_ID が未設定です。");
  }
  return liffId;
}

async function getOrCreateLineUser(
  supabase: SupabaseClient,
  lineUserId: string
): Promise<LineUser> {
  const { data: existing, error: selectError } = await supabase
    .from("line_users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as LineUser;

  const { data: created, error: insertError } = await supabase
    .from("line_users")
    .insert({ line_user_id: lineUserId })
    .select("*")
    .single();

  if (insertError) throw insertError;
  return created as LineUser;
}

// リッチメニューや Quick Reply の postback（data: "command=終了" など）は、その文字を送ったのと同じに扱う。
// それ以外の postback（キーボードを開く・richmenuswitch）は何もしない
function postbackToIncomingEvent(data: string): IncomingEvent | null {
  if (!data.startsWith(COMMAND_PREFIX)) return null;
  return { type: "text", text: data.slice(COMMAND_PREFIX.length) };
}

function toIncomingEvent(message: webhook.MessageContent): IncomingEvent | null {
  switch (message.type) {
    case "text":
      return { type: "text", text: message.text };
    case "location":
      return { type: "location" };
    case "image":
      return { type: "image" };
    default:
      return null;
  }
}

async function registerPlace(
  supabase: SupabaseClient,
  lineUserId: string,
  location: webhook.LocationMessageContent
) {
  const { data: place, error } = await supabase
    .from("places")
    .insert({
      line_user_id: lineUserId,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address ?? null,
      title: location.title ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return place as { id: string };
}

async function attachPhoto(
  supabase: SupabaseClient,
  lineUser: LineUser,
  messageId: string
) {
  if (!lineUser.current_place_id) return;

  // #@@range_begin(wow_photo)
  const blobClient = createMessagingApiBlobClient();
  const stream = await blobClient.getMessageContent(messageId);
  const buffer = await streamToBuffer(stream);

  const placeId = lineUser.current_place_id;
  const fileName = `${randomUUID()}.jpg`;
  const storagePath = `${lineUser.line_user_id}/${placeId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("place-photos")
    .upload(storagePath, buffer, { contentType: "image/jpeg" });
  if (uploadError) throw uploadError;
  // #@@range_end(wow_photo)

  const { error: insertError } = await supabase.from("place_photos").insert({
    place_id: lineUser.current_place_id,
    storage_path: storagePath,
  });
  if (insertError) throw insertError;
}

async function attachComment(supabase: SupabaseClient, placeId: string, body: string) {
  const { error } = await supabase.from("place_comments").insert({ place_id: placeId, body });
  if (error) throw error;
}

async function updateLineUser(
  supabase: SupabaseClient,
  lineUserId: string,
  patch: Partial<Pick<LineUser, "state" | "current_place_id">>
) {
  const { error } = await supabase.from("line_users").update(patch).eq("line_user_id", lineUserId);
  if (error) throw error;
}

// 1件のWebhookイベントを処理する。状態遷移の判断は state-machine.ts に委ね、
// ここでは決まったアクションに応じてSupabaseの読み書きとLINEへの返信だけを行う。
export async function handleLineEvent(supabase: SupabaseClient, event: webhook.Event): Promise<void> {
  if ((event.type !== "message" && event.type !== "postback") || !event.replyToken) return;

  const lineUserId = getLineUserId(event);
  if (!lineUserId) return;

  const incomingEvent =
    event.type === "message" ? toIncomingEvent(event.message) : postbackToIncomingEvent(event.postback.data);
  if (!incomingEvent) return;

  const lineUser = await getOrCreateLineUser(supabase, lineUserId);

  // #@@range_begin(wow_reply)
  const { nextState, action } = transition(lineUser.state, incomingEvent);
  const replyToken = event.replyToken;
  // 返信には「遷移先の状態で次に取れる操作」を Quick Reply として必ず付ける
  const reply = (text: string) =>
    replyText(replyToken, text, quickReplyFor(nextState, getLiffId()));
  // #@@range_end(wow_reply)

  switch (action.kind) {
    case "echo": {
      if (incomingEvent.type === "text") {
        await reply(incomingEvent.text);
      }
      break;
    }

    case "prompt_location": {
      await updateLineUser(supabase, lineUserId, { state: nextState });
      await reply("登録したい場所の位置情報を送ってください📍");
      break;
    }

    case "reprompt_location": {
      await reply("位置情報を送ってください📍");
      break;
    }

    case "location_guide": {
      await reply("場所を登録するときは、先に「登録」と送ってください🙏");
      break;
    }

    case "cancel_register": {
      await updateLineUser(supabase, lineUserId, { state: nextState });
      await reply("登録をやめました。また「登録」と送れば再開できます");
      break;
    }

    case "finish_register": {
      await updateLineUser(supabase, lineUserId, { state: nextState });
      await reply("登録を終えました🙌 地図はメニューから見られます");
      break;
    }

    case "register_place": {
      if (event.type !== "message" || event.message.type !== "location") break;
      const place = await registerPlace(supabase, lineUserId, event.message);
      await updateLineUser(supabase, lineUserId, {
        state: nextState,
        current_place_id: place.id,
      });
      await reply("登録しました！写真やコメントも送れます📷");
      break;
    }

    case "attach_photo": {
      if (event.type !== "message" || event.message.type !== "image") break;
      await attachPhoto(supabase, lineUser, event.message.id);
      await reply("写真を追加しました📸");
      break;
    }

    case "attach_comment": {
      if (incomingEvent.type !== "text" || !lineUser.current_place_id) break;
      await attachComment(supabase, lineUser.current_place_id, incomingEvent.text);
      await reply("コメントを追加しました📝");
      break;
    }

    case "noop":
      break;
  }

  // #@@range_begin(wow_menu_link)
  // 状態が変わったら、リッチメニューも次の状態のものに差し替える。
  // 返信（replyToken には期限がある）を先に済ませ、メニューの失敗で返信を巻き込まない。
  if (nextState !== lineUser.state) {
    try {
      const client = createMessagingApiClient();
      await linkRichMenuForState(client, lineUserId, nextState);
    } catch (error) {
      console.error("リッチメニューの切り替えに失敗しました", error);
    }
  }
  // #@@range_end(wow_menu_link)
}
