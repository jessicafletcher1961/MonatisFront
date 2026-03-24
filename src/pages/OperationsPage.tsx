import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Badge, Button, DataPanel, EmptyState, ErrorState, FilterBar, FormField, LoadingState, PageHeader, SectionHeader, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { formatCurrencyFromCents, formatDate, formatShortDate, nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../lib/format'
import { apiErrorMessage, type CompteSummary, type OperationBasic, type OperationLinePayload, type TypeOperation, monatisApi } from '../lib/monatis-api'
import { readableOperationLabel, sortOperationsDesc, technicalAccountFallback } from '../lib/reporting'

const createSchema = z.object({
  numero: z.string().optional(),
  libelle: z.string().optional(),
  codeTypeOperation: z.string().trim().min(1, 'Le type est obligatoire.'),
  dateValeur: z.string().optional(),
  montant: z.string().trim().min(1, 'Le montant est obligatoire.'),
  identifiantCompteDepense: z.string().optional(),
  identifiantCompteRecette: z.string().optional(),
  nomSousCategorie: z.string().optional(),
  nomsBeneficiaires: z.array(z.string()),
})

const editSchema = z.object({
  numero: z.string().optional(),
  libelle: z.string().optional(),
  codeTypeOperation: z.string().optional(),
  dateValeur: z.string().optional(),
  montant: z.string().optional(),
  identifiantCompteDepense: z.string().optional(),
  identifiantCompteRecette: z.string().optional(),
  pointee: z.boolean(),
  lignes: z.array(
    z.object({
      numeroLigne: z.number().nullable().optional(),
      libelle: z.string().optional(),
      dateComptabilisation: z.string().optional(),
      montant: z.string().optional(),
      nomSousCategorie: z.string().optional(),
      nomsBeneficiaires: z.array(z.string()),
    }),
  ),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>
type CreateStep = 'type' | 'amount' | 'depense' | 'recette' | 'review'
type OperationTypeGroup = 'incoming' | 'outgoing' | 'internal' | 'technical' | 'other'

const CREATE_DEFAULTS: CreateFormValues = {
  numero: '',
  libelle: '',
  codeTypeOperation: '',
  dateValeur: todayIso(),
  montant: '',
  identifiantCompteDepense: '',
  identifiantCompteRecette: '',
  nomSousCategorie: '',
  nomsBeneficiaires: [],
}

const OPERATION_TYPE_GROUP_META: Array<{ key: OperationTypeGroup; label: string }> = [
  { key: 'incoming', label: 'Exterieur vers le foyer' },
  { key: 'outgoing', label: 'Foyer vers l exterieur' },
  { key: 'internal', label: 'Entre vos comptes' },
  { key: 'technical', label: 'Mouvements du compte' },
  { key: 'other', label: 'Autres' },
]

function operationTypeCode(operation: OperationBasic): string {
  return operation.codeTypeOperation ?? operation.typeOperation?.code ?? ''
}

function depenseId(operation: OperationBasic): string {
  return operation.identifiantCompteDepense ?? operation.compteDepense?.identifiant ?? ''
}

function recetteId(operation: OperationBasic): string {
  return operation.identifiantCompteRecette ?? operation.compteRecette?.identifiant ?? ''
}

function accountChoiceLabel(account: CompteSummary): string {
  return `${account.identifiant}${account.libelle ? ` · ${account.libelle}` : ''}`
}

function beneficiariesForLine(operation: OperationBasic, lineIndex: number): string[] {
  const line = operation.lignes[lineIndex]
  return line?.nomsBeneficiaires ?? line?.beneficiaires?.map((item) => item.nom) ?? []
}

function normalizedText(value: string): string {
  return value.trim().toLowerCase()
}

function matchesNeedle(value: string, needle: string): boolean {
  if (!needle) {
    return true
  }

  return normalizedText(value).includes(normalizedText(needle))
}

function operationTypeGroup(code: string): OperationTypeGroup {
  if (code === 'RECETTE') {
    return 'incoming'
  }

  if (code === 'DEPENSE') {
    return 'outgoing'
  }

  if (['TRANSFERT', 'DEPOT', 'INVEST', 'RETRAIT', 'LIQUID', 'VENTE', 'ACHAT'].includes(code)) {
    return 'internal'
  }

  if (['COURANT+', 'COURANT-', 'FINANCIER+', 'FINANCIER-', 'BIEN+', 'BIEN-'].includes(code)) {
    return 'technical'
  }

  return 'other'
}

function typePriority(type: Pick<TypeOperation, 'code' | 'libelle' | 'libelleCourt'>): number {
  const order = OPERATION_TYPE_GROUP_META.findIndex((group) => group.key === operationTypeGroup(type.code))
  return order === -1 ? 999 : order
}

function flowLabelsForType(code: string): {
  depenseStep: string
  recetteStep: string
  depenseSummary: string
  recetteSummary: string
} {
  const group = operationTypeGroup(code)

  if (group === 'incoming') {
    return {
      depenseStep: 'Provenance',
      recetteStep: 'Compte credite',
      depenseSummary: 'Provenance',
      recetteSummary: 'Compte credite',
    }
  }

  if (group === 'outgoing') {
    return {
      depenseStep: 'Compte debite',
      recetteStep: 'Destinataire',
      depenseSummary: 'Compte debite',
      recetteSummary: 'Destinataire',
    }
  }

  if (group === 'technical') {
    return {
      depenseStep: 'Compte impacte',
      recetteStep: 'Contrepartie technique',
      depenseSummary: 'Compte impacte',
      recetteSummary: 'Contrepartie',
    }
  }

  return {
    depenseStep: 'Compte de depart',
    recetteStep: "Compte d arrivee",
    depenseSummary: 'Depart',
    recetteSummary: 'Arrivee',
  }
}

function selectedAccountLabel(accounts: CompteSummary[], identifiant: string): string {
  return accounts.find((account) => account.identifiant === identifiant)?.identifiant ?? identifiant
}

export function OperationsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedNumero, setSelectedNumero] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TOUS')
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('type')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [typeSearch, setTypeSearch] = useState('')
  const [depenseSearch, setDepenseSearch] = useState('')
  const [recetteSearch, setRecetteSearch] = useState('')
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)
  const deferredSearch = useDeferredValue(search)
  const deferredTypeSearch = useDeferredValue(typeSearch)
  const deferredDepenseSearch = useDeferredValue(depenseSearch)
  const deferredRecetteSearch = useDeferredValue(recetteSearch)

  const operationsQuery = useQuery({
    queryKey: ['operations'],
    queryFn: () => monatisApi.listOperations(),
  })

  const detailQuery = useQuery({
    queryKey: ['operations', selectedNumero],
    queryFn: () => monatisApi.getOperation(selectedNumero!),
    enabled: Boolean(selectedNumero),
  })

  const typesQuery = useQuery({
    queryKey: ['operation-types'],
    queryFn: () => monatisApi.listOperationTypes(),
  })

  const internalAccountsQuery = useQuery({
    queryKey: ['comptes', 'internes'],
    queryFn: () => monatisApi.listInternalAccounts(),
  })

  const externalAccountsQuery = useQuery({
    queryKey: ['comptes', 'externes'],
    queryFn: () => monatisApi.listExternalAccounts(),
  })

  const technicalAccountsQuery = useQuery({
    queryKey: ['comptes', 'techniques'],
    queryFn: () => monatisApi.listTechnicalAccounts(),
  })

  const sousCategoriesQuery = useQuery({
    queryKey: ['references', 'souscategorie'],
    queryFn: () => monatisApi.listReferences('souscategorie'),
  })

  const beneficiairesQuery = useQuery({
    queryKey: ['references', 'beneficiaire'],
    queryFn: () => monatisApi.listReferences('beneficiaire'),
  })

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: CREATE_DEFAULTS,
  })

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      numero: '',
      libelle: '',
      codeTypeOperation: '',
      dateValeur: '',
      montant: '',
      identifiantCompteDepense: '',
      identifiantCompteRecette: '',
      pointee: false,
      lignes: [],
    },
  })

  const lineFieldArray = useFieldArray({
    control: editForm.control,
    name: 'lignes',
  })

  const createType = useWatch({ control: createForm.control, name: 'codeTypeOperation' }) ?? ''
  const createAmount = useWatch({ control: createForm.control, name: 'montant' }) ?? ''
  const createDepense = useWatch({ control: createForm.control, name: 'identifiantCompteDepense' }) ?? ''
  const createRecette = useWatch({ control: createForm.control, name: 'identifiantCompteRecette' }) ?? ''
  const createNumero = useWatch({ control: createForm.control, name: 'numero' }) ?? ''
  const createLibelle = useWatch({ control: createForm.control, name: 'libelle' }) ?? ''
  const createDateValeur = useWatch({ control: createForm.control, name: 'dateValeur' }) ?? todayIso()
  const createNomSousCategorie = useWatch({ control: createForm.control, name: 'nomSousCategorie' }) ?? ''
  const createBeneficiaries = useWatch({ control: createForm.control, name: 'nomsBeneficiaires' }) ?? []
  const editType = useWatch({ control: editForm.control, name: 'codeTypeOperation' }) ?? ''
  const watchedLines = useWatch({ control: editForm.control, name: 'lignes' }) ?? []

  const compatQuery = useQuery({
    queryKey: ['operations', 'compat', createType],
    queryFn: () => monatisApi.getOperationCompatibilitiesByType(createType),
    enabled: Boolean(createType),
  })

  const refinedRecetteQuery = useQuery({
    queryKey: ['operations', 'compat', 'recette', createType, createDepense],
    queryFn: () => monatisApi.getOperationCompatibleRecetteByDepense(createType, createDepense),
    enabled: Boolean(createType && createDepense && compatQuery.data?.comptesCompatiblesRecette),
  })

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    editForm.reset({
      numero: detailQuery.data.numero,
      libelle: detailQuery.data.libelle ?? '',
      codeTypeOperation: operationTypeCode(detailQuery.data),
      dateValeur: detailQuery.data.dateValeur,
      montant: toMoneyInput(detailQuery.data.montantEnCentimes),
      identifiantCompteDepense: depenseId(detailQuery.data),
      identifiantCompteRecette: recetteId(detailQuery.data),
      pointee: detailQuery.data.pointee,
      lignes: detailQuery.data.lignes.map((line, index) => ({
        numeroLigne: line.numeroLigne,
        libelle: line.libelle ?? '',
        dateComptabilisation: line.dateComptabilisation ?? detailQuery.data.dateValeur,
        montant: toMoneyInput(line.montantEnCentimes),
        nomSousCategorie: line.nomSousCategorie ?? line.sousCategorie?.nom ?? '',
        nomsBeneficiaires: beneficiariesForLine(detailQuery.data, index),
      })),
    })
  }, [detailQuery.data, editForm])

  const technicalFallbackId = technicalAccountFallback(technicalAccountsQuery.data ?? [])

  useEffect(() => {
    if (!createType) {
      return
    }

    if (compatQuery.data?.comptesCompatiblesDepense === null && createDepense !== technicalFallbackId) {
      createForm.setValue('identifiantCompteDepense', technicalFallbackId)
    }

    if (compatQuery.data?.comptesCompatiblesRecette === null && createRecette !== technicalFallbackId) {
      createForm.setValue('identifiantCompteRecette', technicalFallbackId)
    }
  }, [compatQuery.data, createDepense, createForm, createRecette, createType, technicalFallbackId])

  useEffect(() => {
    if (!(location.state as { openCreate?: boolean } | null)?.openCreate) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createForm.reset(CREATE_DEFAULTS)
      setCreateStep('type')
      setAdvancedOpen(false)
      setTypeSearch('')
      setDepenseSearch('')
      setRecetteSearch('')
      setCreateOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createForm, location.pathname, location.state, navigate])

  useEffect(() => {
    if (!createOpen || createStep !== 'amount') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      amountInputRef.current?.focus()
      amountInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createOpen, createStep])

  const depenseOptions = useMemo(() => compatQuery.data?.comptesCompatiblesDepense ?? [], [compatQuery.data?.comptesCompatiblesDepense])
  const recetteOptions = useMemo(
    () => refinedRecetteQuery.data?.comptesCompatiblesRecette ?? compatQuery.data?.comptesCompatiblesRecette ?? [],
    [compatQuery.data?.comptesCompatiblesRecette, refinedRecetteQuery.data?.comptesCompatiblesRecette],
  )

  const filteredOperations = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()
    const items = sortOperationsDesc(operationsQuery.data ?? [])

    return items.filter((operation) => {
      if (typeFilter !== 'TOUS' && operationTypeCode(operation) !== typeFilter) {
        return false
      }

      if (!needle) {
        return true
      }

      return [operation.numero, operation.libelle, operationTypeCode(operation), depenseId(operation), recetteId(operation)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredSearch, operationsQuery.data, typeFilter])

  const allAccounts = useMemo(
    () => [
      ...(internalAccountsQuery.data ?? []),
      ...(externalAccountsQuery.data ?? []),
      ...(technicalAccountsQuery.data ?? []),
    ],
    [externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )

  const sortedOperationTypes = useMemo(
    () =>
      [...(typesQuery.data ?? [])].sort((left, right) => {
        const priorityGap = typePriority(left) - typePriority(right)
        if (priorityGap !== 0) {
          return priorityGap
        }

        return left.libelleCourt.localeCompare(right.libelleCourt)
      }),
    [typesQuery.data],
  )

  const filteredOperationTypes = useMemo(
    () =>
      sortedOperationTypes.filter((type) =>
        matchesNeedle(`${type.code} ${type.libelleCourt} ${type.libelle}`, deferredTypeSearch),
      ),
    [deferredTypeSearch, sortedOperationTypes],
  )

  const groupedOperationTypes = useMemo(
    () =>
      OPERATION_TYPE_GROUP_META.map((group) => ({
        ...group,
        items: filteredOperationTypes.filter((type) => operationTypeGroup(type.code) === group.key),
      })).filter((group) => group.items.length),
    [filteredOperationTypes],
  )

  const filteredDepenseOptions = useMemo(
    () => depenseOptions.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredDepenseSearch)),
    [deferredDepenseSearch, depenseOptions],
  )

  const filteredRecetteOptions = useMemo(
    () => recetteOptions.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredRecetteSearch)),
    [deferredRecetteSearch, recetteOptions],
  )

  const selectedType = useMemo(
    () => (typesQuery.data ?? []).find((type) => type.code === createType) ?? null,
    [createType, typesQuery.data],
  )
  const createFlowLabels = useMemo(() => flowLabelsForType(createType), [createType])
  const editFlowLabels = useMemo(
    () => flowLabelsForType(editType || detailQuery.data?.typeOperation?.code || detailQuery.data?.codeTypeOperation || ''),
    [detailQuery.data?.codeTypeOperation, detailQuery.data?.typeOperation?.code, editType],
  )

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) =>
      monatisApi.createOperation({
        numero: nullIfBlank(values.numero ?? ''),
        libelle: nullIfBlank(values.libelle ?? ''),
        codeTypeOperation: values.codeTypeOperation,
        dateValeur: nullIfBlank(values.dateValeur ?? ''),
        montantEnCentimes: parseMoneyToCents(values.montant),
        identifiantCompteDepense: values.identifiantCompteDepense?.trim() || technicalFallbackId,
        identifiantCompteRecette: values.identifiantCompteRecette?.trim() || technicalFallbackId,
        nomSousCategorie: nullIfBlank(values.nomSousCategorie ?? ''),
        nomsBeneficiaires: values.nomsBeneficiaires,
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['operations'] })
      setSelectedNumero(response.numero)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const lignes: OperationLinePayload[] = values.lignes.map((line) => ({
        numeroLigne: line.numeroLigne,
        libelle: nullIfBlank(line.libelle ?? ''),
        dateComptabilisation: nullIfBlank(line.dateComptabilisation ?? ''),
        montantEnCentimes: line.montant ? parseMoneyToCents(line.montant) : null,
        nomSousCategorie: nullIfBlank(line.nomSousCategorie ?? ''),
        nomsBeneficiaires: line.nomsBeneficiaires,
      }))

      return monatisApi.updateOperation(selectedNumero!, {
        numero: nullIfBlank(values.numero ?? ''),
        libelle: nullIfBlank(values.libelle ?? ''),
        codeTypeOperation: nullIfBlank(values.codeTypeOperation ?? ''),
        dateValeur: nullIfBlank(values.dateValeur ?? ''),
        montantEnCentimes: values.montant ? parseMoneyToCents(values.montant) : null,
        identifiantCompteDepense: nullIfBlank(values.identifiantCompteDepense ?? ''),
        identifiantCompteRecette: nullIfBlank(values.identifiantCompteRecette ?? ''),
        pointee: values.pointee,
        lignes,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['operations'] })
      await queryClient.invalidateQueries({ queryKey: ['operations', selectedNumero] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteOperation(selectedNumero!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['operations'] })
      setSelectedNumero(null)
      editForm.reset({
        numero: '',
        libelle: '',
        codeTypeOperation: '',
        dateValeur: '',
        montant: '',
        identifiantCompteDepense: '',
        identifiantCompteRecette: '',
        pointee: false,
        lignes: [],
      })
    },
  })

  const hasError =
    operationsQuery.error ||
    detailQuery.error ||
    typesQuery.error ||
    internalAccountsQuery.error ||
    externalAccountsQuery.error ||
    technicalAccountsQuery.error ||
    sousCategoriesQuery.error ||
    beneficiairesQuery.error ||
    compatQuery.error ||
    refinedRecetteQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error

  const currentTypeNeedsReference = ['RECETTE', 'DEPENSE'].includes(createType)
  const depenseIsTechnical = compatQuery.data?.comptesCompatiblesDepense === null
  const recetteIsTechnical = compatQuery.data?.comptesCompatiblesRecette === null
  const amountReady = Boolean(createAmount.trim())
  const depenseReady = depenseIsTechnical ? Boolean(technicalFallbackId) : Boolean(createDepense)
  const recetteReady = recetteIsTechnical ? Boolean(technicalFallbackId) : Boolean(createRecette)

  function resetCreateFlow() {
    createForm.reset(CREATE_DEFAULTS)
    setCreateStep('type')
    setAdvancedOpen(false)
    setTypeSearch('')
    setDepenseSearch('')
    setRecetteSearch('')
  }

  function openCreateFlow() {
    resetCreateFlow()
    setCreateOpen(true)
  }

  function closeCreateFlow() {
    resetCreateFlow()
    setCreateOpen(false)
  }

  function selectType(code: string) {
    createForm.reset({
      ...CREATE_DEFAULTS,
      dateValeur: createDateValeur || todayIso(),
      codeTypeOperation: code,
    })
    setAdvancedOpen(false)
    setDepenseSearch('')
    setRecetteSearch('')
    setCreateStep('amount')
  }

  function continueFromAmount() {
    if (!amountReady || compatQuery.isLoading || !compatQuery.data) {
      return
    }

    setAdvancedOpen(false)

    if (depenseIsTechnical && technicalFallbackId) {
      createForm.setValue('identifiantCompteDepense', technicalFallbackId)

      if (recetteIsTechnical) {
        createForm.setValue('identifiantCompteRecette', technicalFallbackId)
        setCreateStep('review')
        return
      }

      createForm.setValue('identifiantCompteRecette', '')
      setCreateStep('recette')
      return
    }

    createForm.setValue('identifiantCompteDepense', '')
    createForm.setValue('identifiantCompteRecette', '')
    setCreateStep('depense')
  }

  function selectDepenseAccount(identifiant: string) {
    createForm.setValue('identifiantCompteDepense', identifiant)
    if (recetteIsTechnical) {
      createForm.setValue('identifiantCompteRecette', technicalFallbackId)
      setCreateStep('review')
      return
    }

    createForm.setValue('identifiantCompteRecette', '')
    setRecetteSearch('')
    setCreateStep('recette')
  }

  function selectRecetteAccount(identifiant: string) {
    createForm.setValue('identifiantCompteRecette', identifiant)
    setCreateStep('review')
  }

  function goBack() {
    setAdvancedOpen(false)

    if (createStep === 'amount') {
      setCreateStep('type')
      return
    }

    if (createStep === 'depense') {
      setCreateStep('amount')
      return
    }

    if (createStep === 'recette') {
      setCreateStep(depenseIsTechnical ? 'amount' : 'depense')
      return
    }

    if (createStep === 'review') {
      if (!recetteIsTechnical) {
        setCreateStep('recette')
        return
      }

      if (!depenseIsTechnical) {
        setCreateStep('depense')
        return
      }

      setCreateStep('amount')
    }
  }

  const createTrail = useMemo(() => {
    const items: string[] = []

    if (createType) {
      items.push(selectedType?.libelleCourt ?? createType)
    }

    if (createStep !== 'type' && createAmount) {
      items.push(createAmount)
    }

    if ((createStep === 'recette' || createStep === 'review') && depenseReady) {
      items.push(selectedAccountLabel(allAccounts, createDepense || technicalFallbackId))
    }

    if (createStep === 'review' && recetteReady) {
      items.push(selectedAccountLabel(allAccounts, createRecette || technicalFallbackId))
    }

    return items
  }, [allAccounts, createAmount, createDepense, createRecette, createStep, createType, depenseReady, recetteReady, selectedType, technicalFallbackId])
  const amountField = createForm.register('montant')
  const dateField = createForm.register('dateValeur')

  function openDateOptions() {
    setAdvancedOpen(true)

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        dateInputRef.current?.focus()
        ;(dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.()
      })
    })
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations"
        title="Operations"
        actions={
          <Button tone={createOpen ? 'ghost' : 'primary'} onClick={createOpen ? closeCreateFlow : openCreateFlow}>
            {createOpen ? <X size={16} /> : <Plus size={16} />}
            {createOpen ? 'Fermer' : 'Nouvelle operation'}
          </Button>
        }
      />

      {createOpen ? (
        <div className="operation-create-overlay" role="dialog" aria-modal="true" aria-label="Nouvelle operation">
          <button type="button" className="operation-create-backdrop" aria-label="Fermer la saisie" onClick={closeCreateFlow} />
          <div className="operation-create-dialog">
            <Surface className="operation-create-panel">
              <div className="wizard-compact-top">
                <div className="wizard-compact-leading">
                  {createStep !== 'type' ? (
                    <button type="button" className="wizard-back-button" onClick={goBack} aria-label="Revenir a l etape precedente">
                      <ArrowLeft size={15} />
                    </button>
                  ) : null}

                  {createTrail.length ? (
                    <div className="wizard-trail">
                      {createTrail.map((item, index) => (
                        <span key={`${item}-${index}`} className="wizard-trail-item">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button type="button" className="wizard-close-button" onClick={closeCreateFlow} aria-label="Fermer">
                  <X size={15} />
                </button>
              </div>

              <form
                className="page-stack"
                onSubmit={createForm.handleSubmit(async (values) => {
                  await createMutation.mutateAsync(values)
                  closeCreateFlow()
                })}
              >
            {createStep === 'type' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>Type</h2>
                </div>
                <label className="search-field search-field-thin">
                  <Search size={14} />
                  <input value={typeSearch} onChange={(event) => setTypeSearch(event.target.value)} placeholder="Chercher un type..." />
                </label>

                {!groupedOperationTypes.length ? (
                  <EmptyState title="Aucun type" description="Aucun type ne correspond a la recherche." />
                ) : (
                  groupedOperationTypes.map((group) => (
                    <div key={group.key} className="wizard-choice-section">
                      <span className="wizard-choice-section-label">{group.label}</span>
                      <div className="wizard-choice-grid">
                        {group.items.map((type) => (
                          <button
                            key={type.code}
                            type="button"
                            className={cx('wizard-choice-card', createType === type.code && 'active')}
                            onClick={() => selectType(type.code)}
                          >
                            <div>
                              <strong>{type.libelleCourt}</strong>
                              <span>{type.code}</span>
                            </div>
                            {createType === type.code ? <Check size={16} /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </section>
            ) : null}

            {createStep === 'amount' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>Montant</h2>
                </div>
                <div className="wizard-amount">
                  <input
                    {...amountField}
                    ref={(node) => {
                      amountField.ref(node)
                      amountInputRef.current = node
                    }}
                    inputMode="decimal"
                    placeholder="0.00"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        continueFromAmount()
                      }
                    }}
                  />
                </div>
                <div className="wizard-inline-actions">
                  <Button type="button" disabled={!amountReady || compatQuery.isLoading} onClick={continueFromAmount}>
                    Suivant
                  </Button>
                </div>
              </section>
            ) : null}

            {createStep === 'depense' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>{createFlowLabels.depenseStep}</h2>
                </div>

                {compatQuery.isLoading ? (
                  <LoadingState label="Chargement..." />
                ) : depenseIsTechnical ? (
                  <div className="wizard-locked">
                    <Badge>Technique</Badge>
                    <strong>{technicalFallbackId}</strong>
                  </div>
                ) : (
                  <>
                    <label className="search-field search-field-thin">
                      <Search size={14} />
                      <input value={depenseSearch} onChange={(event) => setDepenseSearch(event.target.value)} placeholder="Chercher..." />
                    </label>
                    {!filteredDepenseOptions.length ? (
                      <EmptyState title="Aucun compte" description="Aucun compte compatible." />
                    ) : (
                      <div className="wizard-choice-grid">
                        {filteredDepenseOptions.map((account) => (
                          <button
                            key={account.identifiant}
                            type="button"
                            className={cx('wizard-choice-card', createDepense === account.identifiant && 'active')}
                            onClick={() => selectDepenseAccount(account.identifiant)}
                          >
                            <div>
                              <strong>{account.identifiant}</strong>
                              <span>{account.libelle ?? ' '}</span>
                            </div>
                            {createDepense === account.identifiant ? <Check size={16} /> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : null}

            {createStep === 'recette' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>{createFlowLabels.recetteStep}</h2>
                </div>

                {refinedRecetteQuery.isLoading ? (
                  <LoadingState label="Chargement..." />
                ) : recetteIsTechnical ? (
                  <div className="wizard-locked">
                    <Badge>Technique</Badge>
                    <strong>{technicalFallbackId}</strong>
                  </div>
                ) : (
                  <>
                    <label className="search-field search-field-thin">
                      <Search size={14} />
                      <input value={recetteSearch} onChange={(event) => setRecetteSearch(event.target.value)} placeholder="Chercher..." />
                    </label>
                    {!filteredRecetteOptions.length ? (
                      <EmptyState title="Aucun compte" description="Aucun compte compatible." />
                    ) : (
                      <div className="wizard-choice-grid">
                        {filteredRecetteOptions.map((account) => (
                          <button
                            key={account.identifiant}
                            type="button"
                            className={cx('wizard-choice-card', createRecette === account.identifiant && 'active')}
                            onClick={() => selectRecetteAccount(account.identifiant)}
                          >
                            <div>
                              <strong>{account.identifiant}</strong>
                              <span>{account.libelle ?? ' '}</span>
                            </div>
                            {createRecette === account.identifiant ? <Check size={16} /> : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            ) : null}

            {createStep === 'review' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>Valider</h2>
                </div>

                <div className="wizard-summary">
                  <div className="wizard-summary-card">
                    <span>Type</span>
                    <strong>{selectedType?.libelleCourt ?? createType}</strong>
                  </div>
                  <div className="wizard-summary-card">
                    <span>Montant</span>
                    <strong>{formatCurrencyFromCents(parseMoneyToCents(createAmount))}</strong>
                  </div>
                  <div className="wizard-summary-card">
                    <span>{createFlowLabels.depenseSummary}</span>
                    <strong>{selectedAccountLabel(allAccounts, createDepense || technicalFallbackId)}</strong>
                  </div>
                  <div className="wizard-summary-card">
                    <span>{createFlowLabels.recetteSummary}</span>
                    <strong>{selectedAccountLabel(allAccounts, createRecette || technicalFallbackId)}</strong>
                  </div>
                </div>

                <div className="wizard-inline-actions">
                  <Button type="submit" disabled={createMutation.isPending}>
                    <Save size={16} />
                    Valider
                  </Button>
                  <Button type="button" tone="ghost" onClick={() => setAdvancedOpen((current) => !current)}>
                    {advancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    Options
                  </Button>
                  <button type="button" className="wizard-date-button" onClick={openDateOptions}>
                    {formatShortDate(createDateValeur)}
                  </button>
                </div>

                {advancedOpen ? (
                  <div className="wizard-advanced">
                    <div className="form-grid three-columns">
                      <FormField label="Date">
                        <input
                          type="date"
                          {...dateField}
                          ref={(node) => {
                            dateField.ref(node)
                            dateInputRef.current = node
                          }}
                        />
                      </FormField>

                      <FormField label="Numero">
                        <input {...createForm.register('numero')} placeholder="Facultatif" />
                      </FormField>

                      <FormField label="Libelle">
                        <input {...createForm.register('libelle')} placeholder="Facultatif" />
                      </FormField>
                    </div>

                    {currentTypeNeedsReference ? (
                      <div className="page-stack">
                        <FormField label="Sous-categorie">
                          <select {...createForm.register('nomSousCategorie')}>
                            <option value="">Aucune</option>
                            {(sousCategoriesQuery.data ?? []).map((item) => (
                              <option key={item.nom} value={item.nom}>
                                {item.nom}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <div className="form-field">
                          <span className="form-field-label">Beneficiaires</span>
                          <div className="checkbox-grid">
                            {(beneficiairesQuery.data ?? []).map((item) => {
                              const checked = createBeneficiaries.includes(item.nom)
                              return (
                                <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const values = createForm.getValues('nomsBeneficiaires')
                                      createForm.setValue(
                                        'nomsBeneficiaires',
                                        checked ? values.filter((value) => value !== item.nom) : [...values, item.nom],
                                      )
                                    }}
                                  />
                                  <span>{item.nom}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {(createNumero || createLibelle || createNomSousCategorie || createBeneficiaries.length) ? (
                      <div className="wizard-summary wizard-summary-compact">
                        {createNumero ? (
                          <div className="wizard-summary-card">
                            <span>Numero</span>
                            <strong>{createNumero}</strong>
                          </div>
                        ) : null}
                        {createLibelle ? (
                          <div className="wizard-summary-card">
                            <span>Libelle</span>
                            <strong>{createLibelle}</strong>
                          </div>
                        ) : null}
                        {createNomSousCategorie ? (
                          <div className="wizard-summary-card">
                            <span>Sous-categorie</span>
                            <strong>{createNomSousCategorie}</strong>
                          </div>
                        ) : null}
                        {createBeneficiaries.length ? (
                          <div className="wizard-summary-card">
                            <span>Beneficiaires</span>
                            <strong>{createBeneficiaries.join(', ')}</strong>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
              </form>
            </Surface>
          </div>
        </div>
      ) : null}

      <div className={cx('operations-content', createOpen && 'muted')}>
        {operationsQuery.isLoading ? <LoadingState label="Chargement des operations..." /> : null}
        {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

        <div className="split-layout split-layout-wide">
        <DataPanel title="Historique">
          <FilterBar>
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher une operation..." />
            </label>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="TOUS">Tous les types</option>
              {(typesQuery.data ?? []).map((type) => (
                <option key={type.code} value={type.code}>
                  {type.libelleCourt}
                </option>
              ))}
            </select>
          </FilterBar>

          {!filteredOperations.length ? (
            <EmptyState title="Aucune operation visible" description="La liste est vide ou le filtre ne matche rien." />
          ) : (
            <div className="list-stack">
              {filteredOperations.map((operation) => (
                <button key={operation.numero} className={`list-row ${selectedNumero === operation.numero ? 'selected' : ''}`} onClick={() => setSelectedNumero(operation.numero)}>
                  <div>
                    <strong>{readableOperationLabel(operation)}</strong>
                    <p>
                      {operation.numero} · {formatDate(operation.dateValeur)}
                    </p>
                  </div>
                  <Badge>{operationTypeCode(operation)}</Badge>
                </button>
              ))}
            </div>
          )}
        </DataPanel>

        <Surface className="editor-panel">
          <div className="editor-panel-header">
            <div>
              <span className="eyebrow">Edition</span>
              <h2>{selectedNumero ? `Operation ${selectedNumero}` : 'Selectionne une operation'}</h2>
            </div>
            {selectedNumero ? (
              <Button
                tone="danger"
                onClick={() => {
                  if (window.confirm(`Supprimer l operation ${selectedNumero} ?`)) {
                    void deleteMutation.mutateAsync()
                  }
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
            ) : null}
          </div>

          {!selectedNumero ? (
            <EmptyState title="Aucune operation selectionnee" description="Choisis une ligne dans l historique." />
          ) : detailQuery.isLoading ? (
            <LoadingState label="Chargement du detail..." />
          ) : (
            <form
              className="page-stack"
              onSubmit={editForm.handleSubmit(async (values) => {
                await updateMutation.mutateAsync(values)
              })}
            >
              <div className="form-grid three-columns">
                <FormField label="Numero">
                  <input {...editForm.register('numero')} />
                </FormField>

                  <FormField label="Type">
                    <select {...editForm.register('codeTypeOperation')}>
                      <option value="">Type actuel</option>
                      {(typesQuery.data ?? []).map((type) => (
                        <option key={type.code} value={type.code}>
                          {type.libelleCourt}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Date">
                    <input type="date" {...editForm.register('dateValeur')} />
                  </FormField>

                  <FormField label="Montant">
                    <input {...editForm.register('montant')} inputMode="decimal" />
                  </FormField>

                  <FormField label={editFlowLabels.depenseStep}>
                    <select {...editForm.register('identifiantCompteDepense')}>
                      <option value="">Choisir</option>
                      {allAccounts.map((account) => (
                        <option key={account.identifiant} value={account.identifiant}>
                          {accountChoiceLabel(account)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label={editFlowLabels.recetteStep}>
                    <select {...editForm.register('identifiantCompteRecette')}>
                      <option value="">Choisir</option>
                      {allAccounts.map((account) => (
                        <option key={account.identifiant} value={account.identifiant}>
                          {accountChoiceLabel(account)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                <FormField label="Libelle">
                  <textarea {...editForm.register('libelle')} rows={3} />
                </FormField>

                <label className="toggle-inline">
                  <input type="checkbox" {...editForm.register('pointee')} />
                  <span>Operation pointee</span>
                </label>
              </div>

              <SectionHeader
                title="Lignes de detail"
                subtitle="Somme coherente avec le montant."
                aside={
                  <Button
                    type="button"
                    tone="ghost"
                    onClick={() =>
                      lineFieldArray.append({
                        numeroLigne: null,
                        libelle: '',
                        dateComptabilisation: editForm.getValues('dateValeur') || todayIso(),
                        montant: '',
                        nomSousCategorie: '',
                        nomsBeneficiaires: [],
                      })
                    }
                  >
                    <Plus size={16} />
                    Ajouter une ligne
                  </Button>
                }
              />

              <div className="page-stack">
                {lineFieldArray.fields.map((field, index) => {
                  const currentBenefs = watchedLines[index]?.nomsBeneficiaires ?? []
                  return (
                    <Surface key={field.id} className="nested-panel">
                      <div className="section-header">
                        <div>
                          <h2>Ligne {field.numeroLigne ?? 'nouvelle'}</h2>
                        </div>
                        <Button type="button" tone="danger" onClick={() => lineFieldArray.remove(index)}>
                          <Trash2 size={16} />
                          Retirer
                        </Button>
                      </div>

                      <div className="form-grid three-columns">
                        <FormField label="Libelle">
                          <input {...editForm.register(`lignes.${index}.libelle`)} />
                        </FormField>

                          <FormField label="Date de comptabilisation">
                            <input type="date" {...editForm.register(`lignes.${index}.dateComptabilisation`)} />
                          </FormField>

                          <FormField label="Montant">
                            <input {...editForm.register(`lignes.${index}.montant`)} inputMode="decimal" />
                          </FormField>

                          <FormField label="Sous-categorie">
                            <select {...editForm.register(`lignes.${index}.nomSousCategorie`)}>
                              <option value="">Aucune</option>
                              {(sousCategoriesQuery.data ?? []).map((item) => (
                                <option key={item.nom} value={item.nom}>
                                  {item.nom}
                                </option>
                              ))}
                            </select>
                          </FormField>

                          <div className="form-field full-span">
                            <span className="form-field-label">Beneficiaires</span>
                            <div className="checkbox-grid">
                              {(beneficiairesQuery.data ?? []).map((item) => {
                                const checked = currentBenefs.includes(item.nom)
                                return (
                                  <label key={item.nom} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        const current = editForm.getValues(`lignes.${index}.nomsBeneficiaires`)
                                        editForm.setValue(
                                          `lignes.${index}.nomsBeneficiaires`,
                                          checked ? current.filter((value) => value !== item.nom) : [...current, item.nom],
                                        )
                                      }}
                                    />
                                    <span>{item.nom}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                      </div>
                    </Surface>
                  )
                })}
              </div>

              <div className="button-row">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save size={16} />
                  Sauvegarder
                </Button>
              </div>
            </form>
          )}
        </Surface>
      </div>
    </div>
    </div>
  )
}
