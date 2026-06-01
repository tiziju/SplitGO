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

// PATCH /api/groups/:id — update name, icon, baseCurrency
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, icon, baseCurrency } = await req.json();

  const group = await prisma.group.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(icon !== undefined && { icon }),
      ...(baseCurrency && { baseCurrency }),
    },
  });

  return NextResponse.json(group);
}

// DELETE /api/groups/:id — delete group
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
