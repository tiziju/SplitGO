"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatCurrency } from "@/lib/utils";
import { Plus, LogOut, Users, ChevronRight } from "lucide-react";
import Image from "next/image";

interface Group {
  id: string; name: string; icon: string; baseCurrency: string; inviteCode: string;
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
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroups();
  }, [user, userLoading, router, fetchGroups]);

  const createGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    setSubmitting(true);
    const res = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newGroupName.trim(), baseCurrency: newGroupCurrency, icon: newGroupIcon, createdById: user.id }) });
    const group = await res.json();
    setShowCreate(false); setNewGroupName(""); setSubmitting(false);
    router.push(`/groups/${group.id}`);
  };

  const joinGroup = async () => {
    if (!inviteCode.trim() || !user) return;
    setSubmitting(true);
    const res = await fetch("/api/groups/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteCode: inviteCode.trim().toUpperCase(), userId: user.id }) });
    if (res.ok) {
      const data = await res.json(); setShowJoin(false); setInviteCode(""); setSubmitting(false);
      router.push(`/groups/${data.groupId}`);
    } else { alert("找不到此邀請碼"); setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">
      {/* TopBar */}
      <header className="topbar sticky top-0 z-10">
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#3A4070] flex-shrink-0">
          <Image src="/appicon.png" alt="SplitGo" width={32} height={32} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1">
          <h1 className="text-[17px] font-semibold text-white">SplitGo</h1>
          <p className="text-[#A0A8CC] text-[12px]">{user?.displayName}</p>
        </div>
        <button onClick={() => { setUser(null); router.replace("/login"); }} className="btn-ghost">
          <LogOut className="w-5 h-5 text-[#A0A8CC]" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 pb-32">
        <p className="section-header">我的群組</p>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 bg-[#7B5EA7]/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-[#7B5EA7]" />
            </div>
            <p className="text-[#1A1D2E] font-semibold text-[17px]">尚無分帳群組</p>
            <p className="text-[#8A90B0] text-[15px] text-center">建立新群組或輸入邀請碼<br />加入朋友的群組</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <button key={g.id} onClick={() => router.push(`/groups/${g.id}`)}
                className="card w-full text-left flex items-center gap-3 active:scale-[0.98] transition-transform">
                {/* Group icon */}
                <div className="w-12 h-12 rounded-ds-md bg-[#7B5EA7]/10 flex items-center justify-center flex-shrink-0 text-2xl">
                  {g.icon ?? "✈️"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1D2E] text-[15px] truncate">{g.name}</p>
                  <p className="text-[#8A90B0] text-[13px] mt-0.5">{g.members.length} 位成員 · {g._count.expenses} 筆記帳 · {g.baseCurrency}</p>
                  {/* Member avatars */}
                  <div className="flex -space-x-1.5 mt-2">
                    {g.members.slice(0, 5).map((m) => (
                      <Avatar key={m.user.id} name={m.user.displayName} src={m.user.avatarUrl} size="sm" className="ring-2 ring-white" />
                    ))}
                    {g.members.length > 5 && (
                      <div className="w-7 h-7 bg-[#F0F1F7] rounded-full ring-2 ring-white flex items-center justify-center text-[11px] text-[#8A90B0] font-medium">+{g.members.length - 5}</div>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#8A90B0] flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F5F6FA] border-t border-[#E8E9F3] px-5 py-4 grid grid-cols-2 gap-3">
        <button onClick={() => setShowJoin(true)} className="btn-secondary py-3.5 text-[15px]">加入群組</button>
        <button onClick={() => setShowCreate(true)} className="btn-primary py-3.5 text-[15px] flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> 建立群組
        </button>
      </div>

      {/* Create group */}
      <BottomSheet open={showCreate} onClose={() => setShowCreate(false)} title="建立分帳群組">
        <div className="space-y-4">
          <div>
            <label className="label">群組圖示</label>
            <div className="flex flex-wrap gap-2">
              {["✈️","🏖️","🗾","🗺️","🏔️","🎌","🌏","🚢","🍜","🍣","🏠","💼","👨‍👩‍👧‍👦","🎉","💰","🛍️","🎮","⚽","🎵","🏕️"].map((e) => (
                <button key={e} type="button" onClick={() => setNewGroupIcon(e)}
                  className={`w-10 h-10 rounded-ds-sm text-xl flex items-center justify-center transition-all ${newGroupIcon === e ? "bg-[#FFE8EC] ring-2 ring-[#FF4B6E] scale-110" : "bg-[#F0F1F7]"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">群組名稱</label>
            <input className="input-field" placeholder="例：韓國旅遊 2026" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} maxLength={40} />
          </div>
          <div>
            <label className="label">結算幣別</label>
            <select className="input-field" value={newGroupCurrency} onChange={(e) => setNewGroupCurrency(e.target.value)}>
              {["TWD","USD","JPY","EUR","KRW","HKD","SGD","THB"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={createGroup} disabled={!newGroupName.trim() || submitting} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {submitting ? "建立中..." : "建立群組"}
          </button>
        </div>
      </BottomSheet>

      {/* Join group */}
      <BottomSheet open={showJoin} onClose={() => setShowJoin(false)} title="加入群組">
        <div className="space-y-4">
          <div>
            <label className="label">邀請碼</label>
            <input className="input-field text-center text-2xl font-bold tracking-[0.4em] uppercase" placeholder="XXXXXX"
              value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} maxLength={8} />
          </div>
          <button onClick={joinGroup} disabled={inviteCode.length < 4 || submitting} className="btn-primary w-full py-3.5 disabled:opacity-50">
            {submitting ? "加入中..." : "加入群組"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
