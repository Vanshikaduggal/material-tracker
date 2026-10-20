"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatMoney } from "@/lib/calc";
import type { ProjectSummary } from "@/lib/types";
import { useSessionUser } from "@/components/AppShell";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageLoader,
  ProgressBar,
  Select,
  StatCard,
  statusTone,
} from "@/components/ui";

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export default function DashboardPage() {
  const user = useSessionUser();
  const isAdmin = user.role === "admin";
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");

  useEffect(() => {
    api<{ projects: ProjectSummary[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e.message));
  }, []);

  const owners = useMemo(() => {
    const map = new Map<string, string>();
    projects?.forEach((p) => map.set(p.createdBy, p.createdByName));
    return [...map].sort((a, b) => a[1].localeCompare(b[1]));
  }, [projects]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (projects ?? []).filter(
      (p) =>
        (!status || p.status === status) &&
        (!owner || p.createdBy === owner) &&
        (!term ||
          [p.name, p.moNumber, p.cwoNumber, p.siteName, p.location, p.vendor, p.createdByName].some((f) =>
            f?.toLowerCase().includes(term),
          )),
    );
  }, [projects, q, status, owner]);

  const stats = useMemo(() => {
    const planned = filtered.reduce((s, p) => s + p.plannedCost, 0);
    const consumed = filtered.reduce((s, p) => s + p.consumedCost, 0);
    const budget = filtered.reduce((s, p) => s + (p.budget || 0), 0);
    return {
      count: filtered.length,
      active: filtered.filter((p) => p.status === "In Progress").length,
      planned,
      consumed,
      balance: planned - consumed,
      budget,
    };
  }, [filtered]);

  function exportCsv() {
    downloadCsv(
      `projects-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Project", "MO Number", "CWO Number", "Site", "Location", "Vendor", "Status", "Created By", "Items", "Budget", "Estimated Cost", "Consumed Cost", "Balance", "Utilisation %", "Created On"],
      filtered.map((p) => [
        p.name, p.moNumber, p.cwoNumber, p.siteName, p.location, p.vendor, p.status, p.createdByName, p.materialCount,
        p.budget, p.plannedCost, p.consumedCost, Math.round((p.plannedCost - p.consumedCost) * 100) / 100,
        pct(p.consumedCost, p.plannedCost), formatDate(p.createdAt),
      ]),
    );
  }

  if (error) return <Alert>{error}</Alert>;
  if (!projects) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isAdmin ? "All projects" : "My projects"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isAdmin ? "Organisation-wide view of every project, owner and material spend." : `Welcome back, ${user.name.split(" ")[0]}.`}
          </p>
        </div>
        <LinkButton href="/projects/new">+ New project</LinkButton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Projects" value={stats.count} sub={`${stats.active} in progress`} tone="blue" />
        <StatCard label="Estimated material cost" value={formatMoney(stats.planned)} sub={stats.budget ? `Budget ${formatMoney(stats.budget)}` : "Planned qty × rate"} />
        <StatCard label="Consumed" value={formatMoney(stats.consumed)} sub={`${pct(stats.consumed, stats.planned)}% of estimate`} tone="amber" />
        <StatCard label="Balance material value" value={formatMoney(stats.balance)} sub="Yet to be consumed" tone={stats.balance < 0 ? "rose" : "emerald"} />
      </div>

      <Card>
        <CardHeader
          title="Project register"
          subtitle={`${filtered.length} of ${projects.length} project(s)`}
          action={
            <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
          }
        />
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-3 sm:px-6">
          <Input placeholder="Search name, MO, CWO, site, vendor…" value={q} onChange={(e) => setQ(e.target.value)} className={isAdmin ? "" : "sm:col-span-2"} />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option>In Progress</option>
            <option>On Hold</option>
            <option>Completed</option>
          </Select>
          {isAdmin && (
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">All users</option>
              {owners.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          )}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title={projects.length ? "No projects match your filters" : "No projects yet"}
            description={projects.length ? "Try a different search or filter." : "Create your first project to start tracking materials."}
            action={!projects.length && <LinkButton href="/projects/new">+ New project</LinkButton>}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Project</th>
                    <th className="px-4 py-3">MO / CWO</th>
                    <th className="px-4 py-3">Site / Vendor</th>
                    {isAdmin && <th className="px-4 py-3">Owner</th>}
                    <th className="px-4 py-3 text-right">Estimate</th>
                    <th className="px-4 py-3 text-right">Consumed</th>
                    <th className="w-40 px-4 py-3">Utilisation</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => {
                    const u = pct(p.consumedCost, p.plannedCost);
                    return (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <Link href={`/projects/${p._id}`} className="font-medium text-blue-700 hover:underline">
                            {p.name}
                          </Link>
                          <p className="text-xs text-slate-500">{p.materialCount} items · Updated {formatDate(p.updatedAt)}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <p>{p.moNumber}</p>
                          <p className="text-xs text-slate-500">{p.cwoNumber}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p>{p.siteName}</p>
                          <p className="text-xs text-slate-500">{p.vendor} · {p.location}</p>
                        </td>
                        {isAdmin && <td className="whitespace-nowrap px-4 py-3">{p.createdByName}</td>}
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(p.plannedCost)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(p.consumedCost)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={u} />
                            <span className="w-12 text-right text-xs text-slate-600">{u}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.map((p) => {
                const u = pct(p.consumedCost, p.plannedCost);
                return (
                  <li key={p._id}>
                    <Link href={`/projects/${p._id}`} className="block space-y-2 px-4 py-4 active:bg-slate-50">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-blue-700">{p.name}</p>
                        <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        MO {p.moNumber} · CWO {p.cwoNumber} · {p.siteName}
                        {isAdmin && ` · by ${p.createdByName}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={u} />
                        <span className="text-xs text-slate-600">{u}%</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {formatMoney(p.consumedCost)} of {formatMoney(p.plannedCost)} consumed
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
