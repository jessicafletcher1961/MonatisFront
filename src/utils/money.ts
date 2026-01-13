export function centsToEuros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "";
  const v = cents / 100;
  return v.toFixed(2);
}

export function eurosToCents(input: string): number {
  // Accept "12", "12.3", "12,30"
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function formatEuro(input: string): string {
  // keep only digits, dot, comma
  const cleaned = input.replace(/[^0-9.,-]/g, "");
  return cleaned;
}
