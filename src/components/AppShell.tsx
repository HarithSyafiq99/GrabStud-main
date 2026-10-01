"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
const NAV: Record<string, { href: string; label: string; icon: string }[]> = {
  passenger: [
    { href: "/passenger", label: "Find a ride", icon: "search" },
    { href: "/history", label: "My bookings", icon: "history" },
  ],
  driver: [
    { href: "/driver", label: "Driver hub", icon: "car" },
    { href: "/history", label: "Ride history", icon: "history" },
  ],
  admin: [
    { href: "/admin", label: "Student approvals", icon: "shield" },
    { href: "/admin/logs", label: "System activity", icon: "history" },
    { href: "/history", label: "All bookings", icon: "car" },
  ],
};
export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false),
    [notifications, setNotifications] = useState(false),
    [counts, setCounts] = useState({ pendingRequests: 0, acceptedBookings: 0 }),
    [error, setError] = useState("");
  useEffect(() => {
    if (user.role === "admin") return;
    const load = () =>
      api<typeof counts>("/api/notifications")
        .then(setCounts)
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [user.role, pathname]);
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setError("Could not sign out. Please try again.");
    }
  }
  return (
    <div className="app-shell">
      {open ? (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Link href={NAV[user.role][0].href}>
          <Brand />
        </Link>
        <p className="nav-caption">YOUR CAMPUS, CONNECTED</p>
        <nav>
          {NAV[user.role].map((item) => (
            <Link
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-card">
            <Icon name="leaf" size={24} className="text-[#b5a0ca]" />
            <h3>Small rides. Big difference.</h3>
            <p>Share your journey, save on petrol, and keep campus moving.</p>
          </div>
          <div className="sidebar-user">
            <span className="avatar">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <p>{user.name}</p>
              <small>{user.role} account</small>
            </div>
            <button onClick={logout} aria-label="Sign out">
              <Icon name="logout" size={16} />
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-rose-600 mt-2">
              {error}
            </p>
          ) : null}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-location">
            <Icon name="pin" size={15} />
            <strong>Campus community</strong>
            <span className="hidden sm:inline">
              / {user.role === "admin" ? "Administration" : "Student carpool"}
            </span>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              {new Date().toLocaleDateString("en-MY", {
                timeZone: "Asia/Kuala_Lumpur",
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
            <div className="notification-anchor">
              <button
                className="icon-btn"
                aria-label="Notifications"
                aria-expanded={notifications}
                onClick={() => setNotifications(!notifications)}
              >
                <Icon name="bell" size={18} />
                {counts.pendingRequests > 0 || counts.acceptedBookings > 0 ? (
                  <span className="notification-dot" />
                ) : null}
              </button>
              {notifications ? (
                <div className="panel notification-panel">
                  <h3>Your updates</h3>
                  <p>
                    {user.role === "admin"
                      ? "Review student documents and monitor activity in your admin dashboard."
                      : `${counts.pendingRequests} pending ${user.role === "driver" ? "requests" : "bookings"} · ${counts.acceptedBookings} accepted bookings. Payment is arranged with the driver in cash or QR.`}
                  </p>
                  <Link
                    onClick={() => setNotifications(false)}
                    href={user.role === "admin" ? "/admin" : "/history"}
                  >
                    View {user.role === "admin" ? "approvals" : "bookings"} →
                  </Link>
                </div>
              ) : null}
            </div>
            <span className="avatar">{user.name[0]}</span>
          </div>
        </header>
        <main className="main-content" key={pathname}>
          {children}
          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} GrabStudent · A little closer,
              together.
            </span>
            <span>Student verified. Community powered.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
