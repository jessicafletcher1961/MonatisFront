import type { ResumeCompteView } from '../../lib/reporting'

export interface ResumeGroupView {
  type: string
  accounts: ResumeCompteView[]
  total: number
}

export interface ResumeDashboardSummary {
  totalBalance: number
  accountCount: number
  groupCount: number
  positiveTotal: number
  negativeTotal: number
  averageBalance: number
  strongestGroup: ResumeGroupView | null
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

export function buildResumeGroups(resumes: ResumeCompteView[]): ResumeGroupView[] {
  const groups = new Map<string, ResumeCompteView[]>()
  resumes.forEach((row) => {
    groups.set(row.typeFonctionnement, [...(groups.get(row.typeFonctionnement) ?? []), row])
  })

  return Array.from(groups.entries())
    .map(([type, accounts]) => ({
      type,
      accounts: [...accounts].sort((left, right) => left.identifiant.localeCompare(right.identifiant)),
      total: roundMoney(accounts.reduce((sum, account) => sum + account.montantSoldeEnEuros, 0)),
    }))
    .sort((left, right) => left.type.localeCompare(right.type))
}

export function getResumeDashboardSummary(resumes: ResumeCompteView[], groups: ResumeGroupView[]): ResumeDashboardSummary {
  const totalBalance = roundMoney(resumes.reduce((sum, row) => sum + row.montantSoldeEnEuros, 0))
  const positiveTotal = roundMoney(resumes.filter((row) => row.montantSoldeEnEuros >= 0).reduce((sum, row) => sum + row.montantSoldeEnEuros, 0))
  const negativeTotal = roundMoney(resumes.filter((row) => row.montantSoldeEnEuros < 0).reduce((sum, row) => sum + row.montantSoldeEnEuros, 0))
  const strongestGroup =
    groups
      .slice()
      .sort((left, right) => Math.abs(right.total) - Math.abs(left.total))[0] ?? null

  return {
    totalBalance,
    accountCount: resumes.length,
    groupCount: groups.length,
    positiveTotal,
    negativeTotal,
    averageBalance: resumes.length ? roundMoney(totalBalance / resumes.length) : 0,
    strongestGroup,
  }
}

export function resumeGroupShare(group: ResumeGroupView, groups: ResumeGroupView[]): number {
  const total = groups.reduce((sum, item) => sum + Math.abs(item.total), 0)

  if (!total) {
    return 0
  }

  return Math.max(3, Math.round((Math.abs(group.total) / total) * 100))
}
