"use client";

import { BookingProgress } from "./BookingProgress";
import { LoadingCard } from "./LoadingOverlay";

export function RouteLoading({
  label = "Opening your page…",
}: {
  label?: string;
}) {
  return (
    <div className="page-loading">
      <BookingProgress active label={label} />
      <LoadingCard label={label} />
    </div>
  );
}
