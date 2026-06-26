import { CalendarClock, CircleGauge, Percent, WalletCards } from 'lucide-react'

import { Badge } from '../../components/ui'
import { formatCurrencyFromCents, formatShortDate } from '../../lib/format'
import type { LoanCondition, LoanDetail } from '../../lib/monatis-api'
import { buildLoanScheduleSummary, conditionDurationLabel, formatRate, loanAccountId, loanScheduleRangeLabel, loanStatusLabel, loanTitle, periodLabel } from './loan-summary-utils'

export function LoanOverview({
  loan,
  conditions,
}: {
  loan: LoanDetail
  conditions: LoanCondition[]
}) {
  const summary = buildLoanScheduleSummary(conditions)
  const initialCondition = conditions[0] ?? loan.conditionEmpruntInitiale
  const nextPayment = summary.nextPayment
  const detailTone = summary.status === 'complete' ? 'complete' : summary.status === 'future' ? 'future' : 'active'

  return (
    <section className="loan-overview" data-help="Synthèse de l'emprunt : suit le capital remboursé, le restant dû, le coût et la prochaine échéance calculés par le back.">
      <div className={`loan-detail-hero loan-detail-hero-${detailTone}`}>
        <div>
          <span>{loan.cle}</span>
          <strong>{loanTitle(loan)}</strong>
          <small>{loanAccountId(loan) || 'Sans compte interne'} · {loanScheduleRangeLabel(summary)}</small>
        </div>
        <Badge tone={summary.status === 'complete' ? 'success' : summary.status === 'future' ? 'warning' : 'default'}>{loanStatusLabel(summary)}</Badge>
      </div>

      <div className="loan-progress-panel">
        <div className="loan-progress-head">
          <div>
            <span>Capital remboursé</span>
            <strong>{summary.progressPercent} %</strong>
          </div>
          <div>
            <span>Restant dû théorique</span>
            <strong>{formatCurrencyFromCents(summary.remainingCapitalCents)}</strong>
          </div>
        </div>
        <div className="loan-progress-track" aria-label={`Capital rembourse ${summary.progressPercent} pour cent`}>
          <span className="loan-progress-fill" style={{ width: `${summary.progressPercent}%` }} />
        </div>
        <div className="loan-progress-foot">
          <span>{formatCurrencyFromCents(summary.paidCapitalCents)} remboursés</span>
          <span>{formatCurrencyFromCents(summary.principalCents)} empruntés</span>
        </div>
      </div>

      <div className="loan-kpi-grid">
        <div className="loan-kpi-card">
          <WalletCards size={17} />
          <span>Prochaine échéance</span>
          <strong>{nextPayment ? formatCurrencyFromCents(nextPayment.montantPaiementEnCentimes) : 'Aucune'}</strong>
          <small>{nextPayment ? formatShortDate(nextPayment.date) : 'Echéancier terminé ou absent'}</small>
        </div>
        <div className="loan-kpi-card">
          <Percent size={17} />
          <span>Taux initial</span>
          <strong>{formatRate(initialCondition?.tauxAnnuel)}</strong>
          <small>{periodLabel(initialCondition)}</small>
        </div>
        <div className="loan-kpi-card">
          <CircleGauge size={17} />
          <span>Coût intérêts + frais</span>
          <strong>{formatCurrencyFromCents(summary.totalInterestCents + summary.totalFeesCents)}</strong>
          <small>{formatCurrencyFromCents(summary.totalInterestCents)} intérêts</small>
        </div>
        <div className="loan-kpi-card">
          <CalendarClock size={17} />
          <span>Durée</span>
          <strong>{conditionDurationLabel(initialCondition)}</strong>
          <small>{summary.payments.length} échéance{summary.payments.length > 1 ? 's' : ''} générée{summary.payments.length > 1 ? 's' : ''}</small>
        </div>
      </div>
    </section>
  )
}

