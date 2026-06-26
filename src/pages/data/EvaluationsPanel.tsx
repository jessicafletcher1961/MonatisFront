import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button, ErrorState, FormField, LoadingState, OverlayPanel, Surface } from '../../components/ui'
import { nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../../lib/format'
import { apiErrorMessage, monatisApi } from '../../lib/monatis-api'
import { EvaluationDashboard } from './EvaluationDashboard'
import { EvaluationList } from './EvaluationList'
import { EvaluationOverview } from './EvaluationOverview'
import {
  createAccountLookup,
  type EvaluationAccountTypeFilter,
  type EvaluationListMode,
  evaluationAccountId,
  evaluationTitle,
  filterEvaluations,
} from './evaluation-utils'

interface EvaluationFormState {
  cle: string
  identifiantCompteInterne: string
  dateSolde: string
  montantSolde: string
  libelle: string
}

const emptyForm: EvaluationFormState = {
  cle: '',
  identifiantCompteInterne: '',
  dateSolde: todayIso(),
  montantSolde: '',
  libelle: '',
}

export function EvaluationsPanel() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<EvaluationListMode>('latest')
  const [typeFilter, setTypeFilter] = useState<EvaluationAccountTypeFilter>('all')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<EvaluationFormState>(emptyForm)

  const listQuery = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => monatisApi.listEvaluations(),
  })

  const accountsQuery = useQuery({
    queryKey: ['comptes', 'internes'],
    queryFn: () => monatisApi.listInternalAccounts(),
  })

  const accountsById = useMemo(() => createAccountLookup(accountsQuery.data ?? []), [accountsQuery.data])

  const detailQuery = useQuery({
    queryKey: ['evaluations', selectedKey],
    queryFn: () => monatisApi.getEvaluation(selectedKey!),
    enabled: Boolean(selectedKey),
  })

  const evaluations = useMemo(
    () => filterEvaluations(listQuery.data ?? [], accountsById, mode, typeFilter, search),
    [accountsById, listQuery.data, mode, search, typeFilter],
  )

  const selectedIndex = selectedKey ? evaluations.findIndex((evaluation) => evaluation.cle === selectedKey) : -1
  const selectedForHeader = evaluations.find((evaluation) => evaluation.cle === selectedKey) ?? detailQuery.data ?? null
  const activeEvaluation = detailQuery.data ?? selectedForHeader
  const activeAccount = activeEvaluation ? accountsById.get(evaluationAccountId(activeEvaluation)) : undefined

  useEffect(() => {
    if (createOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        ...emptyForm,
        identifiantCompteInterne: accountsQuery.data?.[0]?.identifiant ?? '',
      })
    }
  }, [accountsQuery.data, createOpen])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      cle: detailQuery.data.cle,
      identifiantCompteInterne: evaluationAccountId(detailQuery.data),
      dateSolde: detailQuery.data.dateSolde ?? todayIso(),
      montantSolde: toMoneyInput(detailQuery.data.montantSoldeEnCentimes),
      libelle: detailQuery.data.libelle ?? '',
    })
  }, [detailQuery.data])

  const payload = () => ({
    cle: nullIfBlank(form.cle),
    identifiantCompteInterne: nullIfBlank(form.identifiantCompteInterne),
    dateSolde: form.dateSolde || null,
    libelle: nullIfBlank(form.libelle),
    montantSoldeEnCentimes: parseMoneyToCents(form.montantSolde),
  })

  const createMutation = useMutation({
    mutationFn: () => monatisApi.createEvaluation(payload()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setCreateOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        throw new Error('Aucune evaluation selectionnee.')
      }
      return monatisApi.updateEvaluation(selectedKey, payload())
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setSelectedKey(response.cle)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        return Promise.resolve()
      }
      return monatisApi.deleteEvaluation(selectedKey)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setSelectedKey(null)
    },
  })

  const activeError = listQuery.error || detailQuery.error || accountsQuery.error || createMutation.error || updateMutation.error || deleteMutation.error

  function updateForm<Key extends keyof EvaluationFormState>(key: Key, value: EvaluationFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openCreate() {
    setForm({
      ...emptyForm,
      identifiantCompteInterne: accountsQuery.data?.[0]?.identifiant ?? '',
    })
    setCreateOpen(true)
  }

  function renderForm(submitLabel: string, onSubmit: () => Promise<unknown>, disabled: boolean) {
    return (
      <form
        className="form-grid two-columns evaluation-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit()
        }}
      >
        <FormField label="Compte interne">
          <select value={form.identifiantCompteInterne} onChange={(event) => updateForm('identifiantCompteInterne', event.target.value)} required>
            <option value="">Choisir</option>
            {(accountsQuery.data ?? []).map((account) => (
              <option key={account.identifiant} value={account.identifiant}>
                {account.identifiant} - {account.libelle ?? 'Sans libelle'}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Date du solde">
          <input type="date" value={form.dateSolde} onChange={(event) => updateForm('dateSolde', event.target.value)} />
        </FormField>
        <FormField label="Montant">
          <input value={form.montantSolde} onChange={(event) => updateForm('montantSolde', event.target.value)} placeholder="0,00" required />
        </FormField>
        <FormField label="Libelle">
          <input value={form.libelle} onChange={(event) => updateForm('libelle', event.target.value)} placeholder="Facultatif" />
        </FormField>
        <FormField label="Cle">
          <input value={form.cle} onChange={(event) => updateForm('cle', event.target.value)} placeholder="Generee si vide" />
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
      {listQuery.isLoading || accountsQuery.isLoading ? <LoadingState label="Chargement des evaluations..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <EvaluationDashboard evaluations={listQuery.data ?? []} accounts={accountsQuery.data ?? []} today={todayIso()} />

      <Surface className="catalog-panel">
        <EvaluationList
          evaluations={evaluations}
          allEvaluations={listQuery.data ?? []}
          accountsById={accountsById}
          search={search}
          mode={mode}
          typeFilter={typeFilter}
          selectedKey={selectedKey}
          onSearchChange={setSearch}
          onModeChange={setMode}
          onTypeFilterChange={setTypeFilter}
          onCreate={openCreate}
          onSelect={setSelectedKey}
        />
      </Surface>

      <OverlayPanel open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle evaluation" width="regular">
        {renderForm('Creer', () => createMutation.mutateAsync(), createMutation.isPending)}
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedKey)}
        onClose={() => setSelectedKey(null)}
        width="wide"
        navigator={{
          label: `Evaluation ${selectedIndex >= 0 ? selectedIndex + 1 : 0}/${evaluations.length}`,
          title: evaluationTitle(selectedForHeader),
          previousDisabled: selectedIndex <= 0,
          nextDisabled: selectedIndex < 0 || selectedIndex >= evaluations.length - 1,
          onPrevious: () => {
            const previous = evaluations[selectedIndex - 1]
            if (previous) {
              setSelectedKey(previous.cle)
            }
          },
          onNext: () => {
            const next = evaluations[selectedIndex + 1]
            if (next) {
              setSelectedKey(next.cle)
            }
          },
        }}
      >
        {detailQuery.isLoading && !activeEvaluation ? (
          <LoadingState label="Chargement de l evaluation..." />
        ) : activeEvaluation ? (
          <div className="page-stack">
            <EvaluationOverview evaluation={activeEvaluation} evaluations={listQuery.data ?? []} account={activeAccount} />
            {renderForm('Modifier', () => updateMutation.mutateAsync(), updateMutation.isPending)}
            <div className="detail-footer-actions">
              <div className="detail-footer-primary" />
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (selectedKey && window.confirm(`Supprimer ${evaluationTitle(selectedForHeader)} ?`)) {
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
