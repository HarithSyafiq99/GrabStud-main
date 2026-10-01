import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  if (user.status !== "approved") redirect("/pending");
  if (user.role === "driver") redirect("/driver");
  redirect("/passenger");
}
