import type { Readable } from "node:stream";
import { messagingApi, validateSignature, webhook } from "@line/bot-sdk";

export type LineWebhookBody = {
  destination: string;
  events: webhook.Event[];
};

function getChannelSecret(): string {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error("LINE_CHANNEL_SECRET が未設定です。");
  }
  return secret;
}

function getChannelAccessToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が未設定です。");
  }
  return token;
}

// LINEからのWebhookリクエストか検証する。ここを通らないリクエストは処理しない。
export function isValidLineSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  return validateSignature(rawBody, getChannelSecret(), signature);
}

export function createMessagingApiClient(): messagingApi.MessagingApiClient {
  return new messagingApi.MessagingApiClient({
    channelAccessToken: getChannelAccessToken(),
  });
}

export function createMessagingApiBlobClient(): messagingApi.MessagingApiBlobClient {
  return new messagingApi.MessagingApiBlobClient({
    channelAccessToken: getChannelAccessToken(),
  });
}

export async function replyText(
  replyToken: string,
  text: string,
  quickReply?: messagingApi.QuickReply
): Promise<void> {
  const client = createMessagingApiClient();
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text, quickReply }],
  });
}

// 画像メッセージの実体（Readable）をBufferにまとめて読み切る。
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function getLineUserId(event: webhook.Event): string | undefined {
  const source = event.source;
  if (source?.type === "user") {
    return source.userId;
  }
  return undefined;
}
