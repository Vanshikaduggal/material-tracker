type Cell = string | number | null | undefined;

const escape = (v: Cell) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const csv = [header, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
  // BOM so Excel opens UTF-8 (₹ etc.) correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
