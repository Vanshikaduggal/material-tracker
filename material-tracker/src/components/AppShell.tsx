"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import type { SessionUser } from "@/lib/types";
import { Badge, PageLoader, cx } from "@/components/ui";
import { Logo } from "@/components/AuthForm";

const SessionContext = createContext<SessionUser | null>(null);

export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSessionUser must be used inside AppShell");
  return user;
}

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <PageLoader />
      </div>
    );
  }

  return (
    <SessionContext.Provider value={user}>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar user={user} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </SessionContext.Provider>
  );
}

function Navbar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/projects/new", label: "New Project" },
    ...(user.role === "admin" ? [{ href: "/admin/users", label: "Users" }] : []),
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = user.role === "admin" ? "/admin/login" : "/login";
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === href : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
            <Logo className="text-blue-600" />
            <span className="hidden sm:inline">Material Tracker</span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  isActive(l.href) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <Badge tone={user.role === "admin" ? "blue" : "slate"}>{user.role === "admin" ? "Admin" : "User"}</Badge>
          <button onClick={logout} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Sign out
          </button>
        </div>

        <button
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-200 px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  isActive(l.href) ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {user.name} <Badge tone={user.role === "admin" ? "blue" : "slate"}>{user.role}</Badge>
              </p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button onClick={logout} className="rounded-lg px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
