import { NextRequest, NextResponse } from "next/server";
import { getFxRates, SUPPORTED_CURRENCIES } from "@/lib/fx";

// GET /api/fx-rates?base=TWD&from=JPY
export async function GET(req: NextRequest) {
  const base = req.nextUrl.searchParams.get("base") ?? "TWD";
  const from = req.nextUrl.searchParams.get("from");

  const rates = await getFxRates(from ?? base);

  return NextResponse.json({
    base: from ?? base,
    rates,
    supported: SUPPORTED_CURRENCIES,
  });
}
