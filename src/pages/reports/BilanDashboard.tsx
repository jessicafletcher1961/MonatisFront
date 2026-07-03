import { Activity, Scale, ShieldCheck, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'

import {
  InsightHero,
  InsightMetric,
  InsightMetricGrid,
  InsightPanel,
  InsightTrendChart,
  InsightWaterfall,
} from '../../components/insight'
import { formatCurrency, formatDate } from '../../lib/format'
import type { BilanPatrimoineView } from '../../lib/reporting'
import { getBilanReportSummary } from './bilan-report-utils'

export function BilanDashboard({
  report,
  start,
  end,
  periodLabel,
}: {
  report: BilanPatrimoineView
  start: string
  end: string
  periodLabel: string
}) {
  const summary = getBilanReportSummary(report)
  const VariationIcon = summary.montantVariationEnEuros >= 0 ? TrendingUp : TrendingDown
  const netFlux = summary.montantTotalRecetteEnEuros - summary.montantTotalDepenseEnEuros
  const patrimoineTrend = report.totals.map((period) => ({
    label: period.label,
    value: period.montantSoldeFinalEnEuros,
  }))

  return (
    <InsightPanel className="bilan-dashboard" help="Synthese bilan patrimoine : resume le patrimoine final, la variation, les flux et les ecarts de controle sur la periode.">
      <InsightHero
        eyebrow="Bilan patrimoine"
        value={formatCurrency(summary.montantSoldeFinalEnEuros)}
        subtitle={`${formatDate(start)} - ${formatDate(end)} - ${periodLabel}`}
        icon={Scale}
        tone={summary.montantVariationEnEuros >= 0 ? 'success' : 'warning'}
      />

      <InsightMetricGrid>
        <InsightMetric
          icon={WalletCards}
          label="Comptes suivis"
          value={summary.accountCount}
          hint={`${summary.groupCount} type(s)`}
          help="Comptes suivis : nombre de comptes internes inclus dans le bilan patrimoine."
        />
        <InsightMetric
          icon={VariationIcon}
          label="Variation"
          value={formatCurrency(summary.montantVariationEnEuros)}
          hint="final - initial"
          tone={summary.montantVariationEnEuros >= 0 ? 'success' : 'warning'}
          help="Variation : difference entre le solde final et le solde initial sur le perimetre analyse."
        />
        <InsightMetric
          icon={Activity}
          label="Flux net"
          value={formatCurrency(netFlux)}
          hint={`+ ${formatCurrency(summary.montantTotalRecetteEnEuros)} / - ${formatCurrency(summary.montantTotalDepenseEnEuros)}`}
          help="Flux net : recettes moins depenses, hors flux techniques isoles par le rapport."
        />
        <InsightMetric
          icon={ShieldCheck}
          label="Ecart controle"
          value={formatCurrency(summary.montantEcartNonJustifieEnEuros)}
          hint="rapprochement"
          tone={Math.abs(summary.montantEcartNonJustifieEnEuros) < 0.01 ? 'success' : 'warning'}
          help="Controle : ecart entre le solde final et la formule solde initial + recettes - depenses + flux techniques."
        />
      </InsightMetricGrid>

      {patrimoineTrend.length > 1 ? (
        <InsightTrendChart
          chartId="reports.bilan.trend"
          eyebrow="Temps"
          title="Patrimoine final par periode"
          subtitle={periodLabel}
          variants={['area', 'line', 'columns']}
          help="Tendance du bilan patrimoine : compare le patrimoine final de chaque periode quand le rapport est decoupe dans le temps."
          items={patrimoineTrend}
          formatValue={formatCurrency}
        />
      ) : null}

      <InsightWaterfall
        chartId="reports.bilan.waterfall"
        eyebrow="Pont"
        title="Construction du patrimoine"
        subtitle="Initial, flux, techniques puis solde final"
        help="Pont patrimonial : montre le passage du solde initial au solde final avec recettes, depenses et ajustements techniques."
        steps={[
          { label: 'Initial', value: summary.montantSoldeInitialEnEuros, displayValue: formatCurrency(summary.montantSoldeInitialEnEuros) },
          { label: 'Recettes', value: summary.montantTotalRecetteEnEuros, displayValue: formatCurrency(summary.montantTotalRecetteEnEuros), tone: 'success' },
          { label: 'Depenses', value: summary.montantTotalDepenseEnEuros, displayValue: `- ${formatCurrency(summary.montantTotalDepenseEnEuros)}`, tone: 'warning' },
          { label: 'Flux techniques', value: summary.soldeTotalTechniqueEnEuros, displayValue: formatCurrency(summary.soldeTotalTechniqueEnEuros) },
          { label: 'Final', value: summary.montantSoldeFinalEnEuros, displayValue: formatCurrency(summary.montantSoldeFinalEnEuros), tone: 'accent' },
        ]}
      />

    </InsightPanel>
  )
}
