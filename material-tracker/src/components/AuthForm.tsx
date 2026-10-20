"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { Alert, Button, Field, Input } from "@/components/ui";

type Mode = "user-login" | "admin-login" | "register";

const copy: Record<Mode, { title: string; subtitle: string; cta: string }> = {
  "user-login": { title: "Sign in", subtitle: "Access your projects and material records", cta: "Sign in" },
  "admin-login": { title: "Admin sign in", subtitle: "Full access to all projects, users and reports", cta: "Sign in as admin" },
  register: { title: "Create your account", subtitle: "Start tracking projects and material consumption", cta: "Create account" },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isAdmin = mode === "admin-login";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "register" && form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        await api("/api/auth/register", { body: { name: form.name, email: form.email, password: form.password } });
      } else {
        await api("/api/auth/login", {
          body: { email: form.email, password: form.password, portal: isAdmin ? "admin" : "user" },
        });
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside
        className={`hidden flex-col justify-between p-10 text-white lg:flex ${
          isAdmin ? "bg-gradient-to-br from-slate-900 to-slate-700" : "bg-gradient-to-br from-blue-900 via-blue-800 to-blue-600"
        }`}
      >
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Logo /> Material Tracker
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">
            {isAdmin ? "Complete visibility across every site." : "Plan, consume and control project materials."}
          </h2>
          <ul className="mt-6 space-y-3 text-white/85">
            <li>• Project register with MO / CWO, site and vendor details</li>
            <li>• Bill of materials with planned qty and unit rates</li>
            <li>• Consumption log with live used vs. balance</li>
            <li>• Budget, consumed cost and variance at a glance</li>
          </ul>
        </div>
        <p className="text-sm text-white/60">Material Tracker · Project material control</p>
      </aside>

      <main className="flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-900 lg:hidden">
            <Logo className="text-blue-600" /> Material Tracker
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {isAdmin && (
              <span className="mb-3 inline-block rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">Admin portal</span>
            )}
            <h1 className="text-2xl font-bold text-slate-900">{copy[mode].title}</h1>
            <p className="mt-1 text-sm text-slate-500">{copy[mode].subtitle}</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {error && <Alert>{error}</Alert>}
              {mode === "register" && (
                <Field label="Full name">
                  <Input required value={form.name} onChange={set("name")} autoComplete="name" />
                </Field>
              )}
              <Field label="Email">
                <Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
              </Field>
              <Field label="Password" hint={mode === "register" ? "At least 8 characters" : undefined}>
                <Input
                  type="password"
                  required
                  minLength={mode === "register" ? 8 : undefined}
                  value={form.password}
                  onChange={set("password")}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
              </Field>
              {mode === "register" && (
                <Field label="Confirm password">
                  <Input type="password" required value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
                </Field>
              )}
              <Button type="submit" loading={loading} className={`w-full ${isAdmin ? "bg-slate-900 hover:bg-slate-800" : ""}`}>
                {copy[mode].cta}
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm text-slate-600">
              {mode === "user-login" && (
                <>
                  <p>
                    New here? <Link href="/register" className="font-medium text-blue-600 hover:underline">Create an account</Link>
                  </p>
                  <p>
                    Administrator? <Link href="/admin/login" className="font-medium text-slate-900 hover:underline">Admin login →</Link>
                  </p>
                </>
              )}
              {mode === "register" && (
                <p>
                  Already registered? <Link href="/login" className="font-medium text-blue-600 hover:underline">Sign in</Link>
                </p>
              )}
              {isAdmin && (
                <p>
                  Not an admin? <Link href="/login" className="font-medium text-blue-600 hover:underline">User login →</Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg className={`h-7 w-7 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
