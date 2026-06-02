"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Payment { userId: string; amountBase: number; user: { id: string; displayName: string } }
interface Split { userId: string; amountBase: number; user: { id: string; displayName: string } }
interface Expense {
  id: string; title: string; amount: number; currency: string;
  amountBase: number; category?: string | null; date: string; createdAt: string;
  payments: Payment[]; splits: Split[];
}
interface Member { user: { id: string; displayName: string; avatarUrl?: string | null } }
interface Group {
  id: string; name: string; icon: string; baseCurrency: string;
  members: Member[]; expenses: Expense[];
}

type Period = "week" | "month" | "year" | "all";

const CATEGORY_COLORS: Record<string, string> = {
  餐飲: "#FF6B6B", 交通: "#4ECDC4", 住宿: "#45B7D1", 購物: "#96CEB4",
  娛樂: "#FFEAA7", 其他: "#DDA0DD",
};
const DEFAULT_COLOR = "#B0BEC5";

const PERIOD_LABELS: Record<Period, string> = {
  week: "本週", month: "本月", year: "今年", all: "全部時間",
};

function filterByPeriod(expenses: Expense[], period: Period): Expense[] {
  if (period === "all") return expenses;
  const now = new Date();
  const start = new Date();
  if (period === "week") start.setDate(now.getDate() - now.getDay());
  if (period === "month") start.setDate(1);
  if (period === "year") { start.setMonth(0); start.setDate(1); }
  start.setHours(0, 0, 0, 0);
  return expenses.filter((e) => new Date(e.date ?? e.createdAt) >= start);
}

export default function StatsPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [viewMode, setViewMode] = useState<"category" | "member">("category");

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (res.ok) setGroup(await res.json());
  }, [groupId]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroup();
  }, [user, userLoading, router, fetchGroup]);

  const filtered = useMemo(() =>
    group ? filterByPeriod(group.expenses, period) : [],
    [group, period]
  );

  const totalBase = useMemo(() =>
    filtered.reduce((s, e) => s + e.amountBase, 0),
    [filtered]
  );

  // 分類統計
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of filtered) {
      const cat = e.category ?? "其他";
      map.set(cat, (map.get(cat) ?? 0) + e.amountBase);
    }
    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount, pct: totalBase > 0 ? (amount / totalBase) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }, [filtered, totalBase]);

  // 個人統計（各人應付金額）
  const memberStats = useMemo(() => {
    if (!group) return [];
    const map = new Map<string, { name: string; avatarUrl?: string | null; paid: number; owed: number }>();
    for (const m of group.members) {
      map.set(m.user.id, { name: m.user.displayName, avatarUrl: m.user.avatarUrl, paid: 0, owed: 0 });
    }
    for (const e of filtered) {
      for (const p of e.payments) {
        const s = map.get(p.userId);
        if (s) s.paid += p.amountBase;
      }
      for (const sp of e.splits) {
        const s = map.get(sp.userId);
        if (s) s.owed += sp.amountBase;
      }
    }
    return Array.from(map.entries())
      .map(([, v]) => v)
      .sort((a, b) => b.owed - a.owed);
  }, [filtered, group]);

  // SVG 圓餅圖
  const pieSlices = useMemo(() => {
    if (categoryStats.length === 0) return [];
    let angle = -90;
    return categoryStats.map((c) => {
      const sweep = (c.pct / 100) * 360;
      const start = angle;
      angle += sweep;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const r = 80;
      const cx = 100; const cy = 100;
      const x1 = cx + r * Math.cos(toRad(start));
      const y1 = cy + r * Math.sin(toRad(start));
      const x2 = cx + r * Math.cos(toRad(start + sweep));
      const y2 = cy + r * Math.sin(toRad(start + sweep));
      const large = sweep > 180 ? 1 : 0;
      const path = sweep >= 359.9
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { ...c, path, color: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR };
    });
  }, [categoryStats]);

  if (!group) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-line-green border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="font-bold text-gray-900 flex-1">統計</h1>
        {/* 時間篩選 */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodMenu((v) => !v)}
            className="text-sm text-line-green font-medium flex items-center gap-1 bg-line-green/10 px-3 py-1.5 rounded-full"
          >
            {PERIOD_LABELS[period]}
            <span className="text-xs">▾</span>
          </button>
          {showPeriodMenu && (
            <div className="absolute right-0 top-10 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-20 min-w-[110px]">
              {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setPeriod(key); setShowPeriodMenu(false); }}
                  className={cn("w-full px-4 py-2.5 text-sm text-left",
                    period === key ? "bg-line-green/10 text-line-green font-medium" : "text-gray-700")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4 space-y-4 pb-8">

        {/* 總金額 */}
        <section className="card bg-white">
          <p className="text-xs text-gray-400 mb-1">{group.baseCurrency} · {PERIOD_LABELS[period]}</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(totalBase, group.baseCurrency)}
          </p>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} 筆消費</p>
        </section>

        {/* 切換模式 */}
        <div className="flex bg-white rounded-2xl p-1 border border-gray-100">
          {(["category", "member"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn("flex-1 py-2 text-sm font-medium rounded-xl transition-colors",
                viewMode === mode ? "bg-line-green text-white" : "text-gray-500")}
            >
              {mode === "category" ? "分類" : "成員"}
            </button>
          ))}
        </div>

        {viewMode === "category" && (
          <>
            {/* 圓餅圖 */}
            {pieSlices.length > 0 ? (
              <section className="card">
                <div className="flex items-center gap-4">
                  <svg viewBox="0 0 200 200" className="w-36 h-36 flex-shrink-0">
                    {pieSlices.map((s, i) => (
                      <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
                    ))}
                    <circle cx="100" cy="100" r="45" fill="white" />
                    <text x="100" y="96" textAnchor="middle" fontSize="11" fill="#6b7280">總計</text>
                    <text x="100" y="112" textAnchor="middle" fontSize="10" fontWeight="600" fill="#111827">
                      {group.baseCurrency}
                    </text>
                  </svg>
                  {/* 圖例 */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {pieSlices.slice(0, 5).map((s) => (
                      <div key={s.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="text-xs text-gray-600 truncate flex-1">{s.name}</span>
                        <span className="text-xs font-medium text-gray-700">{s.pct.toFixed(1)}%</span>
                      </div>
                    ))}
                    {pieSlices.length > 5 && (
                      <p className="text-xs text-gray-400">+{pieSlices.length - 5} 個分類</p>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <div className="card text-center text-gray-400 text-sm py-8">此期間無消費紀錄</div>
            )}

            {/* 分類明細 */}
            <section className="card space-y-3">
              {categoryStats.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR }} />
                      <span className="text-sm font-medium text-gray-700">{c.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(c.amount, group.baseCurrency)}</span>
                      <span className="text-xs text-gray-400 ml-2">{c.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.pct}%`, backgroundColor: CATEGORY_COLORS[c.name] ?? DEFAULT_COLOR }}
                    />
                  </div>
                </div>
              ))}
              {categoryStats.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-4">此期間無消費紀錄</p>
              )}
            </section>
          </>
        )}

        {viewMode === "member" && (
          <section className="card space-y-3">
            {memberStats.map((m) => (
              <div key={m.name} className="flex items-center gap-3">
                <Avatar name={m.name} src={m.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-xs text-green-600">
                      付出 {formatCurrency(m.paid, group.baseCurrency)}
                    </span>
                    <span className="text-xs text-gray-400">
                      應付 {formatCurrency(m.owed, group.baseCurrency)}
                    </span>
                  </div>
                  {/* 進度條 */}
                  {totalBase > 0 && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-line-green rounded-full"
                        style={{ width: `${Math.min((m.owed / totalBase) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {formatCurrency(m.owed, group.baseCurrency)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {totalBase > 0 ? ((m.owed / totalBase) * 100).toFixed(1) : 0}%
                  </p>
                </div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
