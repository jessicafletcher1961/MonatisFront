import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronDown, Pencil, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Badge, Button, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, SectionHeader, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { formatCurrencyFromCents, formatDate, nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../lib/format'
import { apiErrorMessage, type CompteSummary, type OperationBasic, type OperationLinePayload, type ReferenceListItem, type TypeOperation, monatisApi } from '../lib/monatis-api'
import { readableOperationLabel, sortOperationsDesc, technicalAccountFallback } from '../lib/reporting'

const operationLineSchema = z.object({
  numeroLigne: z.number().nullable().optional(),
  libelle: z.string().optional(),
  dateComptabilisation: z.string().optional(),
  montant: z.string().optional(),
  nomSousCategorie: z.string().optional(),
  nomsBeneficiaires: z.array(z.string()),
})

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
  lignes: z.array(operationLineSchema),
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
  lignes: z.array(operationLineSchema),
})

type OperationLineFormValues = z.infer<typeof operationLineSchema>
type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>
type CreateStep = 'type' | 'depense' | 'recette' | 'amount' | 'review'
type QuickEditTarget = 'type' | 'depense' | 'recette' | 'amount' | null
type OperationTypeGroup = 'incoming' | 'outgoing' | 'internal' | 'technical' | 'other'
type SubCategoryPickerTarget =
  | { kind: 'create' }
  | { kind: 'createLine'; index: number }
  | { kind: 'newCreateLine' }
  | { kind: 'line'; index: number }
  | { kind: 'newLine' }
  | null

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
  lignes: [],
}

const OPERATION_TYPE_GROUP_META: Array<{ key: OperationTypeGroup; label: string }> = [
  { key: 'incoming', label: 'Exterieur vers le foyer' },
  { key: 'outgoing', label: 'Foyer vers l exterieur' },
  { key: 'internal', label: 'Interne vers interne' },
  { key: 'technical', label: 'Mouvements du compte' },
  { key: 'other', label: 'Autre' },
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

function beneficiaryNamesForDisplay(line: OperationBasic['lignes'][number]): string[] {
  return line.nomsBeneficiaires ?? line.beneficiaires?.map((item) => item.nom) ?? []
}

function subCategoryNameForLine(line: OperationBasic['lignes'][number]): string {
  return line.nomSousCategorie?.trim() || line.sousCategorie?.nom?.trim() || ''
}

function makeOperationLineValues(date: string): OperationLineFormValues {
  return {
    numeroLigne: null,
    libelle: '',
    dateComptabilisation: date,
    montant: '',
    nomSousCategorie: '',
    nomsBeneficiaires: [],
  }
}

function normalizeOperationLineValues(line?: Partial<OperationLineFormValues> | null): OperationLineFormValues {
  return {
    numeroLigne: line?.numeroLigne ?? null,
    libelle: line?.libelle ?? '',
    dateComptabilisation: line?.dateComptabilisation ?? '',
    montant: line?.montant ?? '',
    nomSousCategorie: line?.nomSousCategorie ?? '',
    nomsBeneficiaires: [...(line?.nomsBeneficiaires ?? [])].sort((left, right) => left.localeCompare(right)),
  }
}

function operationLineValuesEqual(left?: Partial<OperationLineFormValues> | null, right?: Partial<OperationLineFormValues> | null): boolean {
  const a = normalizeOperationLineValues(left)
  const b = normalizeOperationLineValues(right)

  return (
    a.numeroLigne === b.numeroLigne &&
    a.libelle === b.libelle &&
    a.dateComptabilisation === b.dateComptabilisation &&
    a.montant === b.montant &&
    a.nomSousCategorie === b.nomSousCategorie &&
    a.nomsBeneficiaires.length === b.nomsBeneficiaires.length &&
    a.nomsBeneficiaires.every((value, index) => value === b.nomsBeneficiaires[index])
  )
}

function operationLineValuesEqualIgnoringAmount(left?: Partial<OperationLineFormValues> | null, right?: Partial<OperationLineFormValues> | null): boolean {
  const a = normalizeOperationLineValues(left)
  const b = normalizeOperationLineValues(right)

  return (
    a.numeroLigne === b.numeroLigne &&
    a.libelle === b.libelle &&
    a.dateComptabilisation === b.dateComptabilisation &&
    a.nomSousCategorie === b.nomSousCategorie &&
    a.nomsBeneficiaires.length === b.nomsBeneficiaires.length &&
    a.nomsBeneficiaires.every((value, index) => value === b.nomsBeneficiaires[index])
  )
}

function buildOperationLinePayloads(lines: OperationLineFormValues[]): OperationLinePayload[] {
  return lines
    .filter((line) => (line.montant?.trim() ?? '') !== '')
    .map((line) => ({
      numeroLigne: line.numeroLigne,
      libelle: nullIfBlank(line.libelle ?? ''),
      dateComptabilisation: nullIfBlank(line.dateComptabilisation ?? ''),
      montantEnCentimes: parseMoneyToCents(line.montant ?? '0'),
      nomSousCategorie: nullIfBlank(line.nomSousCategorie ?? ''),
      nomsBeneficiaires: line.nomsBeneficiaires ?? [],
    }))
}

function sumOperationLinePayloads(lines: OperationLinePayload[]): number {
  return lines.reduce((total, line) => total + (line.montantEnCentimes ?? 0), 0)
}

function sumOperationLineValues(lines: Array<Partial<OperationLineFormValues> | undefined>, excludedIndex?: number): number {
  return lines.reduce((total, line, index) => {
    if (index === excludedIndex) {
      return total
    }

    return total + parseMoneyToCents(line?.montant ?? '')
  }, 0)
}

function primaryLineIndex(lines: Array<Partial<OperationLineFormValues> | undefined>): number {
  if (!lines.length) {
    return -1
  }

  const explicitIndex = lines.findIndex((line) => (line?.numeroLigne ?? null) === 0)
  return explicitIndex === -1 ? 0 : explicitIndex
}

function remainingAmountForPrimaryLine(totalCents: number, lines: Array<Partial<OperationLineFormValues> | undefined>, primaryIndex: number): number {
  if (primaryIndex === -1) {
    return Math.max(0, totalCents)
  }

  return Math.max(0, totalCents - sumOperationLineValues(lines, primaryIndex))
}

function maxAllowedAmountForLine(
  totalCents: number,
  lines: Array<Partial<OperationLineFormValues> | undefined>,
  index: number,
  primaryIndex = -1,
): number {
  if (primaryIndex !== -1) {
    if (index === primaryIndex) {
      return remainingAmountForPrimaryLine(totalCents, lines, primaryIndex)
    }

    return Math.max(
      0,
      totalCents -
        lines.reduce((total, line, lineIndex) => {
          if (lineIndex === index || lineIndex === primaryIndex) {
            return total
          }

          return total + parseMoneyToCents(line?.montant ?? '')
        }, 0),
    )
  }

  return Math.max(0, totalCents - sumOperationLineValues(lines, index))
}

function amountLimitMessage(
  totalCents: number,
  lines: Array<Partial<OperationLineFormValues> | undefined>,
  index: number,
  primaryIndex = -1,
): string | null {
  if (index === primaryIndex) {
    return null
  }

  const current = parseMoneyToCents(lines[index]?.montant ?? '')
  const max = maxAllowedAmountForLine(totalCents, lines, index, primaryIndex)
  return current > max ? `Max ${formatCurrencyFromCents(max)}` : null
}

function maxAllowedAmountForNewLine(totalCents: number, lines: Array<Partial<OperationLineFormValues> | undefined>, primaryIndex = -1): number {
  if (primaryIndex !== -1) {
    return Math.max(
      0,
      totalCents -
        lines.reduce((total, line, index) => {
          if (index === primaryIndex) {
            return total
          }

          return total + parseMoneyToCents(line?.montant ?? '')
        }, 0),
    )
  }

  return Math.max(0, totalCents - sumOperationLineValues(lines))
}

function amountLimitMessageForNewLine(
  totalCents: number,
  lines: Array<Partial<OperationLineFormValues> | undefined>,
  amount: string,
  primaryIndex = -1,
): string | null {
  const current = parseMoneyToCents(amount)
  const max = maxAllowedAmountForNewLine(totalCents, lines, primaryIndex)
  return current > max ? `Max ${formatCurrencyFromCents(max)}` : null
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
  if (['RECETTE', 'ACHAT'].includes(code)) {
    return 'incoming'
  }

  if (['DEPENSE', 'VENTE'].includes(code)) {
    return 'outgoing'
  }

  if (['TRANSFERT', 'DEPOT', 'INVEST', 'RETRAIT', 'LIQUID'].includes(code)) {
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

function typeOrderInGroup(code: string): number {
  const explicitOrder: Record<string, number> = {
    RECETTE: 0,
    ACHAT: 1,
  }

  return explicitOrder[code] ?? 99
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
      depenseStep: 'Origine',
      recetteStep: 'Compte du foyer',
      depenseSummary: 'Origine',
      recetteSummary: 'Compte du foyer',
    }
  }

  if (group === 'outgoing') {
    return {
      depenseStep: 'Compte du foyer',
      recetteStep: 'Destination',
      depenseSummary: 'Compte du foyer',
      recetteSummary: 'Destination',
    }
  }

  if (group === 'technical') {
    return {
      depenseStep: 'Compte concerne',
      recetteStep: 'Contrepartie',
      depenseSummary: 'Compte concerne',
      recetteSummary: 'Contrepartie',
    }
  }

  return {
    depenseStep: 'Compte source',
    recetteStep: "Compte d arrivee",
    depenseSummary: 'Compte source',
    recetteSummary: 'Compte d arrivee',
  }
}

function selectedAccountLabel(accounts: CompteSummary[], identifiant: string): string {
  return accounts.find((account) => account.identifiant === identifiant)?.identifiant ?? identifiant
}

function compactOperationMeta(operation: OperationBasic): string {
  return [operation.numero, formatDate(operation.dateValeur)].join(' · ')
}

function previewTip(label: string, value: string): string {
  return `${label}. ${value.trim() || 'Vide'}`
}

export function OperationsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedNumero, setSelectedNumero] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([])
  const [typeFilterPickerOpen, setTypeFilterPickerOpen] = useState(false)
  const [typeFilterSearch, setTypeFilterSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('type')
  const [createOptionsOpen, setCreateOptionsOpen] = useState(false)
  const [expandedCreateLineIndex, setExpandedCreateLineIndex] = useState<number | null>(null)
  const [createLineCreateOpen, setCreateLineCreateOpen] = useState(false)
  const [createLineBaselines, setCreateLineBaselines] = useState<OperationLineFormValues[]>([])
  const [quickEditTarget, setQuickEditTarget] = useState<QuickEditTarget>(null)
  const [typeSearch, setTypeSearch] = useState('')
  const [depenseSearch, setDepenseSearch] = useState('')
  const [recetteSearch, setRecetteSearch] = useState('')
  const [expandedLineIndex, setExpandedLineIndex] = useState<number | null>(null)
  const [lineCreateOpen, setLineCreateOpen] = useState(false)
  const [lineBudgetCents, setLineBudgetCents] = useState<number | null>(null)
  const [detailLineBaselines, setDetailLineBaselines] = useState<OperationLineFormValues[]>([])
  const [openCategoryNames, setOpenCategoryNames] = useState<string[]>([])
  const [subCategoryPickerTarget, setSubCategoryPickerTarget] = useState<SubCategoryPickerTarget>(null)
  const [subCategorySearch, setSubCategorySearch] = useState('')
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const quickAmountInputRef = useRef<HTMLInputElement | null>(null)
  const createOptionsPanelRef = useRef<HTMLDivElement | null>(null)
  const createLineCardRefs = useRef<Array<HTMLDivElement | null>>([])
  const lineCardRefs = useRef<Array<HTMLDivElement | null>>([])
  const deferredSearch = useDeferredValue(search)
  const deferredTypeSearch = useDeferredValue(typeSearch)
  const deferredDepenseSearch = useDeferredValue(depenseSearch)
  const deferredRecetteSearch = useDeferredValue(recetteSearch)
  const deferredTypeFilterSearch = useDeferredValue(typeFilterSearch)
  const deferredSubCategorySearch = useDeferredValue(subCategorySearch)

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

  const categoriesQuery = useQuery({
    queryKey: ['references', 'categorie'],
    queryFn: () => monatisApi.listReferences('categorie'),
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
  const createLineFieldArray = useFieldArray({
    control: createForm.control,
    name: 'lignes',
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
  const newLineForm = useForm<OperationLineFormValues>({
    resolver: zodResolver(operationLineSchema),
    defaultValues: makeOperationLineValues(todayIso()),
  })
  const newCreateLineForm = useForm<OperationLineFormValues>({
    resolver: zodResolver(operationLineSchema),
    defaultValues: makeOperationLineValues(todayIso()),
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
  const watchedCreateBeneficiaries = useWatch({ control: createForm.control, name: 'nomsBeneficiaires' })
  const createBeneficiaries = useMemo(() => watchedCreateBeneficiaries ?? [], [watchedCreateBeneficiaries])
  const watchedCreateLines = useWatch({ control: createForm.control, name: 'lignes' })
  const createLines = useMemo(() => watchedCreateLines ?? [], [watchedCreateLines])
  const editType = useWatch({ control: editForm.control, name: 'codeTypeOperation' }) ?? ''
  const editAmount = useWatch({ control: editForm.control, name: 'montant' }) ?? ''
  const editDepense = useWatch({ control: editForm.control, name: 'identifiantCompteDepense' }) ?? ''
  const editRecette = useWatch({ control: editForm.control, name: 'identifiantCompteRecette' }) ?? ''
  const editDateValeur = useWatch({ control: editForm.control, name: 'dateValeur' }) ?? ''
  const editNumero = useWatch({ control: editForm.control, name: 'numero' }) ?? ''
  const editLibelle = useWatch({ control: editForm.control, name: 'libelle' }) ?? ''
  const editPointee = useWatch({ control: editForm.control, name: 'pointee' }) ?? false
  const watchedEditLines = useWatch({ control: editForm.control, name: 'lignes' })
  const watchedLines = useMemo(() => watchedEditLines ?? [], [watchedEditLines])
  const newLineBeneficiaries = useWatch({ control: newLineForm.control, name: 'nomsBeneficiaires' }) ?? []
  const newLineSubCategory = useWatch({ control: newLineForm.control, name: 'nomSousCategorie' }) ?? ''
  const newLineAmount = useWatch({ control: newLineForm.control, name: 'montant' }) ?? ''
  const newCreateLineBeneficiaries = useWatch({ control: newCreateLineForm.control, name: 'nomsBeneficiaires' }) ?? []
  const newCreateLineSubCategory = useWatch({ control: newCreateLineForm.control, name: 'nomSousCategorie' }) ?? ''
  const newCreateLineAmount = useWatch({ control: newCreateLineForm.control, name: 'montant' }) ?? ''
  const amountReady = Boolean(createAmount.trim())
  const createLinePayloads = useMemo(() => buildOperationLinePayloads(createLines), [createLines])
  const createEffectiveAmountCents = parseMoneyToCents(createAmount || '0')

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

    const mappedLines = detailQuery.data.lignes.map((line, index) => ({
      numeroLigne: line.numeroLigne,
      libelle: line.libelle ?? '',
      dateComptabilisation: line.dateComptabilisation ?? detailQuery.data.dateValeur,
      montant: toMoneyInput(line.montantEnCentimes),
      nomSousCategorie: subCategoryNameForLine(line),
      nomsBeneficiaires: beneficiariesForLine(detailQuery.data, index),
    }))

    editForm.reset({
      numero: detailQuery.data.numero,
      libelle: detailQuery.data.libelle ?? '',
      codeTypeOperation: operationTypeCode(detailQuery.data),
      dateValeur: detailQuery.data.dateValeur,
      montant: toMoneyInput(detailQuery.data.montantEnCentimes),
      identifiantCompteDepense: depenseId(detailQuery.data),
      identifiantCompteRecette: recetteId(detailQuery.data),
      pointee: detailQuery.data.pointee,
      lignes: mappedLines,
    })
    const frame = window.requestAnimationFrame(() => {
      setDetailLineBaselines(mappedLines.map((line) => normalizeOperationLineValues(line)))
    })

    return () => window.cancelAnimationFrame(frame)
  }, [detailQuery.data, editForm])

  const technicalFallbackId = technicalAccountFallback(technicalAccountsQuery.data ?? [])

  useEffect(() => {
    if (!createType || !compatQuery.data || !technicalFallbackId) {
      return
    }

    if (createStep === 'depense' && compatQuery.data.comptesCompatiblesDepense === null) {
      if (createDepense !== technicalFallbackId) {
        createForm.setValue('identifiantCompteDepense', technicalFallbackId)
      }

      if (compatQuery.data.comptesCompatiblesRecette === null) {
        if (createRecette !== technicalFallbackId) {
          createForm.setValue('identifiantCompteRecette', technicalFallbackId)
        }
        window.requestAnimationFrame(() => setCreateStep('amount'))
        return
      }

      window.requestAnimationFrame(() => setCreateStep('recette'))
      return
    }

    if (createStep === 'recette' && compatQuery.data.comptesCompatiblesRecette === null) {
      if (createRecette !== technicalFallbackId) {
        createForm.setValue('identifiantCompteRecette', technicalFallbackId)
      }
      window.requestAnimationFrame(() => setCreateStep('amount'))
    }
  }, [compatQuery.data, createDepense, createForm, createRecette, createStep, createType, technicalFallbackId])

  useEffect(() => {
    if (!createType || !compatQuery.data || !technicalFallbackId || !quickEditTarget) {
      return
    }

    if (quickEditTarget === 'depense' && compatQuery.data.comptesCompatiblesDepense === null) {
      if (createDepense !== technicalFallbackId) {
        createForm.setValue('identifiantCompteDepense', technicalFallbackId)
      }

      if (compatQuery.data.comptesCompatiblesRecette === null) {
        if (createRecette !== technicalFallbackId) {
          createForm.setValue('identifiantCompteRecette', technicalFallbackId)
        }
        window.requestAnimationFrame(() => setQuickEditTarget(amountReady ? null : 'amount'))
        return
      }

      window.requestAnimationFrame(() => setQuickEditTarget('recette'))
      return
    }

    if (quickEditTarget === 'recette' && compatQuery.data.comptesCompatiblesRecette === null) {
      if (createRecette !== technicalFallbackId) {
        createForm.setValue('identifiantCompteRecette', technicalFallbackId)
      }
      window.requestAnimationFrame(() => setQuickEditTarget(amountReady ? null : 'amount'))
    }
  }, [amountReady, compatQuery.data, createDepense, createForm, createRecette, createType, quickEditTarget, technicalFallbackId])

  useEffect(() => {
    if (!(location.state as { openCreate?: boolean } | null)?.openCreate) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createForm.reset(CREATE_DEFAULTS)
      setCreateStep('type')
      setCreateOptionsOpen(false)
      setExpandedCreateLineIndex(null)
      setCreateLineCreateOpen(false)
      setCreateLineBaselines([])
      setQuickEditTarget(null)
      setTypeSearch('')
      setDepenseSearch('')
      setRecetteSearch('')
      setTypeFilterSearch('')
      setOpenCategoryNames([])
      setSubCategoryPickerTarget(null)
      setSubCategorySearch('')
      newCreateLineForm.reset(makeOperationLineValues(todayIso()))
      setCreateOpen(true)
      navigate(location.pathname, { replace: true, state: null })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createForm, location.pathname, location.state, navigate, newCreateLineForm])

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

  useEffect(() => {
    if (quickEditTarget !== 'amount') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      quickAmountInputRef.current?.focus()
      quickAmountInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [quickEditTarget])

  useEffect(() => {
    if (!createOpen || createStep !== 'review' || !createOptionsOpen) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createOptionsPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createOpen, createOptionsOpen, createStep])

  useEffect(() => {
    if (!createOpen || !createOptionsOpen || expandedCreateLineIndex == null) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createLineCardRefs.current[expandedCreateLineIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createOpen, createOptionsOpen, expandedCreateLineIndex])

  useEffect(() => {
    if (expandedLineIndex == null) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      lineCardRefs.current[expandedLineIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [expandedLineIndex])

  const depenseOptions = useMemo(() => compatQuery.data?.comptesCompatiblesDepense ?? [], [compatQuery.data?.comptesCompatiblesDepense])
  const recetteOptions = useMemo(
    () => refinedRecetteQuery.data?.comptesCompatiblesRecette ?? compatQuery.data?.comptesCompatiblesRecette ?? [],
    [compatQuery.data?.comptesCompatiblesRecette, refinedRecetteQuery.data?.comptesCompatiblesRecette],
  )

  const filteredOperations = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()
    const items = sortOperationsDesc(operationsQuery.data ?? [])

    return items.filter((operation) => {
      if (selectedTypeFilters.length && !selectedTypeFilters.includes(operationTypeCode(operation))) {
        return false
      }

      if (!needle) {
        return true
      }

      return [
        operation.numero,
        operation.libelle,
        operationTypeCode(operation),
        depenseId(operation),
        recetteId(operation),
        toMoneyInput(operation.montantEnCentimes),
        formatCurrencyFromCents(operation.montantEnCentimes),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredSearch, operationsQuery.data, selectedTypeFilters])

  const selectedOperationSummary = useMemo(
    () => (operationsQuery.data ?? []).find((operation) => operation.numero === selectedNumero) ?? null,
    [operationsQuery.data, selectedNumero],
  )
  const createDefinedAmountCents = parseMoneyToCents(createAmount || '0')
  const createPrimaryLineIndex = useMemo(() => primaryLineIndex(createLines), [createLines])
  const createPrimaryRemainingCents = useMemo(
    () => remainingAmountForPrimaryLine(createDefinedAmountCents, createLines, createPrimaryLineIndex),
    [createDefinedAmountCents, createLines, createPrimaryLineIndex],
  )
  const createLineErrors = useMemo(
    () => createLines.map((_, index) => amountLimitMessage(createDefinedAmountCents, createLines, index, createPrimaryLineIndex)),
    [createDefinedAmountCents, createLines, createPrimaryLineIndex],
  )
  const hasCreateLineOverflow = createLineErrors.some(Boolean)
  const hasCreateLineDrafts = createLines.some((line, index) => index !== createPrimaryLineIndex && !operationLineValuesEqual(line, createLineBaselines[index]))
  const createLineTotalCents = sumOperationLinePayloads(createLinePayloads)
  const createLineGapCents = createDefinedAmountCents - createLineTotalCents
  const createLineTotalMismatch = Boolean(createLines.length) && createLineGapCents !== 0
  const currentLineBudgetCents =
    (editAmount.trim() ? parseMoneyToCents(editAmount) : null) ?? lineBudgetCents ?? selectedOperationSummary?.montantEnCentimes ?? detailQuery.data?.montantEnCentimes ?? 0
  const detailPrimaryLineIndex = useMemo(() => primaryLineIndex(watchedLines), [watchedLines])
  const detailPrimaryRemainingCents = useMemo(
    () => remainingAmountForPrimaryLine(currentLineBudgetCents, watchedLines, detailPrimaryLineIndex),
    [currentLineBudgetCents, detailPrimaryLineIndex, watchedLines],
  )
  const detailLineErrors = useMemo(
    () => watchedLines.map((_, index) => amountLimitMessage(currentLineBudgetCents, watchedLines, index, detailPrimaryLineIndex)),
    [currentLineBudgetCents, detailPrimaryLineIndex, watchedLines],
  )
  const hasDetailLineOverflow = detailLineErrors.some(Boolean)
  const detailLinePayloads = useMemo(() => buildOperationLinePayloads(watchedLines), [watchedLines])
  const detailLineTotalCents = sumOperationLinePayloads(detailLinePayloads)
  const detailLineGapCents = currentLineBudgetCents - detailLineTotalCents
  const detailLineTotalMismatch = Boolean(watchedLines.length) && detailLineGapCents !== 0
  const hasDetailLineDrafts = watchedLines.some((_, index) => lineIsDirty(index))
  const newLineAmountError = useMemo(
    () => amountLimitMessageForNewLine(currentLineBudgetCents, watchedLines, newLineAmount, detailPrimaryLineIndex),
    [currentLineBudgetCents, detailPrimaryLineIndex, newLineAmount, watchedLines],
  )
  const newLineMaxCents = useMemo(
    () => maxAllowedAmountForNewLine(currentLineBudgetCents, watchedLines, detailPrimaryLineIndex),
    [currentLineBudgetCents, detailPrimaryLineIndex, watchedLines],
  )
  const newCreateLineAmountError = useMemo(
    () => amountLimitMessageForNewLine(createDefinedAmountCents, createLines, newCreateLineAmount, createPrimaryLineIndex),
    [createDefinedAmountCents, createLines, createPrimaryLineIndex, newCreateLineAmount],
  )
  const newCreateLineMaxCents = useMemo(
    () => maxAllowedAmountForNewLine(createDefinedAmountCents, createLines, createPrimaryLineIndex),
    [createDefinedAmountCents, createLines, createPrimaryLineIndex],
  )

  useEffect(() => {
    if (createPrimaryLineIndex === -1) {
      return
    }

    const currentAmount = parseMoneyToCents(createLines[createPrimaryLineIndex]?.montant ?? '')
    if (currentAmount !== createPrimaryRemainingCents) {
      createForm.setValue(`lignes.${createPrimaryLineIndex}.montant`, toMoneyInput(createPrimaryRemainingCents), { shouldDirty: false })
    }
  }, [createForm, createLines, createPrimaryLineIndex, createPrimaryRemainingCents])

  useEffect(() => {
    if (createPrimaryLineIndex === -1) {
      return
    }

    const nextBeneficiaries = [...createBeneficiaries].sort((left, right) => left.localeCompare(right))
    const currentPrimaryLine = createLines[createPrimaryLineIndex]
    const currentBeneficiaries = [...(currentPrimaryLine?.nomsBeneficiaires ?? [])].sort((left, right) => left.localeCompare(right))

    if ((currentPrimaryLine?.libelle ?? '') !== createLibelle) {
      createForm.setValue(`lignes.${createPrimaryLineIndex}.libelle`, createLibelle, { shouldDirty: false })
    }

    if ((currentPrimaryLine?.dateComptabilisation ?? '') !== createDateValeur) {
      createForm.setValue(`lignes.${createPrimaryLineIndex}.dateComptabilisation`, createDateValeur, { shouldDirty: false })
    }

    if ((currentPrimaryLine?.nomSousCategorie ?? '') !== createNomSousCategorie) {
      createForm.setValue(`lignes.${createPrimaryLineIndex}.nomSousCategorie`, createNomSousCategorie, { shouldDirty: false })
    }

    if (
      currentBeneficiaries.length !== nextBeneficiaries.length ||
      currentBeneficiaries.some((value, index) => value !== nextBeneficiaries[index])
    ) {
      createForm.setValue(`lignes.${createPrimaryLineIndex}.nomsBeneficiaires`, nextBeneficiaries, { shouldDirty: false })
    }
  }, [createBeneficiaries, createDateValeur, createForm, createLibelle, createLines, createNomSousCategorie, createPrimaryLineIndex])

  useEffect(() => {
    if (detailPrimaryLineIndex === -1) {
      return
    }

    const currentAmount = parseMoneyToCents(watchedLines[detailPrimaryLineIndex]?.montant ?? '')
    if (currentAmount !== detailPrimaryRemainingCents) {
      editForm.setValue(`lignes.${detailPrimaryLineIndex}.montant`, toMoneyInput(detailPrimaryRemainingCents), { shouldDirty: false })
    }
  }, [detailPrimaryLineIndex, detailPrimaryRemainingCents, editForm, watchedLines])

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

        const rankGap = typeOrderInGroup(left.code) - typeOrderInGroup(right.code)
        if (rankGap !== 0) {
          return rankGap
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

  const filteredFilterOperationTypes = useMemo(
    () =>
      sortedOperationTypes.filter((type) =>
        matchesNeedle(`${type.code} ${type.libelleCourt} ${type.libelle}`, deferredTypeFilterSearch),
      ),
    [deferredTypeFilterSearch, sortedOperationTypes],
  )

  const groupedFilterOperationTypes = useMemo(
    () =>
      OPERATION_TYPE_GROUP_META.map((group) => ({
        ...group,
        items: filteredFilterOperationTypes.filter((type) => operationTypeGroup(type.code) === group.key),
      })).filter((group) => group.items.length),
    [filteredFilterOperationTypes],
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
  const selectedTypeFilterItems = useMemo(
    () => sortedOperationTypes.filter((type) => selectedTypeFilters.includes(type.code)),
    [selectedTypeFilters, sortedOperationTypes],
  )
  const createFlowLabels = useMemo(() => flowLabelsForType(createType), [createType])
  const editFlowLabels = useMemo(
    () => flowLabelsForType(editType || detailQuery.data?.typeOperation?.code || detailQuery.data?.codeTypeOperation || ''),
    [detailQuery.data?.codeTypeOperation, detailQuery.data?.typeOperation?.code, editType],
  )
  const detailReferenceSummary = useMemo(() => {
    if (!detailQuery.data && !watchedLines.length) {
      return {
        subCategories: [] as string[],
        beneficiaries: [] as string[],
      }
    }

    const sourceLines = watchedLines.length
      ? watchedLines.map((line) => ({
          nomSousCategorie: line.nomSousCategorie?.trim() ?? '',
          nomsBeneficiaires: line.nomsBeneficiaires ?? [],
        }))
      : (detailQuery.data?.lignes ?? []).map((line) => ({
          nomSousCategorie: subCategoryNameForLine(line),
          nomsBeneficiaires: beneficiaryNamesForDisplay(line),
        }))

    const subCategories = Array.from(new Set(sourceLines.map((line) => line.nomSousCategorie).filter(Boolean)))
    const beneficiaries = Array.from(new Set(sourceLines.flatMap((line) => line.nomsBeneficiaires).filter(Boolean)))

    return { subCategories, beneficiaries }
  }, [detailQuery.data, watchedLines])

  const categoriesByName = useMemo(() => {
    const categories = categoriesQuery.data ?? []
    const sousCategories = sousCategoriesQuery.data ?? []
    const map = new Map<string, ReferenceListItem[]>()

    categories.forEach((category) => {
      map.set(category.nom, [])
    })

    sousCategories.forEach((item) => {
      const categoryName = item.nomCategorie ?? 'Sans categorie'
      map.set(categoryName, [...(map.get(categoryName) ?? []), item])
    })

    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items: [...items].sort((left, right) => left.nom.localeCompare(right.nom)),
    }))
  }, [categoriesQuery.data, sousCategoriesQuery.data])

  const filteredSubCategories = useMemo(
    () =>
      (sousCategoriesQuery.data ?? []).filter((item) =>
        matchesNeedle(`${item.nom} ${item.nomCategorie ?? ''} ${item.libelle ?? ''}`, deferredSubCategorySearch),
      ),
    [deferredSubCategorySearch, sousCategoriesQuery.data],
  )

  const createMutation = useMutation({
    mutationFn: (values: CreateFormValues) => {
      return monatisApi.createOperation({
        numero: nullIfBlank(values.numero ?? ''),
        libelle: nullIfBlank(values.libelle ?? ''),
        codeTypeOperation: values.codeTypeOperation,
        dateValeur: nullIfBlank(values.dateValeur ?? ''),
        montantEnCentimes: parseMoneyToCents(values.montant),
        identifiantCompteDepense: values.identifiantCompteDepense?.trim() || technicalFallbackId,
        identifiantCompteRecette: values.identifiantCompteRecette?.trim() || technicalFallbackId,
        nomSousCategorie: nullIfBlank(values.nomSousCategorie ?? ''),
        nomsBeneficiaires: values.nomsBeneficiaires,
      })
    },
    onSuccess: async (response, values) => {
      const lines = buildOperationLinePayloads(values.lignes ?? []).map((line) => ({
        ...line,
        numeroLigne: null,
      }))

      if (lines.length) {
        await monatisApi.updateOperation(response.numero, {
          numero: null,
          libelle: null,
          codeTypeOperation: null,
          dateValeur: null,
          montantEnCentimes: parseMoneyToCents(values.montant),
          identifiantCompteDepense: null,
          identifiantCompteRecette: null,
          pointee: null,
          lignes: lines.map((line) => ({
            numeroLigne: line.numeroLigne,
            libelle: line.libelle,
            dateComptabilisation: line.dateComptabilisation,
            montantEnCentimes: line.montantEnCentimes,
            nomSousCategorie: line.nomSousCategorie,
            nomsBeneficiaires: line.nomsBeneficiaires,
          })),
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['operations'] })
      setSelectedNumero(null)
      setExpandedLineIndex(null)
      resetCreateFlow()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const lignes = buildOperationLinePayloads(values.lignes ?? [])

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
      setLineBudgetCents(null)
      setSelectedNumero(null)
      setExpandedLineIndex(null)
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
      setDetailLineBaselines([])
    },
  })

  const hasError =
    operationsQuery.error ||
    detailQuery.error ||
    typesQuery.error ||
    internalAccountsQuery.error ||
    externalAccountsQuery.error ||
    technicalAccountsQuery.error ||
    categoriesQuery.error ||
    sousCategoriesQuery.error ||
    beneficiairesQuery.error ||
    compatQuery.error ||
    refinedRecetteQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error

  const currentTypeNeedsReference = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(createType)
  const depenseIsTechnical = compatQuery.data?.comptesCompatiblesDepense === null
  const recetteIsTechnical = compatQuery.data?.comptesCompatiblesRecette === null
  const depenseReady = depenseIsTechnical ? Boolean(technicalFallbackId) : Boolean(createDepense)
  const recetteReady = recetteIsTechnical ? Boolean(technicalFallbackId) : Boolean(createRecette)
  const createReady = Boolean(createType) && amountReady && depenseReady && recetteReady

  function resetCreateFlow() {
    createForm.reset(CREATE_DEFAULTS)
    setCreateStep('type')
    setCreateOptionsOpen(false)
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setQuickEditTarget(null)
    setTypeSearch('')
    setDepenseSearch('')
    setRecetteSearch('')
    setTypeFilterSearch('')
    setOpenCategoryNames([])
    setSubCategoryPickerTarget(null)
    setSubCategorySearch('')
    newCreateLineForm.reset(makeOperationLineValues(todayIso()))
  }

  function openCreateFlow() {
    resetCreateFlow()
    setSelectedNumero(null)
    setCreateOpen(true)
  }

  function closeCreateFlow() {
    resetCreateFlow()
    setCreateOpen(false)
  }

  function toggleCreateOptionsPanel() {
    if (createOptionsOpen) {
      if (expandedCreateLineIndex != null && createLineIsDirty(expandedCreateLineIndex)) {
        resetCreateLineToBaseline(expandedCreateLineIndex)
      }
      setExpandedCreateLineIndex(null)
      setCreateLineCreateOpen(false)
      newCreateLineForm.reset(makeOperationLineValues(createForm.getValues('dateValeur') || todayIso()))
      if (subCategoryPickerTarget?.kind === 'createLine' || subCategoryPickerTarget?.kind === 'newCreateLine') {
        closeSubCategoryPicker()
      }
    }

    setCreateOptionsOpen((current) => !current)
  }

  function selectType(code: string) {
    const keepReferences = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(code)
    createForm.reset({
      ...CREATE_DEFAULTS,
      dateValeur: createDateValeur || todayIso(),
      numero: createNumero,
      libelle: createLibelle,
      montant: createAmount,
      nomSousCategorie: keepReferences ? createNomSousCategorie : '',
      nomsBeneficiaires: keepReferences ? createBeneficiaries : [],
      codeTypeOperation: code,
      lignes: [],
    })
    setCreateOptionsOpen(false)
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setDepenseSearch('')
    setRecetteSearch('')
    setCreateStep('depense')
  }

  function selectTypeInQuickEditor(code: string) {
    const keepReferences = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(code)
    createForm.reset({
      ...CREATE_DEFAULTS,
      dateValeur: createDateValeur || todayIso(),
      numero: createNumero,
      libelle: createLibelle,
      montant: createAmount,
      nomSousCategorie: keepReferences ? createNomSousCategorie : '',
      nomsBeneficiaires: keepReferences ? createBeneficiaries : [],
      codeTypeOperation: code,
      lignes: [],
    })
    setCreateOptionsOpen(false)
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setDepenseSearch('')
    setRecetteSearch('')
    setQuickEditTarget('depense')
  }

  function selectDepenseAccount(identifiant: string) {
    createForm.setValue('identifiantCompteDepense', identifiant)
    if (recetteIsTechnical && technicalFallbackId) {
      createForm.setValue('identifiantCompteRecette', technicalFallbackId)
      setCreateStep('amount')
      return
    }

    createForm.setValue('identifiantCompteRecette', '')
    setRecetteSearch('')
    setCreateStep('recette')
  }

  function selectDepenseInQuickEditor(identifiant: string) {
    createForm.setValue('identifiantCompteDepense', identifiant)
    if (recetteIsTechnical && technicalFallbackId) {
      createForm.setValue('identifiantCompteRecette', technicalFallbackId)
      setQuickEditTarget(amountReady ? null : 'amount')
      return
    }

    createForm.setValue('identifiantCompteRecette', '')
    setRecetteSearch('')
    setQuickEditTarget('recette')
  }

  function selectRecetteAccount(identifiant: string) {
    createForm.setValue('identifiantCompteRecette', identifiant)
    setCreateStep('amount')
  }

  function selectRecetteInQuickEditor(identifiant: string) {
    createForm.setValue('identifiantCompteRecette', identifiant)
    setQuickEditTarget(amountReady ? null : 'amount')
  }

  function continueFromAmount() {
    if (!amountReady) {
      return
    }

    if (!createLines.length) {
      const defaultLine = normalizeOperationLineValues({
        numeroLigne: 0,
        libelle: createLibelle,
        dateComptabilisation: createDateValeur || todayIso(),
        montant: createAmount,
        nomSousCategorie: createNomSousCategorie,
        nomsBeneficiaires: createBeneficiaries,
      })

      createLineFieldArray.replace([defaultLine])
      setCreateLineBaselines([defaultLine])
    }

    setCreateStep('review')
  }

  function closeDetailOverlay() {
    setSelectedNumero(null)
    setExpandedLineIndex(null)
    setLineCreateOpen(false)
    setLineBudgetCents(null)
    setDetailLineBaselines([])
    closeSubCategoryPicker()
  }

  function resetCreateLineToBaseline(index: number) {
    const baseline = createLineBaselines[index]
    if (!baseline) {
      return
    }

    createForm.setValue(`lignes.${index}.numeroLigne`, baseline.numeroLigne)
    createForm.setValue(`lignes.${index}.libelle`, baseline.libelle)
    createForm.setValue(`lignes.${index}.dateComptabilisation`, baseline.dateComptabilisation)
    createForm.setValue(`lignes.${index}.montant`, baseline.montant)
    createForm.setValue(`lignes.${index}.nomSousCategorie`, baseline.nomSousCategorie)
    createForm.setValue(`lignes.${index}.nomsBeneficiaires`, baseline.nomsBeneficiaires)
  }

  function createLineIsDirty(index: number): boolean {
    if (index === createPrimaryLineIndex) {
      return false
    }

    return !operationLineValuesEqual(createLines[index], createLineBaselines[index])
  }

  function toggleCreateLine(index: number) {
    setExpandedCreateLineIndex((current) => {
      if (current === index) {
        if (createLineIsDirty(index)) {
          resetCreateLineToBaseline(index)
        }
        return null
      }

      if (current != null && createLineIsDirty(current)) {
        resetCreateLineToBaseline(current)
      }

      return index
    })
  }

  function openCreateLineCreatePanel() {
    if (expandedCreateLineIndex != null && createLineIsDirty(expandedCreateLineIndex)) {
      resetCreateLineToBaseline(expandedCreateLineIndex)
    }
    setExpandedCreateLineIndex(null)
    newCreateLineForm.reset(makeOperationLineValues(createForm.getValues('dateValeur') || todayIso()))
    setCreateLineCreateOpen(true)
  }

  function closeCreateLineCreatePanel() {
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    newCreateLineForm.reset(makeOperationLineValues(createForm.getValues('dateValeur') || todayIso()))
    if (subCategoryPickerTarget?.kind === 'newCreateLine') {
      closeSubCategoryPicker()
    }
  }

  function resetLineToBaseline(index: number) {
    const baseline = detailLineBaselines[index]
    if (!baseline) {
      return
    }

    editForm.setValue(`lignes.${index}.numeroLigne`, baseline.numeroLigne)
    editForm.setValue(`lignes.${index}.libelle`, baseline.libelle)
    editForm.setValue(`lignes.${index}.dateComptabilisation`, baseline.dateComptabilisation)
    editForm.setValue(`lignes.${index}.montant`, baseline.montant)
    editForm.setValue(`lignes.${index}.nomSousCategorie`, baseline.nomSousCategorie)
    editForm.setValue(`lignes.${index}.nomsBeneficiaires`, baseline.nomsBeneficiaires)
  }

  function lineIsDirty(index: number): boolean {
    if (index === detailPrimaryLineIndex) {
      return !operationLineValuesEqualIgnoringAmount(watchedLines[index], detailLineBaselines[index])
    }

    return !operationLineValuesEqual(watchedLines[index], detailLineBaselines[index])
  }

  function toggleDetailLine(index: number) {
    setExpandedLineIndex((current) => {
      if (current === index) {
        if (lineIsDirty(index)) {
          resetLineToBaseline(index)
        }
        return null
      }

      if (current != null && lineIsDirty(current)) {
        resetLineToBaseline(current)
      }

      return index
    })
  }

  function openLineCreatePanel() {
    if (expandedLineIndex != null && lineIsDirty(expandedLineIndex)) {
      resetLineToBaseline(expandedLineIndex)
    }
    setExpandedLineIndex(null)
    newLineForm.reset(makeOperationLineValues(editForm.getValues('dateValeur') || todayIso()))
    setLineCreateOpen(true)
  }

  function closeLineCreatePanel() {
    setExpandedLineIndex(null)
    setLineCreateOpen(false)
    newLineForm.reset(makeOperationLineValues(editForm.getValues('dateValeur') || todayIso()))
    if (subCategoryPickerTarget?.kind === 'newLine') {
      closeSubCategoryPicker()
    }
  }

  function goBack() {
    if (createStep === 'review') {
      setCreateStep('amount')
      return
    }

    if (createStep === 'amount') {
      if (!recetteIsTechnical) {
        setCreateStep('recette')
        return
      }

      if (!depenseIsTechnical) {
        setCreateStep('depense')
        return
      }

      setCreateStep('type')
      return
    }

    if (createStep === 'depense') {
      setCreateStep('type')
      return
    }

    if (createStep === 'recette') {
      setCreateStep(depenseIsTechnical ? 'type' : 'depense')
      return
    }
  }

  function jumpToStep(step: CreateStep) {
    if (step === 'review' && createReady) {
      setCreateStep('review')
      return
    }

    if (step === 'amount' && depenseReady && recetteReady) {
      setCreateStep('amount')
      return
    }

    if (step === 'recette' && depenseReady) {
      setCreateStep('recette')
      return
    }

    if (step === 'depense' && createType) {
      setCreateStep('depense')
      return
    }

    setCreateStep('type')
  }

  function toggleCategoryAccordion(name: string) {
    setOpenCategoryNames((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name)
      }

      const next = [...current.filter((item) => item !== name), name]
      return next.slice(-2)
    })
  }

  function toggleTypeFilter(code: string) {
    setSelectedTypeFilters((current) => (current.includes(code) ? current.filter((value) => value !== code) : [...current, code]))
  }

  function clearTypeFilters() {
    setSelectedTypeFilters([])
  }

  function openSubCategoryPicker(target: Exclude<SubCategoryPickerTarget, null>) {
    setSubCategoryPickerTarget(target)
    setSubCategorySearch('')
    setOpenCategoryNames([])
  }

  function closeSubCategoryPicker() {
    setSubCategoryPickerTarget(null)
    setSubCategorySearch('')
    setOpenCategoryNames([])
  }

  function currentSubCategoryValue(): string {
    if (!subCategoryPickerTarget) {
      return ''
    }

    if (subCategoryPickerTarget.kind === 'create') {
      return createForm.getValues('nomSousCategorie') ?? ''
    }

    if (subCategoryPickerTarget.kind === 'createLine') {
      return createForm.getValues(`lignes.${subCategoryPickerTarget.index}.nomSousCategorie`) ?? ''
    }

    if (subCategoryPickerTarget.kind === 'newCreateLine') {
      return newCreateLineForm.getValues('nomSousCategorie') ?? ''
    }

    if (subCategoryPickerTarget.kind === 'newLine') {
      return newLineForm.getValues('nomSousCategorie') ?? ''
    }

    return editForm.getValues(`lignes.${subCategoryPickerTarget.index}.nomSousCategorie`) ?? ''
  }

  function toggleSubCategory(name: string) {
    const current = currentSubCategoryValue()
    const nextValue = current === name ? '' : name

    if (subCategoryPickerTarget?.kind === 'createLine') {
      createForm.setValue(`lignes.${subCategoryPickerTarget.index}.nomSousCategorie`, nextValue, { shouldDirty: true, shouldTouch: true })
    } else if (subCategoryPickerTarget?.kind === 'newCreateLine') {
      newCreateLineForm.setValue('nomSousCategorie', nextValue, { shouldDirty: true, shouldTouch: true })
    } else if (subCategoryPickerTarget?.kind === 'newLine') {
      newLineForm.setValue('nomSousCategorie', nextValue, { shouldDirty: true, shouldTouch: true })
    } else if (subCategoryPickerTarget?.kind === 'line') {
      editForm.setValue(`lignes.${subCategoryPickerTarget.index}.nomSousCategorie`, nextValue, { shouldDirty: true, shouldTouch: true })
    } else {
      createForm.setValue('nomSousCategorie', nextValue, { shouldDirty: true, shouldTouch: true })
    }

    closeSubCategoryPicker()
  }

  function applyDetailLineCollection(lines: OperationLineFormValues[]) {
    const normalizedLines = lines.map((line) => normalizeOperationLineValues(line))
    lineFieldArray.replace(normalizedLines)
    setDetailLineBaselines(normalizedLines.map((line) => normalizeOperationLineValues(line)))
  }

  const createTrail = useMemo(() => {
    const items: Array<{ key: CreateStep; label: string }> = []

    if (createType) {
      items.push({ key: 'type', label: selectedType?.libelleCourt ?? createType })
    }

    if ((createStep === 'recette' || createStep === 'amount' || createStep === 'review') && depenseReady) {
      items.push({
        key: 'depense',
        label: selectedAccountLabel(allAccounts, createDepense || technicalFallbackId),
      })
    }

    if ((createStep === 'amount' || createStep === 'review') && recetteReady) {
      items.push({
        key: 'recette',
        label: selectedAccountLabel(allAccounts, createRecette || technicalFallbackId),
      })
    }

    if (createStep === 'review' && (createAmount || createLinePayloads.length)) {
      items.push({
        key: 'amount',
        label: formatCurrencyFromCents(createEffectiveAmountCents),
      })
    }

    return items
  }, [allAccounts, createAmount, createDepense, createEffectiveAmountCents, createLinePayloads.length, createRecette, createStep, createType, depenseReady, recetteReady, selectedType, technicalFallbackId])
  const amountField = createForm.register('montant')

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
                      {createTrail.map((item) => (
                        <button key={item.key} type="button" className="wizard-trail-item button-reset" onClick={() => jumpToStep(item.key)}>
                          {item.label}
                        </button>
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
                  <Button type="button" disabled={!amountReady} onClick={continueFromAmount}>
                    Suivant
                  </Button>
                </div>
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
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('type')}>
                    <span>Type</span>
                    <strong>{selectedType?.libelleCourt ?? createType}</strong>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('depense')}>
                    <span>{createFlowLabels.depenseSummary}</span>
                    <strong>{selectedAccountLabel(allAccounts, createDepense || technicalFallbackId)}</strong>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('recette')}>
                    <span>{createFlowLabels.recetteSummary}</span>
                    <strong>{selectedAccountLabel(allAccounts, createRecette || technicalFallbackId)}</strong>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('amount')}>
                    <span>Montant</span>
                    <strong>{formatCurrencyFromCents(createEffectiveAmountCents)}</strong>
                    <Pencil size={14} />
                  </button>
                </div>

                <div className="form-grid three-columns">
                  <FormField label="Date">
                    <input type="date" {...createForm.register('dateValeur')} />
                  </FormField>

                  <FormField label="Libelle">
                    <input {...createForm.register('libelle')} placeholder="Facultatif" />
                  </FormField>

                  {currentTypeNeedsReference ? (
                    <FormField label="Sous-categorie">
                      <button type="button" className="picker-field" onClick={() => openSubCategoryPicker({ kind: 'create' })}>
                        <div className="picker-field-content">
                          {createNomSousCategorie ? (
                            <div className="picker-chip-list">
                              <span className="picker-chip">{createNomSousCategorie}</span>
                            </div>
                          ) : (
                            <span>Choisir</span>
                          )}
                        </div>
                        <ChevronDown size={16} />
                      </button>
                    </FormField>
                  ) : (
                    <div />
                  )}
                </div>

                {currentTypeNeedsReference ? (
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
                ) : null}

                {createLines.length ? (
                  <div className="wizard-balance-note">
                    <span>Lignes {formatCurrencyFromCents(createLineTotalCents)}</span>
                    {createLineTotalMismatch ? (
                      <small className="inline-amount-error">
                        {createLineGapCents > 0
                          ? `Reste ${formatCurrencyFromCents(createLineGapCents)}`
                          : `Depasse ${formatCurrencyFromCents(Math.abs(createLineGapCents))}`}
                      </small>
                    ) : null}
                  </div>
                ) : null}

                <div className="button-row wizard-review-actions">
                  <Button type="button" tone="ghost" onClick={toggleCreateOptionsPanel}>
                    Options
                    {createLines.length ? <Badge>{createLines.length}</Badge> : null}
                  </Button>
                  {!createOptionsOpen ? (
                    <Button type="submit" disabled={createMutation.isPending || !createReady || hasCreateLineOverflow || hasCreateLineDrafts || createLineTotalMismatch}>
                      <Save size={16} />
                      Valider
                    </Button>
                  ) : null}
                </div>

                {createOptionsOpen ? (
                  <div className="wizard-advanced" ref={createOptionsPanelRef}>
                    <div className="form-grid">
                      <FormField label="Numero">
                        <input {...createForm.register('numero')} placeholder="Facultatif" />
                      </FormField>
                    </div>

                    <div className="page-stack">
                      <div className="section-header">
                        <div>
                          <h2>Lignes</h2>
                        </div>
                        <Button type="button" tone="ghost" disabled={hasCreateLineOverflow} onClick={openCreateLineCreatePanel}>
                          <Plus size={16} />
                          Ajouter
                        </Button>
                      </div>

                      {createLineFieldArray.fields.length ? (
                        <div className="page-stack">
                          {createLineFieldArray.fields.map((field, index) => {
                            const currentLine = createLines[index]
                            const isPrimaryLine = index === createPrimaryLineIndex
                            const currentBenefs = isPrimaryLine ? createBeneficiaries : currentLine?.nomsBeneficiaires ?? []
                            const lineDirty = createLineIsDirty(index)
                            const lineAmountError = createLineErrors[index]
                            const isOpen = expandedCreateLineIndex === index
                            const lineTitle = isPrimaryLine ? 'Ligne 0' : currentLine?.libelle?.trim() || `Ligne ${index}`
                            const lineMeta = [
                              isPrimaryLine ? formatDate(createDateValeur) : currentLine?.dateComptabilisation ? formatDate(currentLine.dateComptabilisation) : null,
                              formatCurrencyFromCents(isPrimaryLine ? createPrimaryRemainingCents : parseMoneyToCents(currentLine?.montant ?? '')),
                              isPrimaryLine ? createNomSousCategorie || null : currentLine?.nomSousCategorie?.trim() || null,
                            ]
                              .filter(Boolean)
                              .join(' · ')

                            return (
                              <div
                                key={field.id}
                                ref={(node) => {
                                  createLineCardRefs.current[index] = node
                                }}
                              >
                                <Surface className={cx('inline-panel', 'line-editor-card', isOpen && 'open')}>
                                  <div className="line-editor-head">
                                    <button type="button" className="line-editor-toggle" onClick={() => toggleCreateLine(index)}>
                                      <div className="line-editor-copy">
                                        <strong>{lineTitle}</strong>
                                        <span>{lineMeta || 'Sans detail'}</span>
                                      </div>
                                      <ChevronDown size={16} />
                                    </button>

                                    <div className="line-editor-actions">
                                      {(isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie) ? (
                                        <Badge>{isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie}</Badge>
                                      ) : null}
                                      {currentBenefs.length ? <Badge>{`${currentBenefs.length} beneficiaire${currentBenefs.length > 1 ? 's' : ''}`}</Badge> : null}
                                    </div>
                                  </div>

                                  {isOpen ? (
                                    <div className="line-editor-body">
                                      <div className="section-header">
                                        <div>
                                          <h2>{isPrimaryLine ? 'Ligne 0' : `Ligne ${index}`}</h2>
                                          {(isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie) || currentBenefs.length ? (
                                            <div className="pill-list">
                                              {(isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie) ? (
                                                <Badge>{isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie}</Badge>
                                              ) : null}
                                              {currentBenefs.map((name) => (
                                                <Badge key={`${field.id}-${name}`}>{name}</Badge>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                        {!isPrimaryLine ? (
                                          <Button
                                            type="button"
                                            tone="danger"
                                            onClick={() => {
                                              createLineFieldArray.remove(index)
                                              setCreateLineBaselines((current) => current.filter((_, lineIndex) => lineIndex !== index))
                                              setExpandedCreateLineIndex((current) => {
                                                if (current == null) return null
                                                if (current === index) return null
                                                return current > index ? current - 1 : current
                                              })
                                            }}
                                          >
                                            <Trash2 size={16} />
                                            Retirer
                                          </Button>
                                        ) : null}
                                      </div>

                                      <div className="form-grid three-columns">
                                        <FormField label="Libelle">
                                          {isPrimaryLine ? (
                                            <input {...createForm.register('libelle')} placeholder="Aucun" />
                                          ) : (
                                            <input {...createForm.register(`lignes.${index}.libelle`)} />
                                          )}
                                        </FormField>

                                        <FormField label="Date">
                                          {isPrimaryLine ? (
                                            <input type="date" {...createForm.register('dateValeur')} />
                                          ) : (
                                            <input type="date" {...createForm.register(`lignes.${index}.dateComptabilisation`)} />
                                          )}
                                        </FormField>

                                        <FormField label="Montant">
                                          <div className="inline-amount-field">
                                            {isPrimaryLine ? (
                                              <input value={toMoneyInput(createPrimaryRemainingCents)} inputMode="decimal" readOnly />
                                            ) : (
                                              <input {...createForm.register(`lignes.${index}.montant`)} inputMode="decimal" />
                                            )}
                                            {lineAmountError ? <small className="inline-amount-error">{lineAmountError}</small> : null}
                                          </div>
                                        </FormField>

                                        <FormField label="Sous-categorie">
                                          <button
                                            type="button"
                                            className="picker-field"
                                            onClick={() => openSubCategoryPicker(isPrimaryLine ? { kind: 'create' } : { kind: 'createLine', index })}
                                          >
                                            <div className="picker-field-content">
                                              {(isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie) ? (
                                                <div className="picker-chip-list">
                                                  <span className="picker-chip">{isPrimaryLine ? createNomSousCategorie : currentLine?.nomSousCategorie}</span>
                                                </div>
                                              ) : (
                                                <span>Choisir</span>
                                              )}
                                            </div>
                                            <ChevronDown size={16} />
                                          </button>
                                        </FormField>

                                        <div className="form-field full-span">
                                          <span className="form-field-label">Beneficiaires</span>
                                          <div className="checkbox-grid">
                                            {(beneficiairesQuery.data ?? []).map((item) => {
                                              const checked = currentBenefs.includes(item.nom)
                                              return (
                                                <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                                                  <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => {
                                                      if (isPrimaryLine) {
                                                        const values = createForm.getValues('nomsBeneficiaires')
                                                        createForm.setValue('nomsBeneficiaires', checked ? values.filter((value) => value !== item.nom) : [...values, item.nom], {
                                                          shouldDirty: true,
                                                          shouldTouch: true,
                                                        })
                                                        return
                                                      }

                                                      const values = createForm.getValues(`lignes.${index}.nomsBeneficiaires`)
                                                      createForm.setValue(
                                                        `lignes.${index}.nomsBeneficiaires`,
                                                        checked ? values.filter((value) => value !== item.nom) : [...values, item.nom],
                                                        { shouldDirty: true, shouldTouch: true },
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

                                      {lineDirty ? (
                                        <div className="line-editor-footer">
                                          <Button type="button" tone="ghost" onClick={() => resetCreateLineToBaseline(index)}>
                                            Annuler
                                          </Button>
                                          <Button
                                            type="button"
                                            disabled={Boolean(lineAmountError)}
                                            onClick={() => {
                                              const nextValue = normalizeOperationLineValues(createForm.getValues(`lignes.${index}`))
                                              setCreateLineBaselines((current) => current.map((line, lineIndex) => (lineIndex === index ? nextValue : line)))
                                              setExpandedCreateLineIndex(null)
                                            }}
                                          >
                                            <Save size={16} />
                                            Modifier
                                          </Button>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </Surface>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="button-row line-editor-submit-row">
                      <Button type="submit" disabled={createMutation.isPending || !createReady || hasCreateLineOverflow || hasCreateLineDrafts || createLineTotalMismatch}>
                        <Save size={16} />
                        Valider
                      </Button>
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}
              </form>

              {quickEditTarget ? (
                <div className="quick-edit-layer" role="dialog" aria-modal="true" aria-label="Modifier un choix">
                  <button type="button" className="quick-edit-backdrop" aria-label="Fermer" onClick={() => setQuickEditTarget(null)} />
                  <div className="quick-edit-card">
                    <div className="quick-edit-head">
                      <strong>
                        {quickEditTarget === 'type'
                          ? 'Type'
                          : quickEditTarget === 'depense'
                            ? createFlowLabels.depenseStep
                            : quickEditTarget === 'recette'
                              ? createFlowLabels.recetteStep
                              : 'Montant'}
                      </strong>
                      <button type="button" className="wizard-close-button" onClick={() => setQuickEditTarget(null)} aria-label="Fermer">
                        <X size={14} />
                      </button>
                    </div>

                    {quickEditTarget === 'type' ? (
                      <div className="page-stack">
                        <label className="search-field search-field-thin">
                          <Search size={14} />
                          <input value={typeSearch} onChange={(event) => setTypeSearch(event.target.value)} placeholder="Chercher..." />
                        </label>
                        {groupedOperationTypes.map((group) => (
                          <div key={group.key} className="wizard-choice-section">
                            <span className="wizard-choice-section-label">{group.label}</span>
                            <div className="wizard-choice-grid">
                              {group.items.map((type) => (
                                <button
                                  key={type.code}
                                  type="button"
                                  className={cx('wizard-choice-card', createType === type.code && 'active')}
                                  onClick={() => selectTypeInQuickEditor(type.code)}
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
                        ))}
                      </div>
                    ) : null}

                    {quickEditTarget === 'depense' ? (
                      compatQuery.isLoading ? (
                        <LoadingState label="Chargement..." />
                      ) : depenseIsTechnical ? (
                        <div className="wizard-locked">
                          <Badge>Technique</Badge>
                          <strong>{technicalFallbackId}</strong>
                        </div>
                      ) : (
                        <div className="page-stack">
                          <label className="search-field search-field-thin">
                            <Search size={14} />
                            <input value={depenseSearch} onChange={(event) => setDepenseSearch(event.target.value)} placeholder="Chercher..." />
                          </label>
                          <div className="wizard-choice-grid">
                            {filteredDepenseOptions.map((account) => (
                              <button
                                key={account.identifiant}
                                type="button"
                                className={cx('wizard-choice-card', createDepense === account.identifiant && 'active')}
                                onClick={() => selectDepenseInQuickEditor(account.identifiant)}
                              >
                                <div>
                                  <strong>{account.identifiant}</strong>
                                  <span>{account.libelle ?? ' '}</span>
                                </div>
                                {createDepense === account.identifiant ? <Check size={16} /> : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    ) : null}

                    {quickEditTarget === 'recette' ? (
                      refinedRecetteQuery.isLoading ? (
                        <LoadingState label="Chargement..." />
                      ) : recetteIsTechnical ? (
                        <div className="wizard-locked">
                          <Badge>Technique</Badge>
                          <strong>{technicalFallbackId}</strong>
                        </div>
                      ) : (
                        <div className="page-stack">
                          <label className="search-field search-field-thin">
                            <Search size={14} />
                            <input value={recetteSearch} onChange={(event) => setRecetteSearch(event.target.value)} placeholder="Chercher..." />
                          </label>
                          <div className="wizard-choice-grid">
                            {filteredRecetteOptions.map((account) => (
                              <button
                                key={account.identifiant}
                                type="button"
                                className={cx('wizard-choice-card', createRecette === account.identifiant && 'active')}
                                onClick={() => selectRecetteInQuickEditor(account.identifiant)}
                              >
                                <div>
                                  <strong>{account.identifiant}</strong>
                                  <span>{account.libelle ?? ' '}</span>
                                </div>
                                {createRecette === account.identifiant ? <Check size={16} /> : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    ) : null}

                    {quickEditTarget === 'amount' ? (
                      <div className="page-stack">
                        <div className="wizard-amount">
                          <input
                            {...amountField}
                            ref={(node) => {
                              amountField.ref(node)
                              quickAmountInputRef.current = node
                            }}
                            inputMode="decimal"
                            placeholder="0.00"
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault()
                                if (createAmount.trim()) {
                                  setQuickEditTarget(null)
                                }
                              }
                            }}
                          />
                        </div>
                        <div className="button-row">
                          <Button type="button" disabled={!createAmount.trim()} onClick={() => setQuickEditTarget(null)}>
                            Enregistrer
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Surface>
          </div>
        </div>
      ) : null}

      <div className={cx('operations-content', createOpen && 'muted')}>
        {operationsQuery.isLoading ? <LoadingState label="Chargement des operations..." /> : null}
        {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

        <Surface className="catalog-panel">
          <FilterBar>
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher une operation..." />
            </label>

            <button type="button" className="picker-field picker-field-compact" onClick={() => setTypeFilterPickerOpen(true)}>
              <div className="picker-field-content">
                {selectedTypeFilterItems.length ? (
                  <div className="picker-chip-list">
                    {selectedTypeFilterItems.slice(0, 3).map((type) => (
                      <span key={type.code} className="picker-chip">
                        {type.libelleCourt}
                      </span>
                    ))}
                    {selectedTypeFilterItems.length > 3 ? <span className="picker-chip">+{selectedTypeFilterItems.length - 3}</span> : null}
                  </div>
                ) : (
                  <span>Tous les types</span>
                )}
              </div>
              <ChevronDown size={16} />
            </button>
          </FilterBar>

          {!filteredOperations.length ? (
            <EmptyState title="Aucune operation visible" description="La liste est vide ou le filtre ne matche rien." />
          ) : (
            <div className="catalog-grid catalog-grid-wide">
              {filteredOperations.map((operation) => (
                <button
                  key={operation.numero}
                  type="button"
                  className={cx('catalog-card', selectedNumero === operation.numero && 'selected')}
                  onClick={() => {
                    setLineBudgetCents(operation.montantEnCentimes)
                    setSelectedNumero(operation.numero)
                    setExpandedLineIndex(null)
                  }}
                >
                  <div className="catalog-card-head">
                    <div>
                      <strong>{readableOperationLabel(operation)}</strong>
                      <p>{compactOperationMeta(operation)}</p>
                    </div>
                    <Badge>{operationTypeCode(operation)}</Badge>
                  </div>

                  <div className="catalog-meta-grid">
                    <div className="catalog-meta-pair">
                      <span>{flowLabelsForType(operationTypeCode(operation)).depenseSummary}</span>
                      <strong>{selectedAccountLabel(allAccounts, depenseId(operation))}</strong>
                    </div>
                    <div className="catalog-meta-pair">
                      <span>{flowLabelsForType(operationTypeCode(operation)).recetteSummary}</span>
                      <strong>{selectedAccountLabel(allAccounts, recetteId(operation))}</strong>
                    </div>
                    <div className="catalog-meta-pair">
                      <span>Montant</span>
                      <strong>{formatCurrencyFromCents(operation.montantEnCentimes)}</strong>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Surface>
      </div>

      <OverlayPanel
        open={typeFilterPickerOpen}
        onClose={() => setTypeFilterPickerOpen(false)}
        title="Filtrer les types"
        width="regular"
        overlayClassName="overlay-top"
      >
        <div className="page-stack">
          <label className="search-field search-field-thin">
            <Search size={14} />
            <input value={typeFilterSearch} onChange={(event) => setTypeFilterSearch(event.target.value)} placeholder="Chercher un type..." />
          </label>

          <div className="button-row">
            <Button type="button" tone="ghost" onClick={clearTypeFilters}>
              Tout afficher
            </Button>
          </div>

          {!groupedFilterOperationTypes.length ? (
            <EmptyState title="Aucun type" description="Aucun type ne correspond a la recherche." />
          ) : (
            groupedFilterOperationTypes.map((group) => (
              <div key={group.key} className="wizard-choice-section">
                <span className="wizard-choice-section-label">{group.label}</span>
                <div className="wizard-choice-grid">
                  {group.items.map((type) => {
                    const active = selectedTypeFilters.includes(type.code)
                    return (
                      <button key={type.code} type="button" className={cx('wizard-choice-card', active && 'active')} onClick={() => toggleTypeFilter(type.code)}>
                        <div>
                          <strong>{type.libelleCourt}</strong>
                          <span>{type.code}</span>
                        </div>
                        {active ? <Check size={16} /> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={Boolean(subCategoryPickerTarget)} onClose={closeSubCategoryPicker} title="Sous-categories" width="regular" overlayClassName="overlay-super-top">
        <div className="page-stack">
          <label className="search-field search-field-thin">
            <Search size={14} />
            <input value={subCategorySearch} onChange={(event) => setSubCategorySearch(event.target.value)} placeholder="Chercher une sous-categorie..." />
          </label>

          {deferredSubCategorySearch ? (
            !filteredSubCategories.length ? (
              <EmptyState title="Aucune sous-categorie" description="Aucun resultat pour cette recherche." />
            ) : (
              <div className="picker-option-list">
                {filteredSubCategories.map((item) => {
                  const selected = currentSubCategoryValue() === item.nom
                  return (
                    <button key={item.nom} type="button" className={cx('picker-option', selected && 'selected')} onClick={() => toggleSubCategory(item.nom)}>
                      <div>
                        <strong>{item.nom}</strong>
                        <span>{item.nomCategorie ?? 'Sans categorie'}</span>
                      </div>
                      {selected ? <Check size={16} /> : null}
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <div className="sub-category-groups">
              {categoriesByName.map((category) => {
                const open = openCategoryNames.includes(category.name)
                return (
                  <div key={category.name} className={cx('sub-category-group', open && 'open')}>
                    <button type="button" className="sub-category-group-toggle" onClick={() => toggleCategoryAccordion(category.name)}>
                      <span>{category.name}</span>
                      <ChevronDown size={14} />
                    </button>

                    {open ? (
                      <div className="sub-category-options">
                        {category.items.length ? (
                          category.items.map((item) => {
                            const selected = currentSubCategoryValue() === item.nom
                            return (
                              <button key={item.nom} type="button" className={cx('sub-category-option', selected && 'selected')} onClick={() => toggleSubCategory(item.nom)}>
                                <span>{item.nom}</span>
                                {selected ? <Check size={14} /> : null}
                              </button>
                            )
                          })
                        ) : (
                          <div className="sub-category-empty">Aucune sous-categorie</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={createLineCreateOpen} onClose={closeCreateLineCreatePanel} title="Nouvelle ligne" width="regular" overlayClassName="overlay-top">
        <form
          className="page-stack"
          onSubmit={newCreateLineForm.handleSubmit(async (values) => {
            createLineFieldArray.append(values)
            setCreateLineBaselines((current) => [...current, normalizeOperationLineValues(values)])
            closeCreateLineCreatePanel()
          })}
        >
          <div className="form-grid three-columns">
            <FormField label="Libelle">
              <input {...newCreateLineForm.register('libelle')} />
            </FormField>

            <FormField label="Date">
              <input type="date" {...newCreateLineForm.register('dateComptabilisation')} />
            </FormField>

            <FormField label="Montant">
              <div className="inline-amount-field">
                <input {...newCreateLineForm.register('montant')} inputMode="decimal" placeholder={`Max ${formatCurrencyFromCents(newCreateLineMaxCents)}`} />
                {newCreateLineAmountError ? <small className="inline-amount-error">{newCreateLineAmountError}</small> : null}
              </div>
            </FormField>

            <FormField label="Sous-categorie">
              <button type="button" className="picker-field" onClick={() => openSubCategoryPicker({ kind: 'newCreateLine' })}>
                <div className="picker-field-content">
                  {newCreateLineSubCategory ? (
                    <div className="picker-chip-list">
                      <span className="picker-chip">{newCreateLineSubCategory}</span>
                    </div>
                  ) : (
                    <span>Choisir</span>
                  )}
                </div>
                <ChevronDown size={16} />
              </button>
            </FormField>

            <div className="form-field full-span">
              <span className="form-field-label">Beneficiaires</span>
              <div className="checkbox-grid">
                {(beneficiairesQuery.data ?? []).map((item) => {
                  const checked = newCreateLineBeneficiaries.includes(item.nom)
                  return (
                    <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const values = newCreateLineForm.getValues('nomsBeneficiaires')
                          newCreateLineForm.setValue('nomsBeneficiaires', checked ? values.filter((value) => value !== item.nom) : [...values, item.nom], {
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }}
                      />
                      <span>{item.nom}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="line-editor-footer">
            <Button type="button" tone="ghost" onClick={closeCreateLineCreatePanel}>
              Annuler
            </Button>
            <Button type="submit" disabled={Boolean(newCreateLineAmountError)}>
              <Save size={16} />
              Valider
            </Button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel open={lineCreateOpen} onClose={closeLineCreatePanel} title="Nouvelle ligne" width="regular" overlayClassName="overlay-top">
        <form
          className="page-stack"
          onSubmit={newLineForm.handleSubmit(async (values) => {
            const nextValue = normalizeOperationLineValues(values)
            lineFieldArray.append(nextValue)
            setDetailLineBaselines((current) => [...current, nextValue])
            closeLineCreatePanel()
            setExpandedLineIndex(null)
          })}
        >
          <div className="form-grid three-columns">
            <FormField label="Libelle">
              <input {...newLineForm.register('libelle')} />
            </FormField>

            <FormField label="Date">
              <input type="date" {...newLineForm.register('dateComptabilisation')} />
            </FormField>

            <FormField label="Montant">
              <div className="inline-amount-field">
                <input {...newLineForm.register('montant')} inputMode="decimal" placeholder={`Max ${formatCurrencyFromCents(newLineMaxCents)}`} />
                {newLineAmountError ? <small className="inline-amount-error">{newLineAmountError}</small> : null}
              </div>
            </FormField>

            <FormField label="Sous-categorie">
              <button type="button" className="picker-field" onClick={() => openSubCategoryPicker({ kind: 'newLine' })}>
                <div className="picker-field-content">
                  {newLineSubCategory ? (
                    <div className="picker-chip-list">
                      <span className="picker-chip">{newLineSubCategory}</span>
                    </div>
                  ) : (
                    <span>Choisir</span>
                  )}
                </div>
                <ChevronDown size={16} />
              </button>
            </FormField>

            <div className="form-field full-span">
              <span className="form-field-label">Beneficiaires</span>
              <div className="checkbox-grid">
                {(beneficiairesQuery.data ?? []).map((item) => {
                  const checked = newLineBeneficiaries.includes(item.nom)
                  return (
                    <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const values = newLineForm.getValues('nomsBeneficiaires')
                          newLineForm.setValue('nomsBeneficiaires', checked ? values.filter((value) => value !== item.nom) : [...values, item.nom], {
                            shouldDirty: true,
                            shouldTouch: true,
                          })
                        }}
                      />
                      <span>{item.nom}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="line-editor-footer">
            <Button type="button" tone="ghost" onClick={closeLineCreatePanel}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending || Boolean(newLineAmountError)}>
              <Save size={16} />
              Valider
            </Button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedNumero)}
        onClose={closeDetailOverlay}
        title={selectedOperationSummary ? readableOperationLabel(selectedOperationSummary) : 'Operation'}
        subtitle={selectedOperationSummary ? compactOperationMeta(selectedOperationSummary) : undefined}
        width="wide"
        actions={
          selectedNumero ? (
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
          ) : null
        }
      >
        {!selectedNumero ? null : detailQuery.isLoading ? (
          <LoadingState label="Chargement du detail..." />
        ) : !detailQuery.data ? (
          <EmptyState title="Operation introuvable" description="Impossible d afficher le detail." />
        ) : (
          <form
            className="page-stack"
            onSubmit={editForm.handleSubmit(async (values) => {
              await updateMutation.mutateAsync(values)
            })}
          >
            <div className="operation-overview-grid edit-mode">
              <div className="operation-overview-card preview-tip" data-tooltip={previewTip('Type', editType || detailQuery.data.typeOperation?.libelleCourt || detailQuery.data.codeTypeOperation || 'Aucun')}>
                <span>Type</span>
                <select {...editForm.register('codeTypeOperation')}>
                  <option value="">Type actuel</option>
                  {(typesQuery.data ?? []).map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.libelleCourt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="operation-overview-card preview-tip" data-tooltip={previewTip(editFlowLabels.depenseSummary, selectedAccountLabel(allAccounts, editDepense || depenseId(detailQuery.data)))}>
                <span>{editFlowLabels.depenseSummary}</span>
                <select {...editForm.register('identifiantCompteDepense')}>
                  <option value="">Choisir</option>
                  {allAccounts.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="operation-overview-card preview-tip" data-tooltip={previewTip(editFlowLabels.recetteSummary, selectedAccountLabel(allAccounts, editRecette || recetteId(detailQuery.data)))}>
                <span>{editFlowLabels.recetteSummary}</span>
                <select {...editForm.register('identifiantCompteRecette')}>
                  <option value="">Choisir</option>
                  {allAccounts.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="operation-overview-card preview-tip" data-tooltip={previewTip('Montant', formatCurrencyFromCents(parseMoneyToCents(editAmount || toMoneyInput(detailQuery.data.montantEnCentimes))))}>
                <span>Montant</span>
                <div className="inline-amount-field">
                  <input {...editForm.register('montant')} inputMode="decimal" />
                  {detailLineTotalMismatch ? (
                    <small className="inline-amount-error">
                      {detailLineGapCents > 0
                        ? `Reste ${formatCurrencyFromCents(detailLineGapCents)}`
                        : `Depasse ${formatCurrencyFromCents(Math.abs(detailLineGapCents))}`}
                    </small>
                  ) : null}
                </div>
              </div>
              <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Date', formatDate(editDateValeur || detailQuery.data.dateValeur))}>
                <span>Date</span>
                <input type="date" {...editForm.register('dateValeur')} />
              </div>
              <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Numero', editNumero || detailQuery.data.numero)}>
                <span>Numero</span>
                <input {...editForm.register('numero')} />
              </div>
              <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Libelle', editLibelle || 'Aucun')}>
                <span>Libelle</span>
                <input {...editForm.register('libelle')} placeholder="Aucun" />
              </div>
              <label className="operation-overview-card compact toggle-card preview-tip" data-tooltip={previewTip('Pointee', editPointee ? 'Oui' : 'Non')}>
                <span>Pointee</span>
                <input type="checkbox" {...editForm.register('pointee')} />
              </label>
              {detailReferenceSummary.subCategories.length ? (
                <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Sous-categories', detailReferenceSummary.subCategories.join(', '))}>
                  <span>Sous-categories</span>
                  <div className="pill-list">
                    {detailReferenceSummary.subCategories.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {detailReferenceSummary.beneficiaries.length ? (
                <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Beneficiaires', detailReferenceSummary.beneficiaries.join(', '))}>
                  <span>Beneficiaires</span>
                  <div className="pill-list">
                    {detailReferenceSummary.beneficiaries.map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {editForm.formState.isDirty ? (
              <div className="button-row operation-edit-actions">
                <Button
                  type="button"
                  tone="ghost"
                  disabled={updateMutation.isPending}
                  onClick={() => {
                    if (!detailQuery.data) {
                      return
                    }

                    const mappedLines = detailQuery.data.lignes.map((line, index) => ({
                      numeroLigne: line.numeroLigne,
                      libelle: line.libelle ?? '',
                      dateComptabilisation: line.dateComptabilisation ?? detailQuery.data.dateValeur,
                      montant: toMoneyInput(line.montantEnCentimes),
                      nomSousCategorie: subCategoryNameForLine(line),
                      nomsBeneficiaires: beneficiariesForLine(detailQuery.data, index),
                    }))

                    editForm.reset({
                      numero: detailQuery.data.numero,
                      libelle: detailQuery.data.libelle ?? '',
                      codeTypeOperation: operationTypeCode(detailQuery.data),
                      dateValeur: detailQuery.data.dateValeur,
                      montant: toMoneyInput(detailQuery.data.montantEnCentimes),
                      identifiantCompteDepense: depenseId(detailQuery.data),
                      identifiantCompteRecette: recetteId(detailQuery.data),
                      pointee: detailQuery.data.pointee,
                      lignes: mappedLines,
                    })
                    setDetailLineBaselines(mappedLines.map((line) => normalizeOperationLineValues(line)))
                    setExpandedLineIndex(null)
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={updateMutation.isPending || hasDetailLineOverflow || detailLineTotalMismatch || hasDetailLineDrafts}>
                  <Save size={16} />
                  Modifier
                </Button>
              </div>
            ) : null}

            <div className="page-stack">
              <SectionHeader
                title="Lignes"
                aside={
                  <Button type="button" tone="ghost" disabled={hasDetailLineOverflow} onClick={openLineCreatePanel}>
                    <Plus size={16} />
                    Ajouter
                  </Button>
                }
              />

              {detailLinePayloads.length ? (
                <div className="wizard-balance-note">
                  <span>Lignes {formatCurrencyFromCents(detailLineTotalCents)}</span>
                  {detailLineTotalMismatch ? (
                    <small className="inline-amount-error">
                      {detailLineGapCents > 0
                        ? `Reste ${formatCurrencyFromCents(detailLineGapCents)}`
                        : `Depasse ${formatCurrencyFromCents(Math.abs(detailLineGapCents))}`}
                    </small>
                  ) : null}
                </div>
              ) : null}

              {!lineFieldArray.fields.length ? (
                <EmptyState title="Aucune ligne" description="Ajoute une ligne si tu veux enrichir le detail." />
              ) : (
                <div className="page-stack">
                  {lineFieldArray.fields.map((field, index) => {
                    const currentBenefs = watchedLines[index]?.nomsBeneficiaires ?? []
                    const currentLine = watchedLines[index]
                    const isPrimaryLine = index === detailPrimaryLineIndex
                    const lineDirty = lineIsDirty(index)
                    const lineAmountError = detailLineErrors[index]
                    const isOpen = expandedLineIndex === index
                    const lineTitle = currentLine?.libelle?.trim() || (isPrimaryLine ? 'Ligne 0' : `Ligne ${field.numeroLigne ?? index}`)
                    const lineMeta = [
                      currentLine?.dateComptabilisation ? formatDate(currentLine.dateComptabilisation) : null,
                      formatCurrencyFromCents(isPrimaryLine ? detailPrimaryRemainingCents : parseMoneyToCents(currentLine?.montant ?? '')),
                      currentLine?.nomSousCategorie?.trim() || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')

                    return (
                      <div
                        key={field.id}
                        ref={(node) => {
                          lineCardRefs.current[index] = node
                        }}
                      >
                        <Surface className={cx('inline-panel', 'line-editor-card', isOpen && 'open')}>
                          <div className="line-editor-head">
                            <button type="button" className="line-editor-toggle" onClick={() => toggleDetailLine(index)}>
                              <div className="line-editor-copy">
                                <strong>{lineTitle}</strong>
                                <span>{lineMeta || 'Aucun detail pour le moment'}</span>
                              </div>
                              <ChevronDown size={16} />
                            </button>

                            <div className="line-editor-actions">
                              {currentLine?.nomSousCategorie ? <Badge>{currentLine.nomSousCategorie}</Badge> : null}
                              {currentBenefs.length ? <Badge>{`${currentBenefs.length} beneficiaire${currentBenefs.length > 1 ? 's' : ''}`}</Badge> : null}
                            </div>
                          </div>

                          {isOpen ? (
                            <div className="line-editor-body">
                              <div className="section-header">
                                <div>
                                  <h2>{isPrimaryLine ? 'Ligne 0' : `Ligne ${field.numeroLigne ?? index}`}</h2>
                                  {currentLine?.nomSousCategorie || currentBenefs.length ? (
                                    <div className="pill-list">
                                      {currentLine?.nomSousCategorie ? <Badge>{currentLine.nomSousCategorie}</Badge> : null}
                                      {currentBenefs.map((name) => (
                                        <Badge key={`${field.id}-${name}`}>{name}</Badge>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                                {!isPrimaryLine ? (
                                  <Button
                                    type="button"
                                    tone="danger"
                                    disabled={updateMutation.isPending}
                                    onClick={() => {
                                      const nextLines = editForm.getValues('lignes').filter((_, lineIndex) => lineIndex !== index)
                                      applyDetailLineCollection(nextLines)
                                      setExpandedLineIndex(null)
                                    }}
                                  >
                                    <Trash2 size={16} />
                                    Retirer
                                  </Button>
                                ) : null}
                              </div>

                              <div className="form-grid three-columns">
                                <FormField label="Libelle">
                                  <input {...editForm.register(`lignes.${index}.libelle`)} />
                                </FormField>

                                <FormField label="Date de comptabilisation">
                                  <input type="date" {...editForm.register(`lignes.${index}.dateComptabilisation`)} />
                                </FormField>

                                <FormField label="Montant">
                                  <div className="inline-amount-field">
                                    {isPrimaryLine ? (
                                      <input value={toMoneyInput(detailPrimaryRemainingCents)} inputMode="decimal" readOnly />
                                    ) : (
                                      <input {...editForm.register(`lignes.${index}.montant`)} inputMode="decimal" />
                                    )}
                                    {lineAmountError ? <small className="inline-amount-error">{lineAmountError}</small> : null}
                                  </div>
                                </FormField>

                                <FormField label="Sous-categorie">
                                  <button type="button" className="picker-field" onClick={() => openSubCategoryPicker({ kind: 'line', index })}>
                                    <div className="picker-field-content">
                                      {currentLine?.nomSousCategorie ? (
                                        <div className="picker-chip-list">
                                          <span className="picker-chip">{currentLine.nomSousCategorie}</span>
                                        </div>
                                      ) : (
                                        <span>Choisir</span>
                                      )}
                                    </div>
                                    <ChevronDown size={16} />
                                  </button>
                                </FormField>

                                <div className="form-field full-span">
                                  <span className="form-field-label">Beneficiaires</span>
                                  <div className="checkbox-grid">
                                    {(beneficiairesQuery.data ?? []).map((item) => {
                                      const checked = currentBenefs.includes(item.nom)
                                      return (
                                        <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                              const current = editForm.getValues(`lignes.${index}.nomsBeneficiaires`)
                                              editForm.setValue(
                                                `lignes.${index}.nomsBeneficiaires`,
                                                checked ? current.filter((value) => value !== item.nom) : [...current, item.nom],
                                                { shouldDirty: true, shouldTouch: true },
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

                              {lineDirty ? (
                                <div className="line-editor-footer">
                                  <Button type="button" tone="ghost" disabled={updateMutation.isPending} onClick={() => resetLineToBaseline(index)}>
                                    Annuler
                                  </Button>
                                  <Button
                                    type="button"
                                    disabled={updateMutation.isPending || Boolean(lineAmountError)}
                                    onClick={() => {
                                      const nextValue = normalizeOperationLineValues(editForm.getValues(`lignes.${index}`))
                                      setDetailLineBaselines((current) => current.map((line, lineIndex) => (lineIndex === index ? nextValue : line)))
                                      setExpandedLineIndex(null)
                                    }}
                                  >
                                    <Save size={16} />
                                    Modifier
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </Surface>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </form>
        )}
      </OverlayPanel>
    </div>
  )
}
