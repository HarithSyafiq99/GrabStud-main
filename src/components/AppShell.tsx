"use client";
import { LoadingLink as Link } from "./LoadingLink";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { BookingProgress } from "./BookingProgress";
import { lockPageScroll } from "@/lib/loading";
import { ProfileSettings } from "./ProfileSettings";
import { Avatar } from "./Avatar";
import { UserContext } from "./UserContext";
import { FirstVisitGuide } from "./FirstVisitGuide";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { api } from "@/lib/client";
import type { SessionUser } from "@/lib/types";
const NAV: Record<
  string,
  { href: string; label: string; mobileLabel: string; icon: string }[]
> = {
  passenger: [
    {
      href: "/passenger",
      label: "Request a journey",
      mobileLabel: "Book a ride",
      icon: "plus",
    },
    {
      href: "/history",
      label: "My bookings",
      mobileLabel: "My bookings",
      icon: "history",
    },
  ],
  driver: [
    {
      href: "/driver",
      label: "Driver hub",
      mobileLabel: "Passengers",
      icon: "car",
    },
    {
      href: "/history",
      label: "Ride history",
      mobileLabel: "History",
      icon: "history",
    },
    {
      href: "/wallet",
      label: "My wallet",
      mobileLabel: "Wallet",
      icon: "wallet",
    },
  ],
  admin: [
    {
      href: "/admin",
      label: "Student approvals",
      mobileLabel: "Approvals",
      icon: "shield",
    },
    {
      href: "/admin/logs",
      label: "System activity",
      mobileLabel: "Activity",
      icon: "history",
    },
    {
      href: "/history",
      label: "All bookings",
      mobileLabel: "Bookings",
      icon: "car",
    },
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
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState(false),
    [counts, setCounts] = useState({
      pendingRequests: 0,
      acceptedBookings: 0,
      priceOffers: 0,
      driverArrivals: 0,
    }),
    [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [navigating, startNavigation] = useTransition();
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setMobile(query.matches);
      if (!query.matches) setOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const releaseScroll = lockPageScroll();
    const focusFrame = requestAnimationFrame(() => {
      sidebarRef.current
        ?.querySelector<HTMLButtonElement>(".sidebar-close")
        ?.focus({ preventScroll: true });
    });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const items = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      );
      const visible = Array.from(items ?? []).filter(
        (item) => item.getClientRects().length,
      );
      const first = visible[0],
        last = visible[visible.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(focusFrame);
      releaseScroll();
      document.removeEventListener("keydown", handleKey);
      previousFocus?.focus();
    };
  }, [open, mobile]);
  useEffect(() => {
    if (user.role === "admin") return;
    const load = () =>
      api<typeof counts>("/api/notifications", { feedback: "background" })
        .then(setCounts)
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [user.role, pathname]);
  async function logout() {
    if (signingOut || navigating) return;
    setSigningOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      startNavigation(() => {
        router.push("/login");
        router.refresh();
      });
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }
  return (
    <UserContext.Provider value={user}>
      <div className="app-shell">
        <FirstVisitGuide user={user} />
        <BookingProgress
          active={signingOut || navigating}
          label="Signing you out…"
        />
        {open ? (
          <button
            className="mobile-overlay"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
        ) : null}
        <aside
          id="app-navigation"
          ref={sidebarRef}
          className={`sidebar ${open ? "open" : ""}`}
          inert={mobile && !open}
          role={mobile && open ? "dialog" : undefined}
          aria-modal={mobile && open ? true : undefined}
          aria-label="Account and navigation"
        >
          <div className="sidebar-heading">
            <Link href={NAV[user.role][0].href} onClick={() => setOpen(false)}>
              <Brand />
            </Link>
            <button
              className="icon-btn sidebar-close"
              aria-label="Close navigation"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={18} />
            </button>
          </div>
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
              <Avatar name={user.name} photo={user.profile_photo} />
              <div>
                <p>{user.name}</p>
                <small>{user.role} account</small>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                disabled={signingOut || navigating}
              >
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
              aria-controls="app-navigation"
              onClick={() => setOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <Link
              className="mobile-brand"
              href={NAV[user.role][0].href}
              aria-label="GrabStudent home"
            >
              <Brand />
            </Link>
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
                  {counts.pendingRequests > 0 ||
                  counts.acceptedBookings > 0 ||
                  counts.priceOffers > 0 ? (
                    <span className="notification-dot" />
                  ) : null}
                </button>
                {notifications ? (
                  <div className="panel notification-panel">
                    <h3>Your updates</h3>
                    <p>
                      {user.role === "admin"
                        ? "Review student documents and monitor activity in your admin dashboard."
                        : `${counts.pendingRequests} pending ${user.role === "driver" ? "requests" : "bookings"} · ${counts.priceOffers} price offers awaiting agreement; ${counts.acceptedBookings} booked seats.${user.role === "passenger" && counts.driverArrivals ? ` ${counts.driverArrivals} driver arrival reminder${counts.driverArrivals === 1 ? "" : "s"} to check.` : ""} Payment is arranged with the driver in cash or QR.`}
                    </p>
                    <Link
                      onClick={() => setNotifications(false)}
                      href={
                        user.role === "admin"
                          ? "/admin"
                          : user.role === "driver"
                            ? "/driver"
                            : "/passenger"
                      }
                    >
                      View {user.role === "admin" ? "approvals" : "requests"} →
                    </Link>
                  </div>
                ) : null}
              </div>
              <Avatar name={user.name} photo={user.profile_photo} />
            </div>
          </header>
          <main className="main-content" key={pathname}>
            <div className="contact-toolbar flex justify-end mb-4">
              <ProfileSettings user={user} />
            </div>
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
        <nav
          className="mobile-bottom-nav"
          aria-label="Mobile primary navigation"
        >
          {NAV[user.role].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "active" : ""}
              aria-current={pathname === item.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.mobileLabel}</span>
            </Link>
          ))}
          <button
            type="button"
            aria-label="Open account menu"
            aria-expanded={open}
            aria-controls="app-navigation"
            onClick={() => setOpen(true)}
          >
            <Icon name="users" size={21} />
            <span>Account</span>
          </button>
        </nav>
      </div>
    </UserContext.Provider>
  );
}
