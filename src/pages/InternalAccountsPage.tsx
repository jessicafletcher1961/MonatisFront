import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Pencil, PiggyBank, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { Badge, Button, DataPanel, EmptyState, ErrorState, FilterBar, FormField, LoadingState, PageHeader, SectionHeader, Surface } from '../components/ui'
import { apiErrorMessage, type EvaluationBasic, monatisApi } from '../lib/monatis-api'
import { computeBalanceAtDate, latestOperationsForAccount, readableOperationLabel } from '../lib/reporting'
import { formatCurrency, formatCurrencyFromCents, formatDate, nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../lib/format'

const accountSchema = z.object({
  identifiant: z.string().trim().min(1, 'L identifiant est obligatoire.'),
  libelle: z.string().optional(),
  codeTypeFonctionnement: z.string().trim().min(1, 'Le type de fonctionnement est obligatoire.'),
  dateSoldeInitial: z.string().optional(),
  montantSoldeInitial: z.string().optional(),
  dateCloture: z.string().optional(),
  nomBanque: z.string().optional(),
  nomsTitulaires: z.array(z.string()),
})

const evaluationSchema = z.object({
  cle: z.string().optional(),
  dateSolde: z.string().optional(),
  libelle: z.string().optional(),
  montantSolde: z.string().trim().min(1, 'Le montant est obligatoire.'),
})

type AccountFormValues = z.infer<typeof accountSchema>
type EvaluationFormValues = z.infer<typeof evaluationSchema>

function evaluationAccountId(evaluation: EvaluationBasic): string | undefined {
  return evaluation.identifiantCompteInterne ?? evaluation.compteInterne?.identifiant
}

export function InternalAccountsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [evaluationMode, setEvaluationMode] = useState<'create' | 'edit'>('create')
  const [selectedEvaluationKey, setSelectedEvaluationKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('TOUS')
  const deferredSearch = useDeferredValue(search)

  const accountsQuery = useQuery({
    queryKey: ['comptes', 'internes'],
    queryFn: () => monatisApi.listInternalAccounts(),
  })

  const detailQuery = useQuery({
    queryKey: ['comptes', 'internes', selectedId],
    queryFn: () => monatisApi.getInternalAccount(selectedId!),
    enabled: Boolean(selectedId),
  })

  const typeQuery = useQuery({
    queryKey: ['typologies', 'fonctionnements'],
    queryFn: () => monatisApi.listTypeFonctionnements(),
  })

  const banquesQuery = useQuery({
    queryKey: ['references', 'banque'],
    queryFn: () => monatisApi.listReferences('banque'),
  })

  const titulairesQuery = useQuery({
    queryKey: ['references', 'titulaire'],
    queryFn: () => monatisApi.listReferences('titulaire'),
  })

  const evaluationsQuery = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => monatisApi.listEvaluations(),
  })

  const operationsQuery = useQuery({
    queryKey: ['operations'],
    queryFn: () => monatisApi.listOperations(),
  })

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      identifiant: '',
      libelle: '',
      codeTypeFonctionnement: '',
      dateSoldeInitial: todayIso(),
      montantSoldeInitial: '0.00',
      dateCloture: '',
      nomBanque: '',
      nomsTitulaires: [],
    },
  })

  const evaluationForm = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      cle: '',
      dateSolde: todayIso(),
      libelle: '',
      montantSolde: '',
    },
  })

  useEffect(() => {
    if (mode === 'edit' && detailQuery.data) {
      accountForm.reset({
        identifiant: detailQuery.data.identifiant,
        libelle: detailQuery.data.libelle ?? '',
        codeTypeFonctionnement: detailQuery.data.typeFonctionnement.code,
        dateSoldeInitial: detailQuery.data.dateSoldeInitial,
        montantSoldeInitial: toMoneyInput(detailQuery.data.montantSoldeInitialEnCentimes),
        dateCloture: detailQuery.data.dateCloture ?? '',
        nomBanque: detailQuery.data.banque?.nom ?? '',
        nomsTitulaires: detailQuery.data.titulaires.map((item) => item.nom),
      })
    }

    if (mode === 'create') {
      accountForm.reset({
        identifiant: '',
        libelle: '',
        codeTypeFonctionnement: '',
        dateSoldeInitial: todayIso(),
        montantSoldeInitial: '0.00',
        dateCloture: '',
        nomBanque: '',
        nomsTitulaires: [],
      })
    }
  }, [accountForm, detailQuery.data, mode])

  const selectedEvaluation = useMemo(
    () => (evaluationsQuery.data ?? []).find((evaluation) => evaluation.cle === selectedEvaluationKey),
    [evaluationsQuery.data, selectedEvaluationKey],
  )

  useEffect(() => {
    if (evaluationMode === 'edit' && selectedEvaluation) {
      evaluationForm.reset({
        cle: selectedEvaluation.cle,
        dateSolde: selectedEvaluation.dateSolde,
        libelle: selectedEvaluation.libelle ?? '',
        montantSolde: toMoneyInput(selectedEvaluation.montantSoldeEnCentimes),
      })
    }

    if (evaluationMode === 'create') {
      evaluationForm.reset({
        cle: '',
        dateSolde: todayIso(),
        libelle: '',
        montantSolde: '',
      })
    }
  }, [evaluationForm, evaluationMode, selectedEvaluation])

  const filteredAccounts = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()

    return (accountsQuery.data ?? [])
      .filter((account) => typeFilter === 'TOUS' || account.codeTypeFonctionnement === typeFilter)
      .filter((account) => {
        if (!needle) {
          return true
        }

        return [account.identifiant, account.libelle, account.nomBanque, ...account.nomsTitulaires]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      })
      .sort((left, right) => left.identifiant.localeCompare(right.identifiant))
  }, [accountsQuery.data, deferredSearch, typeFilter])

  const selectedAccount = useMemo(
    () => (accountsQuery.data ?? []).find((account) => account.identifiant === selectedId) ?? null,
    [accountsQuery.data, selectedId],
  )

  const accountEvaluations = useMemo(
    () =>
      (evaluationsQuery.data ?? [])
        .filter((evaluation) => evaluationAccountId(evaluation) === selectedId)
        .sort((left, right) => right.dateSolde.localeCompare(left.dateSolde)),
    [evaluationsQuery.data, selectedId],
  )

  const currentBalance = useMemo(() => {
    if (!selectedAccount || !operationsQuery.data) {
      return null
    }

    return computeBalanceAtDate(selectedAccount, operationsQuery.data, todayIso())
  }, [operationsQuery.data, selectedAccount])

  const latestOperations = useMemo(() => {
    if (!selectedId || !operationsQuery.data) {
      return []
    }

    return latestOperationsForAccount(operationsQuery.data, selectedId)
  }, [operationsQuery.data, selectedId])

  const createAccountMutation = useMutation({
    mutationFn: (values: AccountFormValues) =>
      monatisApi.createInternalAccount({
        identifiant: values.identifiant.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
        dateCloture: nullIfBlank(values.dateCloture ?? ''),
        codeTypeFonctionnement: values.codeTypeFonctionnement,
        dateSoldeInitial: nullIfBlank(values.dateSoldeInitial ?? ''),
        montantSoldeInitialEnCentimes: parseMoneyToCents(values.montantSoldeInitial ?? '0'),
        nomBanque: nullIfBlank(values.nomBanque ?? ''),
        nomsTitulaires: values.nomsTitulaires,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'internes'] })
      setSelectedId(response.identifiant)
      setMode('edit')
    },
  })

  const updateAccountMutation = useMutation({
    mutationFn: (values: AccountFormValues) =>
      monatisApi.updateInternalAccount(selectedId!, {
        identifiant: values.identifiant.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
        dateCloture: nullIfBlank(values.dateCloture ?? ''),
        codeTypeFonctionnement: values.codeTypeFonctionnement,
        dateSoldeInitial: nullIfBlank(values.dateSoldeInitial ?? ''),
        montantSoldeInitialEnCentimes: parseMoneyToCents(values.montantSoldeInitial ?? '0'),
        nomBanque: nullIfBlank(values.nomBanque ?? ''),
        nomsTitulaires: values.nomsTitulaires,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'internes'] })
      setSelectedId(response.identifiant)
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => monatisApi.deleteInternalAccount(selectedId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'internes'] })
      setSelectedId(null)
      setMode('create')
    },
  })

  const createEvaluationMutation = useMutation({
    mutationFn: (values: EvaluationFormValues) =>
      monatisApi.createEvaluation({
        cle: nullIfBlank(values.cle ?? ''),
        identifiantCompteInterne: selectedId,
        dateSolde: nullIfBlank(values.dateSolde ?? ''),
        libelle: nullIfBlank(values.libelle ?? ''),
        montantSoldeEnCentimes: parseMoneyToCents(values.montantSolde),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setEvaluationMode('create')
      setSelectedEvaluationKey(null)
    },
  })

  const updateEvaluationMutation = useMutation({
    mutationFn: (values: EvaluationFormValues) =>
      monatisApi.updateEvaluation(selectedEvaluationKey!, {
        cle: nullIfBlank(values.cle ?? ''),
        identifiantCompteInterne: selectedId,
        dateSolde: nullIfBlank(values.dateSolde ?? ''),
        libelle: nullIfBlank(values.libelle ?? ''),
        montantSoldeEnCentimes: parseMoneyToCents(values.montantSolde),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setEvaluationMode('create')
      setSelectedEvaluationKey(null)
    },
  })

  const deleteEvaluationMutation = useMutation({
    mutationFn: () => monatisApi.deleteEvaluation(selectedEvaluationKey!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setSelectedEvaluationKey(null)
      setEvaluationMode('create')
    },
  })

  const hasError =
    accountsQuery.error ||
    detailQuery.error ||
    typeQuery.error ||
    banquesQuery.error ||
    titulairesQuery.error ||
    evaluationsQuery.error ||
    operationsQuery.error ||
    createAccountMutation.error ||
    updateAccountMutation.error ||
    deleteAccountMutation.error ||
    createEvaluationMutation.error ||
    updateEvaluationMutation.error ||
    deleteEvaluationMutation.error

  const toggledTitulaires = useWatch({ control: accountForm.control, name: 'nomsTitulaires' }) ?? []

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comptes"
        title="Internes"
        actions={
          <Button
            tone="soft"
            onClick={() => {
              setMode('create')
              setSelectedId(null)
            }}
          >
            <Plus size={16} />
            Nouveau
          </Button>
        }
      />

      {accountsQuery.isLoading ? <LoadingState label="Chargement des comptes internes..." /> : null}
      {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

      <div className="split-layout split-layout-wide">
        <DataPanel title="Internes">
          <FilterBar>
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher un identifiant, une banque ou un titulaire..." />
            </label>

            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="TOUS">Tous les types</option>
              {(typeQuery.data ?? []).map((type) => (
                <option key={type.code} value={type.code}>
                  {type.code}
                </option>
              ))}
            </select>
          </FilterBar>

          {!filteredAccounts.length ? (
            <EmptyState title="Aucun compte visible" description="Creer un compte ou elargir le filtre." />
          ) : (
            <div className="list-stack">
              {filteredAccounts.map((account) => (
                <button key={account.identifiant} className={`list-row ${selectedId === account.identifiant ? 'selected' : ''}`} onClick={() => setSelectedId(account.identifiant)}>
                  <div>
                    <strong>{account.identifiant}</strong>
                    <p>{account.libelle ?? 'Sans libelle'}</p>
                  </div>
                  <Badge>{account.codeTypeFonctionnement}</Badge>
                </button>
              ))}
            </div>
          )}
        </DataPanel>

        <div className="page-stack">
          <Surface className="editor-panel">
            <div className="editor-panel-header">
              <div>
                <span className="eyebrow">{mode === 'create' ? 'Creation' : 'Edition'}</span>
                <h2>{mode === 'create' ? 'Nouveau compte interne' : selectedId}</h2>
                <p>Saisie en centimes cote back.</p>
              </div>
              {selectedId && mode === 'edit' ? (
                <div className="button-row">
                  <Button tone="ghost" onClick={() => setMode('edit')}>
                    <Pencil size={16} />
                    Modifier
                  </Button>
                  <Button
                    tone="danger"
                    onClick={() => {
                      if (window.confirm(`Supprimer ${selectedId} ?`)) {
                        void deleteAccountMutation.mutateAsync()
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Supprimer
                  </Button>
                </div>
              ) : null}
            </div>

            <form
              className="form-grid three-columns"
              onSubmit={accountForm.handleSubmit(async (values) => {
                if (mode === 'create') {
                  await createAccountMutation.mutateAsync(values)
                } else {
                  await updateAccountMutation.mutateAsync(values)
                }
              })}
            >
              <FormField label="Identifiant" error={accountForm.formState.errors.identifiant?.message}>
                <input {...accountForm.register('identifiant')} placeholder="COMPTE-JOINT" />
              </FormField>

              <FormField label="Type de fonctionnement" error={accountForm.formState.errors.codeTypeFonctionnement?.message}>
                <select {...accountForm.register('codeTypeFonctionnement')}>
                  <option value="">Choisir un type</option>
                  {(typeQuery.data ?? []).map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.code}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Banque">
                <select {...accountForm.register('nomBanque')}>
                  <option value="">Aucune banque</option>
                  {(banquesQuery.data ?? []).map((bank) => (
                    <option key={bank.nom} value={bank.nom}>
                      {bank.nom}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Libelle">
                <textarea {...accountForm.register('libelle')} rows={4} placeholder="Description du compte" />
              </FormField>

              <FormField label="Date solde initial">
                <input type="date" {...accountForm.register('dateSoldeInitial')} />
              </FormField>

              <FormField label="Montant solde initial">
                <input {...accountForm.register('montantSoldeInitial')} inputMode="decimal" placeholder="0.00" />
              </FormField>

              <FormField label="Date de cloture">
                <input type="date" {...accountForm.register('dateCloture')} />
              </FormField>

              <div className="form-field full-span">
                <span className="form-field-label">Titulaires associes</span>
                <div className="checkbox-grid">
                  {(titulairesQuery.data ?? []).map((titulaire) => {
                    const checked = toggledTitulaires.includes(titulaire.nom)
                    return (
                      <label key={titulaire.nom} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = accountForm.getValues('nomsTitulaires')
                            accountForm.setValue(
                              'nomsTitulaires',
                              checked ? current.filter((value) => value !== titulaire.nom) : [...current, titulaire.nom],
                            )
                          }}
                        />
                        <span>{titulaire.nom}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="button-row full-span">
                <Button type="submit" disabled={createAccountMutation.isPending || updateAccountMutation.isPending}>
                  <Save size={16} />
                  {mode === 'create' ? 'Enregistrer le compte' : 'Mettre a jour le compte'}
                </Button>
                {mode === 'edit' ? (
                  <Button
                    type="button"
                    tone="ghost"
                    onClick={() => {
                      setMode('create')
                      setSelectedId(null)
                    }}
                  >
                    Revenir a la creation
                  </Button>
                ) : null}
              </div>
            </form>
          </Surface>

          {selectedAccount ? (
            <Surface className="detail-panel">
              <SectionHeader
                title="Lecture du compte"
                subtitle="Vue compacte pour comprendre le contexte metier avant d agir."
                aside={<Badge tone="success">{selectedAccount.codeTypeFonctionnement}</Badge>}
              />

              <div className="detail-grid">
                <div className="detail-card">
                  <PiggyBank size={18} />
                  <div>
                    <span>Solde estime a ce jour</span>
                    <strong>{currentBalance == null ? '...' : formatCurrency(currentBalance)}</strong>
                  </div>
                </div>
                <div className="detail-card">
                  <CalendarDays size={18} />
                  <div>
                    <span>Date solde initial</span>
                    <strong>{formatDate(selectedAccount.dateSoldeInitial)}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-list">
                <div>
                  <span>Banque</span>
                  <strong>{selectedAccount.nomBanque ?? 'Aucune'}</strong>
                </div>
                <div>
                  <span>Titulaires</span>
                  <strong>{selectedAccount.nomsTitulaires.length ? selectedAccount.nomsTitulaires.join(', ') : 'Aucun titulaire'}</strong>
                </div>
                <div>
                  <span>Montant initial</span>
                  <strong>{formatCurrencyFromCents(selectedAccount.montantSoldeInitialEnCentimes)}</strong>
                </div>
                <div>
                  <span>Date de cloture</span>
                  <strong>{selectedAccount.dateCloture ? formatDate(selectedAccount.dateCloture) : 'Compte ouvert'}</strong>
                </div>
              </div>

              <SectionHeader title="Dernieres operations" subtitle="Lecture rapide, calculee localement a partir des operations V1." />
              {!latestOperations.length ? (
                <EmptyState title="Pas encore de mouvement" description="Aucune operation liee a ce compte n a ete detectee." />
              ) : (
                <div className="stacked-cards">
                  {latestOperations.map((operation) => (
                    <div key={operation.numero} className="mini-card">
                      <div>
                        <strong>{readableOperationLabel(operation)}</strong>
                        <p>
                          {operation.numero} · {formatDate(operation.dateValeur)}
                        </p>
                      </div>
                      <Badge>{formatCurrencyFromCents(operation.montantEnCentimes)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          ) : null}

          <Surface className="editor-panel">
            <div className="editor-panel-header">
              <div>
                <span className="eyebrow">Evaluations</span>
                <h2>{selectedId ? `Evaluations de ${selectedId}` : 'Selectionne un compte'}</h2>
                <p>Creation et edition d evaluations rattachees au compte interne courant.</p>
              </div>
            </div>

            {!selectedId ? (
              <EmptyState title="Aucun compte selectionne" description="Choisis un compte interne pour afficher et saisir ses evaluations." />
            ) : (
              <>
                <form
                  className="form-grid two-columns"
                  onSubmit={evaluationForm.handleSubmit(async (values) => {
                    if (evaluationMode === 'create') {
                      await createEvaluationMutation.mutateAsync(values)
                    } else {
                      await updateEvaluationMutation.mutateAsync(values)
                    }
                  })}
                >
                  <FormField label="Cle technique">
                    <input {...evaluationForm.register('cle')} placeholder="Facultatif" />
                  </FormField>

                  <FormField label="Date d evaluation">
                    <input type="date" {...evaluationForm.register('dateSolde')} />
                  </FormField>

                  <FormField label="Montant evalue" error={evaluationForm.formState.errors.montantSolde?.message}>
                    <input {...evaluationForm.register('montantSolde')} inputMode="decimal" placeholder="1500.00" />
                  </FormField>

                  <FormField label="Libelle">
                    <textarea {...evaluationForm.register('libelle')} rows={3} placeholder="Note ou contexte" />
                  </FormField>

                  <div className="button-row full-span">
                    <Button type="submit" disabled={createEvaluationMutation.isPending || updateEvaluationMutation.isPending}>
                      <Save size={16} />
                      {evaluationMode === 'create' ? 'Ajouter l evaluation' : 'Mettre a jour l evaluation'}
                    </Button>
                    {evaluationMode === 'edit' ? (
                      <>
                        <Button
                          type="button"
                          tone="ghost"
                          onClick={() => {
                            setEvaluationMode('create')
                            setSelectedEvaluationKey(null)
                          }}
                        >
                          Nouvelle evaluation
                        </Button>
                        <Button
                          type="button"
                          tone="danger"
                          onClick={() => {
                            if (window.confirm(`Supprimer l evaluation ${selectedEvaluationKey} ?`)) {
                              void deleteEvaluationMutation.mutateAsync()
                            }
                          }}
                        >
                          <Trash2 size={16} />
                          Supprimer
                        </Button>
                      </>
                    ) : null}
                  </div>
                </form>

                {!accountEvaluations.length ? (
                  <EmptyState title="Aucune evaluation" description="Ajoute une premiere evaluation pour enrichir le suivi patrimonial." />
                ) : (
                  <div className="stacked-cards">
                    {accountEvaluations.map((evaluation) => (
                      <button
                        key={evaluation.cle}
                        className={`mini-card selectable ${selectedEvaluationKey === evaluation.cle ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedEvaluationKey(evaluation.cle)
                          setEvaluationMode('edit')
                        }}
                      >
                        <div>
                          <strong>{evaluation.cle}</strong>
                          <p>{formatDate(evaluation.dateSolde)}</p>
                        </div>
                        <Badge>{formatCurrencyFromCents(evaluation.montantSoldeEnCentimes)}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Surface>
        </div>
      </div>
    </div>
  )
}
