/**
 * Minimum-transactions settlement algorithm (greedy).
 * Works correctly for ≤ 20 people.
 */
export interface Balance {
  userId: string;
  displayName: string;
  net: number; // positive = owed money (to receive), negative = owes money (to pay)
}

export interface SettlementSuggestion {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
}

export function calculateSettlements(
  balances: Balance[]
): SettlementSuggestion[] {
  const creditors: Balance[] = [];
  const debtors: Balance[] = [];

  for (const b of balances) {
    const rounded = Math.round(b.net * 100) / 100;
    if (rounded > 0.01) creditors.push({ ...b, net: rounded });
    else if (rounded < -0.01) debtors.push({ ...b, net: rounded });
  }

  creditors.sort((a, b) => b.net - a.net);
  debtors.sort((a, b) => a.net - b.net);

  const suggestions: SettlementSuggestion[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.net, -debt.net);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded > 0.01) {
      suggestions.push({
        fromUserId: debt.userId,
        fromName: debt.displayName,
        toUserId: credit.userId,
        toName: credit.displayName,
        amount: rounded,
      });
    }

    credit.net -= amount;
    debt.net += amount;

    if (Math.abs(credit.net) < 0.01) ci++;
    if (Math.abs(debt.net) < 0.01) di++;
  }

  return suggestions;
}

export function computeGroupBalances(
  members: { userId: string; displayName: string }[],
  expenses: {
    payments: { userId: string; amountBase: number }[];
    splits: { userId: string; amountBase: number }[];
  }[],
  settlements: {
    fromUserId: string;
    toUserId: string;
    amountBase: number;
    status: string;
  }[]
): Balance[] {
  const netMap = new Map<string, number>();
  for (const m of members) netMap.set(m.userId, 0);

  for (const expense of expenses) {
    // Each member owes their split amount
    for (const split of expense.splits) {
      netMap.set(split.userId, (netMap.get(split.userId) ?? 0) - split.amountBase);
    }
    // Each payer gets credit for what they actually paid
    for (const payment of expense.payments) {
      netMap.set(payment.userId, (netMap.get(payment.userId) ?? 0) + payment.amountBase);
    }
  }

  // Apply completed settlements
  for (const s of settlements) {
    if (s.status === "DONE") {
      // fromUser paid → their net goes up (debt reduced)
      netMap.set(s.fromUserId, (netMap.get(s.fromUserId) ?? 0) + s.amountBase);
      // toUser received → their net goes down (credit reduced)
      netMap.set(s.toUserId, (netMap.get(s.toUserId) ?? 0) - s.amountBase);
    }
  }

  return members.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    net: Math.round((netMap.get(m.userId) ?? 0) * 100) / 100,
  }));
}

/**
 * 前端用：即時計算分攤預覽（不需要 API，純前端計算）
 * payments: 各付款人實際付出金額
 * splits:   各分攤人應付金額
 */
export interface PaymentEntry {
  userId: string;
  displayName: string;
  amountPaid: number;
}

export interface SplitEntry {
  userId: string;
  displayName: string;
  amountOwed: number;
}

export interface NetPreview {
  userId: string;
  displayName: string;
  amountPaid: number;
  amountOwed: number;
  net: number; // positive = to receive, negative = to pay
}

export function previewSettlement(
  payments: PaymentEntry[],
  splits: SplitEntry[]
): NetPreview[] {
  const paid = new Map(payments.map((p) => [p.userId, p.amountPaid]));
  const owed = new Map(splits.map((s) => [s.userId, s.amountOwed]));

  const allIds = new Set([...paid.keys(), ...owed.keys()]);
  const members = new Map<string, string>();
  payments.forEach((p) => members.set(p.userId, p.displayName));
  splits.forEach((s) => members.set(s.userId, s.displayName));

  return Array.from(allIds).map((id) => {
    const amountPaid = paid.get(id) ?? 0;
    const amountOwed = owed.get(id) ?? 0;
    const net = Math.round((amountPaid - amountOwed) * 100) / 100;
    return {
      userId: id,
      displayName: members.get(id) ?? id,
      amountPaid,
      amountOwed,
      net,
    };
  });
}
