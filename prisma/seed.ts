import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Demo users
  const alice = await prisma.user.upsert({
    where: { lineUserId: "demo_alice" },
    update: {},
    create: { lineUserId: "demo_alice", displayName: "Alice", avatarUrl: null },
  });

  const bob = await prisma.user.upsert({
    where: { lineUserId: "demo_bob" },
    update: {},
    create: { lineUserId: "demo_bob", displayName: "Bob", avatarUrl: null },
  });

  const carol = await prisma.user.upsert({
    where: { lineUserId: "demo_carol" },
    update: {},
    create: { lineUserId: "demo_carol", displayName: "Carol", avatarUrl: null },
  });

  // Demo group
  const group = await prisma.group.upsert({
    where: { inviteCode: "DEMO2026" },
    update: {},
    create: {
      name: "日本旅遊 2026",
      baseCurrency: "TWD",
      inviteCode: "DEMO2026",
      createdById: alice.id,
      members: {
        create: [
          { userId: alice.id },
          { userId: bob.id },
          { userId: carol.id },
        ],
      },
    },
  });

  // Demo expense 1 — Alice paid all
  const expense1 = await prisma.expense.create({
    data: {
      groupId: group.id,
      title: "飯店住宿",
      amount: 30000,
      currency: "JPY",
      fxRate: 0.217,
      amountBase: 6510,
      splitType: "EQUAL",
      category: "住宿",
      payments: {
        create: [{ userId: alice.id, amount: 30000, amountBase: 6510 }],
      },
      splits: {
        create: [
          { userId: alice.id, amountBase: 2170 },
          { userId: bob.id, amountBase: 2170 },
          { userId: carol.id, amountBase: 2170 },
        ],
      },
    },
  });

  // Demo expense 2 — Bob paid all
  const expense2 = await prisma.expense.create({
    data: {
      groupId: group.id,
      title: "拉麵晚餐",
      amount: 4500,
      currency: "JPY",
      fxRate: 0.217,
      amountBase: 976.5,
      splitType: "EQUAL",
      category: "餐飲",
      payments: {
        create: [{ userId: bob.id, amount: 4500, amountBase: 976.5 }],
      },
      splits: {
        create: [
          { userId: alice.id, amountBase: 325.5 },
          { userId: bob.id, amountBase: 325.5 },
          { userId: carol.id, amountBase: 325.5 },
        ],
      },
    },
  });

  console.log("Seed completed:", { alice, bob, carol, group, expense1, expense2 });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
