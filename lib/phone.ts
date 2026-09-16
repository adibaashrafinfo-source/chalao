// Bangladeshi mobile numbers. Sellers type them in many shapes
// (+8801712345678, 8801712345678, 01712-345678); store one canonical form.

export function normalizeBdPhone(input: string): string {
  const digits = input.replace(/\D/g, "");

  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  if (digits.startsWith("0")) return digits;
  // 1712345678 — the leading zero was dropped
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;

  return digits;
}

/** True for a local mobile number: 11 digits, 01[3-9]xxxxxxxx. */
export function isBdMobile(value: string): boolean {
  return /^01[3-9]\d{8}$/.test(normalizeBdPhone(value));
}

/** 01712345678 → 01712-345678 */
export function formatPhone(value: string): string {
  const normalized = normalizeBdPhone(value);
  return isBdMobile(normalized) ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : value;
}
