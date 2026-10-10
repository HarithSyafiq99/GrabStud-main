export type WalletPeriod = "daily" | "weekly" | "monthly";
// Archived income keeps only daily totals; booking details remain in the saved PDFs.
export const WALLET_INCOME_SELECT = `
  SELECT driver_id,quoted_price AS amount,payment_method,1 AS journeys,
    COALESCE(arrived_at,departure_at) AS recorded_at FROM bookings
  WHERE quoted_price>0 AND (status='completed' OR (status='accepted' AND arrived_at IS NOT NULL))
  UNION ALL
  SELECT driver_id,amount,payment_method,journeys,recorded_day AS recorded_at
  FROM archived_driver_earnings`;
export function walletRanges(now = new Date()) {
  const local = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  const monday = day - ((local.getUTCDay() + 6) % 7) * 86400000;
  const month = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  const iso = (ms: number) => new Date(ms - 8 * 60 * 60 * 1000).toISOString();
  return {
    daily: { start: iso(day), end: iso(day + 86400000), label: "Today" },
    weekly: {
      start: iso(monday),
      end: iso(monday + 7 * 86400000),
      label: "This week",
    },
    monthly: {
      start: iso(month),
      end: iso(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1)),
      label: "This month",
    },
  };
}
export type WalletSummary = {
  label: string;
  start: string;
  end: string;
  total: number;
  cash: number;
  qr: number;
  journeys: number;
};
export type WalletData = {
  periods: Record<WalletPeriod, WalletSummary>;
  recent: {
    id: string;
    from_zone: string;
    to_zone: string;
    departure_at: string;
    recorded_at: string;
    quoted_price: number;
    payment_method: string;
  }[];
  updated_at: string;
};
