import { AlertTriangle, DatabaseZap, Scale, TrendingDown, TrendingUp } from 'lucide-react'

import { formatCurrencyFromCents } from '../../lib/format'
import { summarizeTechnicalAccounts, type TechnicalAccountSummary } from './technical-account-utils'

interface TechnicalAccountsDashboardProps {
  summaries: TechnicalAccountSummary[]
}

export function TechnicalAccountsDashboard({ summaries }: TechnicalAccountsDashboardProps) {
  const summary = summarizeTechnicalAccounts(summaries)

  return (
    <section className="technical-dashboard" data-help="Synthese des comptes techniques et de leurs flux calcules depuis les operations.">
      <article className="technical-summary-item technical-summary-item-main">
        <DatabaseZap size={22} aria-hidden />
        <div>
          <span>Comptes techniques</span>
          <strong>{summary.accountCount}</strong>
          <small>{summary.activeAccountCount} utilise{summary.activeAccountCount > 1 ? 's' : ''}</small>
        </div>
      </article>
      <article className="technical-summary-item">
        <Scale size={22} aria-hidden />
        <div>
          <span>Solde net technique</span>
          <strong>{formatCurrencyFromCents(summary.netCents)}</strong>
          <small>Entrees moins sorties techniques</small>
        </div>
      </article>
      <article className="technical-summary-item">
        <TrendingUp size={22} aria-hidden />
        <div>
          <span>Remunerations</span>
          <strong>{formatCurrencyFromCents(summary.rewardsCents)}</strong>
          <small>Types techniques positifs</small>
        </div>
      </article>
      <article className="technical-summary-item">
        <TrendingDown size={22} aria-hidden />
        <div>
          <span>Frais et charges</span>
          <strong>{formatCurrencyFromCents(summary.chargesCents)}</strong>
          <small>Types techniques negatifs</small>
        </div>
      </article>
      <div className="technical-warning-strip">
        <AlertTriangle size={18} aria-hidden />
        <div>
          <strong>{summary.nonTechnicalFluxCount} flux non technique{summary.nonTechnicalFluxCount > 1 ? 's' : ''}</strong>
          <span>{summary.attentionAccountCount} compte{summary.attentionAccountCount > 1 ? 's' : ''} a verifier</span>
        </div>
      </div>
    </section>
  )
}
