import { AlertTriangle, History, ListChecks, Route, Target } from 'lucide-react'

import { InsightDonutChart, InsightHero, InsightMetric, InsightMetricGrid, InsightPanel } from '../../components/insight'
import { formatDate } from '../../lib/format'
import { summarizeImportRules, type ImportRuleViewModel } from './import-rule-utils'

interface ImportRulesDashboardProps {
  rules: ImportRuleViewModel[]
}

export function ImportRulesDashboard({ rules }: ImportRulesDashboardProps) {
  const summary = summarizeImportRules(rules)
  const rulesToReview = summary.partialRules + summary.unusedRules

  return (
    <InsightPanel className="import-rules-dashboard" help="Synthese des regles apprises pendant l'import de releves bancaires.">
      <InsightHero
        eyebrow="Regles import"
        value={summary.totalRules}
        subtitle={`${summary.readyRules} pretes, ${rulesToReview} a controler`}
        icon={ListChecks}
        tone={rulesToReview ? 'warning' : 'success'}
        tags={[
          { label: `${summary.totalUsages} usage(s)` },
          { label: `${summary.scopedRules} par compte` },
        ]}
      />

      <InsightMetricGrid>
        <InsightMetric icon={ListChecks} label="Regles actives" value={summary.totalRules} hint={`${summary.readyRules} pretes, ${rulesToReview} a controler`} tone={rulesToReview ? 'warning' : 'success'} />
        <InsightMetric icon={History} label="Utilisations apprises" value={summary.totalUsages} hint={summary.latestUsageDate ? `Dernier usage ${formatDate(summary.latestUsageDate)}` : 'Aucune reutilisation'} />
        <InsightMetric icon={Target} label="Par compte" value={summary.scopedRules} hint={`${summary.totalRules - summary.scopedRules} globale(s)`} />
        <InsightMetric icon={AlertTriangle} label="A completer" value={rulesToReview} hint={`${summary.unusedRules} sans usage, ${summary.partialRules} partielles`} tone={rulesToReview ? 'warning' : 'success'} />
      </InsightMetricGrid>

      <InsightDonutChart
        chartId="data.import-rules.quality"
        eyebrow="Qualite"
        title="Qualite des regles"
        subtitle="Etat de preparation des automatismes"
        help="Entonnoir regles import : classe les regles pretes, partielles et sans usage pour reperer ce qui doit etre corrige."
        variants={['funnel', 'donut', 'bars', 'treemap']}
        centerValue={summary.totalRules}
        centerLabel="regles"
        items={[
          { label: 'Pretes', value: summary.readyRules, displayValue: summary.readyRules, tone: 'success' },
          { label: 'Partielles', value: summary.partialRules, displayValue: summary.partialRules, tone: 'warning' },
          { label: 'Sans usage', value: summary.unusedRules, displayValue: summary.unusedRules },
        ]}
      />

      <div className="insight-footer-note">
        <Route size={15} />
        <span>Routage renseigne : {summary.withExternalAccount}/{summary.totalRules || 0} comptes externes, {summary.withCategory} categories, {summary.withBeneficiary} beneficiaires.</span>
      </div>
    </InsightPanel>
  )
}
