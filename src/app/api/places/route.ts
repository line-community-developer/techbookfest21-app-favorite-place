import { resolveLineUserIdFromRequest, LiffTokenVerificationError } from "@/lib/verify-liff-token";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

// LIFFのマップ画面向け: ログイン中のユーザーが登録した場所一覧を返す。
// line_user_id はクライアントから受け取らず、IDトークン検証で確定した値のみ使う。
export async function GET(request: Request): Promise<Response> {
  let lineUserId: string;
  try {
    lineUserId = await resolveLineUserIdFromRequest(request);
  } catch (error) {
    if (error instanceof LiffTokenVerificationError) {
      return new Response("unauthorized", { status: 401 });
    }
    throw error;
  }

  const supabase = createServiceRoleClient();
  // #@@range_begin(wow_my_places)
  const { data, error } = await supabase
    .from("places")
    .select("id, latitude, longitude, address, title, created_at")
    .eq("line_user_id", lineUserId)
    .order("created_at", { ascending: false });
  // #@@range_end(wow_my_places)

  if (error) {
    return new Response("internal error", { status: 500 });
  }

  return Response.json({ places: data });
}
