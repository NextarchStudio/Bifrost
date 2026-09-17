import type { ShopItem } from "@bifrost/contracts";

export function buildShopCsv(items: ShopItem[]): Buffer {
  const rows = [["ID", "Vare", "Kategori", "Storrelse", "Antall", "Notater"], ...items.map((item) => [
    String(item.id), item.name, item.categoryName, item.size ?? "-", String(item.quantity), item.notes ?? "-",
  ])];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
  return Buffer.from(`\uFEFF${csv}`, "utf8");
}

export function buildShopPdf(items: ShopItem[]): Buffer {
  const lines = [
    "Varelager",
    "",
    columns("ID", "Vare", "Kategori", "Storrelse", "Antall", "Notater"),
    "-".repeat(110),
    ...items.map((item) => columns(String(item.id), item.name, item.categoryName, item.size ?? "-", String(item.quantity), item.notes ?? "-")),
  ];
  return simplePdf(lines);
}

function columns(id: string, name: string, category: string, size: string, quantity: string, notes: string): string {
  return `${fit(id, 6)} ${fit(name, 28)} ${fit(category, 18)} ${fit(size, 12)} ${fit(quantity, 8)} ${fit(notes, 40)}`;
}

function fit(value: string, width: number): string {
  const plain = value.replace(/\s+/g, " ").trim() || "-";
  const shortened = plain.length > width ? `${plain.slice(0, Math.max(1, width - 3))}...` : plain;
  return shortened.padEnd(width, " ");
}

function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }

function simplePdf(lines: string[]): Buffer {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += 50) chunks.push(lines.slice(index, index + 50));
  if (!chunks.length) chunks.push([]);
  const objects: string[] = ["<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"];
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (const chunk of chunks) {
    let content = "BT\n/F1 10 Tf\n";
    let y = 802;
    for (const line of chunk) {
      content += `1 0 0 1 40 ${y} Tm\n(${pdfText(line)}) Tj\n`;
      y -= 14;
    }
    content += "ET";
    objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    contentIds.push(objects.length);
    objects.push("");
    pageIds.push(objects.length);
  }
  const pagesId = objects.length + 1;
  pageIds.forEach((pageId, index) => {
    objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 1 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
  });
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = objects.length + 1;
  objects.push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

function pdfText(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replaceAll("ø", "o").replaceAll("Ø", "O")
    .replace(/[^\x20-\x7E]/g, "?").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}
