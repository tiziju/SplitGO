import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { convertToBase } from "@/lib/fx";

interface PaymentInput {
  userId: string;
  amount: number; // 原始幣別
}

interface SplitInput {
  userId: string;
  ratio?: number;
  fixedAmount?: number;
}

// POST /api/expenses — create a new expense
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    groupId,
    title,
    amount,       // 總金額（原始幣別）
    currency,
    payments,     // [{userId, amount}] 各付款人實際付出金額（原始幣別）
    splitType = "EQUAL",
    splits,       // [{userId, ratio?, fixedAmount?}] 分攤對象
    customFxRate,
    category,
    note,
  }: {
    groupId: string;
    title: string;
    amount: number;
    currency: string;
    payments: PaymentInput[];
    splitType?: string;
    splits: SplitInput[];
    customFxRate?: number;
    category?: string;
    note?: string;
  } = body;

  if (!groupId || !title || !amount || !currency || !payments?.length || !splits?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // 換算匯率（所有金額統一換算成基準幣別）
  const { convertedAmount: amountBase, fxRate } = await convertToBase(
    amount,
    currency,
    group.baseCurrency,
    customFxRate
  );

  // 計算各付款人的基準幣別金額
  const paymentData = payments.map((p) => ({
    userId: p.userId,
    amount: p.amount,
    amountBase: Math.round((p.amount * fxRate) * 100) / 100,
  }));

  // 計算各分攤者的基準幣別金額
  const splitData = computeSplits(amountBase, splitType, splits);

  const expense = await prisma.expense.create({
    data: {
      groupId,
      title,
      amount,
      currency,
      fxRate,
      amountBase,
      splitType,
      category: category ?? null,
      note: note ?? null,
      payments: { create: paymentData },
      splits: { create: splitData },
    },
    include: {
      payments: { include: { user: true } },
      splits: { include: { user: true } },
    },
  });

  return NextResponse.json(expense, { status: 201 });
}

function computeSplits(
  totalBase: number,
  splitType: string,
  splits: SplitInput[]
): { userId: string; amountBase: number; ratio?: number; fixedAmount?: number }[] {
  if (splitType === "EQUAL") {
    const each = Math.floor((totalBase / splits.length) * 100) / 100;
    const remainder = Math.round((totalBase - each * splits.length) * 100) / 100;
    return splits.map((s, i) => ({
      userId: s.userId,
      amountBase: i === 0 ? Math.round((each + remainder) * 100) / 100 : each,
    }));
  }

  if (splitType === "RATIO") {
    const totalRatio = splits.reduce((sum, s) => sum + (s.ratio ?? 1), 0);
    return splits.map((s) => ({
      userId: s.userId,
      amountBase: Math.round((totalBase * ((s.ratio ?? 1) / totalRatio)) * 100) / 100,
      ratio: s.ratio,
    }));
  }

  // FIXED
  return splits.map((s) => ({
    userId: s.userId,
    amountBase: s.fixedAmount ?? 0,
    fixedAmount: s.fixedAmount,
  }));
}
