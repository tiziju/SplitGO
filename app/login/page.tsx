"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import Image from "next/image";

const DEMO_USERS = [
  { lineUserId: "demo_alice", displayName: "Alice", avatarUrl: null },
  { lineUserId: "demo_bob",   displayName: "Bob",   avatarUrl: null },
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

  // 登入後要去哪裡（保留 liff.state 解碼後的路徑）
  const getPostLoginPath = () => {
    try {
      const url = new URL(window.location.href);
      const liffState = url.searchParams.get("liff.state");
      if (liffState) {
        const decoded = decodeURIComponent(liffState);
        // decoded 可能是 /groups?action=create 之類
        return decoded.startsWith("/") ? decoded : "/groups";
      }
    } catch {}
    return "/groups";
  };

  useEffect(() => {
    if (!isLiffEnabled) return;
    if (sessionStorage.getItem("liff_completing")) return;
    const url = new URL(window.location.href);
    const hasLiffState = url.searchParams.has("liff.state") || url.hash.includes("liff.state");
    const hasCode = url.searchParams.has("code");
    if (!hasLiffState && !hasCode) return;
    sessionStorage.setItem("liff_completing", "1");
    setLoading(true);
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liff = (window as any).liff;
        if (!liff) { setLoading(false); sessionStorage.removeItem("liff_completing"); return; }
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { setError("登入失敗，請重試"); setLoading(false); sessionStorage.removeItem("liff_completing"); return; }
        const profile = await liff.getProfile();
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineUserId: profile.userId, displayName: profile.displayName, avatarUrl: profile.pictureUrl ?? null }) });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const destination = getPostLoginPath();
        sessionStorage.removeItem("liff_completing");
        setUser(await res.json());
        router.push(destination);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
        sessionStorage.removeItem("liff_completing");
      }
    })();
  }, []); // eslint-disable-line

  const loginWithLine = async () => {
    setLoading(true); setError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const liff = (window as any).liff;
      if (!liff) throw new Error("LIFF SDK not loaded");
      await Promise.race([liff.init({ liffId: LIFF_ID }), new Promise((_, r) => setTimeout(() => r(new Error("Timeout")), 10000))]);
      if (liff.isLoggedIn()) {
        const profile = await liff.getProfile();
        const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineUserId: profile.userId, displayName: profile.displayName, avatarUrl: profile.pictureUrl ?? null }) });
        if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
        setUser(await res.json()); router.push(getPostLoginPath());
      } else { liff.login({ redirectUri: window.location.href }); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); }
  };

  const loginAsDemo = async (demo: typeof DEMO_USERS[0]) => {
    setLoading(true); setSelectedDemo(demo.lineUserId); setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(demo) });
      if (!res.ok) throw new Error("登入失敗，請確認資料庫已設定");
      setUser(await res.json()); router.push(getPostLoginPath());
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setLoading(false); setSelectedDemo(null); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#1E2340]">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-4 pt-16">
        {/* App icon */}
        <div className="w-20 h-20 rounded-[22px] overflow-hidden mb-6" style={{ boxShadow: "0 8px 32px rgba(30,35,64,0.4)" }}>
          <Image src="/appicon.png" alt="SplitGo" width={80} height={80} className="w-full h-full object-cover" />
        </div>

        <h1 className="text-[32px] font-bold text-white leading-tight mb-2">SplitGo</h1>
        <p className="text-[#A0A8CC] text-[15px] text-center leading-relaxed">
          輕鬆分帳，告別帳務糾紛<br />旅遊・室友・家庭一把罩
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mt-6 justify-center">
          {["多幣別自動換算", "LINE 推播通知", "最少交易結算"].map((f) => (
            <span key={f} className="bg-[#2A3060] text-[#A0A8CC] text-[13px] px-3 py-1.5 rounded-full border border-[#3A4070]">{f}</span>
          ))}
        </div>
      </div>

      {/* Login card */}
      <div className="bg-[#F5F6FA] rounded-t-[28px] px-6 pt-8 pb-10" style={{ boxShadow: "0 -4px 32px rgba(0,0,0,0.2)" }}>
        {error && (
          <div className="mb-4 bg-[#FFE8EC] rounded-ds-md px-4 py-3">
            <p className="text-[#FF4B6E] text-[13px]">{error}</p>
          </div>
        )}

        {isLiffEnabled ? (
          <button onClick={loginWithLine} disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-60">
            <div className="w-5 h-5 bg-white rounded flex items-center justify-center flex-shrink-0">
              <span className="text-[#06C755] font-bold text-xs leading-none">L</span>
            </div>
            {loading ? "登入中..." : "使用 LINE 登入"}
          </button>
        ) : (
          <div className="space-y-2.5">
            <p className="text-[13px] text-center text-[#8A90B0] mb-4">開發模式 — 選擇測試帳號</p>
            {DEMO_USERS.map((demo) => (
              <button key={demo.lineUserId} onClick={() => loginAsDemo(demo)}
                disabled={loading}
                className="w-full flex items-center gap-3 bg-white rounded-ds-lg px-4 py-3.5 text-left border border-[#E8E9F3] active:scale-[0.98] transition-transform disabled:opacity-60"
                style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="w-10 h-10 rounded-full bg-[#7B5EA7] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">{demo.displayName[0]}</span>
                </div>
                <div>
                  <p className="font-semibold text-[#1A1D2E] text-[15px]">{demo.displayName}</p>
                  <p className="text-[#8A90B0] text-[13px]">測試帳號</p>
                </div>
                {loading && selectedDemo === demo.lineUserId && (
                  <div className="ml-auto w-5 h-5 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            ))}
          </div>
        )}
        <p className="text-[12px] text-center text-[#8A90B0] mt-5">登入即代表您同意使用條款與隱私政策</p>
      </div>
    </div>
  );
}
