import { Activity, Landmark, Scale, TrendingDown, WalletCards } from 'lucide-react'

import { formatCurrencyFromCents, formatShortDate } from '../../lib/format'
import type { CompteInterneBasic, EvaluationBasic } from '../../lib/monatis-api'
import { summarizeEvaluations } from './evaluation-utils'

interface EvaluationDashboardProps {
  evaluations: EvaluationBasic[]
  accounts: CompteInterneBasic[]
  today: string
}

export function EvaluationDashboard({ evaluations, accounts, today }: EvaluationDashboardProps) {
  const summary = summarizeEvaluations(evaluations, accounts, today)
  const accountsToRefresh = summary.missingAccounts + summary.staleAccounts

  return (
    <section className="evaluation-dashboard" data-help="Synthese des dernieres evaluations connues par compte interne.">
      <article className="evaluation-summary-item evaluation-summary-item-net">
        <Scale size={22} aria-hidden />
        <div>
          <span>Valeur nette evaluee</span>
          <strong>{formatCurrencyFromCents(summary.netAmount)}</strong>
          <small>{summary.latestDate ? `Dernier point ${formatShortDate(summary.latestDate)}` : 'Aucune evaluation'}</small>
        </div>
      </article>
      <article className="evaluation-summary-item">
        <WalletCards size={22} aria-hidden />
        <div>
          <span>Actifs suivis</span>
          <strong>{formatCurrencyFromCents(summary.assetAmount)}</strong>
          <small>{summary.coveredAccounts}/{summary.totalAccounts || 0} comptes couverts</small>
        </div>
      </article>
      <article className="evaluation-summary-item">
        <TrendingDown size={22} aria-hidden />
        <div>
          <span>Dettes evaluees</span>
          <strong>{formatCurrencyFromCents(summary.liabilityAmount)}</strong>
          <small>Montants negatifs consolides</small>
        </div>
      </article>
      <article className="evaluation-summary-item">
        <Activity size={22} aria-hidden />
        <div>
          <span>A actualiser</span>
          <strong>{accountsToRefresh}</strong>
          <small>{summary.missingAccounts} sans point, {summary.staleAccounts} anciens</small>
        </div>
      </article>
      <div className="evaluation-type-strip">
        {summary.typeTotals.map((item) => (
          <div className="evaluation-type-item" key={item.type}>
            <Landmark size={18} aria-hidden />
            <div>
              <span>{item.label}</span>
              <strong>{formatCurrencyFromCents(item.amount)}</strong>
              <small>{item.count} compte{item.count > 1 ? 's' : ''}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
