import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_AUTH_APIS = ["/api/auth/login", "/api/auth/register"];

function getSecret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET ??
      "grabstudent-dev-secret-change-in-production-please",
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/_next") ||
    PUBLIC_AUTH_APIS.includes(pathname) ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg";

  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      let sameOrigin = false;
      try {
        // NextURL normalizes loopback IPs to localhost. Preserve the browser's
        // actual host so valid local/LAN submissions pass the origin check.
        const host = request.headers.get("host") ?? request.nextUrl.host;
        const expected = new URL(`${request.nextUrl.protocol}//${host}`).origin;
        sameOrigin = new URL(origin).origin === expected;
      } catch {
        // Opaque or malformed origins are not same-origin browser requests.
      }
      if (!sameOrigin)
        return NextResponse.json(
          { error: "Invalid request origin." },
          { status: 403 },
        );
    }
  }
  const token = request.cookies.get("gs_session")?.value;

  if (pathname.startsWith("/api")) {
    // This one endpoint authenticates Vercel's bearer secret rather than a user cookie.
    if (pathname === "/api/cron/bookings-monthly") return NextResponse.next();
    if (PUBLIC_AUTH_APIS.includes(pathname)) {
      return NextResponse.next();
    }
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await jwtVerify(token, getSecret());
      return NextResponse.next();
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!token) {
    if (isPublic || pathname === "/") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role as string;
    const status = payload.status as string;

    if (pathname === "/login") return NextResponse.next();
    if (pathname === "/" || pathname === "/register") {
      if (status === "pending" || status === "rejected") {
        return NextResponse.redirect(new URL("/pending", request.url));
      }
      if (role === "admin")
        return NextResponse.redirect(new URL("/admin", request.url));
      if (role === "driver")
        return NextResponse.redirect(new URL("/driver", request.url));
      return NextResponse.redirect(new URL("/passenger", request.url));
    }

    if (pathname.startsWith("/admin") && role !== "admin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (
      (pathname.startsWith("/driver") || pathname.startsWith("/wallet")) &&
      role !== "driver"
    ) {
      return NextResponse.redirect(new URL("/passenger", request.url));
    }
    if (pathname.startsWith("/passenger") && role === "driver") {
      return NextResponse.redirect(new URL("/driver", request.url));
    }
    if (pathname.startsWith("/passenger") && role === "admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Account status is checked against the database by the server layout.
    // A status claim in a seven-day JWT can become stale after admin review.

    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("gs_session");
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
