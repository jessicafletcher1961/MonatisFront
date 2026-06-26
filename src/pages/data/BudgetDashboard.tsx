import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info, PiggyBank, Plus } from 'lucide-react'

import { Button, SegmentedControl, Surface } from '../../components/ui'
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
    <Surface className="budget-dashboard">
      <div className="budget-command-bar">
        <div>
          <h2>Budgets</h2>
          <p>Choisis le type de reference budgetaire. Chaque budget cible une seule reference.</p>
        </div>
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

      <div className="budget-summary-grid" aria-label="Synthese des budgets">
        <div className="budget-summary-item income">
          <ArrowUpRight size={18} />
          <span>Entrees realisees</span>
          <strong>{formatCurrencyFromCents(executionSummary.executedIncomeCents)}</strong>
          <small>sur {formatCurrencyFromCents(executionSummary.plannedIncomeCents)}</small>
        </div>
        <div className="budget-summary-item expense">
          <ArrowDownRight size={18} />
          <span>Sorties consommees</span>
          <strong>{formatCurrencyFromCents(executionSummary.executedExpenseCents)}</strong>
          <small>sur {formatCurrencyFromCents(executionSummary.plannedExpenseCents)}</small>
        </div>
        <div className="budget-summary-item net">
          <PiggyBank size={18} />
          <span>Disponible sorties</span>
          <strong>{formatCurrencyFromCents(executionSummary.remainingExpenseCents)}</strong>
          <small>reste entre les limites actives</small>
        </div>
        <div className="budget-summary-item current">
          <AlertTriangle size={18} />
          <span>Alertes actives</span>
          <strong>
            {executionSummary.alertCount}/{executionSummary.currentCount}
          </strong>
          <small>{executionSummary.totalCount} budgets charges</small>
        </div>
      </div>
    </Surface>
  )
}
