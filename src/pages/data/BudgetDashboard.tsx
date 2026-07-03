import { AlertTriangle, ArrowUpRight, Info, PiggyBank, Plus } from 'lucide-react'

import { InsightBudgetChart, InsightHero, InsightMetric, InsightMetricGrid, InsightPanel } from '../../components/insight'
import { Button, SegmentedControl } from '../../components/ui'
import { formatCurrencyFromCents } from '../../lib/format'
import type { BudgetResource } from '../../lib/monatis-api'
import type { BudgetExecutionSummary } from './budget-execution'
import { budgetResourceHint, budgetResourceModeLabel, resourceOptions } from './budget-panel-utils'

interface BudgetDashboardProps {
  resource: BudgetResource
  executionSummary: BudgetExecutionSummary
  onCreate: () => void
  onResourceChange: (resource: BudgetResource) => void
}

export function BudgetDashboard({ resource, executionSummary, onCreate, onResourceChange }: BudgetDashboardProps) {
  return (
    <InsightPanel className="budget-dashboard" help="Synthese budgets : montre la consommation globale, les alertes et le type de reference actuellement analyse.">
      <div className="budget-command-bar">
        <InsightHero
          eyebrow="Budgets"
          value={formatCurrencyFromCents(executionSummary.remainingExpenseCents)}
          subtitle="Disponible sur les budgets de sorties actifs"
          icon={PiggyBank}
          tone={executionSummary.alertCount ? 'warning' : 'success'}
          tags={[
            { label: budgetResourceModeLabel(resource) },
            { label: `${executionSummary.totalCount} budget(s)` },
          ]}
        />
        <Button tone="soft" onClick={onCreate}>
          <Plus size={16} />
          Nouveau budget
        </Button>
      </div>

      <SegmentedControl items={resourceOptions} value={resource} onChange={(value) => onResourceChange(value as BudgetResource)} />

      <div className="budget-reference-note" data-help="Cette indication precise quelle reference unique le budget cible et comment le suivi est calcule depuis les lignes d'operations.">
        <Info size={16} />
        <div>
          <strong>{budgetResourceModeLabel(resource)}</strong>
          <span>{budgetResourceHint(resource)}</span>
        </div>
      </div>

      <InsightMetricGrid>
        <InsightMetric icon={ArrowUpRight} label="Entrees realisees" value={formatCurrencyFromCents(executionSummary.executedIncomeCents)} hint={`sur ${formatCurrencyFromCents(executionSummary.plannedIncomeCents)}`} tone="success" />
        <InsightMetric icon={PiggyBank} label="Objectif sorties" value={formatCurrencyFromCents(executionSummary.plannedExpenseCents)} hint={`${executionSummary.currentCount} budget(s) actif(s)`} />
        <InsightMetric icon={PiggyBank} label="Budgets actifs" value={`${executionSummary.currentCount}/${executionSummary.totalCount}`} hint={budgetResourceModeLabel(resource)} />
        <InsightMetric icon={AlertTriangle} label="Alertes actives" value={`${executionSummary.alertCount}/${executionSummary.currentCount}`} hint={`${executionSummary.totalCount} budgets charges`} tone={executionSummary.alertCount ? 'warning' : 'success'} />
      </InsightMetricGrid>

      <InsightBudgetChart
        chartId="data.budgets.consumption"
        eyebrow="Consommation"
        title="Sorties suivies"
        subtitle="Le reste devient un dépassement si la limite est franchie"
        help="Jauge budget : compare les sorties consommees a l'objectif des budgets actifs et signale le disponible ou le depassement."
        plannedValue={executionSummary.plannedExpenseCents}
        actualValue={executionSummary.executedExpenseCents}
        remainingValue={executionSummary.remainingExpenseCents}
        formatValue={formatCurrencyFromCents}
      />
    </InsightPanel>
  )
}
