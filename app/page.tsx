"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";

export default function RootPage() {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user) {
      // 已登入：保留 liff.state 參數轉到 /groups（LIFF 會自動導到目標頁）
      const search = window.location.search;
      router.replace(search ? `/groups${search}` : "/groups");
    } else {
      // 未登入：把所有 LIFF 參數帶到 /login，SDK 才能完成認證
      const search = window.location.search;
      router.replace(search ? `/login${search}` : "/login");
    }
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F5F6FA]">
      <div className="w-8 h-8 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
