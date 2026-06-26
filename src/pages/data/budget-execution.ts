import { isIsoWithinRange } from '../../lib/format'
import type { BudgetDetail, BudgetResource, OperationBasic, OperationLineBasic, ReferenceBase } from '../../lib/monatis-api'
import { budgetDirection, budgetPeriodStatus } from './budget-panel-utils'

export type BudgetExecutionStatus = 'future' | 'empty' | 'ok' | 'warning' | 'danger'

export interface BudgetExecution {
  budgetCle: string
  plannedCents: number
  executedCents: number
  executedSignedCents: number
  differenceCents: number
  remainingCents: number
  progressPercent: number
  progressCappedPercent: number
  expectedProgressPercent: number
  status: BudgetExecutionStatus
  statusLabel: string
  executedLabel: string
  remainingLabel: string
}

export interface BudgetExecutionSummary {
  currentCount: number
  totalCount: number
  plannedIncomeCents: number
  plannedExpenseCents: number
  executedIncomeCents: number
  executedExpenseCents: number
  remainingExpenseCents: number
  missingIncomeCents: number
  alertCount: number
}

type BudgetReferenceShape = ReferenceBase & {
  nomCategorie?: string | null
  nomsSousCategories?: string[] | null
}

function budgetReferenceShape(budget: BudgetDetail): BudgetReferenceShape | null {
  return (budget.reference ?? null) as BudgetReferenceShape | null
}

export function budgetReferenceKind(budget: BudgetDetail): BudgetResource | null {
  const reference = budgetReferenceShape(budget)
  if (!reference) return null
  if (Array.isArray(reference.nomsSousCategories)) return 'categorie'
  if (reference.nomCategorie) return 'souscategorie'
  return 'beneficiaire'
}

export function filterBudgetsForResource(budgets: BudgetDetail[], resource: BudgetResource): BudgetDetail[] {
  return budgets.filter((budget) => budgetReferenceKind(budget) === resource)
}

function operationSign(operation: OperationBasic): 1 | -1 | 0 {
  const code = operation.codeTypeOperation ?? operation.typeOperation?.code ?? operation.typeOperation?.name ?? ''
  if (code === 'RECETTE') return 1
  if (code === 'DEPENSE') return -1
  return 0
}

function lineDate(operation: OperationBasic, line: OperationLineBasic): string | null {
  return line.dateComptabilisation || operation.dateValeur || null
}

function lineSousCategorieName(line: OperationLineBasic): string | null {
  return line.nomSousCategorie ?? line.sousCategorie?.nom ?? null
}

function lineBeneficiaryNames(line: OperationLineBasic): string[] {
  const explicitNames = line.nomsBeneficiaires ?? []
  const detailedNames = line.beneficiaires?.map((beneficiaire) => beneficiaire.nom) ?? []
  return [...new Set([...explicitNames, ...detailedNames])]
}

function lineMatchesBudget(resource: BudgetResource, budget: BudgetDetail, line: OperationLineBasic): boolean {
  const reference = budgetReferenceShape(budget)
  if (!reference?.nom) return false

  if (resource === 'beneficiaire') {
    return lineBeneficiaryNames(line).includes(reference.nom)
  }

  if (resource === 'souscategorie') {
    return lineSousCategorieName(line) === reference.nom
  }

  const sousCategories = reference.nomsSousCategories ?? []
  return Boolean(lineSousCategorieName(line) && sousCategories.includes(lineSousCategorieName(line)!))
}

function executionForBudget(budget: BudgetDetail, resource: BudgetResource, operations: OperationBasic[]): number {
  return operations.reduce((total, operation) => {
    const sign = operationSign(operation)
    if (sign === 0) return total

    return (
      total +
      (operation.lignes ?? []).reduce((lineTotal, line) => {
        const date = lineDate(operation, line)
        if (!date || !isIsoWithinRange(date, budget.dateDebut, budget.dateFin)) return lineTotal
        if (!lineMatchesBudget(resource, budget, line)) return lineTotal
        return lineTotal + line.montantEnCentimes * sign
      }, 0)
    )
  }, 0)
}

function daysInclusive(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00`)
  const end = new Date(`${endIso}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return 1
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
}

function periodElapsedPercent(budget: BudgetDetail, today: string): number {
  if (today < budget.dateDebut) return 0
  if (today > budget.dateFin) return 100
  return Math.min(100, Math.max(0, (daysInclusive(budget.dateDebut, today) / daysInclusive(budget.dateDebut, budget.dateFin)) * 100))
}

function statusForBudget(budget: BudgetDetail, executedCents: number, progressPercent: number, expectedProgressPercent: number, today: string): BudgetExecutionStatus {
  const direction = budgetDirection(budget)
  const periodStatus = budgetPeriodStatus(budget, today)
  const plannedCents = Math.abs(budget.montantBudgetEnCentimes)
  const tolerancePercent = 8

  if (periodStatus === 'future') return 'future'
  if (!executedCents) return 'empty'

  if (direction === 'expense') {
    if (executedCents > plannedCents) return 'danger'
    if (progressPercent > expectedProgressPercent + tolerancePercent) return 'warning'
    return 'ok'
  }

  if (direction === 'income') {
    if (executedCents >= plannedCents) return 'ok'
    if (progressPercent + tolerancePercent < expectedProgressPercent) return 'warning'
    return 'ok'
  }

  return 'empty'
}

function labelForStatus(status: BudgetExecutionStatus, direction: ReturnType<typeof budgetDirection>): string {
  if (status === 'future') return 'A venir'
  if (status === 'empty') return 'Aucune ligne'
  if (status === 'danger') return 'Depassement'
  if (status === 'warning') return direction === 'income' ? 'Objectif en retard' : 'Rythme eleve'
  return direction === 'income' ? 'Objectif suivi' : 'Dans le budget'
}

export function buildBudgetExecution(budget: BudgetDetail, resource: BudgetResource, operations: OperationBasic[], today: string): BudgetExecution {
  const direction = budgetDirection(budget)
  const signedBudget = direction === 'expense' ? -budget.montantBudgetEnCentimes : budget.montantBudgetEnCentimes
  const executedSignedCents = executionForBudget(budget, resource, operations)
  const executedCents = direction === 'expense' ? Math.max(0, -executedSignedCents) : Math.max(0, executedSignedCents)
  const plannedCents = Math.abs(signedBudget)
  const differenceCents = signedBudget - executedSignedCents
  const remainingCents = direction === 'expense' ? -differenceCents : differenceCents
  const progressPercent = plannedCents ? (executedCents / plannedCents) * 100 : 0
  const expectedProgressPercent = periodElapsedPercent(budget, today)
  const status = statusForBudget(budget, executedCents, progressPercent, expectedProgressPercent, today)

  return {
    budgetCle: budget.cle,
    plannedCents,
    executedCents,
    executedSignedCents,
    differenceCents,
    remainingCents,
    progressPercent,
    progressCappedPercent: Math.min(140, Math.max(0, progressPercent)),
    expectedProgressPercent,
    status,
    statusLabel: labelForStatus(status, direction),
    executedLabel: direction === 'income' ? 'Encaisse' : 'Consomme',
    remainingLabel: direction === 'income' ? (remainingCents > 0 ? 'Reste a encaisser' : 'Au-dessus objectif') : remainingCents < 0 ? 'Depassement' : 'Disponible',
  }
}

export function buildBudgetExecutions(budgets: BudgetDetail[], resource: BudgetResource, operations: OperationBasic[], today: string): Record<string, BudgetExecution> {
  return budgets.reduce<Record<string, BudgetExecution>>((current, budget) => {
    current[budget.cle] = buildBudgetExecution(budget, resource, operations, today)
    return current
  }, {})
}

export function summarizeBudgetExecutions(budgets: BudgetDetail[], executions: Record<string, BudgetExecution>, today: string): BudgetExecutionSummary {
  return budgets.reduce<BudgetExecutionSummary>(
    (summary, budget) => {
      const execution = executions[budget.cle]
      const direction = budgetDirection(budget)
      const current = budgetPeriodStatus(budget, today) === 'current'

      summary.totalCount += 1
      if (!current || !execution) return summary

      summary.currentCount += 1
      if (execution.status === 'warning' || execution.status === 'danger') {
        summary.alertCount += 1
      }

      if (direction === 'income') {
        summary.plannedIncomeCents += execution.plannedCents
        summary.executedIncomeCents += execution.executedCents
        summary.missingIncomeCents += Math.max(0, execution.remainingCents)
      } else if (direction === 'expense') {
        summary.plannedExpenseCents += execution.plannedCents
        summary.executedExpenseCents += execution.executedCents
        summary.remainingExpenseCents += execution.remainingCents
      }

      return summary
    },
    {
      currentCount: 0,
      totalCount: 0,
      plannedIncomeCents: 0,
      plannedExpenseCents: 0,
      executedIncomeCents: 0,
      executedExpenseCents: 0,
      remainingExpenseCents: 0,
      missingIncomeCents: 0,
      alertCount: 0,
    },
  )
}
