import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Check, ChevronDown, PiggyBank, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { QuickReferenceOverlay, type QuickReferenceDialogState } from '../components/quick-create'
import { Badge, Button, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, QuickAddButton, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { apiErrorMessage, type EvaluationBasic, type ReferenceListItem, type TypeFonctionnement, monatisApi } from '../lib/monatis-api'
import { formatCurrency, formatCurrencyFromCents, formatDate, nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../lib/format'
import { computeBalanceAtDate, latestOperationsForAccount, readableOperationLabel } from '../lib/reporting'

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
type DetailTab = 'overview' | 'evaluations' | 'operations'
type CreateStep = 'type' | 'identifiant' | 'banque' | 'review'

const ACCOUNT_DEFAULTS: AccountFormValues = {
  identifiant: '',
  libelle: '',
  codeTypeFonctionnement: '',
  dateSoldeInitial: todayIso(),
  montantSoldeInitial: '0.00',
  dateCloture: '',
  nomBanque: '',
  nomsTitulaires: [],
}

function evaluationAccountId(evaluation: EvaluationBasic): string | undefined {
  return evaluation.identifiantCompteInterne ?? evaluation.compteInterne?.identifiant
}

function toggleName(items: string[], name: string): string[] {
  return items.includes(name) ? items.filter((item) => item !== name) : [...items, name]
}

function typeLabel(type: TypeFonctionnement): string {
  return type.libelle || type.code
}

function typeCodeLabel(type: TypeFonctionnement): string {
  return type.code || type.libelle
}

function bankMatches(bank: ReferenceListItem, needle: string): boolean {
  if (!needle) {
    return true
  }

  const normalizedNeedle = needle.trim().toLowerCase()
  return [bank.nom, bank.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedNeedle))
}

function previewTip(label: string, value: string): string {
  return `${label}. ${value.trim() || 'Vide'}`
}

export function InternalAccountsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [selectedEvaluationKey, setSelectedEvaluationKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('TOUS')
  const [createStep, setCreateStep] = useState<CreateStep>('type')
  const [bankSearch, setBankSearch] = useState('')
  const [createDateClotureOpen, setCreateDateClotureOpen] = useState(false)
  const [editDateClotureOpen, setEditDateClotureOpen] = useState(false)
  const [quickReferenceDialog, setQuickReferenceDialog] = useState<QuickReferenceDialogState | null>(null)
  const createIdentifiantRef = useRef<HTMLInputElement | null>(null)
  const deferredSearch = useDeferredValue(search)
  const deferredBankSearch = useDeferredValue(bankSearch)

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

  const createForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: ACCOUNT_DEFAULTS,
  })

  const editForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: ACCOUNT_DEFAULTS,
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

  const createType = useWatch({ control: createForm.control, name: 'codeTypeFonctionnement' }) ?? ''
  const createIdentifiant = useWatch({ control: createForm.control, name: 'identifiant' }) ?? ''
  const createBanque = useWatch({ control: createForm.control, name: 'nomBanque' }) ?? ''
  const createDateCloture = useWatch({ control: createForm.control, name: 'dateCloture' }) ?? ''
  const createTitulaires = useWatch({ control: createForm.control, name: 'nomsTitulaires' }) ?? []
  const editIdentifiant = useWatch({ control: editForm.control, name: 'identifiant' }) ?? ''
  const editType = useWatch({ control: editForm.control, name: 'codeTypeFonctionnement' }) ?? ''
  const editBanque = useWatch({ control: editForm.control, name: 'nomBanque' }) ?? ''
  const editLibelle = useWatch({ control: editForm.control, name: 'libelle' }) ?? ''
  const editDateSoldeInitial = useWatch({ control: editForm.control, name: 'dateSoldeInitial' }) ?? ''
  const editMontantSoldeInitial = useWatch({ control: editForm.control, name: 'montantSoldeInitial' }) ?? ''
  const editTitulaires = useWatch({ control: editForm.control, name: 'nomsTitulaires' }) ?? []
  const editDateCloture = useWatch({ control: editForm.control, name: 'dateCloture' }) ?? ''

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    editForm.reset({
      identifiant: detailQuery.data.identifiant,
      libelle: detailQuery.data.libelle ?? '',
      codeTypeFonctionnement: detailQuery.data.typeFonctionnement.code,
      dateSoldeInitial: detailQuery.data.dateSoldeInitial,
      montantSoldeInitial: toMoneyInput(detailQuery.data.montantSoldeInitialEnCentimes),
      dateCloture: detailQuery.data.dateCloture ?? '',
      nomBanque: detailQuery.data.banque?.nom ?? '',
      nomsTitulaires: detailQuery.data.titulaires.map((item) => item.nom),
    })
  }, [detailQuery.data, editForm])

  const selectedEvaluation = useMemo(
    () => (evaluationsQuery.data ?? []).find((evaluation) => evaluation.cle === selectedEvaluationKey),
    [evaluationsQuery.data, selectedEvaluationKey],
  )

  useEffect(() => {
    if (selectedEvaluation) {
      evaluationForm.reset({
        cle: selectedEvaluation.cle,
        dateSolde: selectedEvaluation.dateSolde,
        libelle: selectedEvaluation.libelle ?? '',
        montantSolde: toMoneyInput(selectedEvaluation.montantSoldeEnCentimes),
      })
      return
    }

    evaluationForm.reset({
      cle: '',
      dateSolde: todayIso(),
      libelle: '',
      montantSolde: '',
    })
  }, [evaluationForm, selectedEvaluation])

  useEffect(() => {
    if (!createOpen || createStep !== 'identifiant') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createIdentifiantRef.current?.focus()
      createIdentifiantRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createOpen, createStep])

  const sortedTypes = useMemo(
    () => [...(typeQuery.data ?? [])].sort((left, right) => typeLabel(left).localeCompare(typeLabel(right))),
    [typeQuery.data],
  )

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

  const filteredBanks = useMemo(
    () => (banquesQuery.data ?? []).filter((bank) => bankMatches(bank, deferredBankSearch)).sort((left, right) => left.nom.localeCompare(right.nom)),
    [banquesQuery.data, deferredBankSearch],
  )

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

    return computeBalanceAtDate(selectedAccount, operationsQuery.data, todayIso(), evaluationsQuery.data ?? [])
  }, [evaluationsQuery.data, operationsQuery.data, selectedAccount])

  const balancesByAccount = useMemo(() => {
    const balances = new Map<string, number>()

    if (!operationsQuery.data) {
      return balances
    }

    ;(accountsQuery.data ?? []).forEach((account) => {
      balances.set(account.identifiant, computeBalanceAtDate(account, operationsQuery.data, todayIso(), evaluationsQuery.data ?? []))
    })

    return balances
  }, [accountsQuery.data, evaluationsQuery.data, operationsQuery.data])

  const latestOperations = useMemo(() => {
    if (!selectedId || !operationsQuery.data) {
      return []
    }

    return latestOperationsForAccount(operationsQuery.data, selectedId)
  }, [operationsQuery.data, selectedId])

  const selectedCreateType = useMemo(
    () => sortedTypes.find((type) => type.code === createType) ?? null,
    [createType, sortedTypes],
  )

  const createReady = Boolean(createType && createIdentifiant.trim())

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'internes'] })
      setCreateOpen(false)
      setSelectedId(null)
      setDetailTab('overview')
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
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'internes', selectedId] })
      setSelectedId(response.identifiant)
      setDetailTab('overview')
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: () => monatisApi.deleteInternalAccount(selectedId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'internes'] })
      setSelectedId(null)
      setDetailTab('overview')
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
      setSelectedEvaluationKey(null)
    },
  })

  const deleteEvaluationMutation = useMutation({
    mutationFn: () => monatisApi.deleteEvaluation(selectedEvaluationKey!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['evaluations'] })
      setSelectedEvaluationKey(null)
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

  function closeCreateFlow() {
    createForm.reset(ACCOUNT_DEFAULTS)
    setCreateStep('type')
    setBankSearch('')
    setCreateDateClotureOpen(false)
    setCreateOpen(false)
  }

  function openCreateFlow() {
    createForm.reset(ACCOUNT_DEFAULTS)
    setCreateStep('type')
    setBankSearch('')
    setCreateDateClotureOpen(false)
    setSelectedId(null)
    setEditDateClotureOpen(false)
    setDetailTab('overview')
    setCreateOpen(true)
  }

  function selectCreateTypeStep(code: string) {
    createForm.setValue('codeTypeFonctionnement', code)
    setCreateStep('identifiant')
  }

  function continueFromIdentifiant() {
    const normalized = createForm.getValues('identifiant').trim()

    if (!normalized) {
      createForm.setError('identifiant', { message: 'L identifiant est obligatoire.' })
      return
    }

    createForm.setValue('identifiant', normalized)
    setCreateStep('banque')
  }

  function selectCreateBank(name: string) {
    createForm.setValue('nomBanque', name)
    setCreateStep('review')
  }

  function openQuickReferenceDialog(dialog: QuickReferenceDialogState) {
    setQuickReferenceDialog(dialog)
  }

  function closeQuickReferenceDialog() {
    setQuickReferenceDialog(null)
  }

  function goBackCreate() {
    if (createStep === 'review') {
      setCreateStep('banque')
      return
    }

    if (createStep === 'banque') {
      setCreateStep('identifiant')
      return
    }

    if (createStep === 'identifiant') {
      setCreateStep('type')
    }
  }

  function canJumpToCreateStep(step: CreateStep): boolean {
    if (step === 'type') {
      return true
    }

    if (step === 'identifiant') {
      return Boolean(createType)
    }

    if (step === 'banque') {
      return Boolean(createType && createIdentifiant.trim())
    }

    return createReady
  }

  function jumpToCreateStep(step: CreateStep) {
    if (canJumpToCreateStep(step)) {
      setCreateStep(step)
    }
  }

  const createTrail = [
    { step: 'type' as const, label: selectedCreateType?.code ?? 'Type' },
    { step: 'identifiant' as const, label: createIdentifiant.trim() || 'Nom' },
    { step: 'banque' as const, label: createBanque || 'Aucune' },
    { step: 'review' as const, label: 'Options' },
  ]
  const createIdentifiantField = createForm.register('identifiant')

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comptes"
        title="Internes"
        actions={
          <Button tone="soft" onClick={openCreateFlow}>
            <Plus size={16} />
            Nouveau
          </Button>
        }
      />

      {accountsQuery.isLoading ? <LoadingState label="Chargement des comptes internes..." /> : null}
      {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

      <Surface className="catalog-panel">
        <FilterBar>
          <label className="search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher un identifiant, une banque ou un titulaire..." />
          </label>

          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="TOUS">Tous les types</option>
            {sortedTypes.map((type) => (
              <option key={type.code} value={type.code}>
                {typeLabel(type)}
              </option>
            ))}
          </select>
        </FilterBar>

        {!filteredAccounts.length ? (
          <EmptyState title="Aucun compte visible" description="Creer un compte ou elargir le filtre." />
        ) : (
          <div className="catalog-grid catalog-grid-wide">
            {filteredAccounts.map((account) => (
              <button
                key={account.identifiant}
                type="button"
                className={cx('catalog-card', selectedId === account.identifiant && 'selected')}
                onClick={() => {
                  setSelectedId(account.identifiant)
                  setEditDateClotureOpen(false)
                  setDetailTab('overview')
                }}
              >
                <div className="catalog-card-head">
                  <div>
                    <strong>{account.identifiant}</strong>
                    <p>{account.libelle ?? 'Sans libelle'}</p>
                  </div>
                  <Badge>{account.codeTypeFonctionnement}</Badge>
                </div>

                <div className="catalog-meta-grid">
                  <div className="catalog-meta-pair">
                    <span>Montant estime</span>
                    <strong>{balancesByAccount.has(account.identifiant) ? formatCurrency(balancesByAccount.get(account.identifiant) ?? 0) : '...'}</strong>
                  </div>
                  <div className="catalog-meta-pair">
                    <span>Banque</span>
                    <strong>{account.nomBanque ?? 'Aucune'}</strong>
                  </div>
                  <div className="catalog-meta-pair">
                    <span>Titulaires</span>
                    <strong>{account.nomsTitulaires.length ? account.nomsTitulaires.join(', ') : 'Aucun'}</strong>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Surface>

      <OverlayPanel open={createOpen} onClose={closeCreateFlow} title="Nouveau compte interne" width="wide">
        <form
          className="page-stack"
          onSubmit={createForm.handleSubmit(async (values) => {
            await createAccountMutation.mutateAsync(values)
            closeCreateFlow()
          })}
        >
          <div className="wizard-compact-top">
            <div className="wizard-compact-leading">
              {createStep !== 'type' ? (
                <button type="button" className="wizard-back-button" onClick={goBackCreate} aria-label="Revenir en arriere">
                  <ArrowLeft size={14} />
                </button>
              ) : null}

              <div className="wizard-trail">
                {createTrail.map((item) => (
                  <div key={item.step} className="wizard-trail-item">
                    {canJumpToCreateStep(item.step) ? (
                      <button type="button" className="button-reset" onClick={() => jumpToCreateStep(item.step)}>
                        {item.label}
                      </button>
                    ) : (
                      <span>{item.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {createStep === 'type' ? (
            <section className="wizard-step">
              <div className="wizard-step-head">
                <h2>Type de fonctionnement</h2>
              </div>

              {typeQuery.isLoading ? (
                <LoadingState label="Chargement des types..." />
              ) : !sortedTypes.length ? (
                <EmptyState title="Aucun type disponible" description="Le back ne renvoie pas encore de type de fonctionnement." />
              ) : (
                <div className="wizard-choice-grid">
                  {sortedTypes.map((type) => (
                    <button
                      key={type.code}
                      type="button"
                      className={cx('wizard-choice-card', 'choice-with-tooltip', createType === type.code && 'active')}
                      onClick={() => selectCreateTypeStep(type.code)}
                      data-tooltip={type.libelle}
                      aria-label={`${type.code} - ${type.libelle}`}
                    >
                      <div>
                        <strong>{typeCodeLabel(type)}</strong>
                      </div>
                      {createType === type.code ? <Check size={16} /> : null}
                    </button>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {createStep === 'identifiant' ? (
            <section className="wizard-step">
              <div className="wizard-step-head">
                <h2>Nom du compte</h2>
              </div>

              <FormField label="Identifiant" error={createForm.formState.errors.identifiant?.message}>
                <input
                  {...createIdentifiantField}
                  ref={(node) => {
                    createIdentifiantField.ref(node)
                    createIdentifiantRef.current = node
                  }}
                  placeholder="COMPTE JOINT"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      continueFromIdentifiant()
                    }
                  }}
                />
              </FormField>

              <div className="button-row">
                <Button type="button" disabled={!createIdentifiant.trim()} onClick={continueFromIdentifiant}>
                  Continuer
                </Button>
              </div>
            </section>
          ) : null}

          {createStep === 'banque' ? (
            <section className="wizard-step">
              <div className="wizard-step-head">
                <h2>Banque</h2>
              </div>

              <div className="search-action-row">
                <label className="search-field search-field-thin">
                  <Search size={14} />
                  <input value={bankSearch} onChange={(event) => setBankSearch(event.target.value)} placeholder="Chercher une banque..." />
                </label>
                <QuickAddButton
                  label="Creer une nouvelle banque"
                  onClick={() =>
                    openQuickReferenceDialog({
                      resource: 'banque',
                      title: 'Nouvelle banque',
                      onCreated: (name) => selectCreateBank(name),
                    })
                  }
                />
              </div>

              <div className="wizard-choice-grid">
                <button type="button" className={cx('wizard-choice-card', !createBanque && 'active')} onClick={() => selectCreateBank('')}>
                  <div>
                    <strong>Aucune</strong>
                    <span>Sans banque associee</span>
                  </div>
                  {!createBanque ? <Check size={16} /> : null}
                </button>

                {filteredBanks.map((bank) => (
                  <button
                    key={bank.nom}
                    type="button"
                    className={cx('wizard-choice-card', createBanque === bank.nom && 'active')}
                    onClick={() => selectCreateBank(bank.nom)}
                  >
                    <div>
                      <strong>{bank.nom}</strong>
                      <span>{bank.libelle ?? 'Banque'}</span>
                    </div>
                    {createBanque === bank.nom ? <Check size={16} /> : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {createStep === 'review' ? (
            <section className="wizard-step">
              <div className="wizard-step-head">
                <h2>Valider</h2>
              </div>

              <div className="wizard-summary wizard-summary-tight">
                <div className="wizard-summary-card compact">
                  <span>Type</span>
                  <strong>{selectedCreateType?.code ?? createType}</strong>
                </div>
                <div className="wizard-summary-card compact">
                  <span>Identifiant</span>
                  <strong>{createIdentifiant}</strong>
                </div>
                <div className="wizard-summary-card compact">
                  <span>Banque</span>
                  <strong>{createBanque || 'Aucune'}</strong>
                </div>
              </div>

              <div className="form-grid three-columns">
                <FormField label="Libelle">
                  <input {...createForm.register('libelle')} placeholder="Facultatif" />
                </FormField>

                <FormField label="Date solde initial">
                  <input type="date" {...createForm.register('dateSoldeInitial')} />
                </FormField>

                <FormField label="Montant solde initial">
                  <input {...createForm.register('montantSoldeInitial')} inputMode="decimal" placeholder="0.00" />
                </FormField>
              </div>

              <div className="form-field">
                <span className="form-field-label">Titulaires associes</span>
                <div className="checkbox-grid">
                  <QuickAddButton
                    label="Creer un nouveau titulaire"
                    onClick={() =>
                      openQuickReferenceDialog({
                        resource: 'titulaire',
                        title: 'Nouveau titulaire',
                        onCreated: (name) =>
                          createForm.setValue('nomsTitulaires', toggleName(createForm.getValues('nomsTitulaires'), name), { shouldDirty: true, shouldTouch: true }),
                      })
                    }
                  />
                  {(titulairesQuery.data ?? []).map((titulaire) => {
                    const checked = createTitulaires.includes(titulaire.nom)
                    return (
                      <label key={titulaire.nom} className={cx('toggle-chip', checked && 'checked')}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => createForm.setValue('nomsTitulaires', toggleName(createTitulaires, titulaire.nom), { shouldDirty: true, shouldTouch: true })}
                        />
                        <span>{titulaire.nom}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className={cx('section-toggle', createDateClotureOpen && 'open')}>
                <button type="button" className="section-toggle-button compact" onClick={() => setCreateDateClotureOpen((current) => !current)}>
                  <div className="section-toggle-copy-inline">
                    <strong>Date de cloture</strong>
                    <span>{createDateCloture ? formatDate(createDateCloture) : 'Facultatif'}</span>
                  </div>
                  <ChevronDown size={16} />
                </button>

                {createDateClotureOpen ? (
                  <div className="section-toggle-body">
                    <FormField label="Date de cloture">
                      <input type="date" {...createForm.register('dateCloture')} />
                    </FormField>
                  </div>
                ) : null}
              </div>

              <div className="button-row">
                <Button type="submit" disabled={createAccountMutation.isPending || !createReady}>
                  <Save size={16} />
                  Valider
                </Button>
              </div>
            </section>
          ) : null}
        </form>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedId)}
        onClose={() => {
          setSelectedId(null)
          setSelectedEvaluationKey(null)
          setEditDateClotureOpen(false)
        }}
        title={selectedId ?? 'Compte interne'}
        width="wide"
        actions={
          selectedId ? (
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
          ) : null
        }
      >
        {!selectedId ? null : detailQuery.isLoading ? (
          <LoadingState label="Chargement..." />
        ) : !detailQuery.data || !selectedAccount ? (
          <EmptyState title="Compte introuvable" description="Impossible d afficher ce detail." />
        ) : (
          <>
            <div className="modal-tabs">
              <button type="button" className={cx('modal-tab-button', detailTab === 'overview' && 'active')} onClick={() => setDetailTab('overview')}>
                Apercu
              </button>
              <button type="button" className={cx('modal-tab-button', detailTab === 'evaluations' && 'active')} onClick={() => setDetailTab('evaluations')}>
                Evaluations
              </button>
              <button type="button" className={cx('modal-tab-button', detailTab === 'operations' && 'active')} onClick={() => setDetailTab('operations')}>
                Operations
              </button>
            </div>

            {detailTab === 'overview' ? (
              <form
                className="page-stack"
                onSubmit={editForm.handleSubmit(async (values) => {
                  await updateAccountMutation.mutateAsync(values)
                })}
              >
                <div className="detail-grid">
                  <div className="detail-card preview-tip" data-tooltip={previewTip('Solde estime', currentBalance == null ? 'En calcul' : formatCurrency(currentBalance))}>
                    <PiggyBank size={18} />
                    <div className="detail-card-copy">
                      <span>Solde estime</span>
                      <strong>{currentBalance == null ? '...' : formatCurrency(currentBalance)}</strong>
                    </div>
                  </div>
                  <div className="detail-card preview-tip" data-tooltip={previewTip('Date solde initial', formatDate(editDateSoldeInitial || selectedAccount.dateSoldeInitial))}>
                    <CalendarDays size={18} />
                    <div className="detail-card-copy">
                      <span>Date solde initial</span>
                      <strong>{formatDate(selectedAccount.dateSoldeInitial)}</strong>
                    </div>
                  </div>
                </div>

                <div className="operation-overview-grid edit-mode">
                  <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Identifiant', editIdentifiant || selectedAccount.identifiant)}>
                    <span>Identifiant</span>
                    <input {...editForm.register('identifiant')} />
                  </div>

                  <div
                    className="operation-overview-card compact preview-tip"
                    data-tooltip={previewTip(
                      'Type de fonctionnement',
                      sortedTypes.find((type) => type.code === editType)?.code ?? selectedAccount.codeTypeFonctionnement,
                    )}
                  >
                    <span>Type</span>
                    <select {...editForm.register('codeTypeFonctionnement')}>
                      <option value="">Choisir un type</option>
                      {sortedTypes.map((type) => (
                        <option key={type.code} value={type.code}>
                          {typeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Banque', editBanque || 'Aucune')}>
                    <span>Banque</span>
                    <div className="field-action-row">
                      <select {...editForm.register('nomBanque')}>
                        <option value="">Aucune</option>
                        {(banquesQuery.data ?? []).map((bank) => (
                          <option key={bank.nom} value={bank.nom}>
                            {bank.nom}
                          </option>
                        ))}
                      </select>
                      <QuickAddButton
                        label="Creer une nouvelle banque"
                        onClick={() =>
                          openQuickReferenceDialog({
                            resource: 'banque',
                            title: 'Nouvelle banque',
                            onCreated: (name) => editForm.setValue('nomBanque', name, { shouldDirty: true, shouldTouch: true }),
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Libelle', editLibelle || 'Aucun libelle')}>
                    <span>Libelle</span>
                    <input {...editForm.register('libelle')} placeholder="Aucun" />
                  </div>

                  <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Date solde initial', formatDate(editDateSoldeInitial || selectedAccount.dateSoldeInitial))}>
                    <span>Date solde initial</span>
                    <input type="date" {...editForm.register('dateSoldeInitial')} />
                  </div>

                  <div
                    className="operation-overview-card compact preview-tip"
                    data-tooltip={previewTip(
                      'Montant solde initial',
                      formatCurrencyFromCents(parseMoneyToCents(editMontantSoldeInitial || toMoneyInput(selectedAccount.montantSoldeInitialEnCentimes))),
                    )}
                  >
                    <span>Montant initial</span>
                    <input {...editForm.register('montantSoldeInitial')} inputMode="decimal" />
                  </div>
                </div>

                <div className="form-field">
                  <span className="form-field-label">Titulaires associes</span>
                  <div className="checkbox-grid">
                    <QuickAddButton
                      label="Creer un nouveau titulaire"
                      onClick={() =>
                        openQuickReferenceDialog({
                          resource: 'titulaire',
                          title: 'Nouveau titulaire',
                          onCreated: (name) =>
                            editForm.setValue('nomsTitulaires', toggleName(editForm.getValues('nomsTitulaires'), name), { shouldDirty: true, shouldTouch: true }),
                        })
                      }
                    />
                    {(titulairesQuery.data ?? []).map((titulaire) => {
                      const checked = editTitulaires.includes(titulaire.nom)
                      return (
                        <label key={titulaire.nom} className={cx('toggle-chip', checked && 'checked')}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => editForm.setValue('nomsTitulaires', toggleName(editTitulaires, titulaire.nom), { shouldDirty: true, shouldTouch: true })}
                          />
                          <span>{titulaire.nom}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className={cx('section-toggle', editDateClotureOpen && 'open')}>
                  <button type="button" className="section-toggle-button compact" onClick={() => setEditDateClotureOpen((current) => !current)}>
                    <div className="section-toggle-copy-inline">
                      <strong>Date de cloture</strong>
                      <span>{editDateCloture ? formatDate(editDateCloture) : 'Facultatif'}</span>
                    </div>
                    <ChevronDown size={16} />
                  </button>

                  {editDateClotureOpen ? (
                    <div className="section-toggle-body">
                      <FormField label="Date de cloture">
                        <input type="date" {...editForm.register('dateCloture')} />
                      </FormField>
                    </div>
                  ) : null}
                </div>

                {editForm.formState.isDirty ? (
                  <div className="button-row operation-edit-actions">
                    <Button
                      type="button"
                      tone="ghost"
                      disabled={updateAccountMutation.isPending}
                      onClick={() => {
                        if (!detailQuery.data) {
                          return
                        }

                        editForm.reset({
                          identifiant: detailQuery.data.identifiant,
                          libelle: detailQuery.data.libelle ?? '',
                          codeTypeFonctionnement: detailQuery.data.typeFonctionnement.code,
                          dateSoldeInitial: detailQuery.data.dateSoldeInitial,
                          montantSoldeInitial: toMoneyInput(detailQuery.data.montantSoldeInitialEnCentimes),
                          dateCloture: detailQuery.data.dateCloture ?? '',
                          nomBanque: detailQuery.data.banque?.nom ?? '',
                          nomsTitulaires: detailQuery.data.titulaires.map((item) => item.nom),
                        })
                        setEditDateClotureOpen(false)
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={updateAccountMutation.isPending}>
                      <Save size={16} />
                      Modifier
                    </Button>
                  </div>
                ) : null}
              </form>
            ) : null}

            {detailTab === 'evaluations' ? (
              <div className="page-stack">
                <form
                  className="form-grid two-columns"
                  onSubmit={evaluationForm.handleSubmit(async (values) => {
                    if (selectedEvaluationKey) {
                      await updateEvaluationMutation.mutateAsync(values)
                    } else {
                      await createEvaluationMutation.mutateAsync(values)
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
                    <textarea {...evaluationForm.register('libelle')} rows={3} placeholder="Facultatif" />
                  </FormField>

                  <div className="button-row full-span">
                    <Button type="submit" disabled={createEvaluationMutation.isPending || updateEvaluationMutation.isPending}>
                      <Save size={16} />
                      {selectedEvaluationKey ? 'Mettre a jour' : 'Ajouter'}
                    </Button>
                    {selectedEvaluationKey ? (
                      <Button type="button" tone="ghost" onClick={() => setSelectedEvaluationKey(null)}>
                        Nouvelle evaluation
                      </Button>
                    ) : null}
                    {selectedEvaluationKey ? (
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
                        type="button"
                        className={cx('mini-card', 'selectable', selectedEvaluationKey === evaluation.cle && 'selected')}
                        onClick={() => setSelectedEvaluationKey(evaluation.cle)}
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
              </div>
            ) : null}

            {detailTab === 'operations' ? (
              !latestOperations.length ? (
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
              )
            ) : null}
          </>
        )}
      </OverlayPanel>

      <QuickReferenceOverlay dialog={quickReferenceDialog} onClose={closeQuickReferenceDialog} />
    </div>
  )
}
