"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { formatMoney, formatQty, projectTotals } from "@/lib/calc";
import { downloadTemplate, readMaterialsFile } from "@/lib/excel-import";
import type { Project, ProjectStatus } from "@/lib/types";
import { Alert, Button, Card, CardHeader, Field, Input, Select, cx } from "@/components/ui";

const STATUSES: ProjectStatus[] = ["In Progress", "On Hold", "Completed"];

interface Row {
  key: string;
  _id?: string;
  itemCode: string;
  itemDescription: string;
  category: string;
  uom: string;
  plannedQty: string;
  unitRate: string;
  usedQty: number;
}

interface Details {
  name: string;
  moNumber: string;
  cwoNumber: string;
  siteName: string;
  location: string;
  vendor: string;
  budget: string;
  status: ProjectStatus;
}

let keySeq = 0;
const newKey = () => `r${++keySeq}`;
const emptyRow = (): Row => ({ key: newKey(), itemCode: "", itemDescription: "", category: "", uom: "", plannedQty: "", unitRate: "", usedQty: 0 });
const isBlank = (r: Row) => !r.itemCode && !r.itemDescription && !r.category && !r.uom && !r.plannedQty && !r.unitRate;
const toNum = (s: string) => {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

export function ProjectForm({ initial }: { initial?: Project }) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [step, setStep] = useState(isEdit ? 0 : 1);
  const [details, setDetails] = useState<Details>({
    name: initial?.name ?? "",
    moNumber: initial?.moNumber ?? "",
    cwoNumber: initial?.cwoNumber ?? "",
    siteName: initial?.siteName ?? "",
    location: initial?.location ?? "",
    vendor: initial?.vendor ?? "",
    budget: initial?.budget ? String(initial.budget) : "",
    status: initial?.status ?? "In Progress",
  });
  const [rows, setRows] = useState<Row[]>(
    initial?.materials.length
      ? initial.materials.map((m) => ({
          key: newKey(),
          _id: m._id,
          itemCode: m.itemCode,
          itemDescription: m.itemDescription,
          category: m.category,
          uom: m.uom,
          plannedQty: String(m.plannedQty),
          unitRate: String(m.unitRate),
          usedQty: m.usedQty,
        }))
      : [emptyRow(), emptyRow(), emptyRow()],
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ tone: "emerald" | "rose"; text: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filledRows = rows.filter((r) => !isBlank(r));
  const duplicateCodes = useMemo(() => {
    const counts = new Map<string, number>();
    filledRows.forEach((r) => {
      const c = r.itemCode.trim().toUpperCase();
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return new Set([...counts].filter(([, n]) => n > 1).map(([c]) => c));
  }, [filledRows]);

  const totals = projectTotals(
    filledRows.map((r) => ({ plannedQty: toNum(r.plannedQty) || 0, unitRate: toNum(r.unitRate) || 0, usedQty: r.usedQty })),
    toNum(details.budget) || 0,
  );

  const setD = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDetails({ ...details, [k]: e.target.value });

  const updateRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key: string) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : [emptyRow()]));

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setImportMsg(null);
    setImporting(true);
    try {
      const imported = await readMaterialsFile(file);
      if (!imported.length) {
        setImportMsg({ tone: "rose", text: `No material rows found in ${file.name}. Use the template's column headings.` });
        return;
      }
      setRows((rs) => [...rs.filter((r) => !isBlank(r)), ...imported.map((m) => ({ ...m, key: newKey(), usedQty: 0 }))]);
      setImportMsg({ tone: "emerald", text: `Imported ${imported.length} item(s) from ${file.name}. Review and fill any empty cells below.` });
    } catch {
      setImportMsg({ tone: "rose", text: `Could not read ${file.name}. Please upload an .xlsx, .xls or .csv file.` });
    } finally {
      setImporting(false);
    }
  }

  function validateDetails(): string {
    const labels: Record<string, string> = { name: "Project name", moNumber: "MO number", cwoNumber: "CWO number", siteName: "Site name", location: "Location", vendor: "Vendor" };
    for (const [k, label] of Object.entries(labels)) {
      if (!details[k as keyof Details].toString().trim()) return `${label} is required`;
    }
    if (details.budget && !(toNum(details.budget) >= 0)) return "Budget must be a positive number";
    return "";
  }

  function validateMaterials(): string {
    if (!filledRows.length) return "Add at least one material item";
    for (const [i, r] of filledRows.entries()) {
      const n = `Row ${i + 1}`;
      if (!r.itemCode.trim() || !r.itemDescription.trim() || !r.category.trim() || !r.uom.trim())
        return `${n}: Item code, description, category and UOM are required`;
      if (!(toNum(r.plannedQty) >= 0) || r.plannedQty === "") return `${n}: Enter a valid planned quantity`;
      if (r.unitRate !== "" && !(toNum(r.unitRate) >= 0)) return `${n}: Enter a valid unit rate`;
    }
    if (duplicateCodes.size) return `Duplicate item codes: ${[...duplicateCodes].join(", ")}`;
    return "";
  }

  function next() {
    const msg = step === 1 ? validateDetails() : validateMaterials();
    setError(msg);
    if (!msg) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    // Enter key in a field submits the form; on intermediate steps that should just advance.
    if (!isEdit && step < 3) return next();
    const msg = validateDetails() || validateMaterials();
    setError(msg);
    if (msg) return;
    setSaving(true);
    try {
      const body = {
        ...details,
        budget: toNum(details.budget) || 0,
        materials: filledRows.map((r) => ({
          _id: r._id,
          itemCode: r.itemCode.trim().toUpperCase(),
          itemDescription: r.itemDescription.trim(),
          category: r.category.trim(),
          uom: r.uom.trim(),
          plannedQty: toNum(r.plannedQty),
          unitRate: toNum(r.unitRate) || 0,
        })),
      };
      if (isEdit) {
        await api(`/api/projects/${initial!._id}`, { method: "PUT", body });
        router.push(`/projects/${initial!._id}`);
      } else {
        const res = await api<{ project: { _id: string } }>("/api/projects", { body });
        router.push(`/projects/${res.project._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save project");
      setSaving(false);
    }
  }

  const showDetails = isEdit || step === 1;
  const showMaterials = isEdit || step === 2;
  const showReview = !isEdit && step === 3;

  return (
    <form onSubmit={save} className="space-y-6">
      {!isEdit && <Stepper step={step} />}
      {error && <Alert>{error}</Alert>}

      {showDetails && (
        <Card>
          <CardHeader title="Project details" subtitle="Order references, site and vendor information" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Project name *">
                <Input value={details.name} onChange={setD("name")} placeholder="e.g. FTTH Rollout – Phase 2" autoFocus={!isEdit} />
              </Field>
            </div>
            <Field label="MO Number *">
              <Input value={details.moNumber} onChange={setD("moNumber")} placeholder="MO-2026-0012" />
            </Field>
            <Field label="CWO Number *">
              <Input value={details.cwoNumber} onChange={setD("cwoNumber")} placeholder="CWO-45871" />
            </Field>
            <Field label="Vendor *">
              <Input value={details.vendor} onChange={setD("vendor")} placeholder="Vendor / contractor name" />
            </Field>
            <Field label="Site name *">
              <Input value={details.siteName} onChange={setD("siteName")} />
            </Field>
            <Field label="Location *">
              <Input value={details.location} onChange={setD("location")} placeholder="City, State" />
            </Field>
            <Field label="Sanctioned budget" hint="Optional – used for budget variance">
              <Input inputMode="decimal" value={details.budget} onChange={setD("budget")} placeholder="0.00" />
            </Field>
            {isEdit && (
              <Field label="Status">
                <Select value={details.status} onChange={setD("status")}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        </Card>
      )}

      {showMaterials && (
        <Card>
          <CardHeader
            title="Bill of materials"
            subtitle="Planned quantity and unit rate drive the budget & consumption calculations"
            action={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={importFile}
                />
                <Button type="button" variant="ghost" onClick={() => downloadTemplate()}>
                  Download template
                </Button>
                <Button type="button" variant="secondary" loading={importing} onClick={() => fileRef.current?.click()}>
                  Import from Excel
                </Button>
                <Button type="button" onClick={() => setRows([...rows, emptyRow()])}>
                  + Add item
                </Button>
              </>
            }
          />

          {importMsg && (
            <div className="border-b border-slate-200 px-4 py-3 sm:px-6">
              <Alert tone={importMsg.tone}>{importMsg.text}</Alert>
            </div>
          )}

          <div className="p-4 sm:p-6">
            <div className="hidden grid-cols-[40px_140px_minmax(200px,1fr)_120px_120px_110px_120px_40px] gap-2 px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <span>#</span>
              <span>Item code</span>
              <span>Item description</span>
              <span>Category</span>
              <span>UOM</span>
              <span>Planned qty</span>
              <span>Unit rate</span>
              <span />
            </div>
            <div className="space-y-3 lg:space-y-2">
              {rows.map((r, i) => {
                const dup = duplicateCodes.has(r.itemCode.trim().toUpperCase());
                const locked = r.usedQty > 0;
                return (
                  <div
                    key={r.key}
                    className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4 lg:grid-cols-[40px_140px_minmax(200px,1fr)_120px_120px_110px_120px_40px] lg:items-center lg:border-0 lg:p-0"
                  >
                    <span className="col-span-2 text-xs font-semibold text-slate-500 sm:col-span-4 lg:col-span-1 lg:text-center">
                      <span className="lg:hidden">Item </span>
                      {i + 1}
                    </span>
                    <CellInput label="Item code" value={r.itemCode} invalid={dup} onChange={(v) => updateRow(r.key, { itemCode: v })} className="uppercase" />
                    <CellInput label="Description" value={r.itemDescription} onChange={(v) => updateRow(r.key, { itemDescription: v })} wrapClass="col-span-2 sm:col-span-3 lg:col-span-1" />
                    <CellInput label="Category" value={r.category} onChange={(v) => updateRow(r.key, { category: v })} />
                    <CellInput label="UOM" value={r.uom} onChange={(v) => updateRow(r.key, { uom: v })} />
                    <CellInput label="Planned qty" value={r.plannedQty} inputMode="decimal" onChange={(v) => updateRow(r.key, { plannedQty: v })} />
                    <CellInput label="Unit rate" value={r.unitRate} inputMode="decimal" onChange={(v) => updateRow(r.key, { unitRate: v })} />
                    <div className="flex items-end justify-end lg:items-center lg:justify-center">
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        disabled={locked}
                        title={locked ? `Used qty ${formatQty(r.usedQty)} recorded – delete usage entries first` : "Remove item"}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                        aria-label="Remove item"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 rounded-lg bg-slate-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-slate-600">
                <b className="text-slate-900">{filledRows.length}</b> item(s)
              </span>
              <span className="text-slate-600">
                Estimated material cost: <b className="text-slate-900">{formatMoney(totals.plannedCost)}</b>
                {totals.budgetVariance !== null && (
                  <span className={cx("ml-2 font-medium", totals.budgetVariance < 0 ? "text-rose-600" : "text-emerald-600")}>
                    ({totals.budgetVariance < 0 ? "over" : "within"} budget by {formatMoney(Math.abs(totals.budgetVariance))})
                  </span>
                )}
              </span>
            </div>
          </div>
        </Card>
      )}

      {showReview && <Review details={details} rows={filledRows} totals={totals} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => (isEdit || step === 1 ? router.back() : (setError(""), setStep(step - 1)))}
        >
          {isEdit || step === 1 ? "Cancel" : "← Back"}
        </Button>
        {isEdit || step === 3 ? (
          <Button key="submit" type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        ) : (
          <Button key="next" type="button" onClick={next}>
            Continue →
          </Button>
        )}
      </div>
    </form>
  );
}

function CellInput({
  label,
  value,
  onChange,
  invalid,
  className,
  wrapClass,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
  wrapClass?: string;
  inputMode?: "decimal";
}) {
  return (
    <label className={cx("block", wrapClass)}>
      <span className="mb-0.5 block text-xs text-slate-500 lg:sr-only">{label}</span>
      <Input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(className, invalid && "border-rose-400 ring-2 ring-rose-100")}
        {...rest}
      />
    </label>
  );
}

function Stepper({ step }: { step: number }) {
  const steps = ["Project details", "Materials", "Review & create"];
  return (
    <ol className="flex items-center gap-2 text-sm">
      {steps.map((s, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                state === "done" && "bg-blue-600 text-white",
                state === "current" && "border-2 border-blue-600 text-blue-600",
                state === "todo" && "border-2 border-slate-300 text-slate-400",
              )}
            >
              {state === "done" ? "✓" : n}
            </span>
            <span className={cx("hidden font-medium sm:inline", state === "todo" ? "text-slate-400" : "text-slate-900")}>{s}</span>
            {n < steps.length && <span className="h-px flex-1 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}

function Review({ details, rows, totals }: { details: Details; rows: Row[]; totals: ReturnType<typeof projectTotals> }) {
  const info: [string, string][] = [
    ["Project", details.name],
    ["MO Number", details.moNumber],
    ["CWO Number", details.cwoNumber],
    ["Site", details.siteName],
    ["Location", details.location],
    ["Vendor", details.vendor],
    ["Budget", details.budget ? formatMoney(toNum(details.budget)) : "—"],
    ["Estimated cost", formatMoney(totals.plannedCost)],
  ];
  return (
    <Card>
      <CardHeader title="Review" subtitle="Check everything before creating the project" />
      <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        {info.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto border-t border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Item code</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">UOM</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Rate</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">{r.itemCode.toUpperCase()}</td>
                <td className="px-4 py-2">{r.itemDescription}</td>
                <td className="px-4 py-2">{r.category}</td>
                <td className="px-4 py-2">{r.uom}</td>
                <td className="px-4 py-2 text-right">{formatQty(toNum(r.plannedQty))}</td>
                <td className="px-4 py-2 text-right">{formatMoney(toNum(r.unitRate) || 0)}</td>
                <td className="px-4 py-2 text-right font-medium">{formatMoney((toNum(r.plannedQty) || 0) * (toNum(r.unitRate) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
