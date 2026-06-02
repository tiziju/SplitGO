"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { ArrowLeft, Plus, Copy, Check, Settings, ChevronDown, RotateCcw } from "lucide-react";

/* ── Types ── */
const CATEGORY_COLORS: Record<string, string> = {
  餐飲: "#FF4B6E", 交通: "#4A90D9", 住宿: "#7B5EA7", 購物: "#F5A623",
  娛樂: "#3DBCAA", 其他: "#8A90B0",
};
type Period = "week" | "month" | "year" | "all";
const PERIOD_LABELS: Record<Period, string> = { week: "本週", month: "本月", year: "今年", all: "全部" };
const CATEGORY_EMOJI: Record<string, string> = { 餐飲: "🍜", 交通: "🚌", 住宿: "🏨", 購物: "🛍️", 娛樂: "🎮", 其他: "📌" };

interface User { id: string; displayName: string; avatarUrl?: string | null; }
interface Split { userId: string; amountBase: number; user: User; }
interface Payment { userId: string; amount: number; amountBase: number; user: User; }
interface Expense {
  id: string; title: string; amount: number; currency: string; fxRate: number;
  amountBase: number; payments: Payment[]; splitType: string;
  category?: string | null; splits: Split[]; date?: string | null; createdAt: string;
}
interface Settlement {
  id: string; fromUser: User; toUser: User; amountBase: number;
  currency: string; status: "PENDING" | "DONE"; settledAt?: string | null; createdAt: string;
}
interface Balance { userId: string; displayName: string; avatarUrl?: string | null; net: number; }
interface Group {
  id: string; name: string; icon: string; baseCurrency: string; inviteCode: string;
  members: { user: User }[]; expenses: Expense[]; settlements: Settlement[]; balances: Balance[];
}

function filterByPeriod(expenses: Expense[], period: Period): Expense[] {
  if (period === "all") return expenses;
  const now = new Date(); const start = new Date();
  if (period === "week") start.setDate(now.getDate() - now.getDay());
  if (period === "month") start.setDate(1);
  if (period === "year") { start.setMonth(0); start.setDate(1); }
  start.setHours(0, 0, 0, 0);
  return expenses.filter((e) => new Date(e.date ?? e.createdAt) >= start);
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"expenses" | "settle" | "stats">("expenses");
  const [copied, setCopied] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleCurrency, setSettleCurrency] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [statsView, setStatsView] = useState<"category" | "member">("category");

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (res.ok) { const d = await res.json(); setGroup(d); setSettleCurrency((p) => p || d.baseCurrency); }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroup();
  }, [user, userLoading, router, fetchGroup]);

  /* Stats */
  const filteredExp = useMemo(() => group ? filterByPeriod(group.expenses, period) : [], [group, period]);
  const totalBase = useMemo(() => filteredExp.reduce((s, e) => s + e.amountBase, 0), [filteredExp]);
  const catStats = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of filteredExp) m.set(e.category ?? "其他", (m.get(e.category ?? "其他") ?? 0) + e.amountBase);
    return Array.from(m.entries()).map(([n, a]) => ({ name: n, amount: a, pct: totalBase > 0 ? (a / totalBase) * 100 : 0 })).sort((a, b) => b.amount - a.amount);
  }, [filteredExp, totalBase]);
  const memberStats = useMemo(() => {
    if (!group) return [];
    const m = new Map<string, { name: string; avatarUrl?: string | null; paid: number; owed: number }>();
    for (const mb of group.members) m.set(mb.user.id, { name: mb.user.displayName, avatarUrl: mb.user.avatarUrl, paid: 0, owed: 0 });
    for (const e of filteredExp) {
      for (const p of e.payments) { const s = m.get(p.userId); if (s) s.paid += p.amountBase; }
      for (const sp of e.splits) { const s = m.get(sp.userId); if (s) s.owed += sp.amountBase; }
    }
    return Array.from(m.values()).sort((a, b) => b.owed - a.owed);
  }, [filteredExp, group]);
  const pieSlices = useMemo(() => {
    if (catStats.length === 0) return [];
    let angle = -90;
    return catStats.map((c) => {
      const sweep = (c.pct / 100) * 360; const start = angle; angle += sweep;
      const toRad = (d: number) => (d * Math.PI) / 180;
      const r = 80; const cx = 100; const cy = 100;
      const x1 = cx + r * Math.cos(toRad(start)); const y1 = cy + r * Math.sin(toRad(start));
      const x2 = cx + r * Math.cos(toRad(start + sweep)); const y2 = cy + r * Math.sin(toRad(start + sweep));
      const path = sweep >= 359.9 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z` : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2} Z`;
      return { ...c, path, color: CATEGORY_COLORS[c.name] ?? "#8A90B0" };
    });
  }, [catStats]);

  const copyInviteLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${group?.inviteCode}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const settle = async () => {
    if (!confirm("重新計算結算清單？")) return;
    setSettling(true);
    await fetch("/api/settlements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) });
    await fetchGroup(); setSettling(false);
  };
  // Optimistic: 立即更新畫面，背景打 API
  const markSettlement = (id: string, status: "DONE" | "PENDING") => {
    setGroup((prev) => prev ? {
      ...prev,
      settlements: prev.settlements.map((s) =>
        s.id === id ? { ...s, status, settledAt: status === "DONE" ? new Date().toISOString() : null } : s
      ),
    } : prev);
    fetch(`/api/settlements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      .then(() => fetchGroup()); // 背景同步確保餘額正確
  };
  const deleteExpense = (id: string) => {
    if (!confirm("確定要刪除這筆消費嗎？")) return;
    // 立即從畫面移除
    setGroup((prev) => prev ? { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) } : prev);
    fetch(`/api/expenses/${id}`, { method: "DELETE" }).then(() => fetchGroup());
  };
  const copyTextSummary = () => {
    if (!group) return;
    const lines = [`💰 ${group.name} 結算清單`, "", ...group.settlements.filter(s => s.status === "PENDING").map(s => `・${s.fromUser.displayName} → ${s.toUser.displayName}：${s.amountBase.toLocaleString()} ${s.currency}`)];
    navigator.clipboard.writeText(lines.join("\n")); alert("已複製結算清單");
  };

  if (loading || !group) return (
    <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const myBalance = group.balances.find((b) => b.userId === user?.id);
  const pendingSettlements = group.settlements.filter((s) => s.status === "PENDING");
  const doneSettlements = group.settlements.filter((s) => s.status === "DONE");
  const maxAbsNet = Math.max(...group.balances.map((b) => Math.abs(b.net)), 0.01);

  const allItems = [
    ...group.expenses.map((e) => ({ type: "expense" as const, ...e })),
    ...doneSettlements.map((s) => ({ type: "settlement" as const, ...s })),
  ].sort((a, b) =>
    new Date(b.type === "expense" ? (b.date ?? b.createdAt) : b.createdAt).getTime() -
    new Date(a.type === "expense" ? (a.date ?? a.createdAt) : a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col">

      {/* ── TopBar ── */}
      <header className="bg-[#1E2340] sticky top-0 z-10">
        <div className="topbar">
          <button onClick={() => router.back()} className="btn-ghost flex-shrink-0"><ArrowLeft className="w-5 h-5 text-[#A0A8CC]" /></button>
          <span className="text-xl flex-shrink-0">{group.icon ?? "✈️"}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold text-white truncate">{group.name}</h1>
            <p className="text-[#A0A8CC] text-[12px]">{group.members.length} 位成員 · {group.baseCurrency}</p>
          </div>
          <button onClick={() => router.push(`/groups/${groupId}/settings`)} className="btn-ghost flex-shrink-0"><Settings className="w-5 h-5 text-[#A0A8CC]" /></button>
          <button onClick={copyInviteLink} className="flex items-center gap-1.5 bg-[#2A3060] border border-[#3A4070] rounded-full px-3 py-1.5 flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-[#3DBCAA]" /> : <Copy className="w-3.5 h-3.5 text-[#A0A8CC]" />}
            <span className="text-[#A0A8CC] text-[12px]">{copied ? "已複製" : group.inviteCode}</span>
          </button>
        </div>

        {/* My balance */}
        {myBalance && (
          <div className="px-5 pb-3">
            <div className={cn("rounded-ds-md px-4 py-2.5 flex items-center justify-between", myBalance.net > 0 ? "bg-[#3DBCAA]/15" : myBalance.net < 0 ? "bg-[#FF4B6E]/15" : "bg-white/10")}>
              <span className="text-[#A0A8CC] text-[13px]">我的餘額</span>
              <span className={cn("font-semibold text-[15px]", myBalance.net > 0 ? "text-[#3DBCAA]" : myBalance.net < 0 ? "text-[#FF4B6E]" : "text-[#A0A8CC]")}>
                {myBalance.net > 0 ? `+${formatCurrency(myBalance.net, group.baseCurrency)} 應收` : myBalance.net < 0 ? `${formatCurrency(myBalance.net, group.baseCurrency)} 應付` : "帳款結清 ✓"}
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-t border-[#3A4070]">
          {(["expenses", "settle", "stats"] as const).map((t) => {
            const labels = { expenses: "消費紀錄", settle: "結算", stats: "統計" };
            return (
              <button key={t} onClick={() => setTab(t)}
                className={cn("flex-1 py-3 text-[13px] font-medium transition-colors border-b-2",
                  tab === t ? "text-white border-[#FF4B6E]" : "text-[#A0A8CC] border-transparent hover:text-white")}>
                {labels[t]}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-5 py-4 space-y-3 pb-28">

        {/* ══ 消費紀錄 ══ */}
        {tab === "expenses" && (
          allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 bg-[#FF4B6E]/10 rounded-full flex items-center justify-center text-3xl">🧾</div>
              <p className="text-[#1A1D2E] font-semibold text-[17px]">尚無消費紀錄</p>
              <p className="text-[#8A90B0] text-[15px]">點擊下方按鈕新增第一筆消費</p>
            </div>
          ) : allItems.map((item) => {
            if (item.type === "settlement") return (
              <div key={`s-${item.id}`} className="card flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#3DBCAA]/15 flex items-center justify-center flex-shrink-0 text-xl">💸</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1A1D2E] text-[15px]">
                    <span className="text-[#FF4B6E]">{item.fromUser.displayName}</span>
                    <span className="text-[#8A90B0] mx-1.5">→</span>
                    <span>{item.toUser.displayName}</span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="chip-settled">還款完成</span>
                    <span className="text-[#8A90B0] text-[12px]">{new Date(item.settledAt ?? item.createdAt).toLocaleDateString("zh-TW")}</span>
                  </div>
                </div>
                <p className="font-semibold text-[#3DBCAA] text-[15px]">{formatCurrency(item.amountBase, item.currency)}</p>
              </div>
            );

            const e = item;
            const catColor = CATEGORY_COLORS[e.category ?? ""] ?? "#8A90B0";
            return (
              <div key={`e-${e.id}`} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-ds-md flex items-center justify-center flex-shrink-0 text-xl" style={{ backgroundColor: catColor + "20" }}>
                    {CATEGORY_EMOJI[e.category ?? ""] ?? "💰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1A1D2E] text-[15px] truncate">{e.title}</p>
                    <p className="text-[#8A90B0] text-[13px] mt-0.5">
                      {e.payments.length === 1 ? `${e.payments[0].user.displayName} 付款` : `${e.payments.map(p => p.user.displayName).join("、")} 付款`}
                      {" · "}{new Date(e.date ?? e.createdAt).toLocaleDateString("zh-TW")}
                    </p>
                    {e.currency !== group.baseCurrency && <p className="text-[#8A90B0] text-[12px] mt-0.5">{formatCurrency(e.amount, e.currency)} × {e.fxRate.toFixed(4)}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-[#1A1D2E] text-[15px]">{formatCurrency(e.amountBase, group.baseCurrency)}</p>
                    <div className="flex gap-1.5 justify-end mt-1">
                      <button onClick={() => router.push(`/groups/${groupId}/expenses/${e.id}/edit`)}
                        className="w-8 h-8 rounded-full bg-[#F0F1F7] flex items-center justify-center hover:bg-[#FFE8EC] transition-colors">
                        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-[#8A90B0]" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteExpense(e.id)}
                        className="w-8 h-8 rounded-full bg-[#F0F1F7] flex items-center justify-center hover:bg-[#FFE8EC] transition-colors">
                        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-[#8A90B0]" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#E8E9F3] flex flex-wrap gap-1.5">
                  {e.splits.map((s) => (
                    <div key={s.userId} className="flex items-center gap-1.5 bg-[#F0F1F7] rounded-full px-2.5 py-1">
                      <Avatar name={s.user.displayName} size="sm" className="w-5 h-5 text-[10px]" />
                      <span className="text-[#1A1D2E] text-[12px] font-medium">{s.user.displayName}</span>
                      <span className="text-[#8A90B0] text-[12px]">{formatCurrency(s.amountBase, group.baseCurrency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* ══ 結算 ══ */}
        {tab === "settle" && (
          <>
            {/* Currency selector */}
            <div className="card flex items-center justify-between">
              <span className="text-[#8A90B0] text-[13px] font-medium">顯示幣別</span>
              <select className="bg-[#F0F1F7] rounded-ds-sm px-3 py-1.5 text-[13px] font-semibold text-[#1A1D2E] border-none focus:outline-none"
                value={settleCurrency} onChange={(e) => setSettleCurrency(e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Balance bar chart */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <p className="font-semibold text-[#1A1D2E] text-[15px]">餘額總覽</p>
                <span className="text-[#8A90B0] text-[12px]">{group.baseCurrency}</span>
              </div>
              <div className="space-y-3">
                {group.balances.map((b) => {
                  const pct = (Math.abs(b.net) / maxAbsNet) * 45;
                  const isPos = b.net > 0.01; const isNeg = b.net < -0.01;
                  return (
                    <div key={b.userId} className="flex items-center gap-2">
                      <div className="flex-1 flex justify-end items-center gap-2">
                        {isNeg && (
                          <>
                            <span className="text-[#FF4B6E] text-[13px] font-semibold whitespace-nowrap">{formatCurrency(Math.abs(b.net), group.baseCurrency)}</span>
                            <div className="h-7 rounded-l-full bg-[#FF4B6E]" style={{ width: `${pct}%`, minWidth: 10 }} />
                          </>
                        )}
                      </div>
                      <Avatar name={b.displayName} src={(b as Balance & { avatarUrl?: string | null }).avatarUrl} size="sm" className="flex-shrink-0 ring-2 ring-white" style={{ boxShadow: "var(--shadow-sm)" }} />
                      <div className="flex-1 flex items-center gap-2">
                        {isPos && (
                          <>
                            <div className="h-7 rounded-r-full bg-[#3DBCAA]" style={{ width: `${pct}%`, minWidth: 10 }} />
                            <span className="text-[#3DBCAA] text-[13px] font-semibold whitespace-nowrap">+{formatCurrency(b.net, group.baseCurrency)}</span>
                          </>
                        )}
                        {!isPos && !isNeg && <span className="chip-settled">結清</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[#8A90B0] text-[12px] text-center mt-3">紅色 = 應付，綠色 = 應收</p>
            </div>

            {/* Recalculate */}
            <button onClick={settle} disabled={settling}
              className="w-full btn-secondary py-3.5 flex items-center justify-center gap-2 disabled:opacity-60">
              <RotateCcw className="w-4 h-4" /> {settling ? "計算中..." : "重新計算結算清單"}
            </button>

            {/* Settlement list */}
            {pendingSettlements.length === 0 && doneSettlements.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-[#1A1D2E] font-semibold text-[17px]">尚未結算</p>
                <p className="text-[#8A90B0] text-[15px] mt-1">點擊上方按鈕產生最少轉帳清單</p>
              </div>
            ) : (
              <>
                {pendingSettlements.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="section-header pt-0">待還款</p>
                    <button onClick={copyTextSummary} className="text-[#FF4B6E] text-[13px] font-medium">複製摘要</button>
                  </div>
                )}
                {group.settlements.map((s) => (
                  <div key={s.id} className={cn("card flex items-center gap-3", s.status === "DONE" && "opacity-50")}>
                    <Avatar name={s.fromUser.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#1A1D2E] text-[15px]">
                        <span className="text-[#FF4B6E]">{s.fromUser.displayName}</span>
                        <span className="text-[#8A90B0] mx-1.5">→</span>
                        <span>{s.toUser.displayName}</span>
                      </p>
                      <p className="font-semibold text-[#1A1D2E] text-[17px] mt-0.5">{formatCurrency(s.amountBase, s.currency)}</p>
                      {s.settledAt && <p className="text-[#8A90B0] text-[12px]">已還清 {new Date(s.settledAt).toLocaleDateString("zh-TW")}</p>}
                    </div>
                    <button onClick={() => markSettlement(s.id, s.status === "DONE" ? "PENDING" : "DONE")}
                      className={cn("w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        s.status === "DONE" ? "bg-[#3DBCAA] border-[#3DBCAA]" : "border-[#E8E9F3] bg-white")}>
                      {s.status === "DONE" && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ══ 統計 ══ */}
        {tab === "stats" && (
          <div className="space-y-3">
            {/* Period filter */}
            <div className="flex items-center justify-between">
              <p className="text-[#8A90B0] text-[13px]">{filteredExp.length} 筆消費</p>
              <div className="relative">
                <button onClick={() => setShowPeriodMenu((v) => !v)}
                  className="flex items-center gap-1.5 bg-white border border-[#E8E9F3] rounded-full px-3 py-1.5 text-[13px] font-medium text-[#1A1D2E]"
                  style={{ boxShadow: "var(--shadow-sm)" }}>
                  {PERIOD_LABELS[period]} <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {showPeriodMenu && (
                  <div className="absolute right-0 top-10 bg-white rounded-ds-md border border-[#E8E9F3] overflow-hidden z-20 min-w-[100px]" style={{ boxShadow: "var(--shadow-md)" }}>
                    {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([k, l]) => (
                      <button key={k} onClick={() => { setPeriod(k); setShowPeriodMenu(false); }}
                        className={cn("w-full px-4 py-2.5 text-[13px] text-left", period === k ? "bg-[#FFE8EC] text-[#FF4B6E] font-medium" : "text-[#1A1D2E] hover:bg-[#F5F6FA]")}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Total */}
            <div className="bg-[#1E2340] rounded-ds-lg p-5">
              <p className="text-[#A0A8CC] text-[13px] mb-1">{group.baseCurrency} · {PERIOD_LABELS[period]}</p>
              <p className="font-bold text-white text-[32px] leading-tight">{formatCurrency(totalBase, group.baseCurrency)}</p>
            </div>

            {/* Toggle */}
            <div className="card p-1 flex gap-1">
              {(["category", "member"] as const).map((m) => (
                <button key={m} onClick={() => setStatsView(m)}
                  className={cn("flex-1 py-2 text-[13px] font-medium rounded-ds-sm transition-colors",
                    statsView === m ? "bg-[#FF4B6E] text-white" : "text-[#8A90B0]")}>
                  {m === "category" ? "分類" : "成員"}
                </button>
              ))}
            </div>

            {statsView === "category" && (
              <>
                {pieSlices.length > 0 && (
                  <div className="card flex items-center gap-4">
                    <svg viewBox="0 0 200 200" className="w-36 h-36 flex-shrink-0">
                      {pieSlices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="2" />)}
                      <circle cx="100" cy="100" r="48" fill="white" />
                      <text x="100" y="97" textAnchor="middle" fontSize="12" fill="#8A90B0">總計</text>
                      <text x="100" y="113" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1A1D2E">{group.baseCurrency}</text>
                    </svg>
                    <div className="flex-1 space-y-2 min-w-0">
                      {pieSlices.slice(0, 5).map((s) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-[#1A1D2E] text-[13px] truncate flex-1">{s.name}</span>
                          <span className="text-[#8A90B0] text-[12px] font-medium">{s.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="card space-y-3">
                  {catStats.length === 0 ? <p className="text-[#8A90B0] text-[15px] text-center py-4">此期間無消費紀錄</p> : catStats.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{CATEGORY_EMOJI[c.name] ?? "📌"}</span>
                          <span className="font-medium text-[#1A1D2E] text-[15px]">{c.name}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[#1A1D2E] text-[15px]">{formatCurrency(c.amount, group.baseCurrency)}</span>
                          <span className="text-[#8A90B0] text-[12px] ml-1.5">{c.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-[#F0F1F7] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, backgroundColor: CATEGORY_COLORS[c.name] ?? "#8A90B0" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {statsView === "member" && (
              <div className="card space-y-4">
                {memberStats.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-[#1A1D2E] text-[15px]">{m.name}</span>
                        <div className="text-right">
                          <span className="font-semibold text-[#1A1D2E] text-[15px]">{formatCurrency(m.owed, group.baseCurrency)}</span>
                          <span className="text-[#8A90B0] text-[12px] ml-1">{totalBase > 0 ? ((m.owed / totalBase) * 100).toFixed(1) : 0}%</span>
                        </div>
                      </div>
                      <div className="flex gap-3 mb-1.5">
                        <span className="text-[#3DBCAA] text-[12px]">付出 {formatCurrency(m.paid, group.baseCurrency)}</span>
                        <span className="text-[#8A90B0] text-[12px]">應付 {formatCurrency(m.owed, group.baseCurrency)}</span>
                      </div>
                      <div className="h-1.5 bg-[#F0F1F7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF4B6E] rounded-full" style={{ width: `${totalBase > 0 ? Math.min((m.owed / totalBase) * 100, 100) : 0}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── FAB ── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-5 py-4 bg-[#F5F6FA] border-t border-[#E8E9F3]">
        <button onClick={() => router.push(`/groups/${groupId}/expenses/add`)}
          className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-[15px]">
          <Plus className="w-5 h-5" /> 新增消費
        </button>
      </div>
    </div>
  );
}
