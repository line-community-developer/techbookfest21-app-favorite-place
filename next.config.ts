import type { NextConfig } from "next";

// LIFF 配下の CSP は nonce をリクエストごとに発行するため src/proxy.ts で付与している。
const nextConfig: NextConfig = {};

export default nextConfig;
