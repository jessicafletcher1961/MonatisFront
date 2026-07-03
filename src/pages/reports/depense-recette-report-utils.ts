import type { DepenseRecetteCategoryView, DepenseRecetteSubcategoryView, DepenseRecetteView, PeriodTotalView } from '../../lib/reporting'

export interface DepenseRecetteSummary {
  totalRecette: number
  totalDepense: number
  solde: number
  operationCount: number
  categoryCount: number
  subcategoryCount: number
  strongestCategory: DepenseRecetteCategoryView | null
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

export function sumPeriods(periods: PeriodTotalView[]): PeriodTotalView {
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

export function getDepenseRecetteSummary(report: DepenseRecetteView): DepenseRecetteSummary {
  const total = sumPeriods(report.totals)
  const subcategoryCount = report.categories.reduce((sum, category) => sum + category.children.length, 0)
  const strongestCategory =
    report.categories
      .slice()
      .sort((left, right) => Math.abs(sumPeriods(right.totals).solde) - Math.abs(sumPeriods(left.totals).solde))[0] ?? null

  return {
    totalRecette: total.recette,
    totalDepense: total.depense,
    solde: total.solde,
    operationCount: total.details.length,
    categoryCount: report.categories.length,
    subcategoryCount,
    strongestCategory,
  }
}

export function depenseRecetteCategoryLabel(category: DepenseRecetteCategoryView): string {
  return category.categorie?.nom ?? 'Sans categorie'
}

export function depenseRecetteSubcategoryLabel(subcategory: DepenseRecetteSubcategoryView): string {
  return subcategory.sousCategorie?.nom ?? 'Sans sous-categorie'
}

export function depenseRecetteShare(periods: PeriodTotalView[], report: DepenseRecetteView): number {
  const total = report.categories.reduce((sum, category) => sum + Math.abs(sumPeriods(category.totals).solde), 0)

  if (!total) {
    return 0
  }

  return Math.max(3, Math.round((Math.abs(sumPeriods(periods).solde) / total) * 100))
}
