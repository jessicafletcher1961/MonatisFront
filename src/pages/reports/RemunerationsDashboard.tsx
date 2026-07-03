import { Banknote, CalendarRange, Layers3, Scale } from 'lucide-react'

import {
  InsightHero,
  InsightMetric,
  InsightMetricGrid,
  InsightPanel,
  InsightStackedBar,
  InsightTrendChart,
} from '../../components/insight'
import { formatCurrency, formatDate } from '../../lib/format'
import type { RemunerationsFraisView } from '../../lib/reporting'
import { getRemunerationsSummary } from './remunerations-report-utils'

export function RemunerationsDashboard({
  report,
  start,
  end,
  periodLabel,
}: {
  report: RemunerationsFraisView
  start: string
  end: string
  periodLabel: string
}) {
  const summary = getRemunerationsSummary(report)
  const hasPeriodBreakdown = report.totals.length > 1

  return (
    <InsightPanel className="remunerations-dashboard" help="Synthese remunerations frais : resume les remunerations, les frais, le net et le nombre de comptes sur la periode.">
      <InsightHero
        eyebrow="Remunerations / frais"
        value={formatCurrency(summary.net)}
        subtitle={`${formatDate(start)} - ${formatDate(end)} - ${periodLabel}`}
        icon={Scale}
        tone={summary.net >= 0 ? 'success' : 'warning'}
      />

      <InsightMetricGrid>
        <InsightMetric
          icon={Banknote}
          label="Comptes"
          value={summary.accountCount}
          hint={`${summary.groupCount} type(s)`}
          help="Comptes : nombre de comptes internes ayant des remunerations ou frais dans le rapport."
        />
        <InsightMetric
          icon={Layers3}
          label="Types"
          value={summary.groupCount}
          hint="types avec mouvements"
          help="Types : nombre de types de fonctionnement contenant au moins un mouvement financier analyse."
        />
        <InsightMetric
          icon={CalendarRange}
          label="Periodes"
          value={report.totals.length}
          hint={periodLabel}
          help="Periodes : nombre de segments temporels produits par le decoupage choisi dans les parametres."
        />
      </InsightMetricGrid>

      <InsightStackedBar
        chartId="reports.remunerations.stack"
        eyebrow="Marge"
        title="Produits financiers face aux frais"
        subtitle="Montants retenus par les filtres"
        help="Flux remunerations frais : montre comment les produits financiers sont compares aux frais retenus."
        variants={['flow', 'stack', 'bars', 'pie']}
        segments={[
          { label: 'Remunerations', value: summary.totalRemunerations, displayValue: formatCurrency(summary.totalRemunerations), tone: 'success' },
          { label: 'Frais', value: summary.totalFrais, displayValue: formatCurrency(summary.totalFrais), tone: 'warning' },
        ]}
      />

      {hasPeriodBreakdown ? (
        <InsightTrendChart
          chartId="reports.remunerations.trend"
          eyebrow="Temps"
          title="Net par periode"
          subtitle={periodLabel}
          help="Tendance remunerations frais : suit le net seulement quand plusieurs periodes sont disponibles."
          variants={['area', 'line', 'columns']}
          items={report.totals.map((period) => ({ label: period.label, value: period.solde }))}
          formatValue={formatCurrency}
        />
      ) : null}
    </InsightPanel>
  )
}
