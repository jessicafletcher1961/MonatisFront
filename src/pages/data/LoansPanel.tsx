import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button, ErrorState, FormField, LoadingState, OverlayPanel, Surface } from '../../components/ui'
import { nullIfBlank } from '../../lib/format'
import { apiErrorMessage, monatisApi } from '../../lib/monatis-api'
import { LoanConditionEditor } from './LoanConditionEditor'
import { LoanDashboard } from './LoanDashboard'
import { LoanList } from './LoanList'
import { LoanOverview } from './LoanOverview'
import { LoanPaymentsSection } from './LoanPaymentsSection'
import { conditionPayload, conditionToForm, emptyCondition, type LoanConditionFormState } from './loan-condition-utils'
import { loanConditions, loanTitle } from './loan-summary-utils'

interface LoanFormState {
  cle: string
  libelle: string
  identifiantCompteInterne: string
  conditions: LoanConditionFormState[]
}

function emptyForm(codeTypePeriodeEcheances = 'MENSUEL'): LoanFormState {
  return {
    cle: '',
    libelle: '',
    identifiantCompteInterne: '',
    conditions: [emptyCondition(codeTypePeriodeEcheances)],
  }
}

export function LoansPanel() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<LoanFormState>(() => emptyForm())

  const listQuery = useQuery({
    queryKey: ['emprunts'],
    queryFn: () => monatisApi.listLoans(),
  })

  const accountsQuery = useQuery({
    queryKey: ['comptes', 'internes'],
    queryFn: () => monatisApi.listInternalAccounts(),
  })

  const periodsQuery = useQuery({
    queryKey: ['typologies', 'periode'],
    queryFn: () => monatisApi.listTypologies('periode'),
  })

  const detailQuery = useQuery({
    queryKey: ['emprunts', selectedKey],
    queryFn: () => monatisApi.getLoan(selectedKey!),
    enabled: Boolean(selectedKey),
  })

  const loans = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const items = listQuery.data ?? []
    if (!needle) {
      return items
    }
    return items.filter((loan) => [loan.cle, loan.libelle, loan.identifiantCompteInterne].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
  }, [listQuery.data, search])

  const selectedIndex = selectedKey ? loans.findIndex((loan) => loan.cle === selectedKey) : -1
  const selectedForHeader = loans.find((loan) => loan.cle === selectedKey) ?? detailQuery.data ?? null
  const selectedConditions = useMemo(() => {
    return loanConditions(detailQuery.data)
  }, [detailQuery.data])
  const firstPeriodCode = periodsQuery.data?.[0]?.code ?? 'MENSUEL'

  useEffect(() => {
    if (!createOpen) {
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      ...emptyForm(firstPeriodCode),
      identifiantCompteInterne: accountsQuery.data?.[0]?.identifiant ?? '',
    })
  }, [accountsQuery.data, createOpen, firstPeriodCode])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }
    const conditions = selectedConditions.length ? selectedConditions.map(conditionToForm) : [emptyCondition(firstPeriodCode)]
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      cle: detailQuery.data.cle,
      libelle: detailQuery.data.libelle ?? '',
      identifiantCompteInterne: detailQuery.data.compteInterne?.identifiant ?? detailQuery.data.identifiantCompteInterne ?? '',
      conditions,
    })
  }, [detailQuery.data, firstPeriodCode, selectedConditions])

  const createMutation = useMutation({
    mutationFn: () =>
      monatisApi.createLoan({
        cle: nullIfBlank(form.cle),
        libelle: nullIfBlank(form.libelle),
        identifiantCompteInterne: nullIfBlank(form.identifiantCompteInterne),
        conditionEmpruntInitiale: conditionPayload(form.conditions[0] ?? emptyCondition(firstPeriodCode)),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emprunts'] })
      setCreateOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        throw new Error('Aucun emprunt selectionne.')
      }
      return monatisApi.updateLoan(selectedKey, {
        cle: nullIfBlank(form.cle),
        libelle: nullIfBlank(form.libelle),
        identifiantCompteInterne: nullIfBlank(form.identifiantCompteInterne),
        conditionsEmprunt: form.conditions.map(conditionPayload),
      })
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['emprunts'] })
      setSelectedKey(response.cle)
      await queryClient.invalidateQueries({ queryKey: ['emprunts', response.cle] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!selectedKey) {
        return Promise.resolve()
      }
      return monatisApi.deleteLoan(selectedKey)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['emprunts'] })
      setSelectedKey(null)
    },
  })

  const activeError =
    listQuery.error ||
    detailQuery.error ||
    accountsQuery.error ||
    periodsQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error

  function updateLoan<Key extends keyof LoanFormState>(key: Key, value: LoanFormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function updateCondition(index: number, key: keyof LoanConditionFormState, value: string) {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition, conditionIndex) => (conditionIndex === index ? { ...condition, [key]: value } : condition)),
    }))
  }

  function renderForm(submitLabel: string, onSubmit: () => Promise<unknown>, disabled: boolean, allowRevisions: boolean) {
    return (
      <form
        className="page-stack"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit()
        }}
      >
        <div className="form-grid three-columns">
          <FormField label="Cle">
            <input value={form.cle} onChange={(event) => updateLoan('cle', event.target.value)} placeholder="Generee si vide" />
          </FormField>
          <FormField label="Libelle">
            <input value={form.libelle} onChange={(event) => updateLoan('libelle', event.target.value)} placeholder="Facultatif" />
          </FormField>
          <FormField label="Compte interne">
            <select value={form.identifiantCompteInterne} onChange={(event) => updateLoan('identifiantCompteInterne', event.target.value)}>
              <option value="">Aucun</option>
              {(accountsQuery.data ?? []).map((account) => (
                <option key={account.identifiant} value={account.identifiant}>
                  {account.identifiant} - {account.libelle ?? 'Sans libelle'}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {form.conditions.map((condition, index) => (
          <LoanConditionEditor
            key={`${index}-${condition.numeroPremiereEcheance}`}
            condition={condition}
            index={index}
            periods={periodsQuery.data ?? []}
            removable={allowRevisions && index > 0}
            onChange={updateCondition}
            onRemove={(conditionIndex) => {
              setForm((current) => ({ ...current, conditions: current.conditions.filter((_, indexToKeep) => indexToKeep !== conditionIndex) }))
            }}
          />
        ))}

        <div className="button-row">
          {allowRevisions ? (
            <Button
              type="button"
              tone="soft"
              onClick={() => {
                setForm((current) => ({ ...current, conditions: [...current.conditions, emptyCondition(firstPeriodCode)] }))
              }}
            >
              <Plus size={16} />
              Ajouter une revision
            </Button>
          ) : null}
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
      {listQuery.isLoading ? <LoadingState label="Chargement des emprunts..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <Surface className="catalog-panel">
        <LoanDashboard loans={listQuery.data ?? []} />
        <LoanList
          loans={loans}
          search={search}
          selectedKey={selectedKey}
          onSearchChange={setSearch}
          onCreate={() => setCreateOpen(true)}
          onSelect={setSelectedKey}
        />
      </Surface>

      <OverlayPanel open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvel emprunt" width="wide">
        {renderForm('Creer', () => createMutation.mutateAsync(), createMutation.isPending, false)}
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedKey)}
        onClose={() => setSelectedKey(null)}
        width="wide"
        navigator={{
          label: `Emprunt ${selectedIndex >= 0 ? selectedIndex + 1 : 0}/${loans.length}`,
          title: loanTitle(selectedForHeader),
          previousDisabled: selectedIndex <= 0,
          nextDisabled: selectedIndex < 0 || selectedIndex >= loans.length - 1,
          onPrevious: () => {
            const previous = loans[selectedIndex - 1]
            if (previous) {
              setSelectedKey(previous.cle)
            }
          },
          onNext: () => {
            const next = loans[selectedIndex + 1]
            if (next) {
              setSelectedKey(next.cle)
            }
          },
        }}
      >
        {detailQuery.isLoading ? (
          <LoadingState label="Chargement de l emprunt..." />
        ) : (
          <div className="page-stack">
            {detailQuery.data ? <LoanOverview loan={detailQuery.data} conditions={selectedConditions} /> : null}

            {renderForm('Modifier', () => updateMutation.mutateAsync(), updateMutation.isPending, true)}

            <LoanPaymentsSection selectedKey={selectedKey} conditions={selectedConditions} />

            <div className="detail-footer-actions">
              <div className="detail-footer-primary" />
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (selectedKey && window.confirm(`Supprimer ${loanTitle(selectedForHeader)} ?`)) {
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
