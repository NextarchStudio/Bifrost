import ExcelJS from "exceljs";

export interface ShopImportRow {
  id?: number;
  name: string;
  category: string;
  size: string | null;
  quantity: number;
  notes: string | null;
}

export async function parseShopImport(filename: string, content: Buffer): Promise<ShopImportRow[]> {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "xlsx") return parseXlsx(content);
  if (extension === "csv") return mapImportedRows(parseCsv(content.toString("utf8")));
  if (extension === "xls") return mapImportedRows(parseHtmlTable(content.toString("utf8")));
  throw new Error("Bare XLSX, XLS og CSV er tillatt for import.");
}

export function mapImportedRows(rows: string[][]): ShopImportRow[] {
  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map(normalizeHeader);
  return dataRows.flatMap((values) => {
    const row: ShopImportRow = { name: "", category: "", size: null, quantity: 0, notes: null };
    values.forEach((value, index) => {
      const header = headers[index];
      if (!header) return;
      const trimmed = value.trim();
      if (header === "id") row.id = Math.max(0, Number.parseInt(trimmed, 10) || 0);
      else if (header === "quantity") row.quantity = Math.max(0, Number.parseInt(trimmed.replace(/[^\d-]/g, ""), 10) || 0);
      else if (header === "size") row.size = !trimmed || trimmed === "-" ? null : trimmed;
      else if (header === "notes") row.notes = !trimmed || trimmed === "-" ? null : trimmed;
      else row[header] = trimmed;
    });
    return row.name.trim() ? [row] : [];
  });
}

async function parseXlsx(content: Buffer): Promise<ShopImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(content).buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const rows: string[][] = [];
  worksheet.eachRow((row) => {
    const values: string[] = [];
    for (let column = 1; column <= row.cellCount; column += 1) values.push(cellText(row.getCell(column).value));
    if (values.some((value) => value.trim())) rows.push(values);
  });
  return mapImportedRows(rows);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  }
  return String(value);
}

function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = countOutsideQuotes(firstLine, ";") >= countOutsideQuotes(firstLine, ",") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(field); field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += character;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((match) => decodeHtml(match[1]!.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim());
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_match, entity: string) => {
    if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

function normalizeHeader(header: string): "id" | "name" | "category" | "size" | "quantity" | "notes" | null {
  const value = header.trim().toLocaleLowerCase("nb-NO").replaceAll("æ", "ae").replaceAll("ø", "o").replaceAll("å", "a");
  if (value === "id") return "id";
  if (["vare", "varenavn", "name", "item", "produkt"].includes(value)) return "name";
  if (["kategori", "category"].includes(value)) return "category";
  if (["storrelse", "størrelse", "size"].includes(value)) return "size";
  if (["antall", "quantity", "count"].includes(value)) return "quantity";
  if (["notater", "notat", "notes"].includes(value)) return "notes";
  return null;
}

function countOutsideQuotes(value: string, delimiter: string): number {
  let count = 0; let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '"') quoted = !quoted;
    else if (value[index] === delimiter && !quoted) count += 1;
  }
  return count;
}
