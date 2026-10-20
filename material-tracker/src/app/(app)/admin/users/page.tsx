"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/calc";
import type { Role, UserRow } from "@/lib/types";
import { useSessionUser } from "@/components/AppShell";
import { Alert, Badge, Button, Card, CardHeader, Field, Input, PageLoader, Select, StatCard } from "@/components/ui";

export default function UsersPage() {
  const me = useSessionUser();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    api<{ users: UserRow[] }>("/api/users")
      .then((d) => setUsers(d.users))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>, msg: string) {
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(msg);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  const patch = (u: UserRow, body: Record<string, unknown>, msg: string) =>
    run(() => api(`/api/users/${u._id}`, { method: "PATCH", body }), msg);

  function resetPassword(u: UserRow) {
    const pwd = prompt(`New password for ${u.name} (min 8 characters):`);
    if (!pwd) return;
    if (pwd.length < 8) return setError("Password must be at least 8 characters");
    patch(u, { password: pwd }, `Password updated for ${u.name}`);
  }

  function remove(u: UserRow) {
    if (!confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    run(() => api(`/api/users/${u._id}`, { method: "DELETE" }), `${u.name} deleted`);
  }

  if (!users) return error ? <Alert>{error}</Alert> : <PageLoader />;

  const admins = users.filter((u) => u.role === "admin").length;
  const active = users.filter((u) => u.active).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User management</h1>
          <p className="mt-1 text-sm text-slate-500">Control who can sign in, their role and access.</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Close" : "+ Add user"}</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total users" value={users.length} tone="blue" />
        <StatCard label="Active" value={active} tone="emerald" />
        <StatCard label="Admins" value={admins} />
      </div>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="emerald">{notice}</Alert>}

      {showAdd && (
        <AddUser
          onCreated={(name) => {
            setShowAdd(false);
            setNotice(`${name} added`);
            load();
          }}
        />
      )}

      <Card>
        <CardHeader title="Accounts" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 sm:px-6">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Projects</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => {
                const isMe = u._id === me.id;
                return (
                  <tr key={u._id} className={u.active ? "" : "bg-slate-50 text-slate-400"}>
                    <td className="px-4 py-3 sm:px-6">
                      <p className="font-medium text-slate-900">
                        {u.name} {isMe && <span className="text-xs font-normal text-slate-500">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role}
                        disabled={isMe}
                        className="w-28 py-1"
                        onChange={(e) => patch(u, { role: e.target.value as Role }, `${u.name} is now ${e.target.value}`)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.active ? "emerald" : "rose"}>{u.active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">{u.projectCount}</td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 whitespace-nowrap text-xs font-medium">
                        <button className="text-blue-600 hover:underline" onClick={() => resetPassword(u)}>
                          Reset password
                        </button>
                        {!isMe && (
                          <button
                            className="text-amber-700 hover:underline"
                            onClick={() => patch(u, { active: !u.active }, `${u.name} ${u.active ? "deactivated" : "activated"}`)}
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {!isMe && (
                          <button className="text-rose-600 hover:underline" onClick={() => remove(u)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AddUser({ onCreated }: { onCreated: (name: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "user" as Role });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/users", { body: form });
      onCreated(form.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Add user" />
      <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Full name">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Temporary password">
            <Input type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>Create user</Button>
        </div>
      </form>
    </Card>
  );
}
