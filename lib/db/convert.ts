/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ColumnKind, TableInfo } from "@/lib/db/meta";

const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** A JavaScript date or ISO string, as the text MySQL stores for a DATETIME (always UTC). */
export function toDbDateTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString().replace("T", " ").replace("Z", "");
  if (typeof value !== "string") return String(value);
  // No zone given: the app has always meant UTC here.
  if (NAIVE_DATETIME.test(value)) return value.replace("T", " ");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().replace("T", " ").replace("Z", "");
}

export function toDbDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return String(value);
  return value.length >= 10 ? value.slice(0, 10) : value;
}

/** App value → value to bind in a query. */
export function toDbValue(kind: ColumnKind | undefined, value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  switch (kind) {
    case "bool":
      return value ? 1 : 0;
    case "json":
      return typeof value === "string" ? value : JSON.stringify(value);
    case "ts":
      return toDbDateTime(value);
    case "date":
      return toDbDate(value);
    default:
      return value instanceof Date ? toDbDateTime(value) : value;
  }
}

/** Value read from MySQL → the shape the app expects. */
export function fromDbValue(kind: ColumnKind | undefined, value: any): any {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case "bool":
      return value === true || value === 1 || value === "1";
    case "json":
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    case "ts":
      return typeof value === "string" ? `${value.replace(" ", "T")}Z` : value;
    case "int":
    case "num":
      return typeof value === "string" ? Number(value) : value;
    default:
      return value;
  }
}

export function fromDbRow(info: TableInfo | undefined, row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = fromDbValue(info?.columns.get(key), value);
  }
  return out;
}
