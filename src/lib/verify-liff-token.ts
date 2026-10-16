const LINE_VERIFY_ENDPOINT = "https://api.line.me/oauth2/v2.1/verify";

type LineVerifyResponse = {
  iss: string;
  sub: string; // LINEのuserId
  aud: string;
  exp: number;
  iat: number;
};

export class LiffTokenVerificationError extends Error {}

function getChannelId(): string {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!channelId) {
    throw new Error("LINE_CHANNEL_ID が未設定です。");
  }
  return channelId;
}

// liff.getIDToken() で取得したIDトークンをLINE側で検証し、line_user_idを確定する。
// client_id を渡すことで audience(aud) が自分のチャネル宛かどうかも検証される
// （渡し忘れると「他アプリ向けの正規トークン」まで通ってしまうので必須）。
export async function verifyLiffIdToken(idToken: string): Promise<string> {
  // #@@range_begin(wow_verify)
  const response = await fetch(LINE_VERIFY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: getChannelId(),
    }),
  });

  if (!response.ok) {
    throw new LiffTokenVerificationError(
      `LIFF IDトークンの検証に失敗しました (status: ${response.status})`
    );
  }

  const payload = (await response.json()) as LineVerifyResponse;
  if (!payload.sub) {
    throw new LiffTokenVerificationError(
      "検証レスポンスに sub (line_user_id) がありません"
    );
  }

  return payload.sub;
  // #@@range_end(wow_verify)
}

// Authorization: Bearer <token> ヘッダから line_user_id を取り出す。
// 失敗時は LiffTokenVerificationError を投げるので、呼び出し側は401にマップする。
export async function resolveLineUserIdFromRequest(request: Request): Promise<string> {
  const authorization = request.headers.get("authorization");
  const idToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!idToken) {
    throw new LiffTokenVerificationError("Authorization ヘッダが不正です");
  }

  return verifyLiffIdToken(idToken);
}
