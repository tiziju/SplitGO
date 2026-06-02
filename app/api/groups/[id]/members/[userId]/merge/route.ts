import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/groups/[id]/members/[userId]/merge
// body: { realUserId: string }
// 將虛擬成員 [userId] 的所有資料轉移到 realUserId，然後刪除虛擬成員
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: groupId, userId: virtualUserId } = await params;
  const { realUserId } = await req.json();

  if (!realUserId) {
    return NextResponse.json({ error: "realUserId is required" }, { status: 400 });
  }

  // 確認虛擬成員存在且為 virtual
  const virtualUser = await prisma.user.findUnique({ where: { id: virtualUserId } });
  if (!virtualUser?.isVirtual) {
    return NextResponse.json({ error: "Target is not a virtual user" }, { status: 400 });
  }

  // 確認 realUser 是群組成員
  const realMember = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: realUserId } },
  });
  if (!realMember) {
    return NextResponse.json({ error: "Real user is not a member of this group" }, { status: 400 });
  }

  // 用 transaction 把所有關聯資料轉移
  await prisma.$transaction(async (tx) => {
    // ExpensePayment：若同一筆消費 realUser 已有紀錄則合併金額，否則更新 userId
    const virtualPayments = await tx.expensePayment.findMany({ where: { userId: virtualUserId } });
    for (const vp of virtualPayments) {
      const existing = await tx.expensePayment.findUnique({
        where: { expenseId_userId: { expenseId: vp.expenseId, userId: realUserId } },
      });
      if (existing) {
        await tx.expensePayment.update({
          where: { id: existing.id },
          data: { amount: existing.amount + vp.amount, amountBase: existing.amountBase + vp.amountBase },
        });
        await tx.expensePayment.delete({ where: { id: vp.id } });
      } else {
        await tx.expensePayment.update({ where: { id: vp.id }, data: { userId: realUserId } });
      }
    }

    // ExpenseSplit：同上
    const virtualSplits = await tx.expenseSplit.findMany({ where: { userId: virtualUserId } });
    for (const vs of virtualSplits) {
      const existing = await tx.expenseSplit.findUnique({
        where: { expenseId_userId: { expenseId: vs.expenseId, userId: realUserId } },
      });
      if (existing) {
        await tx.expenseSplit.update({
          where: { id: existing.id },
          data: { amountBase: existing.amountBase + vs.amountBase },
        });
        await tx.expenseSplit.delete({ where: { id: vs.id } });
      } else {
        await tx.expenseSplit.update({ where: { id: vs.id }, data: { userId: realUserId } });
      }
    }

    // Settlement
    await tx.settlement.updateMany({ where: { fromUserId: virtualUserId }, data: { fromUserId: realUserId } });
    await tx.settlement.updateMany({ where: { toUserId: virtualUserId }, data: { toUserId: realUserId } });

    // 刪除虛擬成員的 GroupMember
    await tx.groupMember.deleteMany({ where: { groupId, userId: virtualUserId } });

    // 刪除虛擬 User
    await tx.user.delete({ where: { id: virtualUserId } });
  });

  return NextResponse.json({ success: true });
}
