import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { UserProvider } from "@/contexts/UserContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitGo — 輕鬆分帳",
  description: "LINE Mini App 分帳系統，旅遊、室友、家庭記帳一把罩",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06C755",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>
        <UserProvider>
          <div className="max-w-md mx-auto min-h-screen relative">{children}</div>
        </UserProvider>
        <Script
          src="https://static.line-scdn.net/liff/edge/versions/2.29.0/sdk.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
