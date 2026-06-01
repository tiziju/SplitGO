import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// DELETE /api/expenses/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// PATCH /api/expenses/:id — update title/category/note only (safe fields)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { title, category, note } = body;

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(title && { title }),
      ...(category !== undefined && { category }),
      ...(note !== undefined && { note }),
    },
    include: {
      payments: { include: { user: true } },
      splits: { include: { user: true } },
    },
  });

  return NextResponse.json(expense);
}
