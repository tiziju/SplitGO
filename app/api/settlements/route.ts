import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeGroupBalances, calculateSettlements } from "@/lib/settlement";
import { pushSettlementNotification } from "@/lib/line-notify";

// POST /api/settlements — generate and persist settlement suggestions for a group
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { groupId } = body;

  if (!groupId) return NextResponse.json({ error: "groupId required" }, { status: 400 });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      expenses: { include: { payments: true, splits: true } },
      settlements: true,
    },
  });

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // Clear previous pending settlements
  await prisma.settlement.deleteMany({
    where: { groupId, status: "PENDING" },
  });

  const membersList = group.members.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
  }));

  const balances = computeGroupBalances(
    membersList,
    group.expenses,
    group.settlements.filter((s) => s.status === "DONE")
  );

  const suggestions = calculateSettlements(balances);

  const created = await prisma.$transaction(
    suggestions.map((s) =>
      prisma.settlement.create({
        data: {
          groupId,
          fromUserId: s.fromUserId,
          toUserId: s.toUserId,
          amountBase: s.amount,
          currency: group.baseCurrency,
          status: "PENDING",
        },
        include: { fromUser: true, toUser: true },
      })
    )
  );

  // Push LINE notifications
  const lineUserIds = group.members.map((m) => m.user.lineUserId);
  await pushSettlementNotification(
    lineUserIds,
    group.name,
    suggestions,
    group.baseCurrency
  );

  return NextResponse.json({ settlements: created, balances });
}
