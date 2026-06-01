import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// PATCH /api/settlements/:id — mark as done or pending
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const body = await req.json();
  const { id } = await params;
  const { status } = body; // "DONE" | "PENDING"

  if (status !== "DONE" && status !== "PENDING") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const settlement = await prisma.settlement.update({
    where: { id: id },
    data: {
      status,
      settledAt: status === "DONE" ? new Date() : null,
    },
    include: { fromUser: true, toUser: true },
  });

  return NextResponse.json(settlement);
}
