import { ArrowDownRight, ArrowUpRight, Search, WalletCards } from 'lucide-react'

import { Badge, EmptyState, Surface } from '../../components/ui'
import { cx } from '../../lib/cx'
import { formatCurrencyFromCents } from '../../lib/format'
import type { BudgetDetail, BudgetResource } from '../../lib/monatis-api'
import type { BudgetExecution, BudgetExecutionStatus } from './budget-execution'
import {
  budgetDirection,
  budgetPeriodLabel,
  budgetPeriodStatus,
  budgetPeriodStatusLabel,
  budgetReferenceLabel,
  budgetResourceSearchPlaceholder,
  budgetResourceTargetLabel,
  budgetTypeLabel,
  directionOptions,
  periodFilterOptions,
  titleForBudget,
  type BudgetDirectionFilter,
  type BudgetGroup,
  type BudgetPeriodFilter,
} from './budget-panel-utils'

interface BudgetListProps {
  budgetGroups: BudgetGroup[]
  directionFilter: BudgetDirectionFilter
  periodFilter: BudgetPeriodFilter
  resource: BudgetResource
  search: string
  selectedKey: string | null
  visibleBudgets: BudgetDetail[]
  executions: Record<string, BudgetExecution>
  onDirectionFilterChange: (value: BudgetDirectionFilter) => void
  onPeriodFilterChange: (value: BudgetPeriodFilter) => void
  onSearchChange: (value: string) => void
  onSelectBudget: (key: string) => void
}

function badgeToneForBudget(budget: BudgetDetail): 'default' | 'success' | 'warning' {
  const status = budgetPeriodStatus(budget)
  if (status === 'current') return 'success'
  if (status === 'future') return 'warning'
  return 'default'
}

function executionTone(status?: BudgetExecutionStatus): 'ok' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ok') return 'ok'
  if (status === 'warning') return 'warning'
  if (status === 'danger') return 'danger'
  return 'neutral'
}

function BudgetRow({
  budget,
  execution,
  resource,
  selected,
  onSelect,
}: {
  budget: BudgetDetail
  execution?: BudgetExecution
  resource: BudgetResource
  selected: boolean
  onSelect: () => void
}) {
  const direction = budgetDirection(budget)
  const DirectionIcon = direction === 'income' ? ArrowUpRight : direction === 'expense' ? ArrowDownRight : WalletCards
  const amountPrefix = direction === 'income' ? '+' : direction === 'expense' ? '-' : ''
  const status = budgetPeriodStatus(budget)
  const remainingValue = execution ? Math.abs(execution.remainingCents) : 0
  const overBudget = execution ? direction === 'expense' && execution.remainingCents < 0 : false
  const progressTone = executionTone(execution?.status)

  return (
    <button type="button" className={cx('budget-row', selected && 'selected')} onClick={onSelect}>
      <span className={cx('budget-row-marker', `budget-row-marker-${direction}`)}>
        <DirectionIcon size={18} />
      </span>
      <span className="budget-row-main">
        <strong>{titleForBudget(budget)}</strong>
        <span>
          {budgetResourceTargetLabel(resource)} : {budgetReferenceLabel(budget)} - {budgetTypeLabel(budget)}
        </span>
      </span>
      <span className="budget-row-meta">
        <Badge tone={badgeToneForBudget(budget)}>{budgetPeriodStatusLabel(status)}</Badge>
        <small>{budgetPeriodLabel(budget)}</small>
      </span>
      <span className="budget-row-progress">
        <span className="budget-progress-head">
          <small>{execution?.statusLabel ?? 'Non calcule'}</small>
          <small>{execution ? `${Math.round(execution.progressPercent)}%` : '0%'}</small>
        </span>
        <span className="budget-progress-track" aria-hidden="true">
          <span className={cx('budget-progress-fill', `budget-progress-fill-${progressTone}`)} style={{ width: `${execution?.progressCappedPercent ?? 0}%` }} />
          <span className="budget-progress-expected" style={{ left: `${execution?.expectedProgressPercent ?? 0}%` }} />
        </span>
        <small>
          {execution?.executedLabel ?? 'Realise'} {formatCurrencyFromCents(execution?.executedCents ?? 0)}
        </small>
      </span>
      <span className="budget-row-amount">
        <strong>
          {amountPrefix}
          {formatCurrencyFromCents(budget.montantBudgetEnCentimes)}
        </strong>
        <small>
          {execution?.remainingLabel ?? 'Reste'} {overBudget ? '+' : ''}
          {formatCurrencyFromCents(remainingValue)}
        </small>
      </span>
    </button>
  )
}

export function BudgetList({
  budgetGroups,
  directionFilter,
  periodFilter,
  resource,
  search,
  selectedKey,
  visibleBudgets,
  executions,
  onDirectionFilterChange,
  onPeriodFilterChange,
  onSearchChange,
  onSelectBudget,
}: BudgetListProps) {
  return (
    <Surface className="catalog-panel budget-panel">
      <div className="budget-toolbar">
        <div className="budget-direction-filter" aria-label="Sens du budget">
          <div className="inline-segmented">
            {directionOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cx('inline-segmented-option', directionFilter === option.value && 'active')}
                onClick={() => onDirectionFilterChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="search-field budget-search">
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={budgetResourceSearchPlaceholder(resource)} />
        </label>

        <select className="budget-period-filter" value={periodFilter} onChange={(event) => onPeriodFilterChange(event.target.value as BudgetPeriodFilter)} aria-label="Période">
          {periodFilterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {!visibleBudgets.length ? (
        <EmptyState title="Aucun budget" description="Ajoute un budget ou ajuste les filtres." />
      ) : (
        <div className="budget-list">
          {budgetGroups.map((group) =>
            group.items.length ? (
              <section key={group.status} className="budget-list-section" aria-label={group.label}>
                <div className="budget-section-title">
                  <span>{group.label}</span>
                  <strong>{group.items.length}</strong>
                </div>
                <div className="budget-section-rows">
                  {group.items.map((budget) => (
                    <BudgetRow
                      key={budget.cle}
                      budget={budget}
                      execution={executions[budget.cle]}
                      resource={resource}
                      selected={selectedKey === budget.cle}
                      onSelect={() => onSelectBudget(budget.cle)}
                    />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      )}
    </Surface>
  )
}
