import type { PlusMoinsValuePeriodView, PlusMoinsValueTypeView, PlusMoinsValueView } from '../../lib/reporting'

export interface PlusMoinsPeriodSummary {
  montantSoldeInitialEnEuros: number
  montantOperationsEnEuros: number
  montantPlusMoinsValueNetteEnEuros: number
  tauxPlusMoinsValueNette: number | null
  montantSoldeFinalEnEuros: number
  montantFraisEnEuros: number
  tauxFrais: number | null
}

export interface PlusMoinsReportSummary extends PlusMoinsPeriodSummary {
  groupCount: number
  accountCount: number
  strongestGroup: PlusMoinsValueTypeView | null
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

function roundRate(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null
  }

  return Number.parseFloat(value.toFixed(2))
}

export function plusMoinsRateLabel(value: number | null): string {
  return value == null ? '-' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`
}

export function summarizePlusMoinsPeriods(periods: PlusMoinsValuePeriodView[]): PlusMoinsPeriodSummary {
  const first = periods[0]
  const last = periods[periods.length - 1]
  const operations = periods.reduce((sum, period) => sum + period.montantOperationsEnEuros, 0)
  const plusMoinsValue = periods.reduce((sum, period) => sum + period.montantPlusMoinsValueNetteEnEuros, 0)
  const frais = periods.reduce((sum, period) => sum + period.montantFraisEnEuros, 0)
  const initial = first?.montantSoldeInitialEnEuros ?? 0
  const final = last?.montantSoldeFinalEnEuros ?? 0
  const base = initial + operations

  return {
    montantSoldeInitialEnEuros: roundMoney(initial),
    montantOperationsEnEuros: roundMoney(operations),
    montantPlusMoinsValueNetteEnEuros: roundMoney(plusMoinsValue),
    tauxPlusMoinsValueNette: roundRate(base === 0 ? null : (100 * plusMoinsValue) / base),
    montantSoldeFinalEnEuros: roundMoney(final),
    montantFraisEnEuros: roundMoney(frais),
    tauxFrais: roundRate(final === 0 ? null : (100 * frais) / final),
  }
}

export function getPlusMoinsReportSummary(report: PlusMoinsValueView): PlusMoinsReportSummary {
  const summary = summarizePlusMoinsPeriods(report.totals)
  const accountCount = report.groups.reduce((sum, group) => sum + group.accounts.length, 0)
  const strongestGroup =
    report.groups
      .slice()
      .sort(
        (left, right) =>
          Math.abs(summarizePlusMoinsPeriods(right.periods).montantPlusMoinsValueNetteEnEuros) -
          Math.abs(summarizePlusMoinsPeriods(left.periods).montantPlusMoinsValueNetteEnEuros),
      )[0] ?? null

  return {
    ...summary,
    groupCount: report.groups.length,
    accountCount,
    strongestGroup,
  }
}

export function plusMoinsShare(periods: PlusMoinsValuePeriodView[], report: PlusMoinsValueView): number {
  const total = report.groups.reduce((sum, group) => sum + Math.abs(summarizePlusMoinsPeriods(group.periods).montantPlusMoinsValueNetteEnEuros), 0)

  if (!total) {
    return 0
  }

  return Math.max(3, Math.round((Math.abs(summarizePlusMoinsPeriods(periods).montantPlusMoinsValueNetteEnEuros) / total) * 100))
}
