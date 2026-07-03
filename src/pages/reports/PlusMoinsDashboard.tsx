import { Landmark, Percent, ReceiptText, TrendingDown, TrendingUp } from 'lucide-react'

import {
  InsightHero,
  InsightMetric,
  InsightMetricGrid,
  InsightPanel,
  InsightTrendChart,
  InsightWaterfall,
} from '../../components/insight'
import { formatCurrency, formatDate } from '../../lib/format'
import type { PlusMoinsValueView } from '../../lib/reporting'
import { getPlusMoinsReportSummary, plusMoinsRateLabel } from './plus-moins-report-utils'

export function PlusMoinsDashboard({
  report,
  start,
  end,
  periodLabel,
}: {
  report: PlusMoinsValueView
  start: string
  end: string
  periodLabel: string
}) {
  const summary = getPlusMoinsReportSummary(report)
  const PerformanceIcon = summary.montantPlusMoinsValueNetteEnEuros >= 0 ? TrendingUp : TrendingDown
  const hasPeriodBreakdown = report.totals.length > 1

  return (
    <InsightPanel className="plus-moins-dashboard" help="Synthese plus moins-value : resume la performance nette, le taux, les frais et le solde final sur le perimetre choisi.">
      <InsightHero
        eyebrow="Plus / moins-value"
        value={formatCurrency(summary.montantPlusMoinsValueNetteEnEuros)}
        subtitle={`${formatDate(start)} - ${formatDate(end)} - ${periodLabel}`}
        icon={PerformanceIcon}
        tone={summary.montantPlusMoinsValueNetteEnEuros >= 0 ? 'success' : 'warning'}
      />

      <InsightMetricGrid>
        <InsightMetric
          icon={Percent}
          label="Taux net"
          value={plusMoinsRateLabel(summary.tauxPlusMoinsValueNette)}
          hint="base initiale + operations"
          help="Taux net : performance nette rapportee a la base composee du solde initial et des operations ponderees."
        />
        <InsightMetric
          icon={ReceiptText}
          label="Frais"
          value={formatCurrency(summary.montantFraisEnEuros)}
          hint={`${plusMoinsRateLabel(summary.tauxFrais)} du solde final`}
          tone="warning"
          help="Frais : total des frais techniques pris en compte dans la performance du perimetre."
        />
        <InsightMetric
          icon={Landmark}
          label="Perimetre"
          value={summary.accountCount}
          hint={`${summary.groupCount} type(s) concernes`}
          help="Perimetre : nombre de comptes internes effectivement presents dans le calcul plus / moins-value."
        />
      </InsightMetricGrid>

      {hasPeriodBreakdown ? (
        <InsightTrendChart
          chartId="reports.plus-moins.trend"
          eyebrow="Performance"
          title="Evolution nette"
          subtitle={`${formatDate(start)} - ${formatDate(end)}`}
          help="Tendance plus moins-value : suit la performance nette seulement quand plusieurs periodes sont disponibles."
          variants={['area', 'line', 'columns']}
          items={report.totals.map((period) => ({ label: period.label, value: period.montantPlusMoinsValueNetteEnEuros }))}
          formatValue={formatCurrency}
        />
      ) : null}

      <InsightWaterfall
        chartId="reports.plus-moins.waterfall"
        eyebrow="Pont"
        title="Lecture initial / final"
        subtitle="Les operations ponderees expliquent la base de comparaison"
        help="Pont performance : montre le passage du solde initial au solde final avec les operations ponderees et la performance nette."
        steps={[
          { label: 'Solde initial', value: summary.montantSoldeInitialEnEuros, displayValue: formatCurrency(summary.montantSoldeInitialEnEuros) },
          { label: 'Operations', value: summary.montantOperationsEnEuros, displayValue: formatCurrency(summary.montantOperationsEnEuros), hint: 'ponderees sur la periode' },
          { label: 'Performance nette', value: summary.montantPlusMoinsValueNetteEnEuros, displayValue: formatCurrency(summary.montantPlusMoinsValueNetteEnEuros), tone: summary.montantPlusMoinsValueNetteEnEuros >= 0 ? 'success' : 'warning' },
          { label: 'Solde final', value: summary.montantSoldeFinalEnEuros, displayValue: formatCurrency(summary.montantSoldeFinalEnEuros), tone: 'accent' },
        ]}
      />
    </InsightPanel>
  )
}
