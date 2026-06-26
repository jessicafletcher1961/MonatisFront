import type { CompteTechniqueBasic, OperationBasic, TypeOperation } from '../../lib/monatis-api'

export type TechnicalAccountStatus = 'active' | 'unused' | 'attention'
export type TechnicalAccountFilter = 'all' | TechnicalAccountStatus

export interface TechnicalUsage {
  operation: OperationBasic
  direction: 'in' | 'out' | 'both'
  amountInCents: number
  amountOutCents: number
  netCents: number
  isTechnicalFlux: boolean
  typeLabel: string
}

export interface TechnicalTypeBreakdown {
  code: string
  label: string
  count: number
  amountCents: number
}

export interface TechnicalAccountSummary {
  account: CompteTechniqueBasic
  status: TechnicalAccountStatus
  usageCount: number
  technicalFluxCount: number
  nonTechnicalFluxCount: number
  totalInCents: number
  totalOutCents: number
  netCents: number
  rewardsCents: number
  chargesCents: number
  latestOperationDate: string | null
  usages: TechnicalUsage[]
  typeBreakdown: TechnicalTypeBreakdown[]
}

const TECHNICAL_OPERATION_CODES = new Set(['COURANT+', 'COURANT-', 'FINANCIER+', 'FINANCIER-', 'BIEN+', 'BIEN-'])

export function technicalAccountTitle(account: CompteTechniqueBasic | null | undefined) {
  return account?.libelle?.trim() || account?.identifiant || 'Compte technique'
}

export function createOperationTypeLookup(types: TypeOperation[]) {
  return new Map(types.map((type) => [type.code, type]))
}

export function technicalStatusLabel(status: TechnicalAccountStatus) {
  switch (status) {
    case 'active':
      return 'Utilise'
    case 'attention':
      return 'A verifier'
    case 'unused':
      return 'Dormant'
    default:
      return 'Compte technique'
  }
}

export function technicalStatusHint(summary: TechnicalAccountSummary) {
  if (summary.status === 'attention') {
    return `${summary.nonTechnicalFluxCount} flux non technique${summary.nonTechnicalFluxCount > 1 ? 's' : ''}`
  }
  if (summary.status === 'active') {
    return `${summary.technicalFluxCount} flux technique${summary.technicalFluxCount > 1 ? 's' : ''}`
  }
  return 'Aucun flux rattache'
}

export function technicalStatusTone(status: TechnicalAccountStatus): 'default' | 'success' | 'warning' {
  if (status === 'attention') {
    return 'warning'
  }
  if (status === 'active') {
    return 'success'
  }
  return 'default'
}

export function filterTechnicalSummaries(
  summaries: TechnicalAccountSummary[],
  search: string,
  filter: TechnicalAccountFilter,
) {
  const query = search.trim().toLowerCase()
  return summaries.filter((summary) => {
    if (filter !== 'all' && summary.status !== filter) {
      return false
    }
    if (!query) {
      return true
    }
    const searchable = [
      summary.account.identifiant,
      summary.account.libelle,
      summary.status,
      ...summary.usages.slice(0, 8).flatMap((usage) => [
        usage.operation.numero,
        usage.operation.libelle,
        usage.operation.codeTypeOperation,
        usage.typeLabel,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(query)
  })
}

export function summarizeTechnicalAccounts(summaries: TechnicalAccountSummary[]) {
  return {
    accountCount: summaries.length,
    activeAccountCount: summaries.filter((summary) => summary.status === 'active' || summary.status === 'attention').length,
    attentionAccountCount: summaries.filter((summary) => summary.status === 'attention').length,
    operationCount: summaries.reduce((sum, summary) => sum + summary.usageCount, 0),
    technicalFluxCount: summaries.reduce((sum, summary) => sum + summary.technicalFluxCount, 0),
    nonTechnicalFluxCount: summaries.reduce((sum, summary) => sum + summary.nonTechnicalFluxCount, 0),
    netCents: summaries.reduce((sum, summary) => sum + summary.netCents, 0),
    rewardsCents: summaries.reduce((sum, summary) => sum + summary.rewardsCents, 0),
    chargesCents: summaries.reduce((sum, summary) => sum + summary.chargesCents, 0),
  }
}

export function buildTechnicalAccountSummaries(
  accounts: CompteTechniqueBasic[],
  operations: OperationBasic[],
  operationTypesByCode: Map<string, TypeOperation>,
) {
  return accounts
    .map((account): TechnicalAccountSummary => {
      const usages = operations
        .filter((operation) => operation.identifiantCompteDepense === account.identifiant || operation.identifiantCompteRecette === account.identifiant)
        .map((operation) => buildUsage(account.identifiant, operation, operationTypesByCode))
        .sort((left, right) => {
          const byDate = right.operation.dateValeur.localeCompare(left.operation.dateValeur)
          if (byDate !== 0) {
            return byDate
          }
          return right.operation.numero.localeCompare(left.operation.numero)
        })
      const technicalFluxCount = usages.filter((usage) => usage.isTechnicalFlux).length
      const nonTechnicalFluxCount = usages.length - technicalFluxCount
      const totalInCents = usages.reduce((sum, usage) => sum + usage.amountInCents, 0)
      const totalOutCents = usages.reduce((sum, usage) => sum + usage.amountOutCents, 0)
      const rewardsCents = usages
        .filter((usage) => usage.operation.codeTypeOperation?.endsWith('+'))
        .reduce((sum, usage) => sum + usage.operation.montantEnCentimes, 0)
      const chargesCents = usages
        .filter((usage) => usage.operation.codeTypeOperation?.endsWith('-'))
        .reduce((sum, usage) => sum + usage.operation.montantEnCentimes, 0)
      const status: TechnicalAccountStatus =
        nonTechnicalFluxCount > 0 ? 'attention' : usages.length > 0 ? 'active' : 'unused'

      return {
        account,
        status,
        usageCount: usages.length,
        technicalFluxCount,
        nonTechnicalFluxCount,
        totalInCents,
        totalOutCents,
        netCents: totalInCents - totalOutCents,
        rewardsCents,
        chargesCents,
        latestOperationDate: usages[0]?.operation.dateValeur ?? null,
        usages,
        typeBreakdown: buildTypeBreakdown(usages),
      }
    })
    .sort((left, right) => {
      const byStatus = statusOrder(left.status) - statusOrder(right.status)
      if (byStatus !== 0) {
        return byStatus
      }
      return left.account.identifiant.localeCompare(right.account.identifiant)
    })
}

function buildUsage(accountId: string, operation: OperationBasic, operationTypesByCode: Map<string, TypeOperation>): TechnicalUsage {
  const amountInCents = operation.identifiantCompteRecette === accountId ? operation.montantEnCentimes : 0
  const amountOutCents = operation.identifiantCompteDepense === accountId ? operation.montantEnCentimes : 0
  const code = operation.codeTypeOperation ?? ''
  const operationType = operationTypesByCode.get(code)
  const direction = amountInCents > 0 && amountOutCents > 0 ? 'both' : amountInCents > 0 ? 'in' : 'out'

  return {
    operation,
    direction,
    amountInCents,
    amountOutCents,
    netCents: amountInCents - amountOutCents,
    isTechnicalFlux: operationType?.fluxTechnique ?? TECHNICAL_OPERATION_CODES.has(code),
    typeLabel: operationType?.libelleCourt || code || 'Type absent',
  }
}

function buildTypeBreakdown(usages: TechnicalUsage[]) {
  const byCode = new Map<string, TechnicalTypeBreakdown>()
  for (const usage of usages) {
    const code = usage.operation.codeTypeOperation || 'SANS-TYPE'
    const current = byCode.get(code) ?? {
      code,
      label: usage.typeLabel,
      count: 0,
      amountCents: 0,
    }
    current.count += 1
    current.amountCents += usage.operation.montantEnCentimes
    byCode.set(code, current)
  }
  return Array.from(byCode.values()).sort((left, right) => Math.abs(right.amountCents) - Math.abs(left.amountCents))
}

function statusOrder(status: TechnicalAccountStatus) {
  if (status === 'attention') {
    return 0
  }
  if (status === 'active') {
    return 1
  }
  return 2
}
