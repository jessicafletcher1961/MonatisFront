import { Boxes, GitBranch, ListChecks, Tags } from 'lucide-react'

import { InsightHero, InsightMetric, InsightMetricGrid, InsightMosaicChart, InsightPanel } from '../../components/insight'
import { summarizeTypologies, type TypologyGroupViewModel } from './typology-utils'

interface TypologyDashboardProps {
  groups: TypologyGroupViewModel[]
}

export function TypologyDashboard({ groups }: TypologyDashboardProps) {
  const summary = summarizeTypologies(groups)

  return (
    <InsightPanel className="typology-dashboard" help="Synthese du catalogue de typologies expose par le back.">
      <InsightHero
        eyebrow="Typologies"
        value={summary.totalValues}
        subtitle={`${summary.groupCount} familles chargees depuis le back`}
        icon={Tags}
        tone="neutral"
        tags={[
          { label: `${summary.operationValues} operations` },
          { label: `${summary.technicalValues} flux techniques` },
        ]}
      />

      <InsightMetricGrid>
        <InsightMetric icon={Tags} label="Valeurs exposees" value={summary.totalValues} hint={`${summary.groupCount} familles`} />
        <InsightMetric icon={ListChecks} label="Types operations" value={summary.operationValues} hint={`${summary.categorisableValues} categorisables, ${summary.nonCategorisableValues} hors categorie`} />
        <InsightMetric icon={GitBranch} label="Flux techniques" value={summary.technicalValues} hint="Flags portes par les types operation" tone={summary.technicalValues ? 'warning' : 'default'} />
        <InsightMetric icon={Boxes} label="Famille dense" value={summary.largestGroupTitle} hint={`${summary.largestGroupCount} valeur${summary.largestGroupCount > 1 ? 's' : ''}`} />
      </InsightMetricGrid>

      <InsightMosaicChart
        chartId="data.typologies.catalog"
        eyebrow="Catalogue"
        title="Volume par famille"
        subtitle="Chaque famille prend de la place selon son volume"
        help="Mosaique typologies : compare le nombre de valeurs par famille de typologie."
        variants={['treemap', 'bars', 'donut']}
        items={groups.map((group) => ({
          label: group.shortTitle,
          value: group.items.length,
          displayValue: group.items.length,
          hint: group.usage,
        }))}
      />
    </InsightPanel>
  )
}
