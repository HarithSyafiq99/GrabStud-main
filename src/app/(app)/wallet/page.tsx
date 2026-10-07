import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { WalletClient } from "./wallet-client";
export default async function WalletPage() {
  const user = await getSession();
  if (!user || user.role !== "driver") redirect("/");
  return <WalletClient />;
}
