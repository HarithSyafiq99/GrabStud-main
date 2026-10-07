"use client";
import { createContext, useContext } from "react";
import type { SessionUser } from "@/lib/types";
export const UserContext = createContext<SessionUser | null>(null);
export function useCurrentUser() {
  const user = useContext(UserContext);
  if (!user) throw Error("Account context is missing.");
  return user;
}
