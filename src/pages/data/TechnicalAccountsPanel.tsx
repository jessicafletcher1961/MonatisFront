import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button, ErrorState, FormField, LoadingState, OverlayPanel, Surface } from '../../components/ui'
import { nullIfBlank } from '../../lib/format'
import { apiErrorMessage, monatisApi } from '../../lib/monatis-api'
import { TechnicalAccountOverview } from './TechnicalAccountOverview'
import { TechnicalAccountsDashboard } from './TechnicalAccountsDashboard'
import { TechnicalAccountsList } from './TechnicalAccountsList'
import {
  buildTechnicalAccountSummaries,
  createOperationTypeLookup,
  filterTechnicalSummaries,
  type TechnicalAccountFilter,
  technicalAccountTitle,
} from './technical-account-utils'

interface TechnicalFormState {
  identifiant: string
  libelle: string
}

const emptyForm: TechnicalFormState = {
  identifiant: '',
  libelle: '',
}

export function TechnicalAccountsPanel() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TechnicalAccountFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<TechnicalFormState>(emptyForm)

  const listQuery = useQuery({
    queryKey: ['comptes', 'techniques'],
    queryFn: () => monatisApi.listTechnicalAccounts(),
  })

  const operationsQuery = useQuery({
    queryKey: ['operations'],
    queryFn: () => monatisApi.listOperations(),
  })

  const operationTypesQuery = useQuery({
    queryKey: ['operations', 'types'],
    queryFn: () => monatisApi.listOperationTypes(),
  })

  const operationTypesByCode = useMemo(() => createOperationTypeLookup(operationTypesQuery.data ?? []), [operationTypesQuery.data])

  const summaries = useMemo(
    () => buildTechnicalAccountSummaries(listQuery.data ?? [], operationsQuery.data ?? [], operationTypesByCode),
    [listQuery.data, operationTypesByCode, operationsQuery.data],
  )

  const visibleSummaries = useMemo(
    () => filterTechnicalSummaries(summaries, search, statusFilter),
    [search, statusFilter, summaries],
  )

  const detailQuery = useQuery({
    queryKey: ['comptes', 'techniques', selectedId],
    queryFn: () => monatisApi.getTechnicalAccount(selectedId!),
    enabled: Boolean(selectedId),
  })

  const selectedIndex = selectedId ? visibleSummaries.findIndex((summary) => summary.account.identifiant === selectedId) : -1
  const selectedSummary = summaries.find((summary) => summary.account.identifiant === selectedId) ?? null
  const selectedForHeader = selectedSummary?.account ?? detailQuery.data ?? null

  useEffect(() => {
    if (createOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm(emptyForm)
    }
  }, [createOpen])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      identifiant: detailQuery.data.identifiant,
      libelle: detailQuery.data.libelle ?? '',
    })
  }, [detailQuery.data])

  const createMutation = useMutation({
    mutationFn: () =>
      monatisApi.createTechnicalAccount({
        identifiant: form.identifiant.trim(),
        libelle: nullIfBlank(form.libelle),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'techniques'] })
      setCreateOpen(false)
      setForm(emptyForm)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) {
        throw new Error('Aucun compte technique selectionne.')
      }
      return monatisApi.updateTechnicalAccount(selectedId, {
        identifiant: form.identifiant.trim(),
        libelle: nullIfBlank(form.libelle),
      })
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'techniques'] })
      setSelectedId(response.identifiant)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) {
        return Promise.resolve()
      }
      return monatisApi.deleteTechnicalAccount(selectedId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'techniques'] })
      setSelectedId(null)
    },
  })

  const activeError =
    listQuery.error ||
    operationsQuery.error ||
    operationTypesQuery.error ||
    detailQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error

  function updateForm<Key extends keyof TechnicalFormState>(key: Key, value: TechnicalFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function renderForm(submitLabel: string, onSubmit: () => Promise<unknown>, disabled: boolean) {
    return (
      <form
        className="form-grid two-columns technical-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit()
        }}
      >
        <FormField label="Identifiant" hint="Obligatoire et unique. Utilise dans les operations et rapports.">
          <input value={form.identifiant} onChange={(event) => updateForm('identifiant', event.target.value)} required />
        </FormField>
        <FormField label="Libelle" hint="Nom lisible affiche dans les listes, operations et rapports.">
          <input value={form.libelle} onChange={(event) => updateForm('libelle', event.target.value)} placeholder="Facultatif" />
        </FormField>
        <div className="button-row full-span">
          <Button type="submit" disabled={disabled}>
            <Save size={16} />
            {submitLabel}
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="page-stack">
      {listQuery.isLoading || operationsQuery.isLoading || operationTypesQuery.isLoading ? <LoadingState label="Chargement des comptes techniques..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <TechnicalAccountsDashboard summaries={summaries} />

      <Surface className="catalog-panel">
        <TechnicalAccountsList
          summaries={visibleSummaries}
          search={search}
          filter={statusFilter}
          selectedId={selectedId}
          onSearchChange={setSearch}
          onFilterChange={setStatusFilter}
          onCreate={() => setCreateOpen(true)}
          onSelect={setSelectedId}
        />
      </Surface>

      <OverlayPanel open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau compte technique" width="regular">
        {renderForm('Creer', () => createMutation.mutateAsync(), createMutation.isPending)}
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        width="wide"
        navigator={{
          label: `Compte technique ${selectedIndex >= 0 ? selectedIndex + 1 : 0}/${visibleSummaries.length}`,
          title: technicalAccountTitle(selectedForHeader),
          previousDisabled: selectedIndex <= 0,
          nextDisabled: selectedIndex < 0 || selectedIndex >= visibleSummaries.length - 1,
          onPrevious: () => {
            const previous = visibleSummaries[selectedIndex - 1]
            if (previous) {
              setSelectedId(previous.account.identifiant)
            }
          },
          onNext: () => {
            const next = visibleSummaries[selectedIndex + 1]
            if (next) {
              setSelectedId(next.account.identifiant)
            }
          },
        }}
      >
        {detailQuery.isLoading && !selectedSummary ? (
          <LoadingState label="Chargement du compte..." />
        ) : selectedSummary ? (
          <div className="page-stack">
            <TechnicalAccountOverview summary={selectedSummary} />
            {renderForm('Modifier', () => updateMutation.mutateAsync(), updateMutation.isPending)}
            <div className="detail-footer-actions">
              <div className="detail-footer-primary" />
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (selectedId && window.confirm(`Supprimer ${technicalAccountTitle(selectedForHeader)} ?`)) {
                    void deleteMutation.mutateAsync()
                  }
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
            </div>
          </div>
        ) : null}
      </OverlayPanel>
    </div>
  )
}
