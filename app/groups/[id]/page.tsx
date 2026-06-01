"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CategoryBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowLeft, Plus, Copy, Check, Calculator, Receipt,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";

interface User {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface Split {
  userId: string;
  amountBase: number;
  user: User;
}

interface Payment {
  userId: string;
  amount: number;
  amountBase: number;
  user: User;
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  fxRate: number;
  amountBase: number;
  payments: Payment[];
  splitType: string;
  category?: string | null;
  splits: Split[];
  createdAt: string;
}

interface Settlement {
  id: string;
  fromUser: User;
  toUser: User;
  amountBase: number;
  currency: string;
  status: "PENDING" | "DONE";
  settledAt?: string | null;
}

interface Balance {
  userId: string;
  displayName: string;
  net: number;
}

interface Group {
  id: string;
  name: string;
  baseCurrency: string;
  inviteCode: string;
  members: { user: User }[];
  expenses: Expense[];
  settlements: Settlement[];
  balances: Balance[];
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"expenses" | "balances" | "settlements">("expenses");
  const [copied, setCopied] = useState(false);
  const [settling, setSettling] = useState(false);

  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (res.ok) setGroup(await res.json());
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroup();
  }, [user, userLoading, router, fetchGroup]);

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/invite/${group?.inviteCode}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const settle = async () => {
    if (!confirm("確定要結算並推播通知給所有成員嗎？")) return;
    setSettling(true);
    await fetch("/api/settlements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId }),
    });
    await fetchGroup();
    setTab("settlements");
    setSettling(false);
  };

  const markSettlement = async (id: string, status: "DONE" | "PENDING") => {
    await fetch(`/api/settlements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
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
    const lines = [
      `💰 ${group.name} 結算清單`,
      "",
      ...pending.map(
        (s) => `・${s.fromUser.displayName} → ${s.toUser.displayName}：${s.amountBase.toLocaleString()} ${s.currency}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    alert("已複製結算清單到剪貼簿");
  };

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-line-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const myBalance = group.balances.find((b) => b.userId === user?.id);
  const pendingSettlements = group.settlements.filter((s) => s.status === "PENDING");

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{group.name}</h1>
            <p className="text-xs text-gray-500">{group.members.length} 位成員 · {group.baseCurrency}</p>
          </div>
          <button
            onClick={copyInviteLink}
            className="flex items-center gap-1.5 text-xs bg-line-green/10 text-line-green px-3 py-1.5 rounded-full font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "已複製" : group.inviteCode}
          </button>
        </div>

        {/* My balance card */}
        {myBalance && (
          <div className={`mt-3 rounded-xl p-3 flex items-center gap-2 ${
            myBalance.net > 0 ? "bg-green-50" : myBalance.net < 0 ? "bg-red-50" : "bg-gray-50"
          }`}>
            {myBalance.net > 0 ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : myBalance.net < 0 ? (
              <TrendingDown className="w-4 h-4 text-red-500" />
            ) : (
              <Minus className="w-4 h-4 text-gray-500" />
            )}
            <p className={`text-sm font-medium ${
              myBalance.net > 0 ? "text-green-700" : myBalance.net < 0 ? "text-red-600" : "text-gray-600"
            }`}>
              {myBalance.net > 0
                ? `別人欠你 ${formatCurrency(myBalance.net, group.baseCurrency)}`
                : myBalance.net < 0
                ? `你欠別人 ${formatCurrency(Math.abs(myBalance.net), group.baseCurrency)}`
                : "帳款已結清"}
            </p>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex">
        {(["expenses", "balances", "settlements"] as const).map((t) => {
          const labels = { expenses: "消費紀錄", balances: "餘額", settlements: "結算" };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? "border-line-green text-line-green" : "border-transparent text-gray-500"
              }`}
            >
              {labels[t]}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <main className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {tab === "expenses" && (
          <>
            {group.expenses.length === 0 ? (
              <EmptyState icon={Receipt} title="尚無消費紀錄" description="點擊下方按鈕新增第一筆消費" />
            ) : (
              group.expenses.map((e) => (
                <div key={e.id} className="card">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 text-lg">
                      {categoryEmoji(e.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{e.title}</p>
                        <CategoryBadge category={e.category} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {e.payments.length === 1
                          ? `${e.payments[0].user.displayName} 付款`
                          : `${e.payments.map((p) => p.user.displayName).join("、")} 共同付款`
                        }{" · "}
                        {new Date(e.createdAt).toLocaleDateString("zh-TW")}
                      </p>
                      {e.currency !== group.baseCurrency && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatCurrency(e.amount, e.currency)} × {e.fxRate} ≈
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">
                        {formatCurrency(e.amountBase, group.baseCurrency)}
                      </p>
                      <button
                        onClick={() => deleteExpense(e.id)}
                        className="text-xs text-red-400 mt-1"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                  {/* Splits */}
                  <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-2">
                    {e.splits.map((s) => (
                      <div key={s.userId} className="flex items-center gap-1 bg-gray-50 rounded-full px-2 py-1">
                        <Avatar name={s.user.displayName} size="sm" className="w-5 h-5 text-xs" />
                        <span className="text-xs text-gray-600">{s.user.displayName}</span>
                        <span className="text-xs font-medium text-gray-800">
                          {formatCurrency(s.amountBase, group.baseCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {tab === "balances" && (
          <div className="space-y-2">
            {group.balances.map((b) => (
              <div key={b.userId} className="card flex items-center gap-3">
                <Avatar name={b.displayName} size="md" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{b.displayName}</p>
                  <p className="text-xs text-gray-500">
                    {b.net > 0 ? "應收" : b.net < 0 ? "應付" : "結清"}
                  </p>
                </div>
                <p
                  className={`font-bold text-base ${
                    b.net > 0 ? "text-green-600" : b.net < 0 ? "text-red-500" : "text-gray-400"
                  }`}
                >
                  {b.net >= 0 ? "+" : ""}
                  {formatCurrency(b.net, group.baseCurrency)}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "settlements" && (
          <>
            {pendingSettlements.length === 0 && group.settlements.filter(s => s.status === "DONE").length === 0 ? (
              <EmptyState
                icon={Calculator}
                title="尚未結算"
                description="點擊下方「結算」按鈕產生最少交易還款清單"
              />
            ) : (
              <>
                {pendingSettlements.length > 0 && (
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-gray-500">待還款</h3>
                    <button onClick={copyTextSummary} className="text-xs text-line-green font-medium">
                      複製文字摘要
                    </button>
                  </div>
                )}
                {group.settlements.map((s) => (
                  <div
                    key={s.id}
                    className={`card flex items-center gap-3 ${s.status === "DONE" ? "opacity-60" : ""}`}
                  >
                    <Avatar name={s.fromUser.displayName} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-red-500">{s.fromUser.displayName}</span>
                        {" → "}
                        <span className="text-green-600">{s.toUser.displayName}</span>
                      </p>
                      <p className="font-bold text-gray-900">
                        {formatCurrency(s.amountBase, s.currency)}
                      </p>
                      {s.settledAt && (
                        <p className="text-xs text-gray-400">
                          已還清 {new Date(s.settledAt).toLocaleDateString("zh-TW")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => markSettlement(s.id, s.status === "DONE" ? "PENDING" : "DONE")}
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                        s.status === "DONE"
                          ? "bg-line-green border-line-green"
                          : "border-gray-300"
                      }`}
                    >
                      {s.status === "DONE" && <Check className="w-4 h-4 text-white" />}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </main>

      {/* Bottom action */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={settle} loading={settling}>
          <Calculator className="w-4 h-4" /> 結算
        </Button>
        <Button onClick={() => router.push(`/groups/${groupId}/expenses/add`)}>
          <Plus className="w-4 h-4" /> 新增消費
        </Button>
      </div>
    </div>
  );
}

function categoryEmoji(category?: string | null): string {
  const map: Record<string, string> = {
    餐飲: "🍜",
    交通: "🚌",
    住宿: "🏨",
    購物: "🛍️",
    娛樂: "🎮",
    其他: "📌",
  };
  return map[category ?? ""] ?? "💰";
}
