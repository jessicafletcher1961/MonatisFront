export function mostSignificantItems<T>(items: T[], valueOf: (item: T) => number): T[] {
  return [...items]
    .sort((a, b) => Math.abs(valueOf(b)) - Math.abs(valueOf(a)))
}

export function recentItems<T>(items: T[]): T[] {
  return items
}

export function periodCountLabel(periods: unknown[]): string | null {
  return periods.length > 1 ? `${periods.length} periodes` : null
}
