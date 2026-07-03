import type { BilanPatrimoineView, BilanPeriodView, BilanTypeView } from '../../lib/reporting'

export interface BilanPeriodSummary {
  montantSoldeInitialEnEuros: number
  montantSoldeFinalEnEuros: number
  montantVariationEnEuros: number
  montantTotalRecetteEnEuros: number
  montantTotalDepenseEnEuros: number
  soldeTotalTechniqueEnEuros: number
  montantEcartNonJustifieEnEuros: number
}

export interface BilanReportSummary extends BilanPeriodSummary {
  groupCount: number
  accountCount: number
  strongestGroup: BilanTypeView | null
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

export function summarizeBilanPeriods(periods: BilanPeriodView[]): BilanPeriodSummary {
  const first = periods[0]
  const last = periods[periods.length - 1]
  const initial = first?.montantSoldeInitialEnEuros ?? 0
  const final = last?.montantSoldeFinalEnEuros ?? 0

  return {
    montantSoldeInitialEnEuros: roundMoney(initial),
    montantSoldeFinalEnEuros: roundMoney(final),
    montantVariationEnEuros: roundMoney(final - initial),
    montantTotalRecetteEnEuros: roundMoney(periods.reduce((sum, period) => sum + period.montantTotalRecetteEnEuros, 0)),
    montantTotalDepenseEnEuros: roundMoney(periods.reduce((sum, period) => sum + period.montantTotalDepenseEnEuros, 0)),
    soldeTotalTechniqueEnEuros: roundMoney(periods.reduce((sum, period) => sum + period.soldeTotalTechniqueEnEuros, 0)),
    montantEcartNonJustifieEnEuros: roundMoney(periods.reduce((sum, period) => sum + period.montantEcartNonJustifieEnEuros, 0)),
  }
}

export function getBilanReportSummary(report: BilanPatrimoineView): BilanReportSummary {
  const summary = summarizeBilanPeriods(report.totals)
  const accountCount = report.groups.reduce((sum, group) => sum + group.accounts.length, 0)
  const strongestGroup =
    report.groups
      .slice()
      .sort((left, right) => Math.abs(summarizeBilanPeriods(right.periods).montantSoldeFinalEnEuros) - Math.abs(summarizeBilanPeriods(left.periods).montantSoldeFinalEnEuros))[0] ?? null

  return {
    ...summary,
    groupCount: report.groups.length,
    accountCount,
    strongestGroup,
  }
}

export function bilanShare(periods: BilanPeriodView[], report: BilanPatrimoineView): number {
  const total = report.groups.reduce((sum, group) => sum + Math.abs(summarizeBilanPeriods(group.periods).montantSoldeFinalEnEuros), 0)

  if (!total) {
    return 0
  }

  return Math.max(3, Math.round((Math.abs(summarizeBilanPeriods(periods).montantSoldeFinalEnEuros) / total) * 100))
}
