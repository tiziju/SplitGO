import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE /api/groups/:id/members/:userId
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id: groupId, userId } = await params;

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

  // 不能移除群組建立者
  if (group.createdById === userId) {
    return NextResponse.json({ error: "Cannot remove group creator" }, { status: 400 });
  }

  await prisma.groupMember.deleteMany({
    where: { groupId, userId },
  });

  return NextResponse.json({ success: true });
}
