import { AlertTriangle, DatabaseZap, Route, Scale } from 'lucide-react'

import { InsightHero, InsightMetric, InsightMetricGrid, InsightPanel, InsightStackedBar } from '../../components/insight'
import { formatCurrencyFromCents } from '../../lib/format'
import { summarizeTechnicalAccounts, type TechnicalAccountSummary } from './technical-account-utils'

interface TechnicalAccountsDashboardProps {
  summaries: TechnicalAccountSummary[]
}

export function TechnicalAccountsDashboard({ summaries }: TechnicalAccountsDashboardProps) {
  const summary = summarizeTechnicalAccounts(summaries)

  return (
    <InsightPanel className="technical-dashboard" help="Synthese des comptes techniques et de leurs flux calcules depuis les operations.">
      <InsightHero
        eyebrow="Comptes techniques"
        value={summary.accountCount}
        subtitle={`${summary.activeAccountCount} utilise${summary.activeAccountCount > 1 ? 's' : ''}`}
        icon={DatabaseZap}
        tone={summary.nonTechnicalFluxCount ? 'warning' : 'success'}
        tags={[
          { label: `${summary.technicalFluxCount} flux technique(s)` },
          { label: `${summary.nonTechnicalFluxCount} a verifier`, tone: summary.nonTechnicalFluxCount ? 'warning' : 'success' },
        ]}
      />

      <InsightMetricGrid>
        <InsightMetric icon={DatabaseZap} label="Comptes techniques" value={summary.accountCount} hint={`${summary.activeAccountCount} utilise(s)`} />
        <InsightMetric icon={Scale} label="Solde net" value={formatCurrencyFromCents(summary.netCents)} hint="Entrees moins sorties techniques" tone={summary.netCents >= 0 ? 'success' : 'warning'} />
        <InsightMetric icon={Route} label="Flux techniques" value={summary.technicalFluxCount} hint="lignes reconnues comme techniques" />
        <InsightMetric icon={AlertTriangle} label="A verifier" value={summary.nonTechnicalFluxCount} hint={`${summary.attentionAccountCount} compte(s) concerne(s)`} tone={summary.nonTechnicalFluxCount ? 'warning' : 'success'} />
      </InsightMetricGrid>

      <InsightStackedBar
        chartId="data.technical.flux"
        eyebrow="Flux"
        title="Flux techniques"
        subtitle="Produits et charges techniques"
        help="Barre technique : compare les remunerations et les charges techniques calculees depuis les operations."
        variants={['flow', 'stack', 'bars', 'pie']}
        segments={[
          { label: 'Remunerations', value: summary.rewardsCents, displayValue: formatCurrencyFromCents(summary.rewardsCents), tone: 'success' },
          { label: 'Frais et charges', value: summary.chargesCents, displayValue: formatCurrencyFromCents(summary.chargesCents), tone: 'warning' },
        ]}
      />

      <div className="insight-footer-note">
        <AlertTriangle size={15} />
        <span>{summary.attentionAccountCount} compte{summary.attentionAccountCount > 1 ? 's' : ''} a verifier, {summary.nonTechnicalFluxCount} flux non technique{summary.nonTechnicalFluxCount > 1 ? 's' : ''}.</span>
      </div>
    </InsightPanel>
  )
}
