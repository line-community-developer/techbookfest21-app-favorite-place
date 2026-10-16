import type { webhook } from "@line/bot-sdk";
import { isValidLineSignature, type LineWebhookBody } from "@/lib/line";
import { createServiceRoleClient } from "@/lib/supabase";
import { handleLineEvent } from "@/lib/webhook-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  // #@@range_begin(guard_signature)
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  if (!isValidLineSignature(rawBody, signature)) {
    return new Response("invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody) as LineWebhookBody;
  // #@@range_end(guard_signature)
  const supabase = createServiceRoleClient();

  await Promise.all(
    body.events.map((event: webhook.Event) => handleLineEvent(supabase, event))
  );

  return new Response("ok", { status: 200 });
}
