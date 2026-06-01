import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lineUserId, displayName, avatarUrl } = body;

  if (!lineUserId || !displayName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { lineUserId },
    update: { displayName, avatarUrl: avatarUrl ?? null },
    create: { lineUserId, displayName, avatarUrl: avatarUrl ?? null },
  });

  return NextResponse.json(user);
}
