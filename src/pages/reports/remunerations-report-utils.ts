import type { PeriodTotalView, RemunerationsFraisView, RemunerationsTypeView } from '../../lib/reporting'

export interface RemunerationsSummary {
  totalRemunerations: number
  totalFrais: number
  net: number
  groupCount: number
  accountCount: number
  strongestGroup: RemunerationsTypeView | null
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

export function sumRemunerationsPeriods(periods: PeriodTotalView[]): PeriodTotalView {
  return periods.reduce(
    (total, period) => ({
      start: total.start || period.start,
      end: period.end || total.end,
      label: 'Total',
      recette: roundMoney(total.recette + period.recette),
      depense: roundMoney(total.depense + period.depense),
      solde: roundMoney(total.solde + period.solde),
      details: [...total.details, ...period.details],
    }),
    {
      start: '',
      end: '',
      label: 'Total',
      recette: 0,
      depense: 0,
      solde: 0,
      details: [],
    } satisfies PeriodTotalView,
  )
}

export function getRemunerationsSummary(report: RemunerationsFraisView): RemunerationsSummary {
  const total = sumRemunerationsPeriods(report.totals)
  const accountCount = report.groups.reduce((sum, group) => sum + group.accounts.length, 0)
  const strongestGroup =
    report.groups
      .slice()
      .sort((left, right) => Math.abs(sumRemunerationsPeriods(right.periods).solde) - Math.abs(sumRemunerationsPeriods(left.periods).solde))[0] ?? null

  return {
    totalRemunerations: total.recette,
    totalFrais: total.depense,
    net: total.solde,
    groupCount: report.groups.length,
    accountCount,
    strongestGroup,
  }
}

export function remunerationsShare(periods: PeriodTotalView[], report: RemunerationsFraisView): number {
  const total = report.groups.reduce((sum, group) => sum + Math.abs(sumRemunerationsPeriods(group.periods).solde), 0)

  if (!total) {
    return 0
  }

  return Math.max(3, Math.round((Math.abs(sumRemunerationsPeriods(periods).solde) / total) * 100))
}
