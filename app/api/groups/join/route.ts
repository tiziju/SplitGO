import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/groups/join — join via invite code
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { inviteCode, userId } = body;

  if (!inviteCode || !userId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { inviteCode } });
  if (!group) return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });

  const existing = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: group.id, userId } },
  });

  if (!existing) {
    await prisma.groupMember.create({ data: { groupId: group.id, userId } });
  }

  return NextResponse.json({ groupId: group.id, alreadyMember: !!existing });
}
