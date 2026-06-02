"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, Copy, Check, Calculator, Receipt,
  TrendingUp, TrendingDown, Minus, Settings,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  餐飲: "#FF6B6B", 交通: "#4ECDC4", 住宿: "#45B7D1", 購物: "#96CEB4",
  娛樂: "#FFEAA7", 其他: "#DDA0DD",
};
const DEFAULT_COLOR = "#B0BEC5";
type Period = "week" | "month" | "year" | "all";
const PERIOD_LABELS: Record<Period, string> = { week: "本週", month: "本月", year: "今年", all: "全部時間" };

interface User { id: string; displayName: string; avatarUrl?: string | null; }
interface Split { userId: string; amountBase: number; user: User; }
interface Payment { userId: string; amount: number; amountBase: number; user: User; }
interface Expense {
  id: string; title: string; amount: number; currency: string;
  fxRate: number; amountBase: number; payments: Payment[];
  splitType: string; category?: string | null; splits: Split[];
  date?: string | null; createdAt: string;
}
interface Settlement {
  id: string; fromUser: User; toUser: User; amountBase: number;
  currency: string; status: "PENDING" | "DONE"; settledAt?: string | null; createdAt: string;
}
interface Balance { userId: string; displayName: string; avatarUrl?: string | null; net: number; }
interface Group {
  id: string; name: string; icon: string; baseCurrency: string;
  inviteCode: string; members: { user: User }[];
  expenses: Expense[]; settlements: Settlement[]; balances: Balance[];
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

  // Stats state
  const [period, setPeriod] = useState<Period>("all");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [statsView, setStatsView] = useState<"category" | "member">("category");

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (res.ok) {
      const data = await res.json();
      setGroup(data);
      setSettleCurrency((prev) => prev || data.baseCurrency);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroup();
  }, [user, userLoading, router, fetchGroup]);

  // Stats
  const filteredExpenses = useMemo(() => group ? filterByPeriod(group.expenses, period) : [], [group, period]);
  const totalBase = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amountBase, 0), [filteredExpenses]);
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filteredExpenses) { const cat = e.category ?? "其他"; map.set(cat, (map.get(cat) ?? 0) + e.amountBase); }
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount, pct: totalBase > 0 ? (amount / totalBase) * 100 : 0 })).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, totalBase]);
  const memberStats = useMemo(() => {
    if (!group) return [];
    const map = new Map<string, { name: string; avatarUrl?: string | null; paid: number; owed: number }>();
    for (const m of group.members) map.set(m.user.id, { name: m.user.displayName, avatarUrl: m.user.avatarUrl, paid: 0, owed: 0 });
    for (const e of filteredExpenses) {
      for (const p of e.payments) { const s = map.get(p.userId); if (s) s.paid += p.amountBase; }
      for (const sp of e.splits) { const s = map.get(sp.userId); if (s) s.owed += sp.amountBase; }
    }
    return Array.from(map.values()).sort((a, b) => b.owed - a.owed);
  }, [filteredExpenses, group]);
  const pieSlices = useMemo(() => {
    if (categoryStats.length === 0) return [];
    let angle = -90;
    return categoryStats.map((c) => {
      const sweep = (c.pct / 100) * 360; const start = angle; angle += sweep;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const r = 80; const cx = 100; const cy = 100;
      const x1 = cx + r * Math.cos(toRad(start)); const y1 = cy + r * Math.sin(toRad(start));
      const x2 = cx + r * Math.cos(toRad(start + sweep)); const y2 = cy + r * Math.sin(toRad(start + sweep));
      const large = sweep > 180 ? 1 : 0;
      const path = sweep >= 359.9 ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z` : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { ...c, path, color: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR };
    });
  }, [categoryStats]);

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/invite/${group?.inviteCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const settle = async () => {
    if (!confirm("確定要重新計算結算清單嗎？")) return;
    setSettling(true);
    await fetch("/api/settlements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId }) });
    await fetchGroup();
    setSettling(false);
  };

  const markSettlement = async (id: string, status: "DONE" | "PENDING") => {
    await fetch(`/api/settlements/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await fetchGroup();
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("確定要刪除這筆消費嗎？")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await fetchGroup();
  };

  const copyTextSummary = () => {
    if (!group) return;
    const pending = group.settlements.filter((s) => s.status === "PENDING");
    const lines = [`💰 ${group.name} 結算清單`, "", ...pending.map((s) => `・${s.fromUser.displayName} → ${s.toUser.displayName}：${s.amountBase.toLocaleString()} ${s.currency}`)];
    navigator.clipboard.writeText(lines.join("\n"));
    alert("已複製結算清單到剪貼簿");
  };

  if (loading || !group) {
    return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-line-green border-t-transparent rounded-full animate-spin" /></div>;
  }

  const myBalance = group.balances.find((b) => b.userId === user?.id);
  const pendingSettlements = group.settlements.filter((s) => s.status === "PENDING");
  const doneSettlements = group.settlements.filter((s) => s.status === "DONE");
  const maxAbsNet = Math.max(...group.balances.map((b) => Math.abs(b.net)), 0.01);

  // 消費紀錄 + 已完成結算合併，按日期排序
  const expenseItems: ({ type: "expense" } & Expense)[] = group.expenses.map((e) => ({ type: "expense" as const, ...e }));
  const doneSettleItems: ({ type: "settlement" } & Settlement)[] = doneSettlements.map((s) => ({ type: "settlement" as const, ...s }));
  const allItems = [...expenseItems, ...doneSettleItems].sort(
    (a, b) => new Date(b.type === "expense" ? (b.date ?? b.createdAt) : b.createdAt).getTime()
           - new Date(a.type === "expense" ? (a.date ?? a.createdAt) : a.createdAt).getTime()
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-gray-100"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
          <span className="text-2xl">{group.icon ?? "✈️"}</span>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{group.name}</h1>
            <p className="text-xs text-gray-500">{group.members.length} 位成員 · {group.baseCurrency}</p>
          </div>
          <button onClick={() => router.push(`/groups/${groupId}/settings`)} className="p-1.5 rounded-full hover:bg-gray-100"><Settings className="w-5 h-5 text-gray-500" /></button>
          <button onClick={copyInviteLink} className="flex items-center gap-1.5 text-xs bg-line-green/10 text-line-green px-3 py-1.5 rounded-full font-medium">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "已複製" : group.inviteCode}
          </button>
        </div>
        {myBalance && (
          <div className={`mt-3 rounded-xl p-3 flex items-center gap-2 ${myBalance.net > 0 ? "bg-green-50" : myBalance.net < 0 ? "bg-red-50" : "bg-gray-50"}`}>
            {myBalance.net > 0 ? <TrendingUp className="w-4 h-4 text-green-600" /> : myBalance.net < 0 ? <TrendingDown className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4 text-gray-500" />}
            <p className={`text-sm font-medium ${myBalance.net > 0 ? "text-green-700" : myBalance.net < 0 ? "text-red-600" : "text-gray-600"}`}>
              {myBalance.net > 0 ? `別人欠你 ${formatCurrency(myBalance.net, group.baseCurrency)}` : myBalance.net < 0 ? `你欠別人 ${formatCurrency(Math.abs(myBalance.net), group.baseCurrency)}` : "帳款已結清"}
            </p>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex">
        {(["expenses", "settle", "stats"] as const).map((t) => {
          const labels = { expenses: "消費紀錄", settle: "結算", stats: "統計" };
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-line-green text-line-green" : "border-transparent text-gray-500"}`}>
              {labels[t]}
            </button>
          );
        })}
      </div>

      <main className="flex-1 overflow-auto px-4 py-4 space-y-3">

        {/* ── 消費紀錄（含已完成結算）── */}
        {tab === "expenses" && (
          <>
            {allItems.length === 0 ? (
              <EmptyState icon={Receipt} title="尚無消費紀錄" description="點擊下方按鈕新增第一筆消費" />
            ) : allItems.map((item) => {
              if (item.type === "settlement") {
                return (
                  <div key={`s-${item.id}`} className="card bg-green-50 border border-green-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">💸</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          <span className="text-red-500">{item.fromUser.displayName}</span>
                          {" 還款給 "}
                          <span className="text-green-600">{item.toUser.displayName}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          已還清 · {new Date(item.settledAt ?? item.createdAt).toLocaleDateString("zh-TW")}
                        </p>
                      </div>
                      <p className="font-bold text-green-600">{formatCurrency(item.amountBase, item.currency)}</p>
                    </div>
                  </div>
                );
              }
              const e = item;
              return (
                <div key={`e-${e.id}`} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">{categoryEmoji(e.category)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{e.title}</p>
                        <CategoryBadge category={e.category} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {e.payments.length === 1 ? `${e.payments[0].user.displayName} 付款` : `${e.payments.map((p) => p.user.displayName).join("、")} 共同付款`}{" · "}
                        {new Date(e.date ?? e.createdAt).toLocaleDateString("zh-TW")}
                      </p>
                      {e.currency !== group.baseCurrency && <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(e.amount, e.currency)} × {e.fxRate} ≈</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCurrency(e.amountBase, group.baseCurrency)}</p>
                      <div className="flex gap-3 mt-1 justify-end">
                        <button onClick={() => router.push(`/groups/${groupId}/expenses/${e.id}/edit`)} className="text-xs text-line-green">編輯</button>
                        <button onClick={() => deleteExpense(e.id)} className="text-xs text-red-400">刪除</button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
                    {e.splits.map((s) => (
                      <div key={s.userId} className="flex items-center gap-1 bg-gray-50 rounded-full px-2 py-1">
                        <Avatar name={s.user.displayName} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs text-gray-600">{s.user.displayName}</span>
                        <span className="text-xs font-medium text-gray-800">{formatCurrency(s.amountBase, group.baseCurrency)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── 結算（餘額長條圖 + 結算清單）── */}
        {tab === "settle" && (
          <>
            {/* 幣別切換 */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">餘額總覽</p>
              <select className="text-sm border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
                value={settleCurrency} onChange={(e) => setSettleCurrency(e.target.value)}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* 餘額長條圖 */}
            <div className="card space-y-2 overflow-hidden">
              <p className="text-xs text-gray-400 mb-3">左側為應付（-），右側為應收（+）</p>
              {group.balances.map((b) => {
                const pct = Math.abs(b.net) / maxAbsNet * 100;
                const isPos = b.net > 0.01;
                const isNeg = b.net < -0.01;
                return (
                  <div key={b.userId} className="flex items-center gap-2">
                    {/* 左側（負值）*/}
                    <div className="flex-1 flex justify-end">
                      {isNeg && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-red-500 whitespace-nowrap">
                            -{formatCurrency(Math.abs(b.net), group.baseCurrency)}
                          </span>
                          <div className="h-8 rounded-l-lg bg-red-400" style={{ width: `${pct * 0.8}%`, minWidth: "8px" }} />
                        </div>
                      )}
                    </div>

                    {/* 頭像 + 名字 */}
                    <div className="flex flex-col items-center gap-0.5 w-16 flex-shrink-0">
                      <Avatar name={b.displayName} src={(b as Balance & { avatarUrl?: string | null }).avatarUrl} size="sm" />
                      <span className="text-xs text-gray-600 truncate w-full text-center">{b.displayName}</span>
                    </div>

                    {/* 右側（正值）*/}
                    <div className="flex-1 flex justify-start">
                      {isPos && (
                        <div className="flex items-center gap-2">
                          <div className="h-8 rounded-r-lg bg-line-green" style={{ width: `${pct * 0.8}%`, minWidth: "8px" }} />
                          <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                            +{formatCurrency(b.net, group.baseCurrency)}
                          </span>
                        </div>
                      )}
                      {!isPos && !isNeg && <span className="text-xs text-gray-400">結清</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 結算按鈕 */}
            <Button variant="secondary" onClick={settle} loading={settling} className="w-full">
              <Calculator className="w-4 h-4" /> 重新計算結算清單
            </Button>

            {/* 結算清單 */}
            {pendingSettlements.length === 0 && doneSettlements.length === 0 ? (
              <EmptyState icon={Calculator} title="尚未結算" description="點擊上方按鈕產生最少交易還款清單" />
            ) : (
              <>
                {pendingSettlements.length > 0 && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">待還款</h3>
                    <button onClick={copyTextSummary} className="text-xs text-line-green font-medium">複製摘要</button>
                  </div>
                )}
                {group.settlements.map((s) => (
                  <div key={s.id} className={`card flex items-center gap-3 ${s.status === "DONE" ? "opacity-60" : ""}`}>
                    <Avatar name={s.fromUser.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-red-500">{s.fromUser.displayName}</span>{" → "}<span className="text-green-600">{s.toUser.displayName}</span>
                      </p>
                      <p className="font-bold text-gray-900">{formatCurrency(s.amountBase, s.currency)}</p>
                      {s.settledAt && <p className="text-xs text-gray-400">已還清 {new Date(s.settledAt).toLocaleDateString("zh-TW")}</p>}
                    </div>
                    <button onClick={() => markSettlement(s.id, s.status === "DONE" ? "PENDING" : "DONE")}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${s.status === "DONE" ? "bg-line-green border-line-green" : "border-gray-300"}`}>
                      {s.status === "DONE" && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── 統計 ── */}
        {tab === "stats" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{filteredExpenses.length} 筆消費</p>
              <div className="relative">
                <button onClick={() => setShowPeriodMenu((v) => !v)}
                  className="text-sm text-line-green font-medium flex items-center gap-1 bg-line-green/10 px-3 py-1.5 rounded-full">
                  {PERIOD_LABELS[period]} ▾
                </button>
                {showPeriodMenu && (
                  <div className="absolute right-0 top-10 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-20 min-w-[110px]">
                    {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
                      <button key={key} onClick={() => { setPeriod(key); setShowPeriodMenu(false); }}
                        className={cn("w-full px-4 py-2.5 text-sm text-left", period === key ? "bg-line-green/10 text-line-green font-medium" : "text-gray-700")}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <p className="text-xs text-gray-400 mb-1">{group.baseCurrency} · {PERIOD_LABELS[period]}</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalBase, group.baseCurrency)}</p>
            </div>
            <div className="flex bg-white rounded-2xl p-1 border border-gray-100">
              {(["category", "member"] as const).map((mode) => (
                <button key={mode} onClick={() => setStatsView(mode)}
                  className={cn("flex-1 py-2 text-sm font-medium rounded-xl transition-colors", statsView === mode ? "bg-line-green text-white" : "text-gray-500")}>
                  {mode === "category" ? "分類" : "成員"}
                </button>
              ))}
            </div>
            {statsView === "category" && (
              <>
                {pieSlices.length > 0 ? (
                  <div className="card flex items-center gap-4">
                    <svg viewBox="0 0 200 200" className="w-36 h-36 flex-shrink-0">
                      {pieSlices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />)}
                      <circle cx="100" cy="100" r="45" fill="white" />
                      <text x="100" y="96" textAnchor="middle" fontSize="11" fill="#6b7280">總計</text>
                      <text x="100" y="112" textAnchor="middle" fontSize="10" fontWeight="600" fill="#111827">{group.baseCurrency}</text>
                    </svg>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      {pieSlices.slice(0, 5).map((s) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-xs text-gray-600 truncate flex-1">{s.name}</span>
                          <span className="text-xs font-medium text-gray-700">{s.pct.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div className="card text-center text-gray-400 text-sm py-8">此期間無消費紀錄</div>}
                <div className="card space-y-3">
                  {categoryStats.map((c) => (
                    <div key={c.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR }} />
                          <span className="text-sm font-medium text-gray-700">{c.name}</span>
                        </div>
                        <div>
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(c.amount, group.baseCurrency)}</span>
                          <span className="text-xs text-gray-400 ml-2">{c.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {statsView === "member" && (
              <div className="card space-y-3">
                {memberStats.map((m) => (
                  <div key={m.name} className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatarUrl} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{m.name}</p>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-green-600">付出 {formatCurrency(m.paid, group.baseCurrency)}</span>
                        <span className="text-xs text-gray-400">應付 {formatCurrency(m.owed, group.baseCurrency)}</span>
                      </div>
                      {totalBase > 0 && (
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full bg-line-green rounded-full" style={{ width: `${Math.min((m.owed / totalBase) * 100, 100)}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(m.owed, group.baseCurrency)}</p>
                      <p className="text-xs text-gray-400">{totalBase > 0 ? ((m.owed / totalBase) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4">
        <Button onClick={() => router.push(`/groups/${groupId}/expenses/add`)} className="w-full">
          <Plus className="w-4 h-4" /> 新增消費
        </Button>
      </div>
    </div>
  );
}

function categoryEmoji(category?: string | null): string {
  const map: Record<string, string> = { 餐飲: "🍜", 交通: "🚌", 住宿: "🏨", 購物: "🛍️", 娛樂: "🎮", 其他: "📌" };
  return map[category ?? ""] ?? "💰";
}
