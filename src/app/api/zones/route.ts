import { NextResponse } from "next/server";
import { ZONES, getFlatRate } from "@/lib/zones";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (from && to) {
    return NextResponse.json({ from, to, flat_rate: getFlatRate(from, to) });
  }
  return NextResponse.json({ zones: ZONES });
}
