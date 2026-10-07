import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PendingClient } from "./pending-client";

export default async function PendingPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.status === "approved") {
    redirect(
      user.role === "admin"
        ? "/admin"
        : user.role === "driver"
          ? "/driver"
          : "/passenger",
    );
  }
  return <PendingClient user={user} />;
}
