import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const AUTH_PAGES = ["/login", "/register", "/admin/login"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register", "/api/auth/logout"];

// Optimistic checks only (cookie signature). Every API route re-validates the user against the database.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith("/api/");

  if (isApi) {
    if (PUBLIC_API.includes(pathname) || session) return NextResponse.next();
    return NextResponse.json({ error: "Please sign in to continue" }, { status: 401 });
  }

  if (AUTH_PAGES.includes(pathname)) {
    return session ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  }

  if (!session) {
    const loginPath = pathname.startsWith("/admin") ? "/admin/login" : "/login";
    return NextResponse.redirect(new URL(loginPath, req.url));
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"],
};
