import { formatShortDate, isoDate, todayIso } from '../../lib/format'
import type { BudgetDetail, BudgetResource, Typology } from '../../lib/monatis-api'

export type BudgetDirectionFilter = 'all' | 'income' | 'expense'
export type BudgetPeriodFilter = 'all' | 'current' | 'future' | 'past'
export type BudgetDirection = 'income' | 'expense' | 'neutral'
export type BudgetPeriodStatus = 'current' | 'future' | 'past'

export interface BudgetFormState {
  cle: string
  nomReference: string
  codeTypePeriode: string
  dateCible: string
  codeTypeBudget: string
  montantBudget: string
  libelle: string
}

export interface BudgetSummary {
  incomeCents: number
  expenseCents: number
  netCents: number
  currentCount: number
  totalCount: number
}

export interface BudgetGroup {
  status: BudgetPeriodStatus
  label: string
  items: BudgetDetail[]
}

export const resourceOptions = [
  { value: 'beneficiaire', label: 'Par beneficiaire' },
  { value: 'categorie', label: 'Par categorie' },
  { value: 'souscategorie', label: 'Par sous-categorie' },
]

export const directionOptions: Array<{ value: BudgetDirectionFilter; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'income', label: 'Entrees' },
  { value: 'expense', label: 'Sorties' },
]

export const periodFilterOptions: Array<{ value: BudgetPeriodFilter; label: string }> = [
  { value: 'all', label: 'Toutes periodes' },
  { value: 'current', label: 'En cours' },
  { value: 'future', label: 'A venir' },
  { value: 'past', label: 'Passees' },
]

const statusOrder: Record<BudgetPeriodStatus, number> = {
  current: 0,
  future: 1,
  past: 2,
}

export function emptyBudgetForm(): BudgetFormState {
  return {
    cle: '',
    nomReference: '',
    codeTypePeriode: '',
    dateCible: todayIso(),
    codeTypeBudget: '',
    montantBudget: '',
    libelle: '',
  }
}

export function budgetResourceSingularLabel(resource: BudgetResource): string {
  if (resource === 'beneficiaire') return 'Beneficiaire'
  if (resource === 'categorie') return 'Categorie'
  return 'Sous-categorie'
}

export function budgetResourcePluralLabel(resource: BudgetResource): string {
  if (resource === 'beneficiaire') return 'beneficiaire'
  if (resource === 'categorie') return 'categorie'
  return 'sous-categorie'
}

export function budgetResourceModeLabel(resource: BudgetResource): string {
  return `Budgets par ${budgetResourcePluralLabel(resource)}`
}

export function budgetResourceTargetLabel(resource: BudgetResource): string {
  if (resource === 'beneficiaire') return 'Beneficiaire cible'
  if (resource === 'categorie') return 'Categorie ciblee'
  return 'Sous-categorie ciblee'
}

export function budgetResourceHint(resource: BudgetResource): string {
  if (resource === 'beneficiaire') {
    return "Chaque budget cible un seul beneficiaire. Le suivi additionne les lignes d'operation qui contiennent ce beneficiaire."
  }
  if (resource === 'categorie') {
    return "Chaque budget cible une seule categorie. Le suivi additionne les lignes dont la sous-categorie appartient a cette categorie."
  }
  return "Chaque budget cible une seule sous-categorie. Le suivi additionne les lignes d'operation affectees a cette sous-categorie."
}

export function budgetResourceSearchPlaceholder(resource: BudgetResource): string {
  if (resource === 'beneficiaire') return 'Chercher un budget, un beneficiaire, une periode...'
  if (resource === 'categorie') return 'Chercher un budget, une categorie, une periode...'
  return 'Chercher un budget, une sous-categorie, une periode...'
}

export function titleForBudget(budget?: BudgetDetail | null): string {
  return budget?.libelle?.trim() || budget?.reference?.libelle?.trim() || budget?.reference?.nom || budget?.cle || 'Budget'
}

export function budgetTypeCode(budget?: BudgetDetail | null): string {
  return budget?.typeBudget?.code ?? budget?.codeTypeBudget?.code ?? ''
}

export function budgetTypeLabel(budget?: BudgetDetail | null): string {
  const code = budgetTypeCode(budget)
  if (code === 'SOLDE+') return 'Recettes prevues'
  if (code === 'SOLDE-') return 'Depenses prevues'
  return budget?.typeBudget?.libelle ?? budget?.codeTypeBudget?.libelle ?? (code || 'Type budget')
}

export function budgetTypeShortLabel(code: string, budgetTypes?: Typology[]): string {
  if (code === 'SOLDE+') return "Objectif d'entrees"
  if (code === 'SOLDE-') return 'Limite de sorties'
  return budgetTypes?.find((type) => type.code === code)?.libelle ?? 'Type a choisir'
}

export function budgetTypeOptionLabel(type: Typology): string {
  if (type.code === 'SOLDE+') return "Objectif d'entrees"
  if (type.code === 'SOLDE-') return 'Limite de sorties'
  return type.libelle
}

export function budgetDirection(budget: BudgetDetail): BudgetDirection {
  const code = budgetTypeCode(budget)
  if (code.includes('+')) return 'income'
  if (code.includes('-')) return 'expense'
  return 'neutral'
}

export function budgetReferenceLabel(budget: BudgetDetail): string {
  return budget.reference?.libelle?.trim() || budget.reference?.nom || 'Sans reference'
}

export function budgetPeriodLabel(budget: BudgetDetail): string {
  return `${formatShortDate(budget.dateDebut)} - ${formatShortDate(budget.dateFin)}`
}

export function budgetPeriodStatus(budget: BudgetDetail, today = todayIso()): BudgetPeriodStatus {
  if (budget.dateDebut && today < budget.dateDebut) return 'future'
  if (budget.dateFin && today > budget.dateFin) return 'past'
  return 'current'
}

export function budgetPeriodStatusLabel(status: BudgetPeriodStatus): string {
  if (status === 'current') return 'En cours'
  if (status === 'future') return 'A venir'
  return 'Passe'
}

export function sortBudgets(budgets: BudgetDetail[], today = todayIso()): BudgetDetail[] {
  return [...budgets].sort((left, right) => {
    const statusDelta = statusOrder[budgetPeriodStatus(left, today)] - statusOrder[budgetPeriodStatus(right, today)]
    if (statusDelta !== 0) return statusDelta
    const dateDelta = left.dateDebut.localeCompare(right.dateDebut)
    if (dateDelta !== 0) return dateDelta
    return titleForBudget(left).localeCompare(titleForBudget(right), 'fr')
  })
}

export function filterBudgets(
  budgets: BudgetDetail[],
  filters: { search: string; direction: BudgetDirectionFilter; status: BudgetPeriodFilter; today?: string },
): BudgetDetail[] {
  const today = filters.today ?? todayIso()
  const needle = filters.search.trim().toLowerCase()
  return sortBudgets(budgets, today).filter((budget) => {
    if (filters.direction !== 'all' && budgetDirection(budget) !== filters.direction) return false
    if (filters.status !== 'all' && budgetPeriodStatus(budget, today) !== filters.status) return false
    if (!needle) return true
    return [budget.cle, budget.libelle, budgetReferenceLabel(budget), budget.reference?.nom, budget.typePeriode?.libelle, budgetTypeLabel(budget), budgetPeriodLabel(budget)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle))
  })
}

export function groupBudgetsByStatus(budgets: BudgetDetail[], today = todayIso()): BudgetGroup[] {
  const groups: Record<BudgetPeriodStatus, BudgetDetail[]> = {
    current: [],
    future: [],
    past: [],
  }
  budgets.forEach((budget) => {
    groups[budgetPeriodStatus(budget, today)].push(budget)
  })
  return (['current', 'future', 'past'] as BudgetPeriodStatus[]).map((status) => ({
    status,
    label: budgetPeriodStatusLabel(status),
    items: groups[status],
  }))
}

export function summarizeBudgets(budgets: BudgetDetail[], today = todayIso()): BudgetSummary {
  const summary = budgets.reduce<BudgetSummary>(
    (current, budget) => {
      const direction = budgetDirection(budget)
      if (direction === 'income') {
        current.incomeCents += budget.montantBudgetEnCentimes
      } else if (direction === 'expense') {
        current.expenseCents += budget.montantBudgetEnCentimes
      }
      if (budgetPeriodStatus(budget, today) === 'current') {
        current.currentCount += 1
      }
      current.totalCount += 1
      return current
    },
    { incomeCents: 0, expenseCents: 0, netCents: 0, currentCount: 0, totalCount: 0 },
  )
  summary.netCents = summary.incomeCents - summary.expenseCents
  return summary
}

function dateFromIso(iso: string): Date | null {
  if (!iso) return null
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0)
}

export function budgetPeriodBounds(codeTypePeriode: string, dateCible: string): { start: string; end: string } | null {
  const date = dateFromIso(dateCible)
  if (!date || !codeTypePeriode) return null

  const year = date.getFullYear()
  const month = date.getMonth()

  if (codeTypePeriode === 'MOIS') {
    return { start: isoDate(new Date(year, month, 1)), end: isoDate(endOfMonth(year, month)) }
  }

  if (codeTypePeriode === 'BIMESTRE') {
    const startMonth = month - (month % 2)
    return { start: isoDate(new Date(year, startMonth, 1)), end: isoDate(endOfMonth(year, startMonth + 1)) }
  }

  if (codeTypePeriode === 'TRIMESTRE') {
    const startMonth = month - (month % 3)
    return { start: isoDate(new Date(year, startMonth, 1)), end: isoDate(endOfMonth(year, startMonth + 2)) }
  }

  if (codeTypePeriode === 'QUADRIM') {
    const startMonth = month - (month % 4)
    return { start: isoDate(new Date(year, startMonth, 1)), end: isoDate(endOfMonth(year, startMonth + 3)) }
  }

  if (codeTypePeriode === 'SEMESTRE') {
    const startMonth = month < 6 ? 0 : 6
    return { start: isoDate(new Date(year, startMonth, 1)), end: isoDate(endOfMonth(year, startMonth + 5)) }
  }

  if (codeTypePeriode === 'ANNEE') {
    return { start: isoDate(new Date(year, 0, 1)), end: isoDate(new Date(year, 11, 31)) }
  }

  return null
}

export function budgetPeriodPreviewLabel(codeTypePeriode: string, dateCible: string): string {
  const bounds = budgetPeriodBounds(codeTypePeriode, dateCible)
  if (!bounds) return 'Periode calculee apres choix du type et de la date'
  return `${formatShortDate(bounds.start)} - ${formatShortDate(bounds.end)}`
}
