import { connection } from "next/server";

// CSP の nonce はリクエストごとに変わるため、LIFF 配下は静的生成せず毎回レンダリングする（src/proxy.ts 参照）
export default async function LiffLayout({ children }: LayoutProps<"/liff">) {
  await connection();
  return children;
}
