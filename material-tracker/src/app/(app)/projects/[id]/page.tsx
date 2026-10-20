"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatMoney, formatQty, materialStats, projectTotals } from "@/lib/calc";
import type { Project } from "@/lib/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageLoader,
  ProgressBar,
  Select,
  StatCard,
  cx,
  statusTone,
} from "@/components/ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api<{ project: Project }>(`/api/projects/${id}`)
      .then((d) => setProject(d.project))
      .catch((e) => setError(e.message));
  }, [id]);

  const totals = useMemo(() => (project ? projectTotals(project.materials, project.budget) : null), [project]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { planned: number; consumed: number; items: number }>();
    project?.materials.forEach((m) => {
      const s = materialStats(m);
      const c = map.get(m.category) ?? { planned: 0, consumed: 0, items: 0 };
      map.set(m.category, { planned: c.planned + s.plannedCost, consumed: c.consumed + s.consumedCost, items: c.items + 1 });
    });
    return [...map].sort((a, b) => b[1].planned - a[1].planned);
  }, [project]);

  if (error) return <Alert>{error}</Alert>;
  if (!project || !totals) return <PageLoader />;

  const materialById = new Map(project.materials.map((m) => [m._id, m]));

  async function remove() {
    if (!confirm(`Delete project "${project!.name}" and all its usage records? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  }

  async function deleteUsage(usageId: string) {
    if (!confirm("Delete this usage entry? Used quantity will be recalculated.")) return;
    try {
      const d = await api<{ project: Project }>(`/api/projects/${id}/usage/${usageId}`, { method: "DELETE" });
      setProject(d.project);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  function exportCsv() {
    const p = project!;
    downloadCsv(
      `${p.name.replace(/[^\w-]+/g, "_")}-materials.csv`,
      ["Item Code", "Item Description", "Category", "UOM", "Planned Qty", "Used Qty", "Remaining Qty", "Unit Rate", "Planned Amount", "Consumed Amount", "Balance Amount", "Utilisation %"],
      p.materials.map((m) => {
        const s = materialStats(m);
        return [m.itemCode, m.itemDescription, m.category, m.uom, m.plannedQty, m.usedQty, s.remainingQty, m.unitRate, s.plannedCost, s.consumedCost, s.balanceCost, s.utilisation];
      }),
    );
  }

  const details: [string, string][] = [
    ["MO Number", project.moNumber],
    ["CWO Number", project.cwoNumber],
    ["Site name", project.siteName],
    ["Location", project.location],
    ["Vendor", project.vendor],
    ["Created by", `${project.createdByName} · ${formatDate(project.createdAt)}`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline print:hidden">
            ← Dashboard
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <Badge tone={statusTone(project.status)}>{project.status}</Badge>
            {!project.canEdit && <Badge>Read only</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">Last updated {formatDate(project.updatedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
          <Button variant="secondary" onClick={() => window.print()}>Print</Button>
          {project.canEdit && (
            <>
              <LinkButton href={`/projects/${id}/edit`} variant="secondary">Edit project</LinkButton>
              <Button variant="danger" onClick={remove} loading={deleting}>Delete</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-4 p-4 sm:p-6 md:grid-cols-3 lg:grid-cols-6">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
              <dd className="mt-0.5 break-words font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Sanctioned budget"
          value={project.budget ? formatMoney(project.budget) : "—"}
          sub={totals.budgetUsedPct !== null ? `${totals.budgetUsedPct}% consumed` : "Not set"}
        />
        <StatCard label="Estimated material cost" value={formatMoney(totals.plannedCost)} sub={`${project.materials.length} items`} tone="blue" />
        <StatCard label="Consumed" value={formatMoney(totals.consumedCost)} sub={`${totals.progress}% of estimate`} tone="amber" />
        <StatCard label="Balance material" value={formatMoney(totals.balanceCost)} sub={`${totals.fullyConsumed} item(s) fully used`} tone={totals.balanceCost < 0 ? "rose" : "emerald"} />
        <StatCard
          label="Budget variance"
          value={totals.budgetVariance === null ? "—" : formatMoney(totals.budgetVariance)}
          sub={totals.budgetVariance === null ? "Set a budget to compare" : totals.budgetVariance < 0 ? "Estimate exceeds budget" : "Estimate within budget"}
          tone={totals.budgetVariance === null ? "slate" : totals.budgetVariance < 0 ? "rose" : "emerald"}
        />
      </div>

      {totals.excessItems > 0 && (
        <Alert tone="amber">
          {totals.excessItems} item(s) have consumption above the planned quantity. They are highlighted in the table below.
        </Alert>
      )}

      {project.canEdit && <UsageForm project={project} onSaved={setProject} />}

      <Card>
        <CardHeader title="Material status" subtitle="Planned vs. used vs. remaining, with cost impact" />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-4 py-3">Item code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3 text-right">Planned</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3 text-right">Remaining</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Planned amt</th>
                <th className="px-4 py-3 text-right">Consumed amt</th>
                <th className="min-w-36 px-4 py-3">Utilisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {project.materials.map((m) => {
                const s = materialStats(m);
                return (
                  <tr key={m._id} className={cx(s.isExcess && "bg-rose-50/60")}>
                    <td className={cx("sticky left-0 whitespace-nowrap px-4 py-3 font-mono text-xs", s.isExcess ? "bg-rose-50" : "bg-white")}>{m.itemCode}</td>
                    <td className="min-w-56 px-4 py-3">{m.itemDescription}</td>
                    <td className="px-4 py-3">{m.category}</td>
                    <td className="px-4 py-3">{m.uom}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatQty(m.plannedQty)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{formatQty(m.usedQty)}</td>
                    <td className={cx("whitespace-nowrap px-4 py-3 text-right font-medium", s.isExcess ? "text-rose-600" : "text-emerald-700")}>
                      {s.isExcess ? `${formatQty(Math.abs(s.remainingQty))} excess` : formatQty(s.remainingQty)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(m.unitRate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(s.plannedCost)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(s.consumedCost)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={s.utilisation} />
                        <span className="w-12 text-right text-xs text-slate-600">{s.utilisation}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <td className="sticky left-0 bg-slate-50 px-4 py-3" colSpan={8}>Total</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(totals.plannedCost)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">{formatMoney(totals.consumedCost)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={totals.progress} />
                    <span className="w-12 text-right text-xs">{totals.progress}%</span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Category summary" />
          <ul className="divide-y divide-slate-100">
            {byCategory.map(([cat, v]) => {
              const u = v.planned > 0 ? Math.round((v.consumed / v.planned) * 1000) / 10 : 0;
              return (
                <li key={cat} className="space-y-1.5 px-4 py-3 sm:px-6">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-900">{cat} <span className="font-normal text-slate-500">({v.items})</span></span>
                    <span className="text-slate-600">{u}%</span>
                  </div>
                  <ProgressBar value={u} />
                  <p className="text-xs text-slate-500">{formatMoney(v.consumed)} of {formatMoney(v.planned)}</p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Usage history" subtitle={`${project.usage.length} entr${project.usage.length === 1 ? "y" : "ies"}`} />
          {project.usage.length === 0 ? (
            <EmptyState title="No usage recorded yet" description={project.canEdit ? "Use the form above to record material consumption." : undefined} />
          ) : (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3">By</th>
                    {project.canEdit && <th className="px-4 py-3 print:hidden" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...project.usage]
                    .sort((a, b) => +new Date(b.date) - +new Date(a.date) || +new Date(b.createdAt ?? 0) - +new Date(a.createdAt ?? 0))
                    .map((u) => {
                      const m = materialById.get(u.materialId);
                      return (
                        <tr key={u._id}>
                          <td className="whitespace-nowrap px-4 py-3">{formatDate(u.date)}</td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs">{m?.itemCode ?? "—"}</p>
                            <p className="text-xs text-slate-500">{m?.itemDescription}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{formatQty(u.quantity)} {m?.uom}</td>
                          <td className="px-4 py-3 text-slate-600">{u.remarks || "—"}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-600">{u.recordedByName}</td>
                          {project.canEdit && (
                            <td className="px-4 py-3 text-right print:hidden">
                              <button onClick={() => deleteUsage(u._id)} className="text-xs font-medium text-rose-600 hover:underline">
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function UsageForm({ project, onSaved }: { project: Project; onSaved: (p: Project) => void }) {
  const [form, setForm] = useState({ materialId: "", quantity: "", date: today(), remarks: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const material = project.materials.find((m) => m._id === form.materialId);
  const remaining = material ? materialStats(material).remainingQty : 0;
  const qty = Number(form.quantity);
  const willExceed = material && qty > 0 && qty > remaining;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!material) return setError("Select a material");
    if (!(qty > 0)) return setError("Enter a quantity greater than 0");
    if (willExceed && !confirm(`This exceeds the remaining quantity (${formatQty(remaining)} ${material.uom}). Record anyway?`)) return;
    setSaving(true);
    try {
      const d = await api<{ project: Project }>(`/api/projects/${project._id}/usage`, { body: { ...form, quantity: qty } });
      onSaved(d.project);
      setSuccess(`Recorded ${formatQty(qty)} ${material.uom} of ${material.itemCode}`);
      setForm({ ...form, quantity: "", remarks: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record usage");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader title="Record material usage" subtitle="Log consumption as it happens. Used and remaining quantities update automatically." />
      <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
        {error && <Alert>{error}</Alert>}
        {success && <Alert tone="emerald">{success}</Alert>}
        <div className="grid gap-4 md:grid-cols-12">
          <div className="md:col-span-5">
            <Field label="Material" hint={material ? `Remaining: ${formatQty(remaining)} ${material.uom} of ${formatQty(material.plannedQty)}` : undefined}>
              <Select value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })} required>
                <option value="">Select item…</option>
                {project.materials.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.itemCode} — {m.itemDescription}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label={`Quantity${material ? ` (${material.uom})` : ""}`} error={willExceed ? "Exceeds remaining qty" : undefined}>
              <Input inputMode="decimal" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Date">
              <Input type="date" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label="Remarks">
              <Input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="e.g. Span A–B, challan #" />
            </Field>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>Record usage</Button>
        </div>
      </form>
    </Card>
  );
}
