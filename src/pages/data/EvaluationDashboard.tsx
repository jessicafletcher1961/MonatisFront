import { Activity, Landmark, Percent, TrendingDown, WalletCards } from 'lucide-react'

import { InsightHero, InsightMetric, InsightMetricGrid, InsightMosaicChart, InsightPanel } from '../../components/insight'
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
  const coverageRate = summary.totalAccounts ? Math.round((summary.coveredAccounts / summary.totalAccounts) * 100) : 0

  return (
    <InsightPanel className="evaluation-dashboard" help="Synthese des dernieres evaluations connues par compte interne.">
      <InsightHero
        eyebrow="Evaluations"
        value={formatCurrencyFromCents(summary.netAmount)}
        subtitle={summary.latestDate ? `Dernier point ${formatShortDate(summary.latestDate)}` : 'Aucune evaluation'}
        icon={WalletCards}
        tone={accountsToRefresh ? 'warning' : 'success'}
        tags={[
          { label: `${summary.coveredAccounts}/${summary.totalAccounts || 0} comptes couverts` },
          { label: accountsToRefresh ? `${accountsToRefresh} a actualiser` : 'Couverture a jour', tone: accountsToRefresh ? 'warning' : 'success' },
        ]}
      />

      <InsightMetricGrid>
        <InsightMetric icon={WalletCards} label="Actifs suivis" value={formatCurrencyFromCents(summary.assetAmount)} hint={`${summary.coveredAccounts}/${summary.totalAccounts || 0} comptes couverts`} tone="success" />
        <InsightMetric icon={TrendingDown} label="Dettes evaluees" value={formatCurrencyFromCents(summary.liabilityAmount)} hint="Montants negatifs consolides" tone="warning" />
        <InsightMetric icon={Percent} label="Couverture" value={`${coverageRate} %`} hint={`${summary.coveredAccounts}/${summary.totalAccounts || 0} comptes`} tone={accountsToRefresh ? 'warning' : 'success'} />
        <InsightMetric icon={Activity} label="A actualiser" value={accountsToRefresh} hint={`${summary.missingAccounts} sans point, ${summary.staleAccounts} anciens`} tone={accountsToRefresh ? 'warning' : 'success'} />
      </InsightMetricGrid>

      <InsightMosaicChart
        chartId="data.evaluations.coverage"
        eyebrow="Couverture"
        title="Valeur par type de compte"
        subtitle="Les blocs montrent où se concentre la valeur évaluée"
        help="Mosaique evaluations : compare les dernieres valeurs par type de compte interne."
        variants={['treemap', 'donut', 'bars']}
        items={summary.typeTotals.map((item) => ({
          label: item.label,
          value: item.amount,
          displayValue: formatCurrencyFromCents(item.amount),
          hint: `${item.count} compte${item.count > 1 ? 's' : ''}`,
          tone: item.amount >= 0 ? 'success' : 'warning',
        }))}
      />

      <div className="insight-footer-note">
        <Landmark size={15} />
        <span>Les evaluations alimentent les vues patrimoine et performance quand les comptes disposent d'un point a date.</span>
      </div>
    </InsightPanel>
  )
}
