"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { Plus, LogOut, Receipt } from "lucide-react";
import Image from "next/image";

interface Group {
  id: string;
  name: string;
  icon: string;
  baseCurrency: string;
  inviteCode: string;
  members: { user: { id: string; displayName: string; avatarUrl?: string } }[];
  _count: { expenses: number };
}

export default function GroupsPage() {
  const { user, setUser, loading: userLoading } = useUser();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCurrency, setNewGroupCurrency] = useState("TWD");
  const [newGroupIcon, setNewGroupIcon] = useState("✈️");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    const res = await fetch(`/api/groups?userId=${user.id}`);
    const data = await res.json();
    setGroups(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (userLoading) return; // 等 localStorage 讀完再判斷
    if (!user) { router.replace("/login"); return; }
    fetchGroups();
  }, [user, userLoading, router, fetchGroups]);

  const createGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    setSubmitting(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim(), baseCurrency: newGroupCurrency, icon: newGroupIcon, createdById: user.id }),
    });
    const group = await res.json();
    setShowCreate(false);
    setNewGroupName("");
    router.push(`/groups/${group.id}`);
  };

  const joinGroup = async () => {
    if (!inviteCode.trim() || !user) return;
    setSubmitting(true);
    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase(), userId: user.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setShowJoin(false);
      setInviteCode("");
      router.push(`/groups/${data.groupId}`);
    } else {
      alert("找不到此邀請碼，請確認後重試");
      setSubmitting(false);
    }
  };

  const logout = () => {
    setUser(null);
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-line-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden">
            <Image src="/appicon.png" alt="SplitGo" width={32} height={32} className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-base">SplitGo</h1>
            <p className="text-xs text-gray-500">{user?.displayName}</p>
          </div>
        </div>
        <button onClick={logout} className="p-2 rounded-full hover:bg-gray-100">
          <LogOut className="w-5 h-5 text-gray-400" />
        </button>
      </header>

      {/* Group list */}
      <main className="flex-1 px-4 py-4 space-y-3">
        <h2 className="text-sm font-medium text-gray-500">我的群組</h2>

        {groups.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="尚無分帳群組"
            description="建立新群組或輸入邀請碼加入朋友的群組"
          />
        ) : (
          groups.map((g) => (
            <button
              key={g.id}
              onClick={() => router.push(`/groups/${g.id}`)}
              className="card w-full text-left flex items-center gap-3 hover:border-line-green/30 transition-colors"
            >
              <div className="w-12 h-12 bg-line-green/10 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl">
                {g.icon ?? g.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{g.name}</p>
                <p className="text-xs text-gray-500">
                  {g.members.length} 位成員 · {g._count.expenses} 筆記帳 · {g.baseCurrency}
                </p>
                <div className="flex -space-x-1.5 mt-1.5">
                  {g.members.slice(0, 5).map((m) => (
                    <Avatar key={m.user.id} name={m.user.displayName} src={m.user.avatarUrl} size="sm" className="ring-2 ring-white" />
                  ))}
                  {g.members.length > 5 && (
                    <div className="w-8 h-8 bg-gray-100 rounded-full ring-2 ring-white flex items-center justify-center text-xs text-gray-500">
                      +{g.members.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </main>

      {/* Bottom action buttons */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setShowJoin(true)}>
          加入群組
        </Button>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> 建立群組
        </Button>
      </div>

      {/* Create group sheet */}
      <BottomSheet open={showCreate} onClose={() => setShowCreate(false)} title="建立分帳群組">
        <div className="space-y-4">
          <div>
            <label className="label">群組圖示</label>
            <div className="flex flex-wrap gap-2">
              {["✈️","🏖️","🗾","🗺️","🏔️","🎌","🌏","🚢","🍜","🍣","🏠","💼","👨‍👩‍👧‍👦","🎉","💰","🛍️","🎮","⚽","🎵","🏕️"].map((emoji) => (
                <button key={emoji} type="button" onClick={() => setNewGroupIcon(emoji)}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-all ${newGroupIcon === emoji ? "border-line-green bg-line-green/10 scale-110" : "border-gray-100 bg-gray-50"}`}>
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">群組名稱</label>
            <input
              className="input-field"
              placeholder="例：日本旅遊 2026"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <label className="label">基準幣別</label>
            <select
              className="input-field"
              value={newGroupCurrency}
              onChange={(e) => setNewGroupCurrency(e.target.value)}
            >
              {["TWD", "USD", "JPY", "EUR", "KRW", "HKD", "SGD", "THB"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={createGroup}
            loading={submitting}
            disabled={!newGroupName.trim()}
            className="w-full"
          >
            建立群組
          </Button>
        </div>
      </BottomSheet>

      {/* Join group sheet */}
      <BottomSheet open={showJoin} onClose={() => setShowJoin(false)} title="加入群組">
        <div className="space-y-4">
          <div>
            <label className="label">邀請碼</label>
            <input
              className="input-field uppercase tracking-widest text-center text-lg font-bold"
              placeholder="XXXXXX"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
          </div>
          <Button
            onClick={joinGroup}
            loading={submitting}
            disabled={inviteCode.length < 4}
            className="w-full"
          >
            加入群組
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
