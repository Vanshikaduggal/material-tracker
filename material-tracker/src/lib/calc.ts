import type { Material } from "@/lib/types";

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

export function materialStats(m: Pick<Material, "plannedQty" | "usedQty" | "unitRate">) {
  const remainingQty = round(m.plannedQty - m.usedQty, 3);
  const plannedCost = round(m.plannedQty * m.unitRate);
  const consumedCost = round(m.usedQty * m.unitRate);
  const utilisation = m.plannedQty > 0 ? (m.usedQty / m.plannedQty) * 100 : m.usedQty > 0 ? 100 : 0;
  return {
    remainingQty,
    plannedCost,
    consumedCost,
    balanceCost: round(plannedCost - consumedCost),
    utilisation: round(utilisation, 1),
    isExcess: remainingQty < 0,
  };
}

export function projectTotals(materials: Pick<Material, "plannedQty" | "usedQty" | "unitRate">[], budget = 0) {
  let plannedCost = 0;
  let consumedCost = 0;
  let excessItems = 0;
  let fullyConsumed = 0;
  for (const m of materials) {
    const s = materialStats(m);
    plannedCost += s.plannedCost;
    consumedCost += s.consumedCost;
    if (s.isExcess) excessItems++;
    if (m.plannedQty > 0 && m.usedQty >= m.plannedQty) fullyConsumed++;
  }
  plannedCost = round(plannedCost);
  consumedCost = round(consumedCost);
  return {
    plannedCost,
    consumedCost,
    balanceCost: round(plannedCost - consumedCost),
    progress: plannedCost > 0 ? round((consumedCost / plannedCost) * 100, 1) : 0,
    budget,
    /** Positive = under budget, negative = estimated material cost exceeds budget. */
    budgetVariance: budget > 0 ? round(budget - plannedCost) : null,
    budgetUsedPct: budget > 0 ? round((consumedCost / budget) * 100, 1) : null,
    excessItems,
    fullyConsumed,
  };
}

const currency = process.env.NEXT_PUBLIC_CURRENCY || "INR";
const locale = process.env.NEXT_PUBLIC_LOCALE || "en-IN";

export const formatMoney = (n: number) =>
  new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);

export const formatQty = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(n || 0);

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
