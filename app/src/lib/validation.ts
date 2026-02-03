export function sanitizeAmountInput(value: string) {
  return value.replace(/[^0-9.,]/g, "");
}

export function parseAmountToCents(value: string) {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return null;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}
