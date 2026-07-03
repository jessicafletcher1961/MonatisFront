import { CalendarDays, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'

import { InsightHero, InsightMetric, InsightMetricGrid, InsightMosaicChart, InsightPanel } from '../../components/insight'
import { formatCurrency, formatDate } from '../../lib/format'
import type { ResumeCompteView } from '../../lib/reporting'
import type { ResumeGroupView } from './resume-report-utils'
import { getResumeDashboardSummary } from './resume-report-utils'

export function ResumeDashboard({
  resumes,
  groups,
  date,
}: {
  resumes: ResumeCompteView[]
  groups: ResumeGroupView[]
  date: string
}) {
  const summary = getResumeDashboardSummary(resumes, groups)

  return (
    <InsightPanel className="resume-dashboard" help="Synthese du resume : donne le total des soldes internes, le nombre de comptes inclus et la structure par type de fonctionnement.">
      <InsightHero
        eyebrow="Resume des comptes"
        value={formatCurrency(summary.totalBalance)}
        subtitle={`Solde calcule au ${formatDate(date)}`}
        icon={WalletCards}
        tone={summary.totalBalance >= 0 ? 'success' : 'warning'}
      />

      <InsightMetricGrid>
        <InsightMetric
          icon={WalletCards}
          label="Comptes"
          value={summary.accountCount}
          hint="dans le perimetre"
          help="Comptes : nombre de comptes internes inclus dans le resume apres les filtres de type et de comptes."
        />
        <InsightMetric
          icon={TrendingUp}
          label="Soldes positifs"
          value={formatCurrency(summary.positiveTotal)}
          hint="avant compensation"
          tone="success"
          help="Soldes positifs : somme des comptes dont le solde calcule a la date choisie est positif."
        />
        <InsightMetric
          icon={TrendingDown}
          label="Soldes negatifs"
          value={formatCurrency(summary.negativeTotal)}
          hint="dettes et decouverts"
          tone="warning"
          help="Soldes negatifs : somme des comptes dont le solde calcule a la date choisie est negatif."
        />
        <InsightMetric
          icon={CalendarDays}
          label="Moyenne"
          value={formatCurrency(summary.averageBalance)}
          hint="par compte affiche"
          help="Moyenne : total consolide divise par le nombre de comptes affiches."
        />
      </InsightMetricGrid>

      <InsightMosaicChart
        chartId="reports.resume.mosaic"
        eyebrow="Structure"
        title="Poids des types de comptes"
        subtitle="La taille des blocs suit l'importance absolue du solde"
        help="Mosaique resume : compare les soldes consolides par type de fonctionnement."
        variants={['treemap', 'bars', 'donut']}
        items={groups.map((group) => ({
          label: group.type,
          value: group.total,
          displayValue: formatCurrency(group.total),
          hint: `${group.accounts.length} compte(s)`,
          tone: group.total >= 0 ? 'success' : 'warning',
        }))}
      />
    </InsightPanel>
  )
}
