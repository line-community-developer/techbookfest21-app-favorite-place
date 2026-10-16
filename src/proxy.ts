import { NextResponse, type NextRequest } from "next/server";

// LIFF の画面に付ける Content Security Policy。
// Next.js は RSC のデータをインラインスクリプトで埋め込むため、リクエストごとに nonce を発行して許可する。
// 'strict-dynamic' により、nonce 付きスクリプトが読み込む Google Maps のスクリプトも許可される。
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://maps.googleapis.com${isDev ? " 'unsafe-eval'" : ""}`,
    // Google Maps がインラインスタイルを使うため style は 'unsafe-inline' を残す
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.supabase.co https://*.line-scdn.net",
    "connect-src 'self' https://*.line.me https://*.line-scdn.net https://*.googleapis.com https://*.gstatic.com",
    "worker-src 'self' blob:",
    "frame-src https://*.line.me",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Next.js はリクエストヘッダーの CSP から nonce を読み取り、自分のスクリプトに付ける
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/liff/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
