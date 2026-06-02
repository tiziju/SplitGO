"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EXPENSE_CATEGORIES } from "@/components/ui/Badge";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { previewSettlement } from "@/lib/settlement";
import { ArrowLeft, Info, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Member {
  user: { id: string; displayName: string; avatarUrl?: string | null };
}

interface GroupInfo {
  id: string;
  name: string;
  baseCurrency: string;
  members: Member[];
}

// 付款紀錄：某人實際付了多少
interface PaymentRow {
  userId: string;
  amount: string; // 字串方便 input 綁定
}

// 分攤紀錄：某人應付多少
interface SplitRow {
  userId: string;
  included: boolean;
  ratio: string;
  fixedAmount: string;
}

export default function AddExpensePage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;
  const { user, loading: userLoading } = useUser();
  const router = useRouter();

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState("TWD");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [splitType, setSplitType] = useState<"EQUAL" | "RATIO" | "FIXED">("EQUAL");

  // 付款明細：預設單人付款模式（第一人付全額）
  const [multiPayer, setMultiPayer] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  // 分攤對象
  const [splits, setSplits] = useState<SplitRow[]>([]);

  const [autoFxRate, setAutoFxRate] = useState<number | null>(null);
  const [customFxRate, setCustomFxRate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));

  // ─── 初始化 ───────────────────────────────────────────────
  const fetchGroup = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) return;
    const data: GroupInfo = await res.json();
    setGroup(data);
    setCurrency(data.baseCurrency);

    // 預設：當前使用者付全額；若不在成員中則預選第一位
    const defaultPayerId = data.members.find((m) => m.user.id === user?.id)?.user.id
      ?? data.members[0]?.user.id;
    setPayments(data.members.map((m) => ({
      userId: m.user.id,
      amount: m.user.id === defaultPayerId ? "selected" : "",
    })));

    // 預設：全員平均分攤
    setSplits(data.members.map((m) => ({
      userId: m.user.id,
      included: true,
      ratio: "1",
      fixedAmount: "",
    })));
  }, [groupId, user?.id]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) { router.replace("/login"); return; }
    fetchGroup();
  }, [user, userLoading, router, fetchGroup]);

  // ─── 匯率 ─────────────────────────────────────────────────
  useEffect(() => {
    if (!group || currency === group.baseCurrency) { setAutoFxRate(null); return; }
    fetch(`/api/fx-rates?from=${currency}&base=${group.baseCurrency}`)
      .then((r) => r.json())
      .then((d) => setAutoFxRate(d.rates?.[group.baseCurrency] ?? null));
  }, [currency, group]);

  const fxRate = customFxRate ? parseFloat(customFxRate) : (autoFxRate ?? 1);
  const total = parseFloat(totalAmount) || 0;
  const totalBase = Math.round(total * fxRate * 100) / 100;

  // ─── 付款合計驗證 ─────────────────────────────────────────
  const paymentSum = useMemo(() => {
    if (!multiPayer) return total; // 單人模式：付款 = 總額
    return payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  }, [multiPayer, total, payments]);

  const paymentDiff = Math.round((total - paymentSum) * 100) / 100;
  const paymentBalanced = Math.abs(paymentDiff) < 0.01;

  // ─── 分攤計算 ─────────────────────────────────────────────
  const includedSplits = splits.filter((s) => s.included);

  const computedSplitAmounts = useMemo((): Record<string, number> => {
    if (!totalBase || includedSplits.length === 0) return {};

    if (splitType === "EQUAL") {
      const each = Math.floor((totalBase / includedSplits.length) * 100) / 100;
      const remainder = Math.round((totalBase - each * includedSplits.length) * 100) / 100;
      return Object.fromEntries(
        includedSplits.map((s, i) => [s.userId, i === 0 ? each + remainder : each])
      );
    }

    if (splitType === "RATIO") {
      const totalRatio = includedSplits.reduce((s, r) => s + (parseFloat(r.ratio) || 1), 0);
      return Object.fromEntries(
        includedSplits.map((s) => [
          s.userId,
          Math.round((totalBase * ((parseFloat(s.ratio) || 1) / totalRatio)) * 100) / 100,
        ])
      );
    }

    // FIXED: 最後一人自動補齊
    const fixedSum = includedSplits
      .slice(0, -1)
      .reduce((s, r) => s + (parseFloat(r.fixedAmount) || 0), 0);
    const lastRemaining = Math.max(0, Math.round((totalBase - fixedSum) * 100) / 100);
    return Object.fromEntries(
      includedSplits.map((s, i) =>
        i === includedSplits.length - 1
          ? [s.userId, lastRemaining]
          : [s.userId, parseFloat(s.fixedAmount) || 0]
      )
    );
  }, [totalBase, splitType, includedSplits]);

  const splitTotal = Object.values(computedSplitAmounts).reduce((s, v) => s + v, 0);
  const splitDiff = Math.round((totalBase - splitTotal) * 100) / 100;

  // ─── 即時結算預覽 ─────────────────────────────────────────
  const settlementPreview = useMemo(() => {
    if (!group || !totalBase) return [];

    const memberMap = new Map(
      group.members.map((m) => [m.user.id, m.user.displayName])
    );

    const paymentEntries = multiPayer
      ? payments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({
            userId: p.userId,
            displayName: memberMap.get(p.userId) ?? p.userId,
            amountPaid: Math.round((parseFloat(p.amount) || 0) * fxRate * 100) / 100,
          }))
      : payments
          .filter((p) => p.amount !== "")
          .slice(0, 1)
          .map((p) => ({
            userId: p.userId,
            displayName: memberMap.get(p.userId) ?? p.userId,
            amountPaid: totalBase,
          }));

    const splitEntries = includedSplits.map((s) => ({
      userId: s.userId,
      displayName: memberMap.get(s.userId) ?? s.userId,
      amountOwed: computedSplitAmounts[s.userId] ?? 0,
    }));

    return previewSettlement(paymentEntries, splitEntries);
  }, [group, totalBase, multiPayer, payments, fxRate, includedSplits, computedSplitAmounts]);

  // ─── 提交 ─────────────────────────────────────────────────
  const canSubmit =
    title.trim() &&
    total > 0 &&
    (multiPayer ? paymentBalanced : payments.some((p) => p.amount !== "")) &&
    includedSplits.length > 0 &&
    group;

  const submit = async () => {
    if (!canSubmit || !group) return;
    setSubmitting(true);

    // 決定付款資料
    const singlePayerId = payments.find((p) => p.amount !== "")?.userId ?? payments[0].userId;
    const paymentPayload = multiPayer
      ? payments.filter((p) => parseFloat(p.amount) > 0).map((p) => ({
          userId: p.userId,
          amount: parseFloat(p.amount),
        }))
      : [{ userId: singlePayerId, amount: total }];

    const splitPayload = includedSplits.map((s) => ({
      userId: s.userId,
      ratio: splitType === "RATIO" ? parseFloat(s.ratio) || 1 : undefined,
      fixedAmount:
        splitType === "FIXED" ? computedSplitAmounts[s.userId] : undefined,
    }));

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: group.id,
        title: title.trim(),
        amount: total,
        currency,
        payments: paymentPayload,
        splitType,
        splits: splitPayload,
        customFxRate: customFxRate ? parseFloat(customFxRate) : undefined,
        category: category || undefined,
        note: note.trim() || undefined,
        date: date ? new Date(date).toISOString() : undefined,
      }),
    });

    if (res.ok) router.push(`/groups/${group.id}`);
    else setSubmitting(false);
  };

  // ─── helpers ──────────────────────────────────────────────
  const memberDisplayName = (userId: string) =>
    group?.members.find((m) => m.user.id === userId)?.user.displayName ?? userId;

  const memberAvatarUrl = (userId: string) =>
    group?.members.find((m) => m.user.id === userId)?.user.avatarUrl ?? null;

  const updatePayment = (userId: string, value: string) =>
    setPayments((prev) => prev.map((p) => (p.userId === userId ? { ...p, amount: value } : p)));

  const updateSplit = (userId: string, field: Partial<SplitRow>) =>
    setSplits((prev) => prev.map((s) => (s.userId === userId ? { ...s, ...field } : s)));

  if (!group) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F6FA]">
        <div className="w-8 h-8 border-2 border-[#bae8e8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F6FA]">
      {/* Header */}
      <header className="bg-[#1E2340] px-4 sticky top-0 z-10 flex items-center gap-3" style={{ height: 60 }}>
        <button onClick={() => router.back()} className="btn-ghost flex-shrink-0">
          <ArrowLeft className="w-5 h-5 text-[#A0A8CC]" />
        </button>
        <h1 className="font-semibold text-white text-[17px]">新增消費</h1>
      </header>

      <main className="flex-1 overflow-auto px-4 py-4 space-y-4 pb-28">

        {/* ── 基本資訊 ── */}
        <section className="card space-y-4">
          <div>
            <label className="label">日期 & 時間</label>
            <input
              className="input-field"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">消費名稱 *</label>
            <input
              className="input-field"
              placeholder="例：晚餐、計程車、飯店"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
            />
          </div>

          <div>
            <label className="label">總金額 *</label>
            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-lg font-semibold"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
              <select
                className="input-field w-24"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* FX rate */}
            {currency !== group.baseCurrency && (
              <div className="mt-2 bg-[#EEF4FA] rounded-ds-sm p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[#2c698d]">
                  <Info className="w-3.5 h-3.5" />
                  <span>
                    自動匯率：1 {currency} ≈ {autoFxRate?.toFixed(4) ?? "..."} {group.baseCurrency}
                    {totalBase > 0 && <> → <strong>{totalBase.toLocaleString()} {group.baseCurrency}</strong></>}
                  </span>
                </div>
                <input
                  className="input-field text-sm"
                  type="number"
                  step="any"
                  placeholder={`自訂匯率（選填，預設 ${autoFxRate?.toFixed(4) ?? "自動"}）`}
                  value={customFxRate}
                  onChange={(e) => setCustomFxRate(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <label className="label">分類（選填）</label>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? "" : cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[13px] font-medium border transition-colors",
                    category === cat
                      ? "bg-[#2c698d] text-white border-[#2c698d]"
                      : "bg-white text-[#8A90B0] border-[#E8E9F3]"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── 付款明細 ── */}
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1D2E] text-[15px]">付款明細</h2>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#8A90B0]">多人付款</span>
              <button
                type="button"
                onClick={() => setMultiPayer((v) => !v)}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors",
                  multiPayer ? "bg-[#2c698d]" : "bg-[#E8E9F3]"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    multiPayer ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>

          {!multiPayer ? (
            /* 單人付款 */
            <div>
              <label className="label">付款人</label>
              <div className="grid grid-cols-2 gap-2">
                {group.members.map((m) => {
                  const isSelected = payments.find((p) => p.userId === m.user.id)?.amount !== undefined
                    && m.user.id === (payments.find((p) => p.amount !== "")?.userId ?? payments[0]?.userId);
                  return (
                    <button
                      key={m.user.id}
                      type="button"
                      onClick={() =>
                        setPayments((prev) =>
                          prev.map((p) => ({
                            ...p,
                            amount: p.userId === m.user.id ? "selected" : "",
                          }))
                        )
                      }
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-ds-md border transition-colors",
                        isSelected
                          ? "border-[#2c698d] bg-[#EEF4FA]"
                          : "border-[#E8E9F3] bg-white"
                      )}
                    >
                      <Avatar name={m.user.displayName} src={m.user.avatarUrl} size="sm" />
                      <span className="text-sm font-medium truncate">{m.user.displayName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* 多人付款 */
            <div className="space-y-2">
              <p className="text-xs text-gray-500">輸入每人實際付出金額，合計須等於總金額</p>
              {group.members.map((m) => {
                const row = payments.find((p) => p.userId === m.user.id);
                const val = row?.amount ?? "";
                return (
                  <div key={m.user.id} className="flex items-center gap-3">
                    <Avatar name={m.user.displayName} src={m.user.avatarUrl} size="sm" />
                    <span className="text-sm font-medium flex-1">{m.user.displayName}</span>
                    <div className="relative w-32">
                      <input
                        className="input-field pr-12 text-right"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={val}
                        onChange={(e) => updatePayment(m.user.id, e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                        {currency}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* 付款合計狀態 */}
              {total > 0 && (
                <div className={cn(
                  "flex items-center justify-between rounded-ds-sm px-3 py-2 text-[13px] font-medium",
                  paymentBalanced
                    ? "bg-[#3DBCAA]/10 text-[#3DBCAA]"
                    : "bg-[#F5A623]/10 text-[#F5A623]"
                )}>
                  <span>付款合計</span>
                  <span>
                    {paymentSum.toFixed(2)} / {total.toFixed(2)} {currency}
                    {!paymentBalanced && paymentDiff > 0 && (
                      <span className="ml-2 text-xs">還差 {paymentDiff.toFixed(2)}</span>
                    )}
                    {!paymentBalanced && paymentDiff < 0 && (
                      <span className="ml-2 text-xs">超出 {(-paymentDiff).toFixed(2)}</span>
                    )}
                    {paymentBalanced && " ✓"}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── 分攤方式 ── */}
        <section className="card space-y-3">
          <h2 className="font-semibold text-[#1A1D2E] text-[15px]">分攤設定</h2>

          {/* 分攤類型 */}
          <div className="grid grid-cols-3 gap-2">
            {(["EQUAL", "RATIO", "FIXED"] as const).map((type) => {
              const labels = { EQUAL: "平均分攤", RATIO: "比例分攤", FIXED: "固定金額" };
              const descs = { EQUAL: "每人相同", RATIO: "自訂比例", FIXED: "各自輸入" };
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={cn(
                    "py-2.5 px-2 rounded-ds-sm text-center border transition-colors",
                    splitType === type
                      ? "border-[#2c698d] bg-[#2c698d] text-white"
                      : "border-[#E8E9F3] text-[#8A90B0] bg-white"
                  )}
                >
                  <p className="text-sm font-semibold">{labels[type]}</p>
                  <p className={cn("text-xs mt-0.5", splitType === type ? "text-white/80" : "text-gray-400")}>
                    {descs[type]}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 分攤對象 */}
          <div className="space-y-2">
            {group.members.map((m) => {
              const row = splits.find((s) => s.userId === m.user.id)!;
              const computedAmt = computedSplitAmounts[m.user.id];
              const isLast = includedSplits[includedSplits.length - 1]?.userId === m.user.id;

              return (
                <div
                  key={m.user.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-ds-md border transition-colors",
                    row.included ? "border-[#2c698d]/30 bg-[#EEF4FA]" : "border-[#E8E9F3] bg-[#F5F6FA] opacity-60"
                  )}
                >
                  {/* 勾選 */}
                  <button
                    type="button"
                    onClick={() => updateSplit(m.user.id, { included: !row.included })}
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                      row.included ? "bg-[#2c698d] border-[#2c698d]" : "border-[#E8E9F3]"
                    )}
                  >
                    {row.included && (
                      <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
                        <path d="M1 4l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  <Avatar name={m.user.displayName} src={m.user.avatarUrl} size="sm" />
                  <span className="text-sm font-medium flex-1">{m.user.displayName}</span>

                  {/* 比例模式 */}
                  {row.included && splitType === "RATIO" && (
                    <div className="flex items-center gap-1">
                      <input
                        className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="1"
                        value={row.ratio}
                        onChange={(e) => updateSplit(m.user.id, { ratio: e.target.value })}
                      />
                      <span className="text-xs text-gray-400">份</span>
                    </div>
                  )}

                  {/* 固定金額模式：最後一人自動補齊 */}
                  {row.included && splitType === "FIXED" && (
                    isLast ? (
                      <div className="flex items-center gap-1 bg-[#F5A623]/10 rounded-ds-sm px-2 py-1">
                        <span className="text-[13px] font-semibold text-[#F5A623]">
                          {computedAmt != null ? computedAmt.toFixed(2) : "—"}
                        </span>
                        <span className="text-[11px] text-[#F5A623]">{group.baseCurrency} 自動</span>
                      </div>
                    ) : (
                      <div className="relative w-28">
                        <input
                          className="input-field pr-10 text-right text-sm"
                          type="number"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={row.fixedAmount}
                          onChange={(e) => updateSplit(m.user.id, { fixedAmount: e.target.value })}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                          {group.baseCurrency}
                        </span>
                      </div>
                    )
                  )}

                  {/* 計算結果顯示 */}
                  {row.included && splitType !== "FIXED" && computedAmt != null && (
                    <span className="text-sm font-semibold text-gray-700 min-w-[56px] text-right">
                      {computedAmt.toFixed(2)}
                      <span className="text-xs text-gray-400 ml-0.5">{group.baseCurrency}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 分攤合計狀態 */}
          {totalBase > 0 && splitType === "FIXED" && (
            <div className={cn(
              "flex items-center justify-between rounded-ds-sm px-3 py-2 text-[13px] font-medium",
              Math.abs(splitDiff) < 0.01
                ? "bg-[#3DBCAA]/10 text-[#3DBCAA]"
                : "bg-[#F5A623]/10 text-[#F5A623]"
            )}>
              <span>分攤合計</span>
              <span>
                {splitTotal.toFixed(2)} / {totalBase.toFixed(2)} {group.baseCurrency}
                {Math.abs(splitDiff) >= 0.01 && (
                  <span className="ml-2 text-xs">最後一人補 {Math.max(0, splitDiff).toFixed(2)}</span>
                )}
                {Math.abs(splitDiff) < 0.01 && " ✓"}
              </span>
            </div>
          )}
        </section>

        {/* ── 即時結算預覽 ── */}
        {settlementPreview.length > 0 && totalBase > 0 && (
          <section className="card space-y-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="font-semibold text-gray-900">結算預覽</h2>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>此筆消費後誰欠誰</span>
                {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            {showPreview && (
              <div className="space-y-2 pt-1">
                {settlementPreview.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3">
                    <Avatar name={p.displayName} size="sm" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p.displayName}</p>
                      <p className="text-xs text-gray-500">
                        付了 {p.amountPaid.toFixed(2)}，應付 {p.amountOwed.toFixed(2)} {group.baseCurrency}
                      </p>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1 text-[13px] font-bold",
                      p.net > 0.01 ? "text-[#3DBCAA]" : p.net < -0.01 ? "text-[#2c698d]" : "text-[#8A90B0]"
                    )}>
                      {p.net > 0.01 && <TrendingUp className="w-3.5 h-3.5" />}
                      {p.net < -0.01 && <TrendingDown className="w-3.5 h-3.5" />}
                      {p.net === 0 && <Minus className="w-3.5 h-3.5" />}
                      <span>
                        {p.net > 0 ? "+" : ""}{p.net.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 pt-1">
                  ＋為應收、－為應付（此筆消費對餘額的影響）
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── 備註 ── */}
        <section className="card">
          <label className="label">備註（選填）</label>
          <textarea
            className="input-field resize-none"
            rows={2}
            placeholder="補充說明..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>
      </main>

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#F5F6FA] border-t border-[#E8E9F3] px-5 py-4">
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="btn-primary w-full py-4 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? "新增中..." : "新增消費"}
        </button>
      </div>
    </div>
  );
}
