import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CopyPlus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button, ErrorState, LoadingState, OverlayPanel } from '../../components/ui'
import { cx } from '../../lib/cx'
import { formatCurrencyFromCents, nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../../lib/format'
import { apiErrorMessage, type BudgetResource, monatisApi } from '../../lib/monatis-api'
import { BudgetDashboard } from './BudgetDashboard'
import { buildBudgetExecutions, filterBudgetsForResource, summarizeBudgetExecutions } from './budget-execution'
import { BudgetForm } from './BudgetForm'
import { BudgetList } from './BudgetList'
import {
  budgetDirection,
  budgetPeriodLabel,
  budgetReferenceLabel,
  budgetResourceModeLabel,
  budgetResourceTargetLabel,
  budgetTypeCode,
  budgetTypeLabel,
  emptyBudgetForm,
  filterBudgets,
  groupBudgetsByStatus,
  titleForBudget,
  type BudgetDirectionFilter,
  type BudgetFormState,
  type BudgetPeriodFilter,
} from './budget-panel-utils'

function initialFilterState() {
  return {
    direction: 'all' as BudgetDirectionFilter,
    status: 'all' as BudgetPeriodFilter,
  }
}

export function BudgetsPanel() {
  const queryClient = useQueryClient()
  const [resource, setResource] = useState<BudgetResource>('beneficiaire')
  const [search, setSearch] = useState('')
  const [directionFilter, setDirectionFilter] = useState<BudgetDirectionFilter>('all')
  const [periodFilter, setPeriodFilter] = useState<BudgetPeriodFilter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<BudgetFormState>(emptyBudgetForm)

  const listQuery = useQuery({
    queryKey: ['budgets', resource],
    queryFn: () => monatisApi.listBudgets(resource),
  })

  const referencesQuery = useQuery({
    queryKey: ['references', resource],
    queryFn: () => monatisApi.listReferences(resource),
  })

  const periodsQuery = useQuery({
    queryKey: ['typologies', 'periode'],
    queryFn: () => monatisApi.listTypologies('periode'),
  })

  const budgetTypesQuery = useQuery({
    queryKey: ['typologies', 'budget'],
    queryFn: () => monatisApi.listTypologies('budget'),
  })

  const operationsQuery = useQuery({
    queryKey: ['operations', 'budget-follow-up'],
    queryFn: () => monatisApi.listOperations(),
  })

  const detailQuery = useQuery({
    queryKey: ['budgets', resource, selectedKey],
    queryFn: () => monatisApi.getBudget(resource, selectedKey!),
    enabled: Boolean(selectedKey),
  })

  const today = todayIso()
  const allBudgets = useMemo(() => filterBudgetsForResource(listQuery.data ?? [], resource), [listQuery.data, resource])
  const operations = useMemo(() => operationsQuery.data ?? [], [operationsQuery.data])
  const executions = useMemo(() => buildBudgetExecutions(allBudgets, resource, operations, today), [allBudgets, operations, resource, today])

  const visibleBudgets = useMemo(
    () => filterBudgets(allBudgets, { search, direction: directionFilter, status: periodFilter, today }),
    [allBudgets, directionFilter, periodFilter, search, today],
  )

  const executionSummary = useMemo(() => summarizeBudgetExecutions(allBudgets, executions, today), [allBudgets, executions, today])
  const budgetGroups = useMemo(() => groupBudgetsByStatus(visibleBudgets, today), [today, visibleBudgets])
  const selectedIndex = selectedKey ? visibleBudgets.findIndex((budget) => budget.cle === selectedKey) : -1
  const selectedForHeader = visibleBudgets.find((budget) => budget.cle === selectedKey) ?? detailQuery.data ?? null
  const selectedExecution = selectedForHeader ? executions[selectedForHeader.cle] : null
  const references = useMemo(() => referencesQuery.data ?? [], [referencesQuery.data])
  const periods = useMemo(() => periodsQuery.data ?? [], [periodsQuery.data])
  const budgetTypes = useMemo(() => budgetTypesQuery.data ?? [], [budgetTypesQuery.data])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedKey(null)
    setSearch('')
    setDirectionFilter(initialFilterState().direction)
    setPeriodFilter(initialFilterState().status)
  }, [resource])

  useEffect(() => {
    if (!createOpen) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      ...emptyBudgetForm(),
      nomReference: references[0]?.nom ?? '',
      codeTypePeriode: periods[0]?.code ?? '',
      codeTypeBudget: budgetTypes[0]?.code ?? '',
    })
  }, [budgetTypes, createOpen, periods, references])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      cle: detailQuery.data.cle,
      nomReference: detailQuery.data.reference?.nom ?? '',
      codeTypePeriode: detailQuery.data.typePeriode?.code ?? '',
      dateCible: detailQuery.data.dateDebut ?? todayIso(),
      codeTypeBudget: budgetTypeCode(detailQuery.data),
      montantBudget: toMoneyInput(detailQuery.data.montantBudgetEnCentimes),
      libelle: detailQuery.data.libelle ?? '',
    })
  }, [detailQuery.data])

  const payload = () => ({
    cle: nullIfBlank(form.cle),
    nomReference: nullIfBlank(form.nomReference),
    codeTypePeriode: nullIfBlank(form.codeTypePeriode),
    dateCible: form.dateCible || null,
    codeTypeBudget: nullIfBlank(form.codeTypeBudget),
    montantBudgetEnCentimes: parseMoneyToCents(form.montantBudget),
    libelle: nullIfBlank(form.libelle),
  })

  const createMutation = useMutation({
    mutationFn: () => monatisApi.createBudget(resource, payload()),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['budgets', resource] })
      setCreateOpen(false)
      setSelectedKey(response.cle)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        throw new Error('Aucun budget selectionne.')
      }
      return monatisApi.updateBudget(resource, selectedKey, payload())
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['budgets', resource] })
      setSelectedKey(response.cle)
    },
  })

  const renewMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        throw new Error('Aucun budget selectionne.')
      }
      return monatisApi.renewBudget(resource, selectedKey)
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['budgets', resource] })
      setSelectedKey(response.cle)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        return Promise.resolve()
      }
      return monatisApi.deleteBudget(resource, selectedKey)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['budgets', resource] })
      setSelectedKey(null)
    },
  })

  const activeError =
    listQuery.error ||
    referencesQuery.error ||
    periodsQuery.error ||
    budgetTypesQuery.error ||
    operationsQuery.error ||
    detailQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    renewMutation.error ||
    deleteMutation.error

  function updateForm<Key extends keyof BudgetFormState>(key: Key, value: BudgetFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="page-stack">
      <BudgetDashboard resource={resource} executionSummary={executionSummary} onCreate={() => setCreateOpen(true)} onResourceChange={setResource} />

      {listQuery.isLoading ? <LoadingState label="Chargement des budgets..." /> : null}
      {operationsQuery.isLoading ? <LoadingState label="Calcul du suivi budget..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <BudgetList
        budgetGroups={budgetGroups}
        directionFilter={directionFilter}
        executions={executions}
        periodFilter={periodFilter}
        resource={resource}
        search={search}
        selectedKey={selectedKey}
        visibleBudgets={visibleBudgets}
        onDirectionFilterChange={setDirectionFilter}
        onPeriodFilterChange={setPeriodFilter}
        onSearchChange={setSearch}
        onSelectBudget={setSelectedKey}
      />

      <OverlayPanel open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau budget" width="regular">
        <BudgetForm
          disabled={createMutation.isPending}
          form={form}
          references={references}
          periods={periods}
          budgetTypes={budgetTypes}
          resource={resource}
          submitLabel="Creer"
          onChange={updateForm}
          onSubmit={() => createMutation.mutateAsync()}
        />
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedKey)}
        onClose={() => setSelectedKey(null)}
        width="regular"
        navigator={{
          label: `${budgetResourceModeLabel(resource)} ${selectedIndex >= 0 ? selectedIndex + 1 : 0}/${visibleBudgets.length}`,
          title: titleForBudget(selectedForHeader),
          previousDisabled: selectedIndex <= 0,
          nextDisabled: selectedIndex < 0 || selectedIndex >= visibleBudgets.length - 1,
          onPrevious: () => {
            const previous = visibleBudgets[selectedIndex - 1]
            if (previous) {
              setSelectedKey(previous.cle)
            }
          },
          onNext: () => {
            const next = visibleBudgets[selectedIndex + 1]
            if (next) {
              setSelectedKey(next.cle)
            }
          },
        }}
      >
        {detailQuery.isLoading ? (
          <LoadingState label="Chargement du budget..." />
        ) : (
          <div className="page-stack">
            {detailQuery.data ? (
              <div className={cx('budget-detail-hero', `budget-detail-hero-${budgetDirection(detailQuery.data)}`)}>
                <div>
                  <span>{budgetTypeLabel(detailQuery.data)}</span>
                  <strong>{titleForBudget(detailQuery.data)}</strong>
                  <small>
                    {budgetResourceTargetLabel(resource)} : {budgetReferenceLabel(detailQuery.data)} - {budgetPeriodLabel(detailQuery.data)}
                  </small>
                </div>
                <strong className="budget-detail-amount">{formatCurrencyFromCents(detailQuery.data.montantBudgetEnCentimes)}</strong>
              </div>
            ) : null}

            {selectedExecution ? (
              <div className="budget-detail-follow-up">
                <div className="budget-detail-progress-title">
                  <span>{selectedExecution.statusLabel}</span>
                  <strong>{Math.round(selectedExecution.progressPercent)}%</strong>
                </div>
                <div className="budget-progress-track" aria-hidden="true">
                  <span className={cx('budget-progress-fill', `budget-progress-fill-${selectedExecution.status}`)} style={{ width: `${selectedExecution.progressCappedPercent}%` }} />
                  <span className="budget-progress-expected" style={{ left: `${selectedExecution.expectedProgressPercent}%` }} />
                </div>
                <div className="budget-detail-kpis">
                  <span>
                    <small>{selectedExecution.executedLabel}</small>
                    <strong>{formatCurrencyFromCents(selectedExecution.executedCents)}</strong>
                  </span>
                  <span>
                    <small>{selectedExecution.remainingLabel}</small>
                    <strong>{formatCurrencyFromCents(Math.abs(selectedExecution.remainingCents))}</strong>
                  </span>
                  <span>
                    <small>Rythme attendu</small>
                    <strong>{Math.round(selectedExecution.expectedProgressPercent)}%</strong>
                  </span>
                </div>
              </div>
            ) : null}

            <BudgetForm
              disabled={updateMutation.isPending}
              form={form}
              references={references}
              periods={periods}
              budgetTypes={budgetTypes}
              resource={resource}
              submitLabel="Enregistrer"
              onChange={updateForm}
              onSubmit={() => updateMutation.mutateAsync()}
            />

            <div className="detail-footer-actions">
              <div className="detail-footer-primary">
                <Button type="button" tone="soft" disabled={renewMutation.isPending} onClick={() => void renewMutation.mutateAsync()}>
                  <CopyPlus size={16} />
                  Reconduire
                </Button>
              </div>
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (selectedKey && window.confirm(`Supprimer ${titleForBudget(selectedForHeader)} ?`)) {
                    void deleteMutation.mutateAsync()
                  }
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </OverlayPanel>
    </div>
  )
}
