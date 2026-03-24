import {
  addDays,
  addMonths,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from 'date-fns'

export type MonatisPeriodCode = 'ANNEE' | 'SEMESTRE' | 'TRIMESTRE' | 'BIMESTRE' | 'MOIS' | '' | null | undefined

export interface PeriodBucket {
  key: string
  label: string
  start: string
  end: string
}

const moneyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
})

export function formatCurrency(value?: number | null): string {
  return moneyFormatter.format(value ?? 0)
}

export function formatCurrencyFromCents(value?: number | null): string {
  return formatCurrency((value ?? 0) / 100)
}

export function toMoneyInput(value?: number | null): string {
  return value == null ? '' : ((value ?? 0) / 100).toFixed(2)
}

export function parseMoneyToCents(value: string): number {
  const normalized = value.replace(',', '.').trim()
  if (!normalized) {
    return 0
  }

  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) {
    return 0
  }

  return Math.round(parsed * 100)
}

export function formatDate(iso?: string | null, pattern = 'dd MMM yyyy'): string {
  if (!iso) {
    return 'Non renseigne'
  }

  return format(parseISO(iso), pattern)
}

export function formatShortDate(iso?: string | null): string {
  return formatDate(iso, 'dd/MM/yyyy')
}

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function compareIsoDate(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1

  return a.localeCompare(b)
}

export function isIsoWithinRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end
}

export function dayBefore(iso: string): string {
  return isoDate(addDays(parseISO(iso), -1))
}

function clampPeriod(start: Date, end: Date, min: Date, max: Date): { start: Date; end: Date } | null {
  const effectiveStart = isBefore(start, min) ? min : start
  const effectiveEnd = isAfter(end, max) ? max : end

  if (isAfter(effectiveStart, effectiveEnd)) {
    return null
  }

  return {
    start: effectiveStart,
    end: effectiveEnd,
  }
}

function createBucket(start: Date, end: Date): PeriodBucket {
  return {
    key: `${isoDate(start)}_${isoDate(end)}`,
    label: `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`,
    start: isoDate(start),
    end: isoDate(end),
  }
}

function startOfSemester(date: Date): Date {
  const month = date.getMonth()
  return month < 6 ? new Date(date.getFullYear(), 0, 1) : new Date(date.getFullYear(), 6, 1)
}

function endOfSemester(date: Date): Date {
  const month = date.getMonth()
  return month < 6 ? new Date(date.getFullYear(), 5, 30) : new Date(date.getFullYear(), 11, 31)
}

function startOfBimester(date: Date): Date {
  const month = date.getMonth()
  const bimesterMonth = month - (month % 2)
  return new Date(date.getFullYear(), bimesterMonth, 1)
}

function endOfBimester(date: Date): Date {
  return addDays(addMonths(startOfBimester(date), 2), -1)
}

export function buildPeriodBuckets(startIso: string, endIso: string, codeTypePeriode: MonatisPeriodCode): PeriodBucket[] {
  const start = parseISO(startIso)
  const end = parseISO(endIso)

  if (!codeTypePeriode) {
    return [createBucket(start, end)]
  }

  const buckets: PeriodBucket[] = []

  if (codeTypePeriode === 'MOIS') {
    let cursor = startOfMonth(start)
    while (!isAfter(cursor, end)) {
      const clamped = clampPeriod(cursor, endOfMonth(cursor), start, end)
      if (clamped) {
        buckets.push(createBucket(clamped.start, clamped.end))
      }
      cursor = addMonths(cursor, 1)
    }
    return buckets
  }

  if (codeTypePeriode === 'BIMESTRE') {
    let cursor = startOfBimester(start)
    while (!isAfter(cursor, end)) {
      const clamped = clampPeriod(cursor, endOfBimester(cursor), start, end)
      if (clamped) {
        buckets.push(createBucket(clamped.start, clamped.end))
      }
      cursor = addMonths(cursor, 2)
    }
    return buckets
  }

  if (codeTypePeriode === 'TRIMESTRE') {
    let cursor = startOfQuarter(start)
    while (!isAfter(cursor, end)) {
      const clamped = clampPeriod(cursor, endOfQuarter(cursor), start, end)
      if (clamped) {
        buckets.push(createBucket(clamped.start, clamped.end))
      }
      cursor = addMonths(cursor, 3)
    }
    return buckets
  }

  if (codeTypePeriode === 'SEMESTRE') {
    let cursor = startOfSemester(start)
    while (!isAfter(cursor, end)) {
      const clamped = clampPeriod(cursor, endOfSemester(cursor), start, end)
      if (clamped) {
        buckets.push(createBucket(clamped.start, clamped.end))
      }
      cursor = addMonths(cursor, 6)
    }
    return buckets
  }

  let cursor = startOfYear(start)
  while (!isAfter(cursor, end)) {
    const clamped = clampPeriod(cursor, endOfYear(cursor), start, end)
    if (clamped) {
      buckets.push(createBucket(clamped.start, clamped.end))
    }
    cursor = addMonths(cursor, 12)
  }
  return buckets
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value)
}

export function nullIfBlank(value: string): string | null {
  return value.trim() ? value.trim() : null
}
