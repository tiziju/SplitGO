import type { SettlementSuggestion } from "./settlement";

export async function pushSettlementNotification(
  userIds: string[],
  groupName: string,
  suggestions: SettlementSuggestion[],
  baseCurrency: string
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || token === "your-channel-access-token-here") {
    console.log("[LINE Push] Skipped (no token). Would notify:", userIds);
    return;
  }

  const text = buildSettlementMessage(groupName, suggestions, baseCurrency);

  const promises = userIds.map((userId) =>
    fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: "text", text }],
      }),
    }).catch(console.error)
  );

  await Promise.all(promises);
}

function buildSettlementMessage(
  groupName: string,
  suggestions: SettlementSuggestion[],
  currency: string
): string {
  const lines = [
    `💰 ${groupName} 結算完成！`,
    "",
    "還款清單：",
    ...suggestions.map(
      (s) => `・${s.fromName} → ${s.toName}：${s.amount.toLocaleString()} ${currency}`
    ),
    "",
    "請於確認後標記「已還清」✅",
  ];
  return lines.join("\n");
}
