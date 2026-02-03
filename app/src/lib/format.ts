export function formatCurrencyFromCents(cents: number, locale = "fr-FR", currency = "EUR") {
  if (Number.isNaN(cents)) return "-";
  const value = cents / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrency(value: number, locale = "fr-FR", currency = "EUR") {
  if (Number.isNaN(value)) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso?: string | null, locale = "fr-FR") {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function truncate(value: string, max = 32) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

export function accountTypeLabel(code?: string | null) {
  if (!code) return "INTERNE";
  const normalized = code.toUpperCase();
  const map: Record<string, string> = {
    COURANT: "Courant",
    FINANCIER: "Financier",
    BIEN: "Patrimoine",
    TECHNIQUE: "Technique",
    EXTERNE: "Externe",
  };
  return map[normalized] ?? normalized;
}

export function isValidIsoDate(value: string) {
  if (!value) return true;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}
