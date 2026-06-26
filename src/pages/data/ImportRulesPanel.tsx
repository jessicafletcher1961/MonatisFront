import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PowerOff } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, ErrorState, LoadingState, OverlayPanel, Surface } from '../../components/ui'
import { apiErrorMessage, monatisApi } from '../../lib/monatis-api'
import { ImportRuleOverview } from './ImportRuleOverview'
import { ImportRulesDashboard } from './ImportRulesDashboard'
import { ImportRulesList } from './ImportRulesList'
import {
  buildImportRuleViewModels,
  createImportOperationTypeLookup,
  filterImportRuleViewModels,
  importRuleTitle,
  type ImportRuleFilter,
} from './import-rule-utils'

export function ImportRulesPanel() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ImportRuleFilter>('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const rulesQuery = useQuery({
    queryKey: ['imports-releves', 'regles'],
    queryFn: () => monatisApi.listStatementImportRules(),
  })

  const operationTypesQuery = useQuery({
    queryKey: ['operations', 'types'],
    queryFn: () => monatisApi.listOperationTypes(),
  })

  const operationTypesByCode = useMemo(() => createImportOperationTypeLookup(operationTypesQuery.data ?? []), [operationTypesQuery.data])

  const rules = useMemo(
    () => buildImportRuleViewModels(rulesQuery.data ?? [], operationTypesByCode),
    [operationTypesByCode, rulesQuery.data],
  )

  const visibleRules = useMemo(() => filterImportRuleViewModels(rules, search, filter), [filter, rules, search])
  const selectedIndex = selectedId == null ? -1 : visibleRules.findIndex((rule) => rule.rule.id === selectedId)
  const selectedRule = selectedId == null ? null : rules.find((rule) => rule.rule.id === selectedId) ?? null

  const deactivateMutation = useMutation({
    mutationFn: () => {
      if (selectedId == null) {
        return Promise.resolve()
      }
      return monatisApi.deleteStatementImportRule(selectedId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['imports-releves', 'regles'] })
      setSelectedId(null)
    },
  })

  const activeError = rulesQuery.error || operationTypesQuery.error || deactivateMutation.error

  return (
    <div className="page-stack">
      {rulesQuery.isLoading || operationTypesQuery.isLoading ? <LoadingState label="Chargement des regles d'import..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <ImportRulesDashboard rules={rules} />

      <Surface className="catalog-panel">
        <ImportRulesList
          rules={visibleRules}
          search={search}
          filter={filter}
          selectedId={selectedId}
          onSearchChange={setSearch}
          onFilterChange={setFilter}
          onSelect={setSelectedId}
        />
      </Surface>

      <OverlayPanel
        open={Boolean(selectedRule)}
        onClose={() => setSelectedId(null)}
        width="wide"
        navigator={{
          label: `Regle import ${selectedIndex >= 0 ? selectedIndex + 1 : 0}/${visibleRules.length}`,
          title: importRuleTitle(selectedRule?.rule),
          previousDisabled: selectedIndex <= 0,
          nextDisabled: selectedIndex < 0 || selectedIndex >= visibleRules.length - 1,
          onPrevious: () => {
            const previous = visibleRules[selectedIndex - 1]
            if (previous) {
              setSelectedId(previous.rule.id)
            }
          },
          onNext: () => {
            const next = visibleRules[selectedIndex + 1]
            if (next) {
              setSelectedId(next.rule.id)
            }
          },
        }}
      >
        {selectedRule ? (
          <div className="page-stack">
            <ImportRuleOverview rule={selectedRule} />
            <div className="detail-footer-actions">
              <div className="detail-footer-primary" />
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deactivateMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Desactiver la regle "${selectedRule.title}" ?`)) {
                    void deactivateMutation.mutateAsync()
                  }
                }}
              >
                <PowerOff size={16} />
                Desactiver
              </Button>
            </div>
          </div>
        ) : null}
      </OverlayPanel>
    </div>
  )
}
