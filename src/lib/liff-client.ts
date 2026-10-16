"use client";

import liff from "@line/liff";

let initPromise: Promise<void> | null = null;

// liff.init() はページ内で複数回呼ばれても問題ないSDK側の仕様だが、
// 同時に複数回呼び出さないようにPromiseをキャッシュする。
export function ensureLiffInitialized(): Promise<void> {
  if (!initPromise) {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      throw new Error("NEXT_PUBLIC_LIFF_ID が未設定です。");
    }
    initPromise = liff.init({ liffId });
  }
  return initPromise;
}

// 未ログインならLINEログインへリダイレクトする。戻り値は「ログイン済みかどうか」。
// false が返ったら呼び出し側は処理を中断してよい（liff.login()がリダイレクトする）。
export function ensureLoggedIn(): boolean {
  if (liff.isLoggedIn()) return true;
  liff.login();
  return false;
}

export function getAuthorizedFetchHeaders(): HeadersInit {
  const idToken = liff.getIDToken();
  if (!idToken) {
    throw new Error("LIFF IDトークンを取得できませんでした。");
  }
  return { Authorization: `Bearer ${idToken}` };
}
