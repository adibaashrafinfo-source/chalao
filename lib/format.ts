// Shared formatters. Never format currency inline — always go through formatBDT().

// en-IN gives South Asian (lakh/crore) digit grouping: 185450 → "1,85,450".
const groupedInteger = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const groupedDecimal = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type Amount = number | string | null | undefined;

function toNumber(value: Amount): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * formatBDT(185450)  → "৳ 1,85,450"
 * formatBDT(1250.5)  → "৳ 1,250.50"
 * formatBDT(-300)    → "-৳ 300"
 * formatBDT(null)    → "৳ 0" (or options.fallback)
 */
export function formatBDT(value: Amount, options: { fallback?: string } = {}): string {
  const n = toNumber(value);
  if (n === null) return options.fallback ?? "৳ 0";

  const abs = Math.abs(n);
  const body = Number.isInteger(abs) ? groupedInteger.format(abs) : groupedDecimal.format(abs);
  return `${n < 0 ? "-" : ""}৳ ${body}`;
}

/** Plain counts with the same lakh grouping, no currency sign. */
export function formatCount(value: Amount): string {
  const n = toNumber(value);
  return n === null ? "0" : groupedInteger.format(n);
}
