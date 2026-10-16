import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "好きな場所Bot",
  description: "LINE Messaging API + LIFF ハンズオン用サンプルアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
