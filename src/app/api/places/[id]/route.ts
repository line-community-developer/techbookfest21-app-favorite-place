import { resolveLineUserIdFromRequest, LiffTokenVerificationError } from "@/lib/verify-liff-token";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

const SIGNED_URL_EXPIRES_IN_SECONDS = 60;

type RouteParams = { params: Promise<{ id: string }> };

// LIFFの場所詳細画面向け: 場所本体・写真（署名付きURL）・コメントをまとめて返す。
// 他人の場所IDを渡された場合は、line_user_id が一致しないので404扱いにする
// （「存在しない」と「他人のものだから見せない」を区別しない）。
export async function GET(request: Request, { params }: RouteParams): Promise<Response> {
  let lineUserId: string;
  try {
    lineUserId = await resolveLineUserIdFromRequest(request);
  } catch (error) {
    if (error instanceof LiffTokenVerificationError) {
      return new Response("unauthorized", { status: 401 });
    }
    throw error;
  }

  const { id: placeId } = await params;
  const supabase = createServiceRoleClient();

  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("id, latitude, longitude, address, title, created_at, line_user_id")
    .eq("id", placeId)
    .eq("line_user_id", lineUserId)
    .maybeSingle();

  if (placeError) {
    return new Response("internal error", { status: 500 });
  }
  if (!place) {
    return new Response("not found", { status: 404 });
  }

  const { data: photos, error: photosError } = await supabase
    .from("place_photos")
    .select("id, storage_path, created_at")
    .eq("place_id", placeId)
    .order("created_at", { ascending: true });

  if (photosError) {
    return new Response("internal error", { status: 500 });
  }

  const photoUrls = await Promise.all(
    (photos ?? []).map(async (photo) => {
      const { data: signed, error: signError } = await supabase.storage
        .from("place-photos")
        .createSignedUrl(photo.storage_path, SIGNED_URL_EXPIRES_IN_SECONDS);

      return {
        id: photo.id,
        url: signError ? null : signed?.signedUrl ?? null,
        createdAt: photo.created_at,
      };
    })
  );

  const { data: comments, error: commentsError } = await supabase
    .from("place_comments")
    .select("id, body, created_at")
    .eq("place_id", placeId)
    .order("created_at", { ascending: true });

  if (commentsError) {
    return new Response("internal error", { status: 500 });
  }

  return Response.json({
    place: {
      id: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.address,
      title: place.title,
      createdAt: place.created_at,
    },
    photos: photoUrls,
    comments,
  });
}
