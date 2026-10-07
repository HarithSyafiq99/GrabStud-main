import { NextResponse } from "next/server";
import { getSession, requireApproved, requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { handleError } from "@/lib/http";
import {
  walletRanges,
  type WalletPeriod,
  type WalletSummary,
} from "@/lib/wallet";

export async function GET() {
  try {
    const user = requireApproved(requireRole(await getSession(), ["driver"]));
    const now = new Date();
    const ranges = walletRanges(now);
    const eligible =
      "driver_id=? AND quoted_price>0 AND departure_at<=? AND status IN ('accepted','completed')";
    const summaries = await Promise.all(
      Object.entries(ranges).map(async ([period, range]) => {
        const result = await getDb().execute({
          sql: `SELECT COALESCE(SUM(quoted_price),0) as total,COALESCE(SUM(CASE WHEN payment_method='cash' THEN quoted_price ELSE 0 END),0) as cash,COALESCE(SUM(CASE WHEN payment_method='qr' THEN quoted_price ELSE 0 END),0) as qr,COUNT(*) as journeys FROM bookings WHERE ${eligible} AND departure_at>=? AND departure_at<?`,
          args: [user.id, now.toISOString(), range.start, range.end],
        });
        const row = result.rows[0];
        return [
          period,
          {
            ...range,
            total: Number(row.total),
            cash: Number(row.cash),
            qr: Number(row.qr),
            journeys: Number(row.journeys),
          },
        ] as [WalletPeriod, WalletSummary];
      }),
    );
    const recent = await getDb().execute({
      sql: `SELECT id,from_zone,to_zone,departure_at,quoted_price,payment_method FROM bookings WHERE ${eligible} ORDER BY departure_at DESC LIMIT 8`,
      args: [user.id, now.toISOString()],
    });
    return NextResponse.json(
      {
        periods: Object.fromEntries(summaries),
        recent: recent.rows,
        updated_at: now.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleError(error);
  }
}
