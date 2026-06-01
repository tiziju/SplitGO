import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeGroupBalances } from "@/lib/settlement";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } },
      expenses: {
        include: {
          payments: { include: { user: true } },
          splits: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      settlements: {
        include: { fromUser: true, toUser: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  const membersList = group.members.map((m) => ({
    userId: m.user.id,
    displayName: m.user.displayName,
  }));

  const balances = computeGroupBalances(
    membersList,
    group.expenses,
    group.settlements
  );

  return NextResponse.json({ ...group, balances });
}
