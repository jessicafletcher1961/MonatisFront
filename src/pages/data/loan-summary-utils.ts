import { formatShortDate, todayIso } from '../../lib/format'
import type { LoanBasic, LoanCondition, LoanDetail, LoanPayment } from '../../lib/monatis-api'

export interface LoanScheduleSummary {
  payments: LoanPayment[]
  principalCents: number
  paidCapitalCents: number
  remainingCapitalCents: number
  totalInterestCents: number
  totalFeesCents: number
  totalPaymentCents: number
  progressPercent: number
  nextPayment: LoanPayment | null
  lastDuePayment: LoanPayment | null
  firstPayment: LoanPayment | null
  finalPayment: LoanPayment | null
  status: 'future' | 'active' | 'complete' | 'unknown'
}

export function loanTitle(loan?: { cle: string; libelle: string | null } | null): string {
  return loan?.libelle?.trim() || loan?.cle || 'Emprunt'
}

export function loanAccountId(loan?: LoanBasic | LoanDetail | null): string {
  if (!loan) {
    return ''
  }
  return loan.identifiantCompteInterne ?? ('compteInterne' in loan ? loan.compteInterne?.identifiant : '') ?? ''
}

export function loanConditions(loan?: LoanBasic | LoanDetail | null): LoanCondition[] {
  if (!loan?.conditionEmpruntInitiale) {
    return []
  }
  return [loan.conditionEmpruntInitiale, ...(loan.revisions ?? [])].filter(Boolean) as LoanCondition[]
}

export function loanPayments(conditions: LoanCondition[]): LoanPayment[] {
  return conditions
    .flatMap((condition) => condition.echeances ?? [])
    .slice()
    .sort((a, b) => a.numero - b.numero || a.date.localeCompare(b.date))
}

export function formatRate(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return '0 %'
  }
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value)} %`
}

export function periodLabel(condition?: LoanCondition | null): string {
  return condition?.typePeriodeEcheances?.libelle ?? condition?.codeTypePeriodeEcheances ?? 'Période non renseignée'
}

export function conditionDurationLabel(condition?: LoanCondition | null): string {
  const duration = condition?.duree ?? 0
  return `${duration} échéance${duration > 1 ? 's' : ''}`
}

export function conditionPaymentLabel(condition?: LoanCondition | null): string {
  if (!condition?.montantTotalEcheanceEnCentimes) {
    return 'Echéance à ouvrir'
  }
  return `Echéance ${periodLabel(condition).toLowerCase()}`
}

export function buildLoanScheduleSummary(conditions: LoanCondition[], today = todayIso()): LoanScheduleSummary {
  const payments = loanPayments(conditions)
  const principalCents = conditions[0]?.capitalEmprunteEnCentimes ?? 0
  const lastDuePayment = payments.filter((payment) => payment.date <= today).at(-1) ?? null
  const nextPayment = payments.find((payment) => payment.date >= today) ?? null
  const firstPayment = payments[0] ?? null
  const finalPayment = payments.at(-1) ?? null
  const paidCapitalCents = lastDuePayment?.capitalEmprunteDejaRembourseEnCentimes ?? 0
  const remainingCapitalCents = lastDuePayment?.capitalEmprunteRestantDuEnCentimes ?? principalCents
  const totalInterestCents = payments.reduce((sum, payment) => sum + payment.partInteretEnCentimes, 0)
  const totalFeesCents = payments.reduce((sum, payment) => sum + payment.partFraisFixesEnCentimes, 0)
  const totalPaymentCents = payments.reduce((sum, payment) => sum + payment.montantPaiementEnCentimes, 0)
  const progressPercent = principalCents > 0 ? Math.min(100, Math.max(0, Math.round((paidCapitalCents / principalCents) * 100))) : 0

  let status: LoanScheduleSummary['status'] = 'unknown'
  if (payments.length) {
    if (!lastDuePayment) {
      status = 'future'
    } else if (!nextPayment && finalPayment?.capitalEmprunteRestantDuEnCentimes === 0) {
      status = 'complete'
    } else {
      status = 'active'
    }
  }

  return {
    payments,
    principalCents,
    paidCapitalCents,
    remainingCapitalCents,
    totalInterestCents,
    totalFeesCents,
    totalPaymentCents,
    progressPercent,
    nextPayment,
    lastDuePayment,
    firstPayment,
    finalPayment,
    status,
  }
}

export function loanStatusLabel(summary: LoanScheduleSummary): string {
  if (summary.status === 'future') return 'A venir'
  if (summary.status === 'complete') return 'Terminé'
  if (summary.status === 'active') return 'En cours'
  return 'Echéancier non chargé'
}

export function loanScheduleRangeLabel(summary: LoanScheduleSummary): string {
  if (!summary.firstPayment || !summary.finalPayment) {
    return 'Echéancier à ouvrir'
  }
  return `${formatShortDate(summary.firstPayment.date)} - ${formatShortDate(summary.finalPayment.date)}`
}
