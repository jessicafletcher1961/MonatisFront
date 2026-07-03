import { Layers3, Scale, Tags } from 'lucide-react'

import {
  InsightHero,
  InsightMetric,
  InsightMetricGrid,
  InsightPanel,
  InsightStackedBar,
  InsightTrendChart,
} from '../../components/insight'
import { formatCurrency, formatDate } from '../../lib/format'
import type { DepenseRecetteView } from '../../lib/reporting'
import { depenseRecetteCategoryLabel, getDepenseRecetteSummary } from './depense-recette-report-utils'

export function DepenseRecetteDashboard({
  report,
  start,
  end,
  periodLabel,
  subcategoryCount,
}: {
  report: DepenseRecetteView
  start: string
  end: string
  periodLabel: string
  subcategoryCount: number
}) {
  const summary = getDepenseRecetteSummary(report)
  const strongestCategory = summary.strongestCategory ? depenseRecetteCategoryLabel(summary.strongestCategory) : null
  const hasPeriodBreakdown = report.totals.length > 1

  return (
    <InsightPanel className="depense-recette-dashboard" help="Synthese depenses recettes : resume les entrees, sorties, solde net et le volume de lignes d'operations sur la periode.">
      <InsightHero
        eyebrow="Depenses / recettes"
        value={formatCurrency(summary.solde)}
        subtitle={`${formatDate(start)} - ${formatDate(end)} - ${periodLabel}`}
        icon={Scale}
        tone={summary.solde >= 0 ? 'success' : 'warning'}
      />

      <InsightMetricGrid>
        <InsightMetric
          icon={Tags}
          label="Lignes"
          value={summary.operationCount}
          hint="operations analysees"
          help="Lignes : nombre de lignes comptables de recettes ou depenses retenues par les filtres."
        />
        <InsightMetric
          icon={Layers3}
          label="Categories"
          value={summary.categoryCount}
          hint={strongestCategory ?? 'aucun segment dominant'}
          help="Categories : nombre de categories contenant au moins une ligne analysee. Le sous-texte indique la categorie la plus marquante."
        />
        <InsightMetric
          icon={Layers3}
          label="Sous-categories"
          value={summary.subcategoryCount}
          hint={subcategoryCount ? `${subcategoryCount} filtre(s)` : 'couverture du rapport'}
          help="Sous-categories : nombre de sous-categories visibles dans le rapport apres les filtres."
        />
      </InsightMetricGrid>

      <InsightStackedBar
        chartId="reports.depense-recette.balance"
        eyebrow="Balance"
        title="Ce qui entre face a ce qui sort"
        subtitle="Montants retenus par les filtres"
        help="Flux depenses recettes : montre comment le volume analyse se repartit entre entrees et sorties."
        variants={['flow', 'stack', 'bars', 'pie']}
        segments={[
          { label: 'Recettes', value: summary.totalRecette, displayValue: formatCurrency(summary.totalRecette), tone: 'success' },
          { label: 'Depenses', value: summary.totalDepense, displayValue: formatCurrency(summary.totalDepense), tone: 'warning' },
        ]}
      />

      {hasPeriodBreakdown ? (
        <InsightTrendChart
          chartId="reports.depense-recette.trend"
          eyebrow="Temps"
          title="Solde par periode"
          subtitle={periodLabel}
          help="Tendance depenses recettes : suit le solde net uniquement quand plusieurs periodes sont disponibles."
          variants={['area', 'line', 'columns']}
          items={report.totals.map((period) => ({ label: period.label, value: period.solde }))}
          formatValue={formatCurrency}
        />
      ) : null}
    </InsightPanel>
  )
}
