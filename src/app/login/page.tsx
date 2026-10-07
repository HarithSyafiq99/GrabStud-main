import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-client";

export default async function LoginPage() {
  // Check the current database session before redirecting to a dashboard.
  const user = await getSession();
  if (user) {
    if (user.status !== "approved") redirect("/pending");
    redirect(
      user.role === "admin"
        ? "/admin"
        : user.role === "driver"
          ? "/driver"
          : "/passenger",
    );
  }
  return <LoginForm />;
}
