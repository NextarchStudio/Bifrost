import type { BarcodeExportRequest } from "@bifrost/contracts";

export const MAX_BARCODE_EXPORT_CODES = 100_000;
const MAX_BARCODE_LENGTH = 150;

export class BarcodeDomainError extends Error {
  constructor(message: string, readonly code: "INVALID_INPUT" | "TOO_MANY_CODES" = "INVALID_INPUT") {
    super(message);
  }
}

export interface BarcodeExport {
  filename: string;
  content: Buffer;
  mime: "text/plain; charset=UTF-8";
  count: number;
}

export interface BarcodeService {
  buildExport(input: BarcodeExportRequest): BarcodeExport;
}

export function createBarcodeService(now: () => Date = () => new Date()): BarcodeService {
  return {
    buildExport(input) {
      const codes = collectBarcodeCodes(input);
      const filename = `${barcodeExportFilename(input.filename ?? "", now())}.udl`;
      return {
        filename,
        content: Buffer.from(`\uFEFF${codes.join("\r\n")}\r\n`, "utf8"),
        mime: "text/plain; charset=UTF-8",
        count: codes.length,
      };
    },
  };
}

export function collectBarcodeCodes(input: BarcodeExportRequest): string[] {
  const codes: string[] = [];
  const rawCodes = input.codes?.trim() ?? "";
  const rangeStart = input.rangeStart?.trim() ?? "";
  const rangeEnd = input.rangeEnd?.trim() ?? "";

  if (rawCodes) codes.push(...parseBarcodeCodes(rawCodes));

  if (rangeStart || rangeEnd) {
    if (!rangeStart || !rangeEnd) {
      throw new BarcodeDomainError("Fyll inn både fra-kode og til-kode for å lage en serie.");
    }
    codes.push(...buildBarcodeRange(rangeStart, rangeEnd));
  }

  const uniqueCodes = [...new Set(codes)];
  if (uniqueCodes.length === 0) {
    throw new BarcodeDomainError("Legg inn minst ett strekkodenummer eller et intervall.");
  }
  if (uniqueCodes.length > MAX_BARCODE_EXPORT_CODES) {
    throw new BarcodeDomainError(`En eksport kan inneholde maks ${MAX_BARCODE_EXPORT_CODES.toLocaleString("nb-NO")} koder.`, "TOO_MANY_CODES");
  }
  return uniqueCodes;
}

export function parseBarcodeCodes(rawCodes: string): string[] {
  const codes = rawCodes.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  if (codes.length === 0) throw new BarcodeDomainError("Legg inn minst ett strekkodenummer.");
  for (const code of codes) validateBarcodeLength(code);
  return codes;
}

export function buildBarcodeRange(startCode: string, endCode: string): string[] {
  validateBarcodeLength(startCode);
  validateBarcodeLength(endCode);
  const pattern = /^(.*?)(\d+)([^0-9]*)$/;
  const start = pattern.exec(startCode);
  const end = pattern.exec(endCode);
  if (!start || !end) {
    throw new BarcodeDomainError("Intervall må slutte med tall, for eksempel TG26-0001 til TG26-0020.");
  }

  const [, startPrefix = "", startNumberRaw = "", startSuffix = ""] = start;
  const [, endPrefix = "", endNumberRaw = "", endSuffix = ""] = end;
  if (startPrefix !== endPrefix || startSuffix !== endSuffix) {
    throw new BarcodeDomainError("Fra-kode og til-kode må ha samme tekst før og etter tallene.");
  }

  const startNumber = BigInt(startNumberRaw);
  const endNumber = BigInt(endNumberRaw);
  if (endNumber < startNumber) {
    throw new BarcodeDomainError("Til-kode må være større enn eller lik fra-kode.");
  }

  const total = endNumber - startNumber + 1n;
  if (total > BigInt(MAX_BARCODE_EXPORT_CODES)) {
    throw new BarcodeDomainError(`Et intervall kan inneholde maks ${MAX_BARCODE_EXPORT_CODES.toLocaleString("nb-NO")} koder.`, "TOO_MANY_CODES");
  }

  const width = Math.max(startNumberRaw.length, endNumberRaw.length);
  const codes: string[] = [];
  for (let number = startNumber; number <= endNumber; number += 1n) {
    codes.push(`${startPrefix}${number.toString().padStart(width, "0")}${startSuffix}`);
  }
  return codes;
}

export function barcodeExportFilename(requestedFilename: string, now: Date): string {
  const requested = requestedFilename.trim();
  if (!requested) return `strekkoder-${localTimestamp(now)}`;
  const sanitized = requested.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-._]+|[-._]+$/g, "");
  return sanitized || `strekkoder-${localTimestamp(now)}`;
}

function validateBarcodeLength(code: string): void {
  if (code.length > MAX_BARCODE_LENGTH) {
    throw new BarcodeDomainError(`Strekkoder kan maks være ${MAX_BARCODE_LENGTH} tegn.`);
  }
}

function localTimestamp(value: Date): string {
  const part = (number: number) => String(number).padStart(2, "0");
  return `${value.getFullYear()}${part(value.getMonth() + 1)}${part(value.getDate())}-${part(value.getHours())}${part(value.getMinutes())}${part(value.getSeconds())}`;
}
