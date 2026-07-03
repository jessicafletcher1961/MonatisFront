import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Clock3, DatabaseZap, Scale, TrendingDown, TrendingUp } from 'lucide-react'

import { Badge, EmptyState } from '../../components/ui'
import { formatCurrencyFromCents, formatShortDate } from '../../lib/format'
import {
  technicalAccountTitle,
  type TechnicalAccountSummary,
  technicalStatusHint,
  technicalStatusLabel,
  technicalStatusTone,
} from './technical-account-utils'

interface TechnicalAccountOverviewProps {
  summary: TechnicalAccountSummary
}

export function TechnicalAccountOverview({ summary }: TechnicalAccountOverviewProps) {
  const maxTypeAmount = Math.max(1, ...summary.typeBreakdown.map((item) => Math.abs(item.amountCents)))

  return (
    <section className="technical-overview" data-help="Resume l'utilisation du compte technique dans les operations et les rapports.">
      <div className={`technical-detail-hero technical-detail-hero-${summary.status}`}>
        <div>
          <span>{summary.account.identifiant}</span>
          <h2>{technicalAccountTitle(summary.account)}</h2>
          <p>{technicalStatusHint(summary)}</p>
        </div>
        <Badge tone={technicalStatusTone(summary.status)}>{technicalStatusLabel(summary.status)}</Badge>
      </div>

      <div className="technical-kpi-grid">
        <article className="technical-kpi-card technical-kpi-primary">
          <Scale size={20} aria-hidden />
          <span>Solde net technique</span>
          <strong>{formatCurrencyFromCents(summary.netCents)}</strong>
          <small>{formatCurrencyFromCents(summary.totalInCents)} entrees - {formatCurrencyFromCents(summary.totalOutCents)} sorties</small>
        </article>
        <article className="technical-kpi-card">
          <DatabaseZap size={20} aria-hidden />
          <span>Flux techniques</span>
          <strong>{summary.technicalFluxCount}</strong>
          <small>{summary.usageCount} operation{summary.usageCount > 1 ? 's' : ''} rattachee{summary.usageCount > 1 ? 's' : ''}</small>
        </article>
        <article className="technical-kpi-card">
          <TrendingUp size={20} aria-hidden />
          <span>Remunerations</span>
          <strong>{formatCurrencyFromCents(summary.rewardsCents)}</strong>
          <small>Codes operation finissant par +</small>
        </article>
        <article className="technical-kpi-card">
          <TrendingDown size={20} aria-hidden />
          <span>Frais et charges</span>
          <strong>{formatCurrencyFromCents(summary.chargesCents)}</strong>
          <small>Codes operation finissant par -</small>
        </article>
      </div>

      <div className="technical-detail-grid">
        <section className="technical-activity-panel">
          <div className="technical-panel-head">
            <div>
              <span>Flux recents</span>
              <strong>{summary.latestOperationDate ? formatShortDate(summary.latestOperationDate) : 'Aucun flux'}</strong>
            </div>
            <Clock3 size={18} aria-hidden />
          </div>
          {summary.usages.length === 0 ? (
            <EmptyState title="Aucun flux rattache" description="Ce compte existe mais aucune operation ne l'utilise actuellement." />
          ) : (
            <div className="technical-usage-list">
              {summary.usages.slice(0, 6).map((usage) => (
                <article className={`technical-usage-row ${usage.isTechnicalFlux ? '' : 'attention'}`} key={usage.operation.numero}>
                  <span className="technical-usage-direction">
                    {usage.direction === 'in' ? <ArrowDownLeft size={16} aria-hidden /> : <ArrowUpRight size={16} aria-hidden />}
                  </span>
                  <div>
                    <strong>{usage.operation.libelle || usage.operation.numero}</strong>
                    <small>{usage.operation.numero} - {usage.typeLabel} - {formatShortDate(usage.operation.dateValeur)}</small>
                  </div>
                  <strong>{formatCurrencyFromCents(Math.abs(usage.netCents))}</strong>
                  {!usage.isTechnicalFlux ? <AlertTriangle size={16} aria-label="Flux non technique" /> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="technical-breakdown-panel">
          <div className="technical-panel-head">
            <div>
              <span>Flux par type</span>
              <strong>{summary.typeBreakdown.length} type{summary.typeBreakdown.length > 1 ? 's' : ''}</strong>
            </div>
            <DatabaseZap size={18} aria-hidden />
          </div>
          {summary.typeBreakdown.length === 0 ? (
            <EmptyState title="Aucun type" description="L'analyse par type apparaitra apres les premieres operations rattachees." />
          ) : (
            <div className="technical-breakdown-list">
              {summary.typeBreakdown.map((item) => {
                const width = Math.max(6, Math.round((Math.abs(item.amountCents) / maxTypeAmount) * 100))
                return (
                  <div className="technical-breakdown-row" key={item.code}>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.code} - {item.count} flux</small>
                    </div>
                    <div className="technical-breakdown-meter" aria-hidden>
                      <span style={{ width: `${width}%` }} />
                    </div>
                    <strong>{formatCurrencyFromCents(item.amountCents)}</strong>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
