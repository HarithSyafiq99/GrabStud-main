"use client";
import { useEffect } from "react";
import { beginLoading } from "@/lib/loading";

export function BookingProgress({
  active,
  label,
  success = false,
  detail,
}: {
  active: boolean;
  label: string;
  success?: boolean;
  detail?: string;
}) {
  useEffect(() => {
    if (!active) return;
    return beginLoading(label, { priority: 10, success, detail });
  }, [active, label, success, detail]);
  return null;
}
