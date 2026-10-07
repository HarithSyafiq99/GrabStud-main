import { beginLoading } from "./loading";

type ApiOptions = RequestInit & {
  feedback?: "blocking" | "background";
  loadingLabel?: string;
};

function requestLabel(url: string, method: string) {
  if (url.includes("/auth/login")) return "Signing you in…";
  if (url.includes("/auth/logout")) return "Signing you out…";
  if (url.includes("/auth/register")) return "Creating your account…";
  if (url.includes("/auth/resubmit")) return "Submitting your documents…";
  if (url.includes("/auth/me"))
    return method === "GET"
      ? "Checking your account…"
      : "Saving your phone number…";
  if (url.includes("/notifications")) return "Checking your updates…";
  if (url.includes("/admin/logs")) return "Refreshing community activity…";
  if (url.includes("/admin/users"))
    return method === "GET"
      ? "Refreshing user accounts…"
      : "Updating this application…";
  if (url.includes("/admin/overview")) return "Refreshing the dashboard…";
  if (url.includes("/history")) return "Refreshing booking history…";
  if (url.includes("/wallet")) return "Refreshing your wallet…";
  if (url.includes("/bookings"))
    return method === "GET" ? "Refreshing journeys…" : "Updating your booking…";
  return "Loading your update…";
}

export async function api<T = Record<string, unknown>>(
  url: string,
  options: ApiOptions = {},
): Promise<T> {
  const { feedback = "blocking", loadingLabel, ...request } = options;
  const finish = beginLoading(
    loadingLabel ?? requestLabel(url, request.method?.toUpperCase() ?? "GET"),
    { mode: feedback },
  );
  try {
    const res = await fetch(url, {
      ...request,
      headers: { "Content-Type": "application/json", ...request.headers },
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error ?? "Request failed. Please try again.");
    return data as T;
  } finally {
    finish();
  }
}
export function rideDate(value: string) {
  return new Date(value).toLocaleDateString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    weekday: "short",
  });
}
export function rideTime(value: string) {
  return new Date(value).toLocaleTimeString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
  });
}
export function localDateTime() {
  const d = new Date(Date.now() + 8 * 3600000);
  return d.toISOString().slice(0, 16);
}
