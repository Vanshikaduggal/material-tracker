export interface ImportedRow {
  itemCode: string;
  itemDescription: string;
  category: string;
  uom: string;
  plannedQty: string;
  unitRate: string;
}

export const TEMPLATE_HEADERS = ["Item Code", "Item Description", "Category", "UOM", "Planned Qty", "Unit Rate"];

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Header aliases, normalised (lowercase letters only).
const COLUMNS: Record<keyof ImportedRow, string[]> = {
  itemCode: ["itemcode", "code", "materialcode", "partno", "partnumber"],
  itemDescription: ["itemdescription", "description", "desc", "materialdescription", "itemname"],
  category: ["category", "type"],
  uom: ["uom", "unit", "unitofmeasure", "units"],
  plannedQty: ["plannedqty", "qty", "quantity", "plannedquantity", "boqqty", "reqqty"],
  unitRate: ["unitrate", "rate", "price", "unitprice"],
};

const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/**
 * Reads the first worksheet of an .xlsx/.xls/.csv file.
 * Columns are matched by header name (any order); without a recognisable header row,
 * the template column order is assumed.
 */
export async function readMaterialsFile(file: File): Promise<ImportedRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("The file has no worksheets");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true, blankrows: false });

  const headerIdx = rows.slice(0, 20).findIndex((r) => r.some((c) => COLUMNS.itemCode.includes(norm(c))));
  const map = {} as Record<keyof ImportedRow, number>;
  if (headerIdx >= 0) {
    const header = rows[headerIdx].map(norm);
    for (const [key, aliases] of Object.entries(COLUMNS) as [keyof ImportedRow, string[]][]) {
      map[key] = header.findIndex((h) => aliases.includes(h));
    }
  } else {
    (Object.keys(COLUMNS) as (keyof ImportedRow)[]).forEach((k, i) => (map[k] = i));
  }

  const get = (r: unknown[], k: keyof ImportedRow) => (map[k] >= 0 ? cell(r[map[k]]) : "");
  return rows
    .slice(headerIdx + 1)
    .map((r) => ({
      itemCode: get(r, "itemCode"),
      itemDescription: get(r, "itemDescription"),
      category: get(r, "category"),
      uom: get(r, "uom"),
      plannedQty: get(r, "plannedQty"),
      unitRate: get(r, "unitRate"),
    }))
    .filter((r) => r.itemCode || r.itemDescription);
}

export async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ["DUC000059", "HDPE Duct 40/34.2mm Green", "Supply", "Kilometer", 12, 45000],
  ]);
  ws["!cols"] = [{ wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Materials");
  XLSX.writeFile(wb, "materials-template.xlsx");
}
