import { formatCurrencyFromCents } from '../../lib/format'
import type { CompteInterneBasic, EvaluationBasic } from '../../lib/monatis-api'

export type EvaluationListMode = 'latest' | 'history'
export type EvaluationAccountTypeFilter = 'all' | 'COURANT' | 'FINANCIER' | 'BIEN'

export const EVALUATION_ACCOUNT_TYPES: Exclude<EvaluationAccountTypeFilter, 'all'>[] = [
  'COURANT',
  'FINANCIER',
  'BIEN',
]

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function createAccountLookup(accounts: CompteInterneBasic[]) {
  return new Map(accounts.map((account) => [account.identifiant, account]))
}

export function evaluationAccountId(evaluation: EvaluationBasic | null | undefined) {
  return evaluation?.identifiantCompteInterne ?? evaluation?.compteInterne?.identifiant ?? ''
}

export function evaluationTitle(evaluation: EvaluationBasic | null | undefined) {
  return evaluation?.libelle?.trim() || evaluation?.cle || 'Evaluation'
}

export function accountDisplayLabel(account: CompteInterneBasic | undefined, fallbackId?: string) {
  return account?.libelle?.trim() || fallbackId || account?.identifiant || 'Compte non renseigne'
}

export function accountTypeLabel(code: string | undefined) {
  switch (code) {
    case 'COURANT':
      return 'Compte courant'
    case 'FINANCIER':
      return 'Placement'
    case 'BIEN':
      return 'Bien'
    default:
      return code || 'Compte'
  }
}

export function sortedEvaluations(evaluations: EvaluationBasic[]) {
  return [...evaluations].sort((left, right) => {
    const byDate = right.dateSolde.localeCompare(left.dateSolde)
    if (byDate !== 0) {
      return byDate
    }
    return left.cle.localeCompare(right.cle)
  })
}

export function groupEvaluationsByAccount(evaluations: EvaluationBasic[]) {
  const groups = new Map<string, EvaluationBasic[]>()
  for (const evaluation of sortedEvaluations(evaluations)) {
    const accountId = evaluationAccountId(evaluation)
    if (!accountId) {
      continue
    }
    const current = groups.get(accountId) ?? []
    current.push(evaluation)
    groups.set(accountId, current)
  }
  return groups
}

export function latestEvaluations(evaluations: EvaluationBasic[]) {
  return Array.from(groupEvaluationsByAccount(evaluations).values()).map((items) => items[0])
}

export function previousEvaluationFor(evaluation: EvaluationBasic, evaluations: EvaluationBasic[]) {
  const accountId = evaluationAccountId(evaluation)
  if (!accountId) {
    return null
  }
  const accountEvaluations = groupEvaluationsByAccount(evaluations).get(accountId) ?? []
  const index = accountEvaluations.findIndex((item) => item.cle === evaluation.cle)
  return index >= 0 ? (accountEvaluations[index + 1] ?? null) : null
}

export function daysBetweenIso(startDate: string | undefined, endDate: string | undefined) {
  if (!startDate || !endDate) {
    return null
  }
  const start = Date.parse(startDate)
  const end = Date.parse(endDate)
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null
  }
  return Math.round((end - start) / MS_PER_DAY)
}

export function signedCurrencyFromCents(cents: number) {
  if (cents > 0) {
    return `+${formatCurrencyFromCents(cents)}`
  }
  return formatCurrencyFromCents(cents)
}

export function percentChange(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined || previous === 0) {
    return null
  }
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatSignedPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'n/a'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('fr-FR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })} %`
}

export function filterEvaluations(
  evaluations: EvaluationBasic[],
  accountsById: Map<string, CompteInterneBasic>,
  mode: EvaluationListMode,
  typeFilter: EvaluationAccountTypeFilter,
  search: string,
) {
  const query = search.trim().toLowerCase()
  const source = mode === 'latest' ? latestEvaluations(evaluations) : sortedEvaluations(evaluations)

  return source.filter((evaluation) => {
    const accountId = evaluationAccountId(evaluation)
    const account = accountsById.get(accountId)
    if (typeFilter !== 'all' && account?.codeTypeFonctionnement !== typeFilter) {
      return false
    }
    if (!query) {
      return true
    }
    const searchable = [
      evaluation.cle,
      evaluation.libelle,
      accountId,
      account?.libelle,
      account?.nomBanque,
      account?.nomsTitulaires,
      account?.codeTypeFonctionnement,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(query)
  })
}

export function summarizeEvaluations(
  evaluations: EvaluationBasic[],
  accounts: CompteInterneBasic[],
  today: string,
) {
  const latest = latestEvaluations(evaluations)
  const coveredAccountIds = new Set(latest.map(evaluationAccountId).filter(Boolean))
  const accountsById = createAccountLookup(accounts)
  const typeTotals = EVALUATION_ACCOUNT_TYPES.map((type) => {
    const items = latest.filter((evaluation) => accountsById.get(evaluationAccountId(evaluation))?.codeTypeFonctionnement === type)
    return {
      type,
      label: accountTypeLabel(type),
      count: items.length,
      amount: items.reduce((sum, evaluation) => sum + evaluation.montantSoldeEnCentimes, 0),
    }
  })

  const netAmount = latest.reduce((sum, evaluation) => sum + evaluation.montantSoldeEnCentimes, 0)
  const assetAmount = latest
    .filter((evaluation) => evaluation.montantSoldeEnCentimes > 0)
    .reduce((sum, evaluation) => sum + evaluation.montantSoldeEnCentimes, 0)
  const liabilityAmount = latest
    .filter((evaluation) => evaluation.montantSoldeEnCentimes < 0)
    .reduce((sum, evaluation) => sum + Math.abs(evaluation.montantSoldeEnCentimes), 0)
  const staleAccounts = latest.filter((evaluation) => {
    const age = daysBetweenIso(evaluation.dateSolde, today)
    return age !== null && age > 90
  }).length

  return {
    latest,
    netAmount,
    assetAmount,
    liabilityAmount,
    typeTotals,
    coveredAccounts: coveredAccountIds.size,
    totalAccounts: accounts.length,
    missingAccounts: Math.max(0, accounts.length - coveredAccountIds.size),
    staleAccounts,
    latestDate: latest.reduce<string | null>((maxDate, evaluation) => {
      if (!maxDate || evaluation.dateSolde > maxDate) {
        return evaluation.dateSolde
      }
      return maxDate
    }, null),
  }
}
