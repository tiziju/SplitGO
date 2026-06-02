import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/groups/[id]/members — 新增虛擬成員
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const { displayName } = await req.json();

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  // 建立虛擬 User（lineUserId 用 virtual_ 前綴確保唯一）
  const virtualUser = await prisma.user.create({
    data: {
      lineUserId: `virtual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      displayName: displayName.trim(),
      isVirtual: true,
    },
  });

  // 加入群組
  await prisma.groupMember.create({
    data: { groupId, userId: virtualUser.id },
  });

  return NextResponse.json(virtualUser, { status: 201 });
}
