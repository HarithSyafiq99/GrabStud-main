export async function api<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error ?? "Request failed. Please try again.");
  return data as T;
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
