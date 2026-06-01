import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/utils";

// GET /api/groups?userId=xxx — list groups for a user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: {
      group: {
        include: {
          members: { include: { user: true } },
          _count: { select: { expenses: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json(memberships.map((m) => m.group));
}

// POST /api/groups — create a new group
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, baseCurrency = "TWD", createdById } = body;

  if (!name || !createdById) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const inviteCode = generateInviteCode();

  const group = await prisma.group.create({
    data: {
      name,
      baseCurrency,
      inviteCode,
      createdById,
      members: { create: { userId: createdById } },
    },
    include: { members: { include: { user: true } } },
  });

  return NextResponse.json(group, { status: 201 });
}
