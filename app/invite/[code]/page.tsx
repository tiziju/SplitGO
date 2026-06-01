"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/Button";
import { Users } from "lucide-react";

export default function InvitePage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const { user } = useUser();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      sessionStorage.setItem("pendingInvite", code);
      router.replace("/login");
    }
  }, [user, code, router]);

  const join = async () => {
    if (!user) return;
    setJoining(true);
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code, userId: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      router.replace(`/groups/${data.groupId}`);
    } else {
      setError("找不到此邀請碼，可能已過期或無效。");
      setJoining(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 text-center">
      <div className="w-16 h-16 bg-line-green/10 rounded-2xl flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-line-green" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">收到分帳邀請</h1>
      <p className="text-gray-500 text-sm mb-2">邀請碼：{code}</p>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <Button onClick={join} loading={joining} className="mt-4 w-full max-w-xs">
        加入群組
      </Button>
    </div>
  );
}
