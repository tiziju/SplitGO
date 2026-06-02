import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { convertToBase } from "@/lib/fx";

// GET /api/expenses/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      payments: { include: { user: true } },
      splits: { include: { user: true } },
    },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(expense);
}

// DELETE /api/expenses/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// PATCH /api/expenses/:id — full update
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, amount, currency, payments, splitType, splits, customFxRate, category, note, date } = body;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { group: true },
  });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 若有傳金額相關欄位，重新換算
  if (amount && currency) {
    const { convertedAmount: amountBase, fxRate } = await convertToBase(
      amount, currency, expense.group.baseCurrency, customFxRate
    );

    const paymentData = payments.map((p: { userId: string; amount: number }) => ({
      userId: p.userId,
      amount: p.amount,
      amountBase: Math.round(p.amount * fxRate * 100) / 100,
    }));

    const splitData = computeSplits(amountBase, splitType, splits);

    // 刪除舊的 payments/splits，重新建立
    await prisma.$transaction([
      prisma.expensePayment.deleteMany({ where: { expenseId: id } }),
      prisma.expenseSplit.deleteMany({ where: { expenseId: id } }),
      prisma.expense.update({
        where: { id },
        data: {
          title,
          amount,
          currency,
          fxRate,
          amountBase,
          splitType,
          category: category ?? null,
          note: note ?? null,
          date: date ? new Date(date) : undefined,
          payments: { create: paymentData },
          splits: { create: splitData },
        },
      }),
    ]);
  } else {
    // 只更新文字欄位
    await prisma.expense.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(category !== undefined && { category }),
        ...(note !== undefined && { note }),
      },
    });
  }

  const updated = await prisma.expense.findUnique({
    where: { id },
    include: {
      payments: { include: { user: true } },
      splits: { include: { user: true } },
    },
  });

  return NextResponse.json(updated);
}

function computeSplits(
  totalBase: number,
  splitType: string,
  splits: { userId: string; ratio?: number; fixedAmount?: number }[]
) {
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
  return splits.map((s) => ({
    userId: s.userId,
    amountBase: s.fixedAmount ?? 0,
    fixedAmount: s.fixedAmount,
  }));
}
