import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(error: unknown) {
  const status = (error as { status?: number }).status ?? 500;
  if (status >= 500) console.error(error);
  const message =
    status >= 500
      ? "Something went wrong. Please try again."
      : error instanceof Error
        ? error.message
        : "Request failed";
  return jsonError(message, status);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
