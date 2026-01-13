import { format, parseISO, isValid } from "date-fns";

export function toLocalDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function safeFormatLocalDate(iso: string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    if (!isValid(d)) return "";
    return format(d, pattern);
  } catch {
    return "";
  }
}
