"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/Button";
import { Users } from "lucide-react";

const DEMO_USERS = [
  { lineUserId: "demo_alice", displayName: "Alice", avatarUrl: null },
  { lineUserId: "demo_bob", displayName: "Bob", avatarUrl: null },
  { lineUserId: "demo_carol", displayName: "Carol", avatarUrl: null },
];

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
const isLiffEnabled = LIFF_ID !== "" && LIFF_ID !== "your-liff-id-here";

export default function LoginPage() {
  const { setUser } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  // LINE OAuth 跳回來後，URL 會帶有 liff.state 參數，此時自動完成登入
  useEffect(() => {
    if (!isLiffEnabled) return;
    // 避免重複執行
    if (sessionStorage.getItem("liff_completing")) return;

    const url = new URL(window.location.href);
    const hasLiffState = url.searchParams.has("liff.state") || url.hash.includes("liff.state");
    const hasCode = url.searchParams.has("code");

    if (!hasLiffState && !hasCode) return; // 不是從 LINE OAuth 跳回來的，不做任何事

    sessionStorage.setItem("liff_completing", "1");
    setLoading(true);

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          setError("登入失敗，請重試");
          setLoading(false);
          sessionStorage.removeItem("liff_completing");
          return;
        }
        const profile = await liff.getProfile();
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.userId,
            displayName: profile.displayName,
            avatarUrl: profile.pictureUrl ?? null,
          }),
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const user = await res.json();
        sessionStorage.removeItem("liff_completing");
        setUser(user);
        router.push("/groups");
      } catch (e) {
        console.error("LIFF auto-login failed", e);
        setError("登入失敗，請重試");
        setLoading(false);
        sessionStorage.removeItem("liff_completing");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginWithLine = async () => {
    setLoading(true);
    setError(null);
    try {
      setError("步驟1：載入 LIFF SDK...");
      const liff = (await import("@line/liff")).default;

      setError("步驟2：初始化 LIFF...");
      await Promise.race([
        liff.init({ liffId: LIFF_ID }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("liff.init timeout (10s)")), 10000)),
      ]);

      const loggedIn = liff.isLoggedIn();
      setError(`步驟3：isLoggedIn = ${loggedIn}`);

      if (loggedIn) {
        setError("步驟4：取得個人資料...");
        const profile = await liff.getProfile();

        setError(`步驟5：呼叫 API... (userId=${profile.userId.slice(0, 8)})`);
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.userId,
            displayName: profile.displayName,
            avatarUrl: profile.pictureUrl ?? null,
          }),
        });
        if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

        setError("步驟6：登入成功，跳轉中...");
        const user = await res.json();
        setUser(user);
        router.push("/groups");
      } else {
        setError("步驟3b：跳轉 LINE 授權...");
        liff.login({ redirectUri: window.location.href });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("LIFF login failed", e);
      setError(`❌ 失敗：${msg}`);
      setLoading(false);
    }
  };

  const loginAsDemo = async (demo: (typeof DEMO_USERS)[0]) => {
    setLoading(true);
    setSelectedDemo(demo.lineUserId);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const user = await res.json();
      setUser(user);
      router.push("/groups");
    } catch {
      setError("登入失敗，請確認資料庫已設定");
      setLoading(false);
      setSelectedDemo(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-line-green/10 to-white">
      <div className="flex-1 flex flex-col items-center justify-center px-8 pt-16 pb-8">
        <div className="w-20 h-20 bg-line-green rounded-3xl flex items-center justify-center mb-6 shadow-lg">
          <Users className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SplitGo</h1>
        <p className="text-gray-500 text-center text-base leading-relaxed">
          輕鬆分帳，告別帳務糾紛
          <br />
          旅遊・室友・家庭一把罩
        </p>
        <div className="flex flex-wrap gap-2 mt-6 justify-center">
          {["多幣別自動換算", "LINE 推播通知", "最少交易結算"].map((f) => (
            <span key={f} className="bg-white border border-gray-200 text-gray-600 text-xs px-3 py-1.5 rounded-full shadow-sm">
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="px-6 pb-10 space-y-3">
        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 rounded-xl py-2 px-4">{error}</p>
        )}
        {isLiffEnabled ? (
          <Button onClick={loginWithLine} loading={loading} className="w-full h-14 text-base">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
              <path d="M19.365 9.89c.50 0 .904.405.904.904s-.404.904-.904.904h-2.44v1.532h2.44c.499 0 .903.404.903.903s-.404.903-.903.903H16.02a.904.904 0 0 1-.904-.903V9.89c0-.499.405-.904.904-.904h3.345zm-5.78 0c.499 0 .903.405.903.904v4.243a.904.904 0 0 1-1.806 0V9.89c0-.499.404-.904.903-.904zm-2.57 0c.499 0 .904.405.904.904v2.668l-2.197-3.121a.904.904 0 0 0-1.61.553v4.239c0 .499.404.903.903.903s.904-.404.904-.903v-2.667l2.197 3.12a.904.904 0 0 0 1.61-.552V9.89a.904.904 0 0 0-.91-.904zm-5.098 0a.904.904 0 0 0-.904.904v4.243c0 .499.405.903.904.903h3.345a.904.904 0 0 0 0-1.806H6.82v-3.34a.904.904 0 0 0-.904-.904zM12 2C6.477 2 2 6.145 2 11.259c0 4.57 3.874 8.389 9.116 9.116.355.051.84.156.963.358.11.184.072.472.035.658l-.156.927c-.047.277-.22 1.084.952.591 1.172-.493 6.322-3.724 8.629-6.376C23.174 14.447 24 12.935 24 11.259 24 6.145 19.523 2 14 2H12z" />
            </svg>
            使用 LINE 登入
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-center text-gray-400 mb-3">開發模式：選擇測試帳號</p>
            {DEMO_USERS.map((demo) => (
              <Button
                key={demo.lineUserId}
                variant="secondary"
                onClick={() => loginAsDemo(demo)}
                loading={loading && selectedDemo === demo.lineUserId}
                disabled={loading}
                className="w-full"
              >
                <div className="w-7 h-7 rounded-full bg-line-green text-white flex items-center justify-center text-xs font-bold">
                  {demo.displayName[0]}
                </div>
                以 {demo.displayName} 身份登入
              </Button>
            ))}
          </div>
        )}
        <p className="text-xs text-center text-gray-400 mt-4">
          登入即代表您同意 SplitGo 使用條款與隱私政策
        </p>
      </div>
    </div>
  );
}
