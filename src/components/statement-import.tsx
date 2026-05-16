import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronLeft, ChevronRight, Eye, FileText, LoaderCircle, Plus, Save, Search, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../lib/cx'
import { formatCurrencyFromCents, nullIfBlank, parseMoneyToCents, toMoneyInput } from '../lib/format'
import {
  apiErrorMessage,
  type CompteSummary,
  type ImportRuleRole,
  monatisApi,
  type OperationBasic,
  type ReferenceListItem,
  type ReferenceResource,
  type StatementImportDuplicateExistingOperation,
  type StatementImportDuplicateOperationResponse,
  type StatementImportDuplicateStatus,
  type StatementImportRule,
  type StatementImportRuleLearningItemRequest,
} from '../lib/monatis-api'
import { pdfImporterApi, type StatementOperationCandidate } from '../lib/pdf-import-api'
import { QuickAccountOverlay, type QuickAccountDialogState, QuickReferenceOverlay, type QuickReferenceDialogState } from './quick-create'
import { Badge, Button, EmptyState, ErrorState, FormField, LoadingState, OverlayPanel } from './ui'

type ImportDraftStatus = 'draft' | 'imported' | 'error'
type AccountField = 'depense' | 'recette'
type OperationTypeGroup = 'incoming' | 'outgoing' | 'internal' | 'technical' | 'other'
type DraftIssueField = 'codeTypeOperation' | 'dateValeur' | 'montant' | 'identifiantCompteDepense' | 'identifiantCompteRecette'
type ImportFilter = 'needs-action' | 'ready' | 'duplicates' | 'all'
type DraftReviewState = 'auto' | 'review' | 'blocked'
type CorrectionStepKind = DraftIssueField
type CreationChoice = 'internal-account' | 'external-account' | ReferenceResource
type CreationChooserStep = 'root' | 'account' | 'reference'
type BeneficiaryPickerTarget = { kind: 'draft'; id: string; values: string[] } | { kind: 'group'; id: string; values: string[] }
type DuplicateKeepNotice = { tone: 'delete' | 'keep'; message: string }
type DuplicateHoverTooltip = { text: string; x: number; y: number }

const DEFAULT_DRAFT_PAGE_SIZE = 50
const DRAFT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

interface ImportDraft {
  id: string
  sourceIndex: number
  selected: boolean
  status: ImportDraftStatus
  error: string
  codeTypeOperation: string
  dateValeur: string
  dateComptabilisation: string
  numero: string
  libelle: string
  montant: string
  identifiantCompteDepense: string
  identifiantCompteRecette: string
  statementAccountRole: AccountField
  counterpartyAccountRole: AccountField
  suggestedCounterpartyName: string
  nomSousCategorie: string
  nomsBeneficiaires: string[]
  confidence: number | null
  page: number | null
  warnings: string[]
  groupKey: string
  groupLabel: string
  groupSize: number
  isRecurring: boolean
  memoryRuleId: number | null
  memoryKey: string
  memoryApplied: boolean
  memoryWarning: string
  duplicateStatus: StatementImportDuplicateStatus
  duplicateScore: number | null
  duplicateReasons: string[]
  duplicateOperation: StatementImportDuplicateExistingOperation | null
  duplicateOperationNumero: string
  duplicateOperationLabel: string
  duplicateOperationDate: string
  duplicateOperationAmount: number | null
  duplicateIgnored: boolean
}

interface ImportOutcome {
  id: string
  ok: boolean
  error?: string
}

interface ImportRunResult {
  outcomes: ImportOutcome[]
  memoryLearningError: string
  duplicateDeletionError: string
  duplicateDeletionCount: number
}

interface ImportGroup {
  key: string
  label: string
  count: number
  selectedCount: number
  missingExternalCount: number
  blockedCount: number
  reviewCount: number
  readyCount: number
  exactDuplicateCount: number
  probableDuplicateCount: number
  memoryCount: number
  totalCents: number
  counterpartyAccountRole: AccountField
  currentTypeCode: string
  mixedTypes: boolean
  currentSousCategorie: string
  mixedSousCategories: boolean
  currentBeneficiaries: string[]
  mixedBeneficiaries: boolean
  currentExternalAccountId: string
  mixedExternalAccounts: boolean
  operationIds: string[]
}

interface DraftIssue {
  field: DraftIssueField
  label: string
  message: string
}

interface CorrectionStep {
  kind: CorrectionStepKind
  label: string
  message: string
}

function accountChoiceLabel(account: CompteSummary): string {
  return `${account.identifiant}${account.libelle ? ` - ${account.libelle}` : ''}`
}

function normalizedLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function frenchDateToken(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function formatFrenchDateTime(value?: string | null): string {
  if (!value) {
    return 'creation non disponible'
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})/.exec(value)
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}`
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
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

function accountOptionsForField(
  codeTypeOperation: string,
  field: AccountField,
  internalAccounts: CompteSummary[],
  externalAccounts: CompteSummary[],
): CompteSummary[] {
  const group = operationTypeGroup(codeTypeOperation)

  if (group === 'incoming') {
    return field === 'depense' ? externalAccounts : internalAccounts
  }

  if (group === 'outgoing') {
    return field === 'depense' ? internalAccounts : externalAccounts
  }

  if (group === 'internal') {
    return internalAccounts
  }

  return [...internalAccounts, ...externalAccounts]
}

function accountOptionsWithCurrent(options: CompteSummary[], currentIdentifiant: string, allAccounts: CompteSummary[]): CompteSummary[] {
  if (!currentIdentifiant || options.some((account) => account.identifiant === currentIdentifiant)) {
    return options
  }

  const knownAccount = allAccounts.find((account) => account.identifiant === currentIdentifiant)
  return [...options, knownAccount ?? { identifiant: currentIdentifiant, libelle: 'Memoire' }]
}

function findSuggestedExternalAccount(candidate: Pick<ImportDraft, 'suggestedCounterpartyName'>, externalAccounts: CompteSummary[]): string {
  const suggestion = normalizedLookup(candidate.suggestedCounterpartyName)
  if (!suggestion) {
    return ''
  }

  const match = externalAccounts.find((account) => {
    const haystack = normalizedLookup(`${account.identifiant} ${account.libelle ?? ''}`)
    return haystack.includes(suggestion) || suggestion.includes(normalizedLookup(account.identifiant))
  })

  return match?.identifiant ?? ''
}

function findAccountByIdOrIdentifier(accounts: CompteSummary[], id?: number | null, identifiant?: string | null): CompteSummary | undefined {
  return accounts.find((account) => (id != null && account.id === id) || Boolean(identifiant && account.identifiant === identifiant))
}

function findReferenceByIdOrName<T extends { id?: number; nom: string }>(items: T[], id?: number | null, nom?: string | null): T | undefined {
  return items.find((item) => (id != null && item.id === id) || Boolean(nom && item.nom === nom))
}

function statementAccountIdentifier(draft: ImportDraft): string {
  return draft.statementAccountRole === 'depense' ? draft.identifiantCompteDepense : draft.identifiantCompteRecette
}

function counterpartyAccountIdentifier(draft: ImportDraft): string {
  return draft.counterpartyAccountRole === 'depense' ? draft.identifiantCompteDepense : draft.identifiantCompteRecette
}

function memoryRoleForDraft(draft: Pick<ImportDraft, 'counterpartyAccountRole'>): ImportRuleRole {
  return draft.counterpartyAccountRole === 'depense' ? 'DEPENSE' : 'RECETTE'
}

function applyMemoryRuleToDraft(
  draft: ImportDraft,
  rule: StatementImportRule,
  externalAccounts: CompteSummary[],
  sousCategories: ReferenceListItem[],
  beneficiaires: ReferenceListItem[],
): ImportDraft {
  const warnings: string[] = []
  const next: ImportDraft = {
    ...draft,
    memoryRuleId: rule.id,
    memoryKey: rule.cleLibelleNormalisee,
    memoryApplied: true,
    memoryWarning: '',
  }

  if (rule.codeTypeOperation) {
    next.codeTypeOperation = rule.codeTypeOperation
  }

  if (rule.compteExterneId != null || rule.identifiantCompteExterne) {
    const account = findAccountByIdOrIdentifier(externalAccounts, rule.compteExterneId, rule.identifiantCompteExterne)
    if (account) {
      if (draft.counterpartyAccountRole === 'depense') {
        next.identifiantCompteDepense = account.identifiant
      } else {
        next.identifiantCompteRecette = account.identifiant
      }
    } else if (rule.identifiantCompteExterne) {
      if (draft.counterpartyAccountRole === 'depense') {
        next.identifiantCompteDepense = rule.identifiantCompteExterne
      } else {
        next.identifiantCompteRecette = rule.identifiantCompteExterne
      }
      warnings.push('Memoire: le compte externe memorise n est pas dans la liste chargee.')
    } else {
      warnings.push('Memoire: le compte externe memorise est introuvable.')
    }
  }

  if (rule.sousCategorieId != null || rule.nomSousCategorie) {
    const sousCategorie = findReferenceByIdOrName(sousCategories, rule.sousCategorieId, rule.nomSousCategorie)
    if (sousCategorie) {
      next.nomSousCategorie = sousCategorie.nom
    } else {
      warnings.push('Memoire: la sous-categorie memorisee est introuvable.')
    }
  }

  const beneficiaryInputs = [
    ...(rule.beneficiaireIds ?? []).map((id) => ({ id, nom: null as string | null })),
    ...(rule.nomsBeneficiaires ?? []).map((nom) => ({ id: null as number | null, nom })),
  ]

  if (beneficiaryInputs.length) {
    const names = new Set<string>()
    let missingCount = 0

    for (const input of beneficiaryInputs) {
      const beneficiaire = findReferenceByIdOrName(beneficiaires, input.id, input.nom)
      if (beneficiaire) {
        names.add(beneficiaire.nom)
      } else {
        missingCount += 1
      }
    }

    if (names.size) {
      next.nomsBeneficiaires = Array.from(names)
    }

    if (missingCount) {
      warnings.push('Memoire: un beneficiaire memorise est introuvable.')
    }
  }

  next.memoryWarning = warnings.join(' ')
  return next
}

function candidateToDraft(candidate: StatementOperationCandidate, externalAccounts: CompteSummary[]): ImportDraft {
  const suggestedCounterpartyName = candidate.suggestedCounterpartyName ?? ''
  const suggestedCounterpartyId = findSuggestedExternalAccount({ suggestedCounterpartyName }, externalAccounts)
  const counterpartyAccountPatch =
    candidate.counterpartyAccountRole === 'depense'
      ? { identifiantCompteDepense: suggestedCounterpartyId, identifiantCompteRecette: '' }
      : { identifiantCompteDepense: '', identifiantCompteRecette: suggestedCounterpartyId }

  return {
    id: candidate.id,
    sourceIndex: candidate.sourceIndex,
    selected: candidate.selected,
    status: 'draft',
    error: '',
    codeTypeOperation: candidate.codeTypeOperation || (candidate.montantSigneEnCentimes != null && candidate.montantSigneEnCentimes >= 0 ? 'RECETTE' : 'DEPENSE'),
    dateValeur: candidate.dateValeur ?? candidate.dateComptabilisation ?? '',
    dateComptabilisation: candidate.dateComptabilisation ?? candidate.dateValeur ?? '',
    numero: candidate.numero ?? '',
    libelle: candidate.libelle ?? '',
    montant: candidate.montantEnCentimes == null ? '' : toMoneyInput(candidate.montantEnCentimes),
    ...counterpartyAccountPatch,
    statementAccountRole: candidate.statementAccountRole,
    counterpartyAccountRole: candidate.counterpartyAccountRole,
    suggestedCounterpartyName,
    nomSousCategorie: candidate.nomSousCategorie ?? '',
    nomsBeneficiaires: candidate.nomsBeneficiaires ?? [],
    confidence: candidate.confidence,
    page: candidate.page,
    warnings: candidate.warnings ?? [],
    groupKey: candidate.groupKey,
    groupLabel: candidate.groupLabel,
    groupSize: candidate.groupSize,
    isRecurring: candidate.isRecurring,
    memoryRuleId: null,
    memoryKey: '',
    memoryApplied: false,
    memoryWarning: '',
    duplicateStatus: 'NOUVELLE',
    duplicateScore: null,
    duplicateReasons: [],
    duplicateOperation: null,
    duplicateOperationNumero: '',
    duplicateOperationLabel: '',
    duplicateOperationDate: '',
    duplicateOperationAmount: null,
    duplicateIgnored: false,
  }
}

function applyStatementAccount(draft: ImportDraft, statementAccountId: string, externalAccounts: CompteSummary[]): ImportDraft {
  const next = { ...draft }

  if (statementAccountId) {
    if (draft.statementAccountRole === 'depense') {
      next.identifiantCompteDepense = statementAccountId
    } else {
      next.identifiantCompteRecette = statementAccountId
    }
  }

  const suggestedCounterpartyId = findSuggestedExternalAccount(draft, externalAccounts)
  if (suggestedCounterpartyId) {
    if (draft.counterpartyAccountRole === 'depense' && !next.identifiantCompteDepense) {
      next.identifiantCompteDepense = suggestedCounterpartyId
    }

    if (draft.counterpartyAccountRole === 'recette' && !next.identifiantCompteRecette) {
      next.identifiantCompteRecette = suggestedCounterpartyId
    }
  }

  return next
}

function formatPdfEuro(value?: number | null): string {
  return value == null ? '-' : formatCurrencyFromCents(Math.round(value * 100))
}

function confidenceLabel(value: number | null): string {
  if (value == null) {
    return '-'
  }

  return `${Math.round(value * 100)}%`
}

function draftAmountCents(draft: Pick<ImportDraft, 'montant'>): number | null {
  const amount = Math.abs(parseMoneyToCents(draft.montant))
  return amount > 0 ? amount : null
}

function duplicateResetPatch(): Pick<
  ImportDraft,
  | 'duplicateStatus'
  | 'duplicateScore'
  | 'duplicateReasons'
  | 'duplicateOperation'
  | 'duplicateOperationNumero'
  | 'duplicateOperationLabel'
  | 'duplicateOperationDate'
  | 'duplicateOperationAmount'
  | 'duplicateIgnored'
> {
  return {
    duplicateStatus: 'NOUVELLE',
    duplicateScore: null,
    duplicateReasons: [],
    duplicateOperation: null,
    duplicateOperationNumero: '',
    duplicateOperationLabel: '',
    duplicateOperationDate: '',
    duplicateOperationAmount: null,
    duplicateIgnored: false,
  }
}

function hasDuplicateCriteriaPatch(patch: Partial<ImportDraft>): boolean {
  return (
    'codeTypeOperation' in patch ||
    'dateValeur' in patch ||
    'dateComptabilisation' in patch ||
    'libelle' in patch ||
    'montant' in patch ||
    'identifiantCompteDepense' in patch ||
    'identifiantCompteRecette' in patch
  )
}

function applyDuplicateDetectionResult(draft: ImportDraft, duplicate?: StatementImportDuplicateOperationResponse): ImportDraft {
  if (!duplicate || draft.status === 'imported') {
    return {
      ...draft,
      ...duplicateResetPatch(),
    }
  }

  const existing = duplicate.operationExistante
  const isExactDuplicate = duplicate.statut === 'DOUBLON_EXACT'

  return {
    ...draft,
    selected: isExactDuplicate ? false : draft.selected,
    duplicateStatus: duplicate.statut,
    duplicateScore: duplicate.score,
    duplicateReasons: duplicate.raisons ?? [],
    duplicateOperation: existing ?? null,
    duplicateOperationNumero: existing?.numero ?? '',
    duplicateOperationLabel: existing?.libelle ?? '',
    duplicateOperationDate: existing?.dateValeur ?? existing?.dateComptabilisation ?? '',
    duplicateOperationAmount: existing?.montantEnCentimes ?? null,
    duplicateIgnored: isExactDuplicate ? true : duplicate.statut === 'NOUVELLE' ? false : draft.duplicateIgnored,
  }
}

function groupSingleValue(values: string[]): { value: string; mixed: boolean } {
  const distinctValues = Array.from(new Set(values.filter(Boolean)))
  return {
    value: distinctValues.length === 1 ? distinctValues[0] : '',
    mixed: distinctValues.length > 1,
  }
}

export function StatementImportOverlay({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported?: () => void | Promise<void>
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const statementImportRef = useRef<HTMLDivElement | null>(null)
  const duplicateNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [resultWarnings, setResultWarnings] = useState<string[]>([])
  const [balanceControl, setBalanceControl] = useState<{
    status: string
    opening_balance: number | null
    closing_balance: number | null
    transactions_total: number | null
    expected_delta: number | null
    difference: number | null
    passed: boolean
  } | null>(null)
  const [statementAccountId, setStatementAccountId] = useState('')
  const [drafts, setDrafts] = useState<ImportDraft[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [memoryError, setMemoryError] = useState('')
  const [duplicateError, setDuplicateError] = useState('')
  const [duplicateDeletionError, setDuplicateDeletionError] = useState('')
  const [activeFilter, setActiveFilter] = useState<ImportFilter>('needs-action')
  const [draftSearch, setDraftSearch] = useState('')
  const [showOnlySelectedInAll, setShowOnlySelectedInAll] = useState(false)
  const [similarGroupsOpen, setSimilarGroupsOpen] = useState(false)
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<string[]>([])
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [correctionDraftIds, setCorrectionDraftIds] = useState<string[]>([])
  const [correctionIndex, setCorrectionIndex] = useState(0)
  const [statementAccountPromptOpen, setStatementAccountPromptOpen] = useState(false)
  const [duplicatePreviewDraftId, setDuplicatePreviewDraftId] = useState<string | null>(null)
  const [duplicateExistingKeepByNumero, setDuplicateExistingKeepByNumero] = useState<Record<string, boolean>>({})
  const [duplicateKeepNotice, setDuplicateKeepNotice] = useState<DuplicateKeepNotice | null>(null)
  const [duplicateHoverTooltip, setDuplicateHoverTooltip] = useState<DuplicateHoverTooltip | null>(null)
  const [creationChooserOpen, setCreationChooserOpen] = useState(false)
  const [creationChooserStep, setCreationChooserStep] = useState<CreationChooserStep>('root')
  const [quickReferenceDialog, setQuickReferenceDialog] = useState<QuickReferenceDialogState | null>(null)
  const [quickAccountDialog, setQuickAccountDialog] = useState<QuickAccountDialogState | null>(null)
  const [beneficiaryPicker, setBeneficiaryPicker] = useState<BeneficiaryPickerTarget | null>(null)
  const [importScrollMetrics, setImportScrollMetrics] = useState({ clientHeight: 1, scrollHeight: 1, scrollTop: 0 })
  const [draftPageSize, setDraftPageSize] = useState(DEFAULT_DRAFT_PAGE_SIZE)
  const [draftPageIndex, setDraftPageIndex] = useState(1)
  const duplicatePreviewDraftIds = drafts
    .filter((draft) => draft.status !== 'imported' && draft.duplicateStatus !== 'NOUVELLE')
    .map((draft) => draft.id)
  const duplicatePreviewIndex = duplicatePreviewDraftId ? duplicatePreviewDraftIds.indexOf(duplicatePreviewDraftId) : -1

  const typesQuery = useQuery({
    queryKey: ['operation-types'],
    queryFn: () => monatisApi.listOperationTypes(),
    enabled: open,
  })

  const internalAccountsQuery = useQuery({
    queryKey: ['comptes', 'internes'],
    queryFn: () => monatisApi.listInternalAccounts(),
    enabled: open,
  })

  const externalAccountsQuery = useQuery({
    queryKey: ['comptes', 'externes'],
    queryFn: () => monatisApi.listExternalAccounts(),
    enabled: open,
  })

  const sousCategoriesQuery = useQuery({
    queryKey: ['references', 'souscategorie'],
    queryFn: () => monatisApi.listReferences('souscategorie'),
    enabled: open,
  })

  const beneficiairesQuery = useQuery({
    queryKey: ['references', 'beneficiaire'],
    queryFn: () => monatisApi.listReferences('beneficiaire'),
    enabled: open,
  })

  const internalAccounts = useMemo(() => internalAccountsQuery.data ?? [], [internalAccountsQuery.data])
  const externalAccounts = useMemo(() => externalAccountsQuery.data ?? [], [externalAccountsQuery.data])
  const duplicatePreviewDraft = duplicatePreviewDraftId ? drafts.find((draft) => draft.id === duplicatePreviewDraftId) ?? null : null
  const duplicateExistingOperationQuery = useQuery({
    queryKey: ['operation', 'duplicate-preview', duplicatePreviewDraft?.duplicateOperationNumero],
    queryFn: () => monatisApi.getOperation(duplicatePreviewDraft?.duplicateOperationNumero ?? ''),
    enabled: open && Boolean(duplicatePreviewDraft?.duplicateOperationNumero),
  })
  const selectedDraftCount = drafts.filter((draft) => draft.selected && draft.status !== 'imported').length
  const selectableDraftCount = drafts.filter((draft) => draft.status !== 'imported').length
  const allSelectableDraftsSelected = selectableDraftCount > 0 && drafts.every((draft) => draft.status === 'imported' || draft.selected)
  const pendingDuplicateDeletionNumeros = Array.from(
    new Set(
      drafts
        .filter((draft) => draft.status !== 'imported' && draft.duplicateStatus !== 'NOUVELLE' && draft.duplicateOperationNumero && duplicateExistingKeepByNumero[draft.duplicateOperationNumero] === false)
        .map((draft) => draft.duplicateOperationNumero),
    ),
  )
  const pendingDuplicateDeletionCount = pendingDuplicateDeletionNumeros.length
  const correctionDraftIdsAll = drafts.filter((draft) => correctionStepsForDraft(draft).length > 0).map((draft) => draft.id)
  const importGroups: ImportGroup[] = (() => {
    const groupedDrafts = new Map<string, ImportDraft[]>()

    for (const draft of drafts) {
      if (draft.status === 'imported') {
        continue
      }

      const key = draft.groupKey || draft.id
      const currentGroup = groupedDrafts.get(key) ?? []
      currentGroup.push(draft)
      groupedDrafts.set(key, currentGroup)
    }

    return Array.from(groupedDrafts.entries())
      .map(([key, groupDrafts]) => {
        const firstDraft = groupDrafts[0]
        const externalAccountIds = new Set(
          groupDrafts
            .map((draft) => (draft.counterpartyAccountRole === 'depense' ? draft.identifiantCompteDepense : draft.identifiantCompteRecette))
            .filter(Boolean),
        )
        const typeState = groupSingleValue(groupDrafts.map((draft) => draft.codeTypeOperation))
        const sousCategorieState = groupSingleValue(groupDrafts.map((draft) => draft.nomSousCategorie))
        const beneficiaryState = groupSingleValue(groupDrafts.map((draft) => draft.nomsBeneficiaires.join('\u001f')))
        const currentBeneficiaries = beneficiaryState.value ? beneficiaryState.value.split('\u001f').filter(Boolean) : []
        const totalCents = groupDrafts.reduce((total, draft) => total + (draftAmountCents(draft) ?? 0), 0)

        return {
          key,
          label: firstDraft.groupLabel || firstDraft.suggestedCounterpartyName || firstDraft.libelle || `Groupe ${firstDraft.sourceIndex}`,
          count: groupDrafts.length,
          selectedCount: groupDrafts.filter((draft) => draft.selected).length,
          missingExternalCount: groupDrafts.filter((draft) => {
            const accountId = draft.counterpartyAccountRole === 'depense' ? draft.identifiantCompteDepense : draft.identifiantCompteRecette
            return !accountId
          }).length,
          blockedCount: groupDrafts.filter((draft) => draftReviewState(draft) === 'blocked').length,
          reviewCount: groupDrafts.filter((draft) => draftReviewState(draft) === 'review').length,
          readyCount: groupDrafts.filter((draft) => draftIsReadyForImport(draft)).length,
          exactDuplicateCount: groupDrafts.filter((draft) => draft.duplicateStatus === 'DOUBLON_EXACT').length,
          probableDuplicateCount: groupDrafts.filter((draft) => draft.duplicateStatus === 'DOUBLON_PROBABLE').length,
          memoryCount: groupDrafts.filter((draft) => draft.memoryApplied).length,
          totalCents,
          counterpartyAccountRole: firstDraft.counterpartyAccountRole,
          currentTypeCode: typeState.value,
          mixedTypes: typeState.mixed,
          currentSousCategorie: sousCategorieState.value,
          mixedSousCategories: sousCategorieState.mixed,
          currentBeneficiaries,
          mixedBeneficiaries: beneficiaryState.mixed,
          currentExternalAccountId: externalAccountIds.size === 1 ? Array.from(externalAccountIds)[0] : '',
          mixedExternalAccounts: externalAccountIds.size > 1,
          operationIds: groupDrafts.map((draft) => draft.id),
        }
      })
      .filter((group) => group.count > 1)
      .sort((left, right) => right.count - left.count || right.missingExternalCount - left.missingExternalCount || left.label.localeCompare(right.label))
  })()

  async function hydrateDraftsWithMemory(sourceDrafts: ImportDraft[]): Promise<ImportDraft[]> {
    if (!sourceDrafts.length) {
      setMemoryError('')
      return sourceDrafts
    }

    try {
      const response = await monatisApi.suggestStatementImportRules({
        operations: sourceDrafts.map((draft) => {
          const contextAccount = findAccountByIdOrIdentifier(internalAccounts, null, statementAccountIdentifier(draft))

          return {
            operationImportId: draft.id,
            libelle: draft.libelle,
            groupKey: draft.groupKey,
            roleCompteExterne: memoryRoleForDraft(draft),
            compteInterneContexteId: contextAccount?.id ?? null,
            identifiantCompteInterneContexte: contextAccount?.identifiant ?? null,
          }
        }),
      })

      const suggestionsById = new Map(response.operations.map((operation) => [operation.operationImportId, operation]))
      const hydratedDrafts = sourceDrafts.map((draft) => {
        const suggestion = suggestionsById.get(draft.id)
        if (!suggestion?.regle || draft.status === 'imported') {
          return {
            ...draft,
            memoryRuleId: null,
            memoryKey: suggestion?.cleLibelleNormalisee ?? draft.memoryKey,
            memoryApplied: false,
            memoryWarning: '',
          }
        }

        return applyMemoryRuleToDraft(
          draft,
          suggestion.regle,
          externalAccounts,
          sousCategoriesQuery.data ?? [],
          beneficiairesQuery.data ?? [],
        )
      })

      setMemoryError('')
      return hydratedDrafts
    } catch (error) {
      setMemoryError(apiErrorMessage(error))
      return sourceDrafts
    }
  }

  async function hydrateDraftsWithDuplicates(sourceDrafts: ImportDraft[]): Promise<ImportDraft[]> {
    const activeDrafts = sourceDrafts.filter((draft) => draft.status !== 'imported')
    if (!activeDrafts.length) {
      setDuplicateError('')
      return sourceDrafts
    }

    try {
      const response = await monatisApi.detectStatementImportDuplicates({
        operations: activeDrafts.map((draft) => ({
          operationImportId: draft.id,
          libelle: draft.libelle,
          dateValeur: nullIfBlank(draft.dateValeur),
          dateComptabilisation: nullIfBlank(draft.dateComptabilisation),
          montantEnCentimes: draftAmountCents(draft),
          codeTypeOperation: draft.codeTypeOperation,
          identifiantCompteDepense: draft.identifiantCompteDepense,
          identifiantCompteRecette: draft.identifiantCompteRecette,
        })),
      })

      const duplicatesById = new Map(response.operations.map((operation) => [operation.operationImportId, operation]))
      setDuplicateError('')
      return sourceDrafts.map((draft) => applyDuplicateDetectionResult(draft, duplicatesById.get(draft.id)))
    } catch (error) {
      setDuplicateError(apiErrorMessage(error))
      return sourceDrafts
    }
  }

  async function hydrateDraftsForImport(sourceDrafts: ImportDraft[]): Promise<ImportDraft[]> {
    const memoryDrafts = await hydrateDraftsWithMemory(sourceDrafts)
    return hydrateDraftsWithDuplicates(memoryDrafts)
  }

  const analyzeMutation = useMutation({
    mutationFn: (file: File) => pdfImporterApi.analyzeStatementPdf(file),
    onSuccess: async (payload) => {
      setResultWarnings(payload.warnings ?? [])
      setBalanceControl(payload.stats?.balance_control ?? null)
      setDuplicateDeletionError('')
      const defaultStatementAccountId = statementAccountId
      const mappedDrafts = (payload.operation_candidates ?? [])
        .map((candidate) => candidateToDraft(candidate, externalAccounts))
        .map((draft) => applyStatementAccount(draft, defaultStatementAccountId, externalAccounts))
      if (defaultStatementAccountId) {
        setStatementAccountId(defaultStatementAccountId)
      }
      const hydratedDrafts = await hydrateDraftsForImport(mappedDrafts)
      setDrafts(hydratedDrafts)
      setActiveFilter(nextFilterForDrafts(hydratedDrafts))
      setSimilarGroupsOpen(false)
      setExpandedGroupKeys([])
      setExpandedId(null)
      setDraftPageIndex(1)
      setStatementAccountPromptOpen(hydratedDrafts.length > 0)
    },
  })

  function draftIssues(draft: ImportDraft): DraftIssue[] {
    const issues: DraftIssue[] = []

    if (draft.status === 'imported') {
      return issues
    }

    if (!draft.codeTypeOperation.trim()) {
      issues.push({ field: 'codeTypeOperation', label: 'Type', message: 'Type obligatoire.' })
    }

    if (!draft.dateValeur.trim()) {
      issues.push({ field: 'dateValeur', label: 'Date valeur', message: 'Date obligatoire.' })
    }

    if (Math.abs(parseMoneyToCents(draft.montant)) <= 0) {
      issues.push({ field: 'montant', label: 'Montant', message: 'Montant obligatoire.' })
    }

    if (!draft.identifiantCompteDepense.trim()) {
      issues.push({ field: 'identifiantCompteDepense', label: 'Compte depense', message: 'Compte depense obligatoire.' })
    }

    if (!draft.identifiantCompteRecette.trim()) {
      issues.push({ field: 'identifiantCompteRecette', label: 'Compte recette', message: 'Compte recette obligatoire.' })
    }

    return issues
  }

  function draftIssue(draft: ImportDraft): DraftIssue | null {
    return draftIssues(draft)[0] ?? null
  }

  function correctionStepsForDraft(draft: ImportDraft): CorrectionStep[] {
    if (draft.status === 'imported') {
      return []
    }

    return draftIssues(draft).map((issue) => ({
      kind: issue.field,
      label: issue.label,
      message: issue.message,
    }))
  }

  function draftReviewState(draft: ImportDraft): DraftReviewState {
    if (draft.status === 'imported') {
      return 'auto'
    }

    if (draftIssue(draft)) {
      return 'blocked'
    }

    return 'auto'
  }

  function draftIsReadyForImport(draft: ImportDraft): boolean {
    return draft.status !== 'imported' && draft.selected && !draftIssue(draft)
  }

  function nextFilterForDrafts(nextDrafts: ImportDraft[]): ImportFilter {
    const hasMissingImportantField = nextDrafts.some((draft) => draft.status !== 'imported' && Boolean(draftIssue(draft)))
    if (hasMissingImportantField) {
      return 'needs-action'
    }

    const hasDuplicates = nextDrafts.some((draft) => draft.status !== 'imported' && draft.duplicateStatus !== 'NOUVELLE')
    return hasDuplicates ? 'duplicates' : 'ready'
  }

  const blockedDraftCount = drafts.filter((draft) => draft.status !== 'imported' && draftReviewState(draft) === 'blocked').length
  const reviewDraftCount = drafts.filter((draft) => draft.status !== 'imported' && draftReviewState(draft) === 'review').length
  const readyDraftCount = drafts.filter((draft) => draftIsReadyForImport(draft)).length
  const exactDuplicateCount = drafts.filter((draft) => draft.status !== 'imported' && draft.duplicateStatus === 'DOUBLON_EXACT').length
  const probableDuplicateCount = drafts.filter((draft) => draft.status !== 'imported' && draft.duplicateStatus === 'DOUBLON_PROBABLE').length
  const draftSearchNeedle = normalizedLookup(draftSearch)
  const draftMatchesSearch = (draft: ImportDraft): boolean => {
    if (!draftSearchNeedle) {
      return true
    }

    const allAccounts = [...internalAccounts, ...externalAccounts]
    const depenseAccount = findAccountByIdOrIdentifier(allAccounts, null, draft.identifiantCompteDepense)
    const recetteAccount = findAccountByIdOrIdentifier(allAccounts, null, draft.identifiantCompteRecette)
    const operationType = (typesQuery.data ?? []).find((type) => type.code === draft.codeTypeOperation)
    const amountCents = Math.abs(parseMoneyToCents(draft.montant))
    const amountEuro = (amountCents / 100).toFixed(2)
    const dateValeurFr = frenchDateToken(draft.dateValeur)
    const dateComptaFr = frenchDateToken(draft.dateComptabilisation)

    return normalizedLookup(
      [
        draft.sourceIndex,
        draft.numero,
        draft.libelle,
        draft.dateValeur,
        dateValeurFr,
        dateValeurFr.replace(/\D/g, ''),
        draft.dateComptabilisation,
        dateComptaFr,
        dateComptaFr.replace(/\D/g, ''),
        draft.montant,
        amountEuro,
        amountEuro.replace('.', ','),
        formatCurrencyFromCents(amountCents),
        draft.codeTypeOperation,
        operationType?.libelleCourt,
        operationType?.libelle,
        draft.identifiantCompteDepense,
        depenseAccount?.libelle,
        draft.identifiantCompteRecette,
        recetteAccount?.libelle,
        draft.nomSousCategorie,
        draft.nomsBeneficiaires.join(' '),
        draft.suggestedCounterpartyName,
        draft.groupLabel,
        draft.duplicateOperationLabel,
        draft.duplicateOperationNumero,
        draft.duplicateOperationDate,
      ]
        .filter((value) => value != null && String(value).trim())
        .join(' '),
    ).includes(draftSearchNeedle)
  }
  const filteredDrafts = drafts.filter((draft) => {
    let matchesFilter = activeFilter === 'all'

    if (!matchesFilter && draft.status === 'imported') {
      return false
    }

    if (activeFilter === 'needs-action') {
      matchesFilter = Boolean(draftIssue(draft))
    }

    if (activeFilter === 'ready') {
      matchesFilter = draftIsReadyForImport(draft)
    }

    if (activeFilter === 'duplicates') {
      matchesFilter = draft.duplicateStatus !== 'NOUVELLE'
    }

    const matchesSelectedFilter = activeFilter !== 'all' || !showOnlySelectedInAll || draft.selected

    return matchesFilter && matchesSelectedFilter && draftMatchesSearch(draft)
  })
  const draftPageCount = Math.max(1, Math.ceil(filteredDrafts.length / draftPageSize))
  const currentDraftPage = Math.min(draftPageIndex, draftPageCount)
  const draftPageStartIndex = filteredDrafts.length ? (currentDraftPage - 1) * draftPageSize : 0
  const draftPageEndIndex = Math.min(draftPageStartIndex + draftPageSize, filteredDrafts.length)
  const visibleFilteredDrafts = filteredDrafts.slice(draftPageStartIndex, draftPageEndIndex)

  function learningItemForDraft(draft: ImportDraft): StatementImportRuleLearningItemRequest {
    const contextAccount = findAccountByIdOrIdentifier(internalAccounts, null, statementAccountIdentifier(draft))
    const contextAccountId = statementAccountIdentifier(draft)
    const externalAccountId = counterpartyAccountIdentifier(draft)
    const externalAccount = findAccountByIdOrIdentifier(externalAccounts, null, externalAccountId)
    const sousCategorie = findReferenceByIdOrName(sousCategoriesQuery.data ?? [], null, draft.nomSousCategorie)
    const selectedBeneficiaires = draft.nomsBeneficiaires
      .map((name) => findReferenceByIdOrName(beneficiairesQuery.data ?? [], null, name))
      .filter((beneficiaire): beneficiaire is ReferenceListItem => Boolean(beneficiaire))

    return {
      libelle: draft.libelle,
      groupKey: draft.groupKey,
      roleCompteExterne: memoryRoleForDraft(draft),
      codeTypeOperation: draft.codeTypeOperation,
      compteInterneContexteId: contextAccount?.id ?? null,
      identifiantCompteInterneContexte: contextAccount?.identifiant ?? nullIfBlank(contextAccountId),
      compteExterneId: externalAccount?.id ?? null,
      identifiantCompteExterne: externalAccount?.identifiant ?? nullIfBlank(externalAccountId),
      sousCategorieId: sousCategorie?.id ?? null,
      nomSousCategorie: sousCategorie?.nom ?? nullIfBlank(draft.nomSousCategorie),
      beneficiaireIds: selectedBeneficiaires.map((beneficiaire) => beneficiaire.id).filter((id): id is number => id != null),
      nomsBeneficiaires: draft.nomsBeneficiaires,
    }
  }

  const importMutation = useMutation({
    onMutate: () => {
      setDuplicateDeletionError('')
    },
    mutationFn: async (): Promise<ImportRunResult> => {
      const outcomes: ImportOutcome[] = []
      const selectedDrafts = drafts.filter((draft) => draft.selected && draft.status !== 'imported')
      const learningItems: StatementImportRuleLearningItemRequest[] = []
      const duplicateOperationsToDelete = new Set(pendingDuplicateDeletionNumeros)

      for (const draft of selectedDrafts) {
        const issue = draftIssue(draft)
        if (issue) {
          outcomes.push({ id: draft.id, ok: false, error: issue.message })
          continue
        }

        const amountCents = Math.abs(parseMoneyToCents(draft.montant))

        try {
          const created = await monatisApi.createOperation({
            numero: nullIfBlank(draft.numero),
            libelle: nullIfBlank(draft.libelle),
            codeTypeOperation: draft.codeTypeOperation,
            dateValeur: nullIfBlank(draft.dateValeur),
            montantEnCentimes: amountCents,
            identifiantCompteDepense: draft.identifiantCompteDepense,
            identifiantCompteRecette: draft.identifiantCompteRecette,
            nomSousCategorie: nullIfBlank(draft.nomSousCategorie),
            nomsBeneficiaires: draft.nomsBeneficiaires,
          })

          await monatisApi.updateOperation(created.numero, {
            numero: null,
            libelle: null,
            codeTypeOperation: null,
            dateValeur: null,
            montantEnCentimes: amountCents,
            identifiantCompteDepense: null,
            identifiantCompteRecette: null,
            pointee: null,
            lignes: [
              {
                numeroLigne: null,
                libelle: nullIfBlank(draft.libelle),
                dateComptabilisation: nullIfBlank(draft.dateComptabilisation || draft.dateValeur),
                montantEnCentimes: amountCents,
                nomSousCategorie: nullIfBlank(draft.nomSousCategorie),
                nomsBeneficiaires: draft.nomsBeneficiaires,
              },
            ],
          })

          outcomes.push({ id: draft.id, ok: true })
          learningItems.push(learningItemForDraft(draft))
        } catch (error) {
          outcomes.push({ id: draft.id, ok: false, error: apiErrorMessage(error) })
        }
      }

      let duplicateDeletionError = ''
      let duplicateDeletionCount = 0
      for (const operationNumero of duplicateOperationsToDelete) {
        try {
          await monatisApi.deleteOperation(operationNumero)
          duplicateDeletionCount += 1
        } catch (error) {
          duplicateDeletionError = [duplicateDeletionError, `${operationNumero}: ${apiErrorMessage(error)}`].filter(Boolean).join(' | ')
        }
      }

      let memoryLearningError = ''
      if (learningItems.length) {
        try {
          await monatisApi.learnStatementImportRules({ operations: learningItems })
        } catch (error) {
          memoryLearningError = apiErrorMessage(error)
        }
      }

      return { outcomes, memoryLearningError, duplicateDeletionError, duplicateDeletionCount }
    },
    onSuccess: async ({ outcomes, memoryLearningError, duplicateDeletionError, duplicateDeletionCount }) => {
      const outcomeById = new Map(outcomes.map((outcome) => [outcome.id, outcome]))
      const successCount = outcomes.filter((outcome) => outcome.ok).length

      setDrafts((current) =>
        current.map((draft) => {
          const outcome = outcomeById.get(draft.id)
          if (!outcome) {
            return draft
          }

          return outcome.ok ? { ...draft, status: 'imported', error: '', selected: false } : { ...draft, status: 'error', error: outcome.error ?? 'Import impossible.' }
        }),
      )

      if (successCount || duplicateDeletionCount) {
        await queryClient.invalidateQueries({ queryKey: ['operations'] })
        await onImported?.()
      }

      setMemoryError(memoryLearningError)
      setDuplicateDeletionError(duplicateDeletionError)
    },
  })

  function resetImportState() {
    setSelectedFile(null)
    setResultWarnings([])
    setBalanceControl(null)
    setStatementAccountId('')
    setDrafts([])
    setExpandedId(null)
    setMemoryError('')
    setDuplicateError('')
    setDuplicateDeletionError('')
    setActiveFilter('needs-action')
    setShowOnlySelectedInAll(false)
    setSimilarGroupsOpen(false)
    setExpandedGroupKeys([])
    setCorrectionOpen(false)
    setCorrectionDraftIds([])
    setCorrectionIndex(0)
    setStatementAccountPromptOpen(false)
    setDuplicatePreviewDraftId(null)
    setDuplicateExistingKeepByNumero({})
    setDuplicateKeepNotice(null)
    setDuplicateHoverTooltip(null)
    setCreationChooserOpen(false)
    setCreationChooserStep('root')
    setQuickReferenceDialog(null)
    setQuickAccountDialog(null)
    setBeneficiaryPicker(null)
    analyzeMutation.reset()
    importMutation.reset()
    setDraftPageIndex(1)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function closeAndReset() {
    resetImportState()
    onClose()
  }

  function selectFile(file: File | null) {
    setSelectedFile(file)
    setResultWarnings([])
    setBalanceControl(null)
    setDrafts([])
    setExpandedId(null)
    setMemoryError('')
    setDuplicateError('')
    setDuplicateDeletionError('')
    setActiveFilter('needs-action')
    setShowOnlySelectedInAll(false)
    setSimilarGroupsOpen(false)
    setExpandedGroupKeys([])
    setCorrectionOpen(false)
    setCorrectionDraftIds([])
    setCorrectionIndex(0)
    setStatementAccountPromptOpen(false)
    setDuplicatePreviewDraftId(null)
    setDuplicateExistingKeepByNumero({})
    setDuplicateKeepNotice(null)
    setDuplicateHoverTooltip(null)
    setCreationChooserOpen(false)
    setCreationChooserStep('root')
    setQuickReferenceDialog(null)
    setQuickAccountDialog(null)
    setBeneficiaryPicker(null)
    analyzeMutation.reset()
    importMutation.reset()
    setDraftPageIndex(1)
  }

  function patchedDraft(draft: ImportDraft, patch: Partial<ImportDraft>): ImportDraft {
    const duplicatePatch = hasDuplicateCriteriaPatch(patch) ? duplicateResetPatch() : {}

    return {
      ...draft,
      ...patch,
      ...duplicatePatch,
      status: draft.status === 'imported' ? 'imported' : 'draft',
      error: '',
      memoryWarning:
        'codeTypeOperation' in patch ||
        'identifiantCompteDepense' in patch ||
        'identifiantCompteRecette' in patch ||
        'nomSousCategorie' in patch ||
        'nomsBeneficiaires' in patch
          ? ''
          : (patch.memoryWarning ?? draft.memoryWarning),
    }
  }

  function updateDraft(id: string, patch: Partial<ImportDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? patchedDraft(draft, patch) : draft)),
    )
  }

  function updateDraftType(draft: ImportDraft, codeTypeOperation: string) {
    const depenseOptions = accountOptionsForField(codeTypeOperation, 'depense', internalAccounts, externalAccounts)
    const recetteOptions = accountOptionsForField(codeTypeOperation, 'recette', internalAccounts, externalAccounts)

    updateDraft(draft.id, {
      codeTypeOperation,
      identifiantCompteDepense: depenseOptions.some((account) => account.identifiant === draft.identifiantCompteDepense) ? draft.identifiantCompteDepense : '',
      identifiantCompteRecette: recetteOptions.some((account) => account.identifiant === draft.identifiantCompteRecette) ? draft.identifiantCompteRecette : '',
    })
  }

  function toggleBeneficiary(draft: ImportDraft, name: string) {
    updateDraft(draft.id, {
      nomsBeneficiaires: draft.nomsBeneficiaires.includes(name)
        ? draft.nomsBeneficiaires.filter((value) => value !== name)
        : [...draft.nomsBeneficiaires, name],
    })
  }

  function addBeneficiary(draft: ImportDraft, name: string) {
    if (!name || draft.nomsBeneficiaires.includes(name)) {
      return
    }

    updateDraft(draft.id, {
      nomsBeneficiaires: [...draft.nomsBeneficiaires, name],
    })
  }

  async function changeStatementAccount(nextStatementAccountId: string) {
    setStatementAccountId(nextStatementAccountId)
    const accountDrafts = drafts.map((draft) => (draft.status === 'imported' ? draft : applyStatementAccount(draft, nextStatementAccountId, externalAccounts)))
    setDrafts(accountDrafts)
    const hydratedDrafts = await hydrateDraftsForImport(accountDrafts)
    setDrafts(hydratedDrafts)
    setActiveFilter(nextFilterForDrafts(hydratedDrafts))
    setSimilarGroupsOpen(false)
    setExpandedGroupKeys([])
    setExpandedId(null)
    setDraftPageIndex(1)
  }

  async function chooseStatementAccountFromPrompt(nextStatementAccountId: string) {
    setStatementAccountPromptOpen(false)
    await changeStatementAccount(nextStatementAccountId)
  }

  async function applyExternalAccountToGroup(groupKey: string, externalAccountId: string) {
    const nextDrafts: ImportDraft[] = drafts.map((draft) => {
      if (draft.status === 'imported' || draft.groupKey !== groupKey) {
        return draft
      }

      const accountPatch =
        draft.counterpartyAccountRole === 'depense'
          ? { identifiantCompteDepense: externalAccountId }
          : { identifiantCompteRecette: externalAccountId }

      return {
        ...draft,
        ...accountPatch,
        ...duplicateResetPatch(),
        status: 'draft',
        error: '',
        memoryWarning: '',
      }
    })

    setDrafts(nextDrafts)
    const duplicateDrafts = await hydrateDraftsWithDuplicates(nextDrafts)
    setDrafts(duplicateDrafts)
  }

  async function applyTypeToGroup(groupKey: string, codeTypeOperation: string) {
    const nextDrafts: ImportDraft[] = drafts.map((draft) => {
      if (draft.status === 'imported' || draft.groupKey !== groupKey) {
        return draft
      }

      const depenseOptions = accountOptionsForField(codeTypeOperation, 'depense', internalAccounts, externalAccounts)
      const recetteOptions = accountOptionsForField(codeTypeOperation, 'recette', internalAccounts, externalAccounts)

      return {
        ...draft,
        ...duplicateResetPatch(),
        codeTypeOperation,
        identifiantCompteDepense: depenseOptions.some((account) => account.identifiant === draft.identifiantCompteDepense) ? draft.identifiantCompteDepense : '',
        identifiantCompteRecette: recetteOptions.some((account) => account.identifiant === draft.identifiantCompteRecette) ? draft.identifiantCompteRecette : '',
        status: 'draft',
        error: '',
        memoryWarning: '',
      }
    })

    setDrafts(nextDrafts)
    const duplicateDrafts = await hydrateDraftsWithDuplicates(nextDrafts)
    setDrafts(duplicateDrafts)
  }

  function applySousCategorieToGroup(groupKey: string, nomSousCategorie: string) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.status === 'imported' || draft.groupKey !== groupKey
          ? draft
          : {
              ...draft,
              nomSousCategorie,
              status: 'draft',
              error: '',
              memoryWarning: '',
            },
      ),
    )
  }

  function applyBeneficiariesToGroup(groupKey: string, names: string[]) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.status === 'imported' || draft.groupKey !== groupKey
          ? draft
          : {
              ...draft,
              nomsBeneficiaires: names,
              status: 'draft',
              error: '',
              memoryWarning: '',
            },
      ),
    )
  }

  function openDraftBeneficiaryPicker(draft: ImportDraft) {
    setBeneficiaryPicker({ kind: 'draft', id: draft.id, values: draft.nomsBeneficiaires })
  }

  function openGroupBeneficiaryPicker(group: ImportGroup) {
    setBeneficiaryPicker({ kind: 'group', id: group.key, values: group.mixedBeneficiaries ? [] : group.currentBeneficiaries })
  }

  function togglePickedBeneficiary(name: string) {
    setBeneficiaryPicker((current) => {
      if (!current) {
        return current
      }

      const nextValues = current.values.includes(name) ? current.values.filter((value) => value !== name) : [...current.values, name]
      return { ...current, values: nextValues }
    })
  }

  function validateBeneficiaryPicker() {
    if (!beneficiaryPicker) {
      return
    }

    if (beneficiaryPicker.kind === 'draft') {
      updateDraft(beneficiaryPicker.id, { nomsBeneficiaires: beneficiaryPicker.values })
    } else {
      applyBeneficiariesToGroup(beneficiaryPicker.id, beneficiaryPicker.values)
    }

    setBeneficiaryPicker(null)
  }

  function openCreationChooser() {
    setCreationChooserStep('root')
    setCreationChooserOpen(true)
  }

  function toggleAllDraftSelection() {
    const nextSelected = !allSelectableDraftsSelected
    setDrafts((current) =>
      current.map((draft) =>
        draft.status === 'imported'
          ? draft
          : {
              ...draft,
              selected: nextSelected,
              duplicateIgnored: nextSelected ? false : draft.duplicateIgnored,
            },
      ),
    )
  }

  function changeImportFilter(nextFilter: ImportFilter) {
    setActiveFilter(nextFilter)
    setSimilarGroupsOpen(false)
    setExpandedGroupKeys([])
    setExpandedId(null)
    setDraftPageIndex(1)
  }

  function changeDraftPageSize(value: string) {
    const nextSize = Number(value)
    if (!DRAFT_PAGE_SIZE_OPTIONS.includes(nextSize)) {
      return
    }

    setDraftPageSize(nextSize)
    setDraftPageIndex(1)
    setExpandedId(null)
  }

  function changeDraftPage(nextPage: number) {
    const clampedPage = Math.max(1, Math.min(draftPageCount, nextPage))
    setDraftPageIndex(clampedPage)
    setExpandedId(null)
    window.setTimeout(() => {
      statementImportScrollElement()?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 0)
  }

  function renderDraftPaginationControls(position: 'top' | 'bottom') {
    return (
      <div className={cx('statement-import-list-controls', position === 'bottom' && 'bottom')} aria-label={`Pagination des operations du releve ${position === 'bottom' ? 'bas' : 'haut'}`}>
        {activeFilter === 'all' && position === 'top' ? (
          <label className="statement-import-selected-only-filter">
            <input
              type="checkbox"
              checked={showOnlySelectedInAll}
              onChange={(event) => {
                setShowOnlySelectedInAll(event.target.checked)
                setDraftPageIndex(1)
                setExpandedId(null)
              }}
            />
            <span>Afficher uniquement les operations cochees</span>
          </label>
        ) : null}

        <div className="statement-import-list-count">
          <strong>{filteredDrafts.length ? `${draftPageStartIndex + 1}-${draftPageEndIndex}` : '0'}</strong>
          <span>{`sur ${filteredDrafts.length}`}</span>
        </div>

        <label className="statement-import-page-size">
          <span>Afficher</span>
          <select value={draftPageSize} onChange={(event) => changeDraftPageSize(event.target.value)} aria-label="Nombre d'operations affichees">
            {DRAFT_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="statement-import-page-buttons">
          <button type="button" disabled={currentDraftPage <= 1} onClick={() => changeDraftPage(currentDraftPage - 1)} aria-label="Page precedente">
            <ChevronLeft size={15} />
          </button>
          <span>{`${currentDraftPage}/${draftPageCount}`}</span>
          <button type="button" disabled={currentDraftPage >= draftPageCount} onClick={() => changeDraftPage(currentDraftPage + 1)} aria-label="Page suivante">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  function statementImportScrollElement(): HTMLElement | null {
    const importRoot = statementImportRef.current
    return (importRoot?.closest('.floating-panel-body') as HTMLElement | null) ?? importRoot
  }

  function scrollImportPanel(position: 'top' | 'bottom') {
    const target = statementImportScrollElement()

    target?.scrollTo({
      top: position === 'top' ? 0 : target.scrollHeight,
      behavior: 'smooth',
    })
  }

  function scrollImportPanelToRailPoint(clientY: number, track: HTMLElement) {
    const target = statementImportScrollElement()
    if (!target) {
      return
    }

    const rect = track.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(rect.height, 1)))
    target.scrollTop = ratio * Math.max(0, target.scrollHeight - target.clientHeight)
  }

  function startImportRailScroll(event: ReactPointerEvent<HTMLDivElement>) {
    if (importScrollMetrics.scrollHeight <= importScrollMetrics.clientHeight + 1) {
      return
    }

    const track = event.currentTarget
    scrollImportPanelToRailPoint(event.clientY, track)

    const onPointerMove = (moveEvent: PointerEvent) => {
      scrollImportPanelToRailPoint(moveEvent.clientY, track)
    }
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
  }

  function uncheckDuplicateDrafts() {
    setDrafts((current) =>
      current.map((draft) =>
        draft.status === 'imported' || draft.duplicateStatus === 'NOUVELLE'
          ? draft
          : {
              ...draft,
              selected: false,
              duplicateIgnored: true,
            },
      ),
    )
  }

  function checkDuplicateDrafts() {
    setDrafts((current) =>
      current.map((draft) =>
        draft.status === 'imported' || draft.duplicateStatus === 'NOUVELLE'
          ? draft
          : {
              ...draft,
              selected: true,
              duplicateIgnored: true,
            },
      ),
    )
  }

  function duplicateStatusLabel(draft: ImportDraft) {
    return draft.duplicateStatus === 'DOUBLON_EXACT' ? 'Doublon exact' : 'Doublon probable'
  }

  function renderDuplicatePreviewButton(draft: ImportDraft, visible: boolean) {
    if (activeFilter !== 'duplicates' || !visible || draft.status === 'imported' || draft.status === 'error' || draft.duplicateStatus === 'NOUVELLE') {
      return null
    }

    return (
      <button
        type="button"
        className="statement-import-duplicate-preview-button"
        data-tooltip="Voir cette operation et les doublons detectes."
        aria-label="Voir les doublons detectes"
        onClick={(event) => {
          event.stopPropagation()
          setDuplicatePreviewDraftId(draft.id)
        }}
      >
        <Eye size={15} />
      </button>
    )
  }

  function duplicateExistingKept(numero: string) {
    return duplicateExistingKeepByNumero[numero] ?? true
  }

  function showDuplicateKeepNotice(kept: boolean) {
    if (duplicateNoticeTimeoutRef.current) {
      clearTimeout(duplicateNoticeTimeoutRef.current)
    }

    setDuplicateKeepNotice({
      tone: kept ? 'keep' : 'delete',
      message: kept
        ? 'Ce doublon deja enregistre sera conserve quand vous cliquerez sur Importer.'
        : 'Ce doublon deja enregistre sera supprime quand vous cliquerez sur Importer.',
    })

    duplicateNoticeTimeoutRef.current = setTimeout(() => {
      setDuplicateKeepNotice(null)
      duplicateNoticeTimeoutRef.current = null
    }, 2800)
  }

  function showDuplicateHoverTooltipFromMouse(event: ReactMouseEvent<HTMLElement>, text: string) {
    setDuplicateHoverTooltip({
      text,
      x: Math.max(12, Math.min(window.innerWidth - 12, event.clientX)),
      y: Math.max(84, event.clientY - 12),
    })
  }

  function showDuplicateHoverTooltipFromFocus(event: ReactFocusEvent<HTMLElement>, text: string) {
    const rect = event.currentTarget.getBoundingClientRect()
    setDuplicateHoverTooltip({
      text,
      x: rect.left + rect.width / 2,
      y: Math.max(84, rect.top - 8),
    })
  }

  function toggleDuplicateExistingKeep(numero: string) {
    const nextKept = !duplicateExistingKept(numero)
    setDuplicateExistingKeepByNumero((current) => ({
      ...current,
      [numero]: nextKept,
    }))
    showDuplicateKeepNotice(nextKept)
  }

  function moveDuplicatePreview(delta: number) {
    if (!duplicatePreviewDraftIds.length || duplicatePreviewIndex < 0) {
      return
    }

    const nextIndex = Math.max(0, Math.min(duplicatePreviewDraftIds.length - 1, duplicatePreviewIndex + delta))
    setDuplicatePreviewDraftId(duplicatePreviewDraftIds[nextIndex])
  }

  function renderDuplicateImportDraftDetails(draft: ImportDraft, title: string) {
    const allAccounts = [...internalAccounts, ...externalAccounts]
    const depenseOptions = accountOptionsWithCurrent(
      accountOptionsForField(draft.codeTypeOperation, 'depense', internalAccounts, externalAccounts),
      draft.identifiantCompteDepense,
      allAccounts,
    )
    const recetteOptions = accountOptionsWithCurrent(
      accountOptionsForField(draft.codeTypeOperation, 'recette', internalAccounts, externalAccounts),
      draft.identifiantCompteRecette,
      allAccounts,
    )

    return (
      <section className="statement-import-duplicate-preview-section editable">
        <div className="statement-import-duplicate-preview-section-head">
          <div>
            <span>{title}</span>
            <strong>{draft.libelle || `Operation ${draft.sourceIndex}`}</strong>
            <small>
              {draft.dateComptabilisation || draft.dateValeur || 'Date manquante'} - {formatCurrencyFromCents(Math.abs(parseMoneyToCents(draft.montant)))}
            </small>
          </div>
          <label
            className="statement-import-duplicate-source-toggle"
            data-tooltip="Cochee : cette operation du releve sera importee. Decochee : elle sera ignoree."
            aria-label={draft.selected ? 'Operation du releve importee' : 'Operation du releve ignoree'}
            onMouseEnter={(event) => showDuplicateHoverTooltipFromMouse(event, 'Cochee : cette operation du releve sera importee. Decochee : elle sera ignoree.')}
            onMouseMove={(event) => showDuplicateHoverTooltipFromMouse(event, 'Cochee : cette operation du releve sera importee. Decochee : elle sera ignoree.')}
            onMouseLeave={() => setDuplicateHoverTooltip(null)}
            onFocus={(event) => showDuplicateHoverTooltipFromFocus(event, 'Cochee : cette operation du releve sera importee. Decochee : elle sera ignoree.')}
            onBlur={() => setDuplicateHoverTooltip(null)}
          >
            <input
              type="checkbox"
              checked={draft.selected}
              disabled={draft.status === 'imported'}
              onChange={(event) => updateDraft(draft.id, { selected: event.target.checked, duplicateIgnored: event.target.checked ? false : draft.duplicateIgnored })}
            />
            <span />
          </label>
        </div>

        <div className="form-grid three-columns statement-import-duplicate-edit-grid">
          <FormField label="Type">
            <select value={draft.codeTypeOperation} onChange={(event) => updateDraftType(draft, event.target.value)}>
              <option value="">Choisir</option>
              {(typesQuery.data ?? []).map((type) => (
                <option key={type.code} value={type.code}>
                  {type.libelleCourt}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Date valeur">
            <input type="date" value={draft.dateValeur} onChange={(event) => updateDraft(draft.id, { dateValeur: event.target.value })} />
          </FormField>

          <FormField label="Date compta">
            <input type="date" value={draft.dateComptabilisation} onChange={(event) => updateDraft(draft.id, { dateComptabilisation: event.target.value })} />
          </FormField>

          <FormField label="Montant">
            <input value={draft.montant} inputMode="decimal" onChange={(event) => updateDraft(draft.id, { montant: event.target.value })} />
          </FormField>

          <FormField label="Compte depense">
            <select value={draft.identifiantCompteDepense} onChange={(event) => updateDraft(draft.id, { identifiantCompteDepense: event.target.value })}>
              <option value="">Choisir</option>
              {depenseOptions.map((account) => (
                <option key={account.identifiant} value={account.identifiant}>
                  {accountChoiceLabel(account)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Compte recette">
            <select value={draft.identifiantCompteRecette} onChange={(event) => updateDraft(draft.id, { identifiantCompteRecette: event.target.value })}>
              <option value="">Choisir</option>
              {recetteOptions.map((account) => (
                <option key={account.identifiant} value={account.identifiant}>
                  {accountChoiceLabel(account)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Libelle">
            <input value={draft.libelle} onChange={(event) => updateDraft(draft.id, { libelle: event.target.value })} />
          </FormField>

          <FormField label="Sous-categorie">
            <select value={draft.nomSousCategorie} onChange={(event) => updateDraft(draft.id, { nomSousCategorie: event.target.value })}>
              <option value="">Aucune</option>
              {(sousCategoriesQuery.data ?? []).map((item) => (
                <option key={item.nom} value={item.nom}>
                  {item.nom}
                </option>
              ))}
            </select>
          </FormField>

          <div className="statement-import-inline-beneficiaries">
            <span>Beneficiaires</span>
            <button type="button" className="statement-import-beneficiary-field" onClick={() => openDraftBeneficiaryPicker(draft)}>
              {`Selectionne ${draft.nomsBeneficiaires.length}`}
            </button>
          </div>
        </div>
      </section>
    )
  }

  function renderExistingDuplicateDetails(draft: ImportDraft, operation: OperationBasic | undefined) {
    const existing = draft.duplicateOperation
    const numero = operation?.numero ?? existing?.numero ?? draft.duplicateOperationNumero
    const kept = numero ? duplicateExistingKept(numero) : true
    const lineItems = operation?.lignes ?? []
    const dateCreation = operation?.dateCreation ?? existing?.dateCreation ?? null
    const dateCreationLabel = dateCreation ? `cree le ${formatFrenchDateTime(dateCreation)}` : 'creation non disponible'

    return (
      <section className="statement-import-duplicate-preview-section existing">
        <div className="statement-import-duplicate-preview-section-head">
          <div>
            <span>Operation deja presente en base</span>
            <strong>{operation?.libelle || existing?.libelle || draft.duplicateOperationLabel || numero || 'Operation existante'}</strong>
            <small>
              {[
                numero ? `N ${numero}` : null,
                dateCreationLabel,
                operation?.dateValeur || existing?.dateValeur || existing?.dateComptabilisation || draft.duplicateOperationDate || null,
                operation?.montantEnCentimes != null
                  ? formatCurrencyFromCents(operation.montantEnCentimes)
                  : draft.duplicateOperationAmount != null
                    ? formatCurrencyFromCents(draft.duplicateOperationAmount)
                    : null,
              ]
                .filter(Boolean)
                .join(' - ')}
            </small>
          </div>
          <label
            className="statement-import-duplicate-keep-toggle"
            data-tooltip="Cochee : ce doublon deja enregistre reste dans l'application. Decochee : il sera supprime quand vous cliquerez sur Importer."
            aria-label={kept ? 'Garder le doublon deja en base' : 'Supprimer le doublon deja en base pendant l import'}
            onMouseEnter={(event) => showDuplicateHoverTooltipFromMouse(event, "Cochee : ce doublon deja enregistre reste dans l'application. Decochee : il sera supprime quand vous cliquerez sur Importer.")}
            onMouseMove={(event) => showDuplicateHoverTooltipFromMouse(event, "Cochee : ce doublon deja enregistre reste dans l'application. Decochee : il sera supprime quand vous cliquerez sur Importer.")}
            onMouseLeave={() => setDuplicateHoverTooltip(null)}
            onFocus={(event) => showDuplicateHoverTooltipFromFocus(event, "Cochee : ce doublon deja enregistre reste dans l'application. Decochee : il sera supprime quand vous cliquerez sur Importer.")}
            onBlur={() => setDuplicateHoverTooltip(null)}
          >
            <input type="checkbox" checked={kept} disabled={!numero} onChange={() => (numero ? toggleDuplicateExistingKeep(numero) : undefined)} />
            <span />
          </label>
        </div>

        <div className="statement-import-duplicate-readonly-grid">
          <span>Type</span>
          <strong>{operation?.typeOperation?.libelleCourt || existing?.codeTypeOperation || 'Non renseigne'}</strong>
          <span>Compte depense</span>
          <strong>{operation?.compteDepense ? accountChoiceLabel(operation.compteDepense) : existing?.libelleCompteDepense || existing?.identifiantCompteDepense || 'Non renseigne'}</strong>
          <span>Compte recette</span>
          <strong>{operation?.compteRecette ? accountChoiceLabel(operation.compteRecette) : existing?.libelleCompteRecette || existing?.identifiantCompteRecette || 'Non renseigne'}</strong>
        </div>

        {duplicateExistingOperationQuery.isFetching ? <small>Chargement du detail en base...</small> : null}
        {lineItems.length ? (
          <div className="statement-import-duplicate-lines">
            {lineItems.map((line) => (
              <div key={line.numeroLigne} className="statement-import-duplicate-line">
                <strong>{line.libelle || `Ligne ${line.numeroLigne}`}</strong>
                <small>
                  {line.dateComptabilisation} - {formatCurrencyFromCents(line.montantEnCentimes)}
                  {line.nomSousCategorie ? ` - ${line.nomSousCategorie}` : ''}
                  {line.nomsBeneficiaires?.length ? ` - ${line.nomsBeneficiaires.join(', ')}` : ''}
                </small>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    )
  }

  function accountCreationCreated(kind: 'interne' | 'externe', identifiant: string) {
    if (kind === 'interne') {
      void changeStatementAccount(identifiant)
    }

    if (kind === 'externe' && correctionDraft && currentCorrectionStep?.kind) {
      if (currentCorrectionStep.kind === 'identifiantCompteDepense') {
        applyCorrectionPatch(correctionDraft.id, { identifiantCompteDepense: identifiant })
      }

      if (currentCorrectionStep.kind === 'identifiantCompteRecette') {
        applyCorrectionPatch(correctionDraft.id, { identifiantCompteRecette: identifiant })
      }
    }
  }

  function referenceCreationCreated(resource: ReferenceResource, name: string) {
    if (!correctionDraft) {
      return
    }

    if (resource === 'souscategorie') {
      updateDraft(correctionDraft.id, { nomSousCategorie: name })
    }

    if (resource === 'beneficiaire') {
      addBeneficiary(correctionDraft, name)
    }
  }

  function openCreationTarget(choice: CreationChoice) {
    setCreationChooserOpen(false)

    if (choice === 'internal-account') {
      setQuickAccountDialog({
        title: 'Nouveau compte du releve',
        overlayClassName: 'overlay-super-top statement-import-create-overlay-layer',
        initialKind: 'interne',
        allowedKinds: ['interne'],
        onCreated: (identifiant) => accountCreationCreated('interne', identifiant),
      })
      return
    }

    if (choice === 'external-account') {
      setQuickAccountDialog({
        title: 'Nouveau compte externe',
        overlayClassName: 'overlay-super-top statement-import-create-overlay-layer',
        initialKind: 'externe',
        allowedKinds: ['externe'],
        onCreated: (identifiant) => accountCreationCreated('externe', identifiant),
      })
      return
    }

    setQuickReferenceDialog({
      resource: choice,
      title: choice === 'beneficiaire' ? 'Nouveau beneficiaire' : choice === 'souscategorie' ? 'Nouvelle sous-categorie' : `Nouvelle ${choice}`,
      overlayClassName: 'overlay-super-top statement-import-create-overlay-layer',
      onCreated: (name) => referenceCreationCreated(choice, name),
    })
  }

  function toggleSimilarGroupsPanel() {
    setSimilarGroupsOpen((current) => {
      const nextOpen = !current
      if (!nextOpen) {
        setExpandedGroupKeys([])
        setExpandedId(null)
      }
      return nextOpen
    })
  }

  function toggleSimilarGroup(groupKey: string) {
    setExpandedGroupKeys((current) => {
      const isOpen = current.includes(groupKey)
      return isOpen ? current.filter((key) => key !== groupKey) : [...current, groupKey]
    })
    setExpandedId(null)
  }

  function openCorrectionAssistant(ids: string[]) {
    const actionableIds = ids.filter((id) => {
      const draft = drafts.find((item) => item.id === id)
      return Boolean(draft && correctionStepsForDraft(draft).length)
    })

    if (!actionableIds.length) {
      return
    }

    setCorrectionDraftIds(actionableIds)
    setCorrectionIndex(0)
    setExpandedId(null)
    setCorrectionOpen(true)
  }

  function moveCorrection(delta: number) {
    setExpandedId(null)
    setCorrectionIndex((current) => {
      const next = Math.max(0, Math.min(correctionDraftIds.length - 1, current + delta))
      return next
    })
  }

  function moveAfterCorrection(nextDrafts: ImportDraft[], correctedDraftId: string) {
    const correctedDraft = nextDrafts.find((draft) => draft.id === correctedDraftId)
    if (correctedDraft && correctionStepsForDraft(correctedDraft).length) {
      return
    }

    const nextIndex = correctionDraftIds.findIndex((id, index) => {
      if (index <= correctionIndex) {
        return false
      }

      const draft = nextDrafts.find((item) => item.id === id)
      return Boolean(draft && correctionStepsForDraft(draft).length)
    })

    if (nextIndex >= 0) {
      setExpandedId(null)
      setCorrectionIndex(nextIndex)
      return
    }

    const previousIndex = correctionDraftIds.findIndex((id, index) => {
      if (index >= correctionIndex) {
        return false
      }

      const draft = nextDrafts.find((item) => item.id === id)
      return Boolean(draft && correctionStepsForDraft(draft).length)
    })

    if (previousIndex >= 0) {
      setExpandedId(null)
      setCorrectionIndex(previousIndex)
      return
    }

    setCorrectionOpen(false)
    setCorrectionDraftIds([])
    setCorrectionIndex(0)
    setActiveFilter('ready')
    setSimilarGroupsOpen(false)
    setExpandedGroupKeys([])
    setExpandedId(null)
    setDraftPageIndex(1)
  }

  function applyCorrectionPatch(draftId: string, patch: Partial<ImportDraft>) {
    const nextDrafts = drafts.map((draft) => (draft.id === draftId ? patchedDraft(draft, patch) : draft))
    setDrafts(nextDrafts)
    moveAfterCorrection(nextDrafts, draftId)
  }

  function renderInlineCorrection(
    draft: ImportDraft,
    issue: DraftIssue,
    depenseOptions: CompteSummary[],
    recetteOptions: CompteSummary[],
  ) {
    if (issue.field === 'codeTypeOperation') {
      return (
        <select value={draft.codeTypeOperation} onChange={(event) => updateDraftType(draft, event.target.value)} aria-label="Corriger le type">
          <option value="">Choisir un type</option>
          {(typesQuery.data ?? []).map((type) => (
            <option key={type.code} value={type.code}>
              {type.libelleCourt}
            </option>
          ))}
        </select>
      )
    }

    if (issue.field === 'dateValeur') {
      return <input type="date" value={draft.dateValeur} onChange={(event) => updateDraft(draft.id, { dateValeur: event.target.value })} aria-label="Corriger la date" />
    }

    if (issue.field === 'montant') {
      return <input value={draft.montant} inputMode="decimal" placeholder="0.00" onChange={(event) => updateDraft(draft.id, { montant: event.target.value })} aria-label="Corriger le montant" />
    }

    if (issue.field === 'identifiantCompteDepense') {
      return (
        <select value={draft.identifiantCompteDepense} onChange={(event) => updateDraft(draft.id, { identifiantCompteDepense: event.target.value })} aria-label="Corriger le compte depense">
          <option value="">Choisir un compte depense</option>
          {depenseOptions.map((account) => (
            <option key={account.identifiant} value={account.identifiant}>
              {accountChoiceLabel(account)}
            </option>
          ))}
        </select>
      )
    }

    return (
      <select value={draft.identifiantCompteRecette} onChange={(event) => updateDraft(draft.id, { identifiantCompteRecette: event.target.value })} aria-label="Corriger le compte recette">
        <option value="">Choisir un compte recette</option>
        {recetteOptions.map((account) => (
          <option key={account.identifiant} value={account.identifiant}>
            {accountChoiceLabel(account)}
          </option>
        ))}
      </select>
    )
  }

  function renderCorrectionStep(draft: ImportDraft, step: CorrectionStep) {
    const allAccounts = [...internalAccounts, ...externalAccounts]

    if (step.kind === 'codeTypeOperation') {
      return (
        <div className="statement-import-choice-grid">
          {!(typesQuery.data ?? []).length ? <div className="statement-import-existing-operation">Aucun type d'operation charge.</div> : null}
          {(typesQuery.data ?? []).map((type) => (
            <button key={type.code} type="button" className="statement-import-choice" onClick={() => applyCorrectionPatch(draft.id, { codeTypeOperation: type.code })}>
              <strong>{type.libelleCourt}</strong>
              <span>{type.code}</span>
            </button>
          ))}
        </div>
      )
    }

    if (step.kind === 'identifiantCompteDepense' || step.kind === 'identifiantCompteRecette') {
      const field = step.kind === 'identifiantCompteDepense' ? 'depense' : 'recette'
      const options = accountOptionsWithCurrent(accountOptionsForField(draft.codeTypeOperation, field, internalAccounts, externalAccounts), field === 'depense' ? draft.identifiantCompteDepense : draft.identifiantCompteRecette, allAccounts)
      const label = field === 'depense' ? 'Compte depense' : 'Compte recette'

      return (
        <div className="statement-import-correction-choice-panel">
          <strong>{`Corriger le ${label.toLowerCase()}`}</strong>
          <div className="statement-import-choice-grid account-grid">
            {!options.length ? <div className="statement-import-existing-operation">Aucun compte compatible charge.</div> : null}
            {options.map((account) => (
              <button
                key={account.identifiant}
                type="button"
                className="statement-import-choice"
                onClick={() =>
                  applyCorrectionPatch(
                    draft.id,
                    field === 'depense' ? { identifiantCompteDepense: account.identifiant } : { identifiantCompteRecette: account.identifiant },
                  )
                }
              >
                <strong>{account.identifiant}</strong>
                {account.libelle ? <span>{account.libelle}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )
    }

    if (step.kind === 'dateValeur') {
      return (
        <form
          className="statement-import-correction-form"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            applyCorrectionPatch(draft.id, { dateValeur: String(formData.get('value') ?? '') })
          }}
        >
          <input name="value" type="date" defaultValue={draft.dateValeur} autoFocus />
          <Button type="submit">Valider</Button>
        </form>
      )
    }

    if (step.kind === 'montant') {
      return (
        <form
          className="statement-import-correction-form"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            applyCorrectionPatch(draft.id, { montant: String(formData.get('value') ?? '') })
          }}
        >
          <input name="value" inputMode="decimal" defaultValue={draft.montant} placeholder="0.00" autoFocus />
          <Button type="submit">Valider</Button>
        </form>
      )
    }

    return null
  }

  const analyzeError = analyzeMutation.error ? apiErrorMessage(analyzeMutation.error) : ''
  const loadingReferences =
    typesQuery.isLoading ||
    internalAccountsQuery.isLoading ||
    externalAccountsQuery.isLoading ||
    sousCategoriesQuery.isLoading ||
    beneficiairesQuery.isLoading
  const referenceError =
    typesQuery.error || internalAccountsQuery.error || externalAccountsQuery.error || sousCategoriesQuery.error || beneficiairesQuery.error
  const allImported = Boolean(drafts.length) && drafts.every((draft) => draft.status === 'imported')

  useEffect(() => {
    if (!correctionOpen && !duplicatePreviewDraftId) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [correctionOpen, duplicatePreviewDraftId])

  useEffect(() => {
    return () => {
      if (duplicateNoticeTimeoutRef.current) {
        clearTimeout(duplicateNoticeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const target = statementImportScrollElement()
    if (!target) {
      return undefined
    }

    const updateScrollMetrics = () => {
      setImportScrollMetrics({
        clientHeight: target.clientHeight,
        scrollHeight: target.scrollHeight,
        scrollTop: target.scrollTop,
      })
    }

    updateScrollMetrics()
    target.addEventListener('scroll', updateScrollMetrics, { passive: true })
    window.addEventListener('resize', updateScrollMetrics)

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollMetrics) : null
    resizeObserver?.observe(target)
    if (statementImportRef.current) {
      resizeObserver?.observe(statementImportRef.current)
    }

    return () => {
      target.removeEventListener('scroll', updateScrollMetrics)
      window.removeEventListener('resize', updateScrollMetrics)
      resizeObserver?.disconnect()
    }
  }, [open, drafts.length, activeFilter, draftSearch, expandedId, similarGroupsOpen, expandedGroupKeys.length])

  useEffect(() => {
    if (!open || correctionOpen) {
      return undefined
    }

    function onImportWheel(event: WheelEvent) {
      const target = statementImportScrollElement()
      if (!target || target.scrollHeight <= target.clientHeight + 1) {
        return
      }

      const eventTarget = event.target as HTMLElement | null
      if (eventTarget?.closest('.statement-import-correction-overlay, .statement-import-duplicate-overlay, .statement-import-create-overlay-layer, .statement-import-beneficiary-popover')) {
        return
      }

      target.scrollTop += event.deltaY
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        target.scrollLeft += event.deltaX
      }
      event.preventDefault()
    }

    window.addEventListener('wheel', onImportWheel, { passive: false, capture: true })
    return () => window.removeEventListener('wheel', onImportWheel, { capture: true })
  }, [open, correctionOpen])

  useEffect(() => {
    if (!open || !drafts.length) {
      return undefined
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea' || target?.isContentEditable) {
        return
      }

      if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        setDrafts((current) =>
          current.map((draft) =>
            draft.status === 'imported'
              ? draft
              : {
                  ...draft,
                  selected:
                    !draft.duplicateIgnored &&
                    Boolean(draft.codeTypeOperation.trim()) &&
                    Boolean(draft.dateValeur.trim()) &&
                    Math.abs(parseMoneyToCents(draft.montant)) > 0 &&
                    Boolean(draft.identifiantCompteDepense.trim()) &&
                    Boolean(draft.identifiantCompteRecette.trim()),
                },
          ),
        )
        setActiveFilter('ready')
        setDraftPageIndex(1)
      }

      if (event.key.toLowerCase() === 'i') {
        event.preventDefault()
        setDrafts((current) =>
          current.map((draft) =>
            draft.status === 'imported' || draft.duplicateStatus !== 'DOUBLON_EXACT'
              ? draft
              : {
                  ...draft,
                  selected: false,
                  duplicateIgnored: true,
                },
          ),
        )
      }

      if (event.ctrlKey && event.key === 'ArrowDown') {
        event.preventDefault()
        const nextDraft = drafts.find((draft) => {
          const hasMissingImportantField =
            !draft.codeTypeOperation.trim() ||
            !draft.dateValeur.trim() ||
            Math.abs(parseMoneyToCents(draft.montant)) <= 0 ||
            !draft.identifiantCompteDepense.trim() ||
            !draft.identifiantCompteRecette.trim()

          return draft.status !== 'imported' && hasMissingImportantField
        })

        if (nextDraft) {
          setActiveFilter('needs-action')
          setExpandedId(null)
          setDraftPageIndex(1)
          window.setTimeout(() => {
            document.querySelector(`[data-import-draft-id="${nextDraft.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }, 0)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drafts, open])

  const correctionDraft = correctionOpen ? drafts.find((draft) => draft.id === correctionDraftIds[correctionIndex]) : undefined
  const correctionSteps = correctionDraft ? correctionStepsForDraft(correctionDraft) : []
  const currentCorrectionStep = correctionSteps[0] ?? null
  const currentCorrectionIsAccount =
    currentCorrectionStep?.kind === 'identifiantCompteDepense' || currentCorrectionStep?.kind === 'identifiantCompteRecette'

  function renderSimilarGroupOperation(draft: ImportDraft, options?: { correctionMode?: boolean }) {
    const allAccounts = [...internalAccounts, ...externalAccounts]
    const depenseOptions = accountOptionsWithCurrent(
      accountOptionsForField(draft.codeTypeOperation, 'depense', internalAccounts, externalAccounts),
      draft.identifiantCompteDepense,
      allAccounts,
    )
    const recetteOptions = accountOptionsWithCurrent(
      accountOptionsForField(draft.codeTypeOperation, 'recette', internalAccounts, externalAccounts),
      draft.identifiantCompteRecette,
      allAccounts,
    )
    const counterpartyOptions = accountOptionsWithCurrent(
      accountOptionsForField(draft.codeTypeOperation, draft.counterpartyAccountRole, internalAccounts, externalAccounts),
      counterpartyAccountIdentifier(draft),
      allAccounts,
    )
    const counterpartyLabel = draft.counterpartyAccountRole === 'depense' ? 'Origine' : 'Destination'
    const issue = draftIssue(draft)
    const reviewState = draftReviewState(draft)
    const expanded = expandedId === draft.id
    const showStatus = !options?.correctionMode
    const showSoftStatus = showStatus && activeFilter !== 'needs-action' && activeFilter !== 'ready' && activeFilter !== 'all'

    return (
      <section
        key={draft.id}
        data-import-draft-id={draft.id}
        className={cx(
          'statement-import-card',
          'statement-import-card-nested',
          draft.codeTypeOperation === 'RECETTE' && 'statement-import-card-incoming',
          draft.codeTypeOperation === 'DEPENSE' && 'statement-import-card-outgoing',
          draft.duplicateStatus === 'DOUBLON_EXACT' && 'statement-import-card-duplicate',
          draft.duplicateStatus === 'DOUBLON_PROBABLE' && 'statement-import-card-probable',
          reviewState === 'blocked' && 'statement-import-card-blocked',
          expanded && 'open',
          draft.status === 'imported' && 'imported',
        )}
      >
        <div className="statement-import-card-head">
          <label className="statement-import-check">
            <input
              type="checkbox"
              checked={draft.selected}
              disabled={draft.status === 'imported'}
              onChange={(event) => updateDraft(draft.id, { selected: event.target.checked, duplicateIgnored: event.target.checked ? false : draft.duplicateIgnored })}
            />
            <span />
          </label>

          <button type="button" className="statement-import-card-toggle" onClick={() => setExpandedId(expanded ? null : draft.id)}>
            <div>
              <strong>{draft.libelle || `Operation ${draft.sourceIndex}`}</strong>
              <small>
                #{draft.sourceIndex} - {draft.dateComptabilisation || draft.dateValeur || 'Date manquante'} - {formatCurrencyFromCents(Math.abs(parseMoneyToCents(draft.montant)))}
                {draft.suggestedCounterpartyName ? ` - ${draft.suggestedCounterpartyName}` : ''}
              </small>
            </div>
            <ChevronDown size={16} />
          </button>

          <div className="statement-import-card-status">
            {showStatus && draft.status === 'imported' ? <Badge tone="success">Importee</Badge> : null}
            {showStatus && draft.status === 'error' ? <Badge tone="warning">Erreur</Badge> : null}
            {showSoftStatus && draft.status !== 'imported' && draft.status !== 'error' && issue && draft.selected ? <Badge tone="warning">A corriger</Badge> : null}
            {renderDuplicatePreviewButton(draft, showStatus)}
            {draft.status !== 'imported' && draft.status !== 'error' && !issue && draft.duplicateStatus === 'NOUVELLE' && !draft.memoryWarning && !draft.memoryApplied ? (
              showStatus ? <Badge tone={draft.selected ? 'success' : undefined}>{draft.selected ? 'Pret' : 'Lu'}</Badge> : null
            ) : null}
          </div>

          {showStatus && issue && draft.selected ? (
            <div className="statement-import-quick-fix">
              <span>{issue.label}</span>
              {renderInlineCorrection(draft, issue, depenseOptions, recetteOptions)}
            </div>
          ) : null}

          {draft.status !== 'imported' ? (
            <div className="statement-import-inline-classification">
              <label>
                <span>Type</span>
                <select value={draft.codeTypeOperation} onChange={(event) => updateDraftType(draft, event.target.value)}>
                  <option value="">Type</option>
                  {(typesQuery.data ?? []).map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.libelleCourt}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>{counterpartyLabel}</span>
                <select
                  value={counterpartyAccountIdentifier(draft)}
                  onChange={(event) =>
                    updateDraft(
                      draft.id,
                      draft.counterpartyAccountRole === 'depense'
                        ? { identifiantCompteDepense: event.target.value }
                        : { identifiantCompteRecette: event.target.value },
                    )
                  }
                >
                  <option value="">Compte externe</option>
                  {counterpartyOptions.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Sous-categorie</span>
                <select value={draft.nomSousCategorie} onChange={(event) => updateDraft(draft.id, { nomSousCategorie: event.target.value })}>
                  <option value="">Aucune</option>
                  {(sousCategoriesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </label>

              <div className="statement-import-inline-beneficiaries">
                <span>Beneficiaires</span>
                <button type="button" className="statement-import-beneficiary-field" onClick={() => openDraftBeneficiaryPicker(draft)}>
                  {`Selectionne ${draft.nomsBeneficiaires.length}`}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {expanded ? (
          <div className="statement-import-card-body">
            <div className="form-grid three-columns">
              <FormField label="Type">
                <select value={draft.codeTypeOperation} onChange={(event) => updateDraftType(draft, event.target.value)}>
                  <option value="">Choisir</option>
                  {(typesQuery.data ?? []).map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.libelleCourt}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date valeur">
                <input type="date" value={draft.dateValeur} onChange={(event) => updateDraft(draft.id, { dateValeur: event.target.value })} />
              </FormField>

              <FormField label="Montant">
                <input value={draft.montant} inputMode="decimal" onChange={(event) => updateDraft(draft.id, { montant: event.target.value })} />
              </FormField>

              <FormField label="Compte depense">
                <select value={draft.identifiantCompteDepense} onChange={(event) => updateDraft(draft.id, { identifiantCompteDepense: event.target.value })}>
                  <option value="">Choisir</option>
                  {depenseOptions.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Compte recette">
                <select value={draft.identifiantCompteRecette} onChange={(event) => updateDraft(draft.id, { identifiantCompteRecette: event.target.value })}>
                  <option value="">Choisir</option>
                  {recetteOptions.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date compta">
                <input type="date" value={draft.dateComptabilisation} onChange={(event) => updateDraft(draft.id, { dateComptabilisation: event.target.value })} />
              </FormField>

              <FormField label="Numero">
                <input value={draft.numero} placeholder="Facultatif" onChange={(event) => updateDraft(draft.id, { numero: event.target.value })} />
              </FormField>

              <FormField label="Libelle">
                <input value={draft.libelle} onChange={(event) => updateDraft(draft.id, { libelle: event.target.value })} />
              </FormField>

              <FormField label="Sous-categorie">
                <select value={draft.nomSousCategorie} onChange={(event) => updateDraft(draft.id, { nomSousCategorie: event.target.value })}>
                  <option value="">Aucune</option>
                  {(sousCategoriesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <details className="statement-import-beneficiaries-details">
              <summary>
                <span>Beneficiaires</span>
                <strong>{`Selectionne ${draft.nomsBeneficiaires.length}`}</strong>
              </summary>
              <div className="checkbox-grid">
                {(beneficiairesQuery.data ?? []).map((item) => {
                  const checked = draft.nomsBeneficiaires.includes(item.nom)
                  return (
                    <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                      <input type="checkbox" checked={checked} onChange={() => toggleBeneficiary(draft, item.nom)} />
                      <span>{item.nom}</span>
                    </label>
                  )
                })}
                {!(beneficiairesQuery.data ?? []).length ? <span className="muted-text">Aucun beneficiaire reference.</span> : null}
              </div>
            </details>

            <div className="statement-import-card-meta">
              <span>Page {draft.page ?? '-'}</span>
              <span>Confiance {confidenceLabel(draft.confidence)}</span>
              {draft.suggestedCounterpartyName ? <span>Suggestion {draft.suggestedCounterpartyName}</span> : null}
            </div>
          </div>
        ) : null}
      </section>
    )
  }

  const correctionOverlay =
    correctionOpen && correctionDraft ? (
      <div className="statement-import-correction-overlay" role="dialog" aria-modal="true" aria-label="Correction guidee">
        <div className="statement-import-correction-card">
          <div className="statement-import-correction-topbar">
            <button type="button" className="statement-import-arrow-button" disabled={correctionIndex <= 0} onClick={() => moveCorrection(-1)} aria-label="Operation precedente">
              <ChevronLeft size={20} />
            </button>

            <button type="button" className="statement-import-create-reference-button compact" onClick={openCreationChooser}>
              <Plus size={14} />
              Creer reference ou compte
            </button>

            <div>
              <span>{`Operation ${correctionIndex + 1} / ${correctionDraftIds.length}`}</span>
              <strong>{correctionDraft.libelle || `Operation ${correctionDraft.sourceIndex}`}</strong>
            </div>

            <button
              type="button"
              className="statement-import-arrow-button"
              disabled={correctionIndex >= correctionDraftIds.length - 1}
              onClick={() => moveCorrection(1)}
              aria-label="Operation suivante"
            >
              <ChevronRight size={20} />
            </button>

            <button type="button" className="statement-import-correction-close" onClick={() => setCorrectionOpen(false)}>
              Fermer
            </button>
          </div>

          <div className="statement-import-correction-draft-card">
            {renderSimilarGroupOperation(correctionDraft, { correctionMode: true })}
          </div>

          {currentCorrectionStep ? (
            <div className="statement-import-correction-step">
              {!currentCorrectionIsAccount ? <h3>{currentCorrectionStep.label}</h3> : null}
              {!currentCorrectionIsAccount ? <p>{currentCorrectionStep.message}</p> : null}
              {renderCorrectionStep(correctionDraft, currentCorrectionStep)}
            </div>
          ) : (
            <div className="statement-import-correction-step">
              <h3>Operation prete</h3>
              <p>Il n'y a plus rien a corriger sur cette operation.</p>
              <Button type="button" onClick={() => (correctionIndex >= correctionDraftIds.length - 1 ? setCorrectionOpen(false) : moveCorrection(1))}>
                {correctionIndex >= correctionDraftIds.length - 1 ? 'Terminer' : 'Suivante'}
              </Button>
            </div>
          )}
        </div>
      </div>
    ) : null
  const importScrollOverflow = importScrollMetrics.scrollHeight > importScrollMetrics.clientHeight + 1
  const importScrollThumbHeight = importScrollOverflow ? Math.max(8, Math.min(100, (importScrollMetrics.clientHeight / importScrollMetrics.scrollHeight) * 100)) : 100
  const importScrollThumbTop = importScrollOverflow
    ? (importScrollMetrics.scrollTop / Math.max(1, importScrollMetrics.scrollHeight - importScrollMetrics.clientHeight)) * (100 - importScrollThumbHeight)
    : 0
  const duplicatePreviewRelatedDrafts = duplicatePreviewDraft
    ? drafts.filter((draft) => {
        if (draft.id === duplicatePreviewDraft.id || draft.duplicateStatus === 'NOUVELLE') {
          return false
        }

        const sameExistingOperation =
          Boolean(duplicatePreviewDraft.duplicateOperationNumero) && draft.duplicateOperationNumero === duplicatePreviewDraft.duplicateOperationNumero
        const sameImportedOperation =
          draft.libelle === duplicatePreviewDraft.libelle &&
          draft.dateValeur === duplicatePreviewDraft.dateValeur &&
          draft.dateComptabilisation === duplicatePreviewDraft.dateComptabilisation &&
          draft.montant === duplicatePreviewDraft.montant

        return sameExistingOperation || sameImportedOperation
      })
    : []
  const duplicatePreviewOverlay = duplicatePreviewDraft ? (
    <div className="statement-import-duplicate-overlay" role="dialog" aria-modal="true" aria-label="Detail des doublons">
      {duplicateKeepNotice ? (
        <div className={cx('statement-import-duplicate-toast', duplicateKeepNotice.tone)} role="status">
          {duplicateKeepNotice.message}
        </div>
      ) : null}

      <div className="statement-import-duplicate-card">
        <div className="statement-import-duplicate-topbar">
          <button type="button" className="statement-import-arrow-button" disabled={duplicatePreviewIndex <= 0} onClick={() => moveDuplicatePreview(-1)} aria-label="Doublon precedent">
            <ChevronLeft size={20} />
          </button>

          <div>
            <span>{duplicatePreviewIndex >= 0 ? `Doublon ${duplicatePreviewIndex + 1}/${duplicatePreviewDraftIds.length}` : 'Doublon detecte'}</span>
            <strong>{duplicatePreviewDraft.libelle || `Operation ${duplicatePreviewDraft.sourceIndex}`}</strong>
          </div>

          <button
            type="button"
            className="statement-import-arrow-button"
            disabled={duplicatePreviewIndex < 0 || duplicatePreviewIndex >= duplicatePreviewDraftIds.length - 1}
            onClick={() => moveDuplicatePreview(1)}
            aria-label="Doublon suivant"
          >
            <ChevronRight size={20} />
          </button>

          <button
            type="button"
            className="statement-import-correction-close"
            onClick={() => {
              setDuplicatePreviewDraftId(null)
              setDuplicateKeepNotice(null)
              setDuplicateHoverTooltip(null)
            }}
          >
            Fermer
          </button>
        </div>

        <div className="statement-import-duplicate-preview-note">
          <AlertTriangle size={15} />
          <span>
            Les choix faits ici seront appliques quand vous cliquerez sur Importer. Si vous decochez une operation deja enregistree, elle sera supprimee a ce moment-la.
          </span>
        </div>

        <div className="statement-import-duplicate-scroll">
          <div className="statement-import-duplicate-preview">
            {renderDuplicateImportDraftDetails(duplicatePreviewDraft, `Operation du releve - ${duplicateStatusLabel(duplicatePreviewDraft)}`)}

            {renderExistingDuplicateDetails(duplicatePreviewDraft, duplicateExistingOperationQuery.data)}

            {duplicatePreviewRelatedDrafts.length ? (
              <section className="statement-import-duplicate-preview-section related">
                <div className="statement-import-duplicate-preview-section-head">
                  <div>
                    <span>Autres lignes du releve rapprochees</span>
                    <strong>{`${duplicatePreviewRelatedDrafts.length} operation${duplicatePreviewRelatedDrafts.length > 1 ? 's' : ''}`}</strong>
                  </div>
                </div>
                <div className="statement-import-duplicate-preview-list">
                  {duplicatePreviewRelatedDrafts.map((draft) => renderDuplicateImportDraftDetails(draft, `Operation du releve ${draft.sourceIndex}`))}
                </div>
              </section>
            ) : null}

            {duplicatePreviewDraft.duplicateReasons.length ? (
              <section className="statement-import-duplicate-preview-section">
                <span>Indices</span>
                <div className="statement-import-duplicate-reason-list">
                  {duplicatePreviewDraft.duplicateReasons.map((reason) => (
                    <small key={reason}>{reason}</small>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
    <OverlayPanel
      open={open}
      onClose={closeAndReset}
      title="Importer un releve"
      width="wide"
      overlayClassName="overlay-super-top statement-import-overlay-layer"
      closeOnBackdrop={false}
      dialogAccessory={
        <div className={cx('statement-import-scroll-rail', !importScrollOverflow && 'disabled')} aria-label="Navigation rapide dans l'import">
          <button type="button" title="Aller en haut" aria-label="Aller en haut" disabled={!importScrollOverflow} onClick={() => scrollImportPanel('top')}>
            <ArrowUpToLine size={15} />
          </button>
          <div className="statement-import-scroll-track" aria-hidden="true" onPointerDown={startImportRailScroll}>
            <div className="statement-import-scroll-thumb" style={{ height: `${importScrollThumbHeight}%`, top: `${importScrollThumbTop}%` }} />
          </div>
          <button type="button" title="Aller en bas" aria-label="Aller en bas" disabled={!importScrollOverflow} onClick={() => scrollImportPanel('bottom')}>
            <ArrowDownToLine size={15} />
          </button>
        </div>
      }
    >
      <div ref={statementImportRef} className="statement-import">
        <div className="statement-import-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
          />
          <button type="button" className="statement-import-drop" onClick={() => fileInputRef.current?.click()}>
            <FileText size={20} />
            <span>{selectedFile ? selectedFile.name : 'Choisir un PDF de releve'}</span>
          </button>
          <Button type="button" disabled={!selectedFile || analyzeMutation.isPending || loadingReferences} onClick={() => selectedFile && analyzeMutation.mutate(selectedFile)}>
            {analyzeMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}
            Analyser
          </Button>
        </div>

        <div className="statement-import-service-note">
          <span>Service PDF: {pdfImporterApi.baseUrl}</span>
        </div>

        {analyzeMutation.isPending ? <LoadingState label="Lecture du PDF en cours..." /> : null}
        {analyzeError ? <ErrorState message={analyzeError} /> : null}
        {referenceError ? <ErrorState message={apiErrorMessage(referenceError)} /> : null}
        {memoryError ? (
          <div className="statement-import-warning compact">
            <AlertTriangle size={15} />
            <div>
              <p>Memoire d'import indisponible: {memoryError}</p>
            </div>
          </div>
        ) : null}
        {duplicateError ? (
          <div className="statement-import-warning compact">
            <AlertTriangle size={15} />
            <div>
              <p>Detection des doublons indisponible: {duplicateError}</p>
            </div>
          </div>
        ) : null}
        {duplicateDeletionError ? (
          <div className="statement-import-warning compact">
            <AlertTriangle size={15} />
            <div>
              <p>Suppression de doublon impossible: {duplicateDeletionError}</p>
            </div>
          </div>
        ) : null}

        {resultWarnings.length ? (
          <div className="statement-import-warning">
            <AlertTriangle size={16} />
            <div>
              {resultWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          </div>
        ) : null}

        {balanceControl ? (
          <div className="statement-import-balance">
            <div>
              <span>Ancien solde</span>
              <strong>{formatPdfEuro(balanceControl.opening_balance)}</strong>
            </div>
            <div>
              <span>Nouveau solde</span>
              <strong>{formatPdfEuro(balanceControl.closing_balance)}</strong>
            </div>
            <div>
              <span>Total releve</span>
              <strong>{formatPdfEuro(balanceControl.transactions_total)}</strong>
            </div>
            <div>
              <span>Controle</span>
              <strong className={cx(balanceControl.passed ? 'positive-text' : 'warning-text')}>{balanceControl.passed ? 'OK' : balanceControl.status}</strong>
            </div>
          </div>
        ) : null}

        {loadingReferences && drafts.length ? <LoadingState label="Chargement des references MONATIS..." /> : null}

        {drafts.length ? (
          <>
            <div className="statement-import-review-panel">
              <FormField label="Compte du releve">
                <select value={statementAccountId} onChange={(event) => changeStatementAccount(event.target.value)}>
                  <option value="">Choisir</option>
                  {internalAccounts.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </FormField>
              <button type="button" className="statement-import-create-reference-button" onClick={openCreationChooser}>
                <Plus size={15} />
                Creer reference ou compte
              </button>
            </div>

            <div className="statement-import-filter-shell">
              <label
                className="statement-import-select-all-toggle"
                title={allSelectableDraftsSelected ? 'Cliquer pour tout decocher' : 'Cliquer pour tout cocher'}
                aria-label={allSelectableDraftsSelected ? 'Cliquer pour tout decocher' : 'Cliquer pour tout cocher'}
              >
                <input type="checkbox" checked={allSelectableDraftsSelected} disabled={!selectableDraftCount} onChange={toggleAllDraftSelection} />
                <span />
              </label>

              <div className="statement-import-filter-row" role="tablist" aria-label="Filtrer les operations importees du releve">
                {[
                  { key: 'needs-action' as ImportFilter, label: 'A traiter', count: blockedDraftCount + reviewDraftCount },
                  { key: 'ready' as ImportFilter, label: 'Pretes', count: readyDraftCount },
                  { key: 'duplicates' as ImportFilter, label: 'Doublons', count: exactDuplicateCount + probableDuplicateCount },
                  { key: 'all' as ImportFilter, label: 'Tout', count: drafts.length },
                ].map((filter) => (
                  <button key={filter.key} type="button" className={cx(activeFilter === filter.key && 'active')} onClick={() => changeImportFilter(filter.key)}>
                    <span>{filter.count}</span>
                    {filter.label}
                  </button>
                ))}
              </div>

              <label className="statement-import-filter-search">
                <Search size={14} />
                <input
                  value={draftSearch}
                  onChange={(event) => {
                    setDraftSearch(event.target.value)
                    setExpandedId(null)
                    setDraftPageIndex(1)
                  }}
                  placeholder="Rechercher..."
                  aria-label="Rechercher une operation"
                />
              </label>
            </div>

            {activeFilter === 'needs-action' ? (
              <section className="statement-import-filter-action-row">
                <button
                  type="button"
                  className="statement-import-correct-button"
                  data-tooltip="Ouvre la correction guidée et présente les opérations à corriger une par une."
                  disabled={!correctionDraftIdsAll.length}
                  onClick={() => openCorrectionAssistant(correctionDraftIdsAll)}
                >
                  Corriger
                </button>
              </section>
            ) : null}

            {activeFilter === 'duplicates' ? (
              <div className="statement-import-filter-action-row">
                <button
                  type="button"
                  className="statement-import-filter-action-button"
                  disabled={!exactDuplicateCount && !probableDuplicateCount}
                  onClick={checkDuplicateDrafts}
                >
                  Cocher tous les doublons
                </button>
                <button
                  type="button"
                  className="statement-import-filter-action-button"
                  disabled={!exactDuplicateCount && !probableDuplicateCount}
                  onClick={uncheckDuplicateDrafts}
                >
                  Décocher tous les doublons
                </button>
              </div>
            ) : null}

            {activeFilter !== 'needs-action' && activeFilter !== 'duplicates' && !draftSearchNeedle && importGroups.length ? (
              <section className={cx('statement-import-groups', !similarGroupsOpen && 'collapsed')}>
                <div className="statement-import-groups-head">
                  <button type="button" className="statement-import-section-toggle" onClick={toggleSimilarGroupsPanel} aria-expanded={similarGroupsOpen}>
                    <ChevronDown size={15} />
                    <div>
                      <strong>Operations similaires</strong>
                      <span>{`${importGroups.length} groupe${importGroups.length > 1 ? 's' : ''} detecte${importGroups.length > 1 ? 's' : ''}`}</span>
                    </div>
                  </button>

                  <div className="statement-import-groups-head-actions">
                    <Badge>{`${importGroups.length} groupe${importGroups.length > 1 ? 's' : ''}`}</Badge>
                  </div>
                </div>

                {similarGroupsOpen ? <div className="statement-import-group-list">
                  {importGroups.map((group) => {
                    const groupExpanded = expandedGroupKeys.includes(group.key)
                    const groupDrafts = group.operationIds
                      .map((id) => drafts.find((draft) => draft.id === id))
                      .filter((draft): draft is ImportDraft => Boolean(draft))

                    return (
                      <div key={group.key} className={cx('statement-import-group-row', groupExpanded && 'open')}>
                        <button type="button" className="statement-import-group-main" onClick={() => toggleSimilarGroup(group.key)} aria-expanded={groupExpanded}>
                          <ChevronDown size={15} />
                          <div>
                            <strong>{group.label}</strong>
                            <span>
                              {group.count} ops - {formatCurrencyFromCents(group.totalCents)}
                              {group.selectedCount !== group.count ? ` - ${group.selectedCount} selectionnee${group.selectedCount > 1 ? 's' : ''}` : ''}
                              {group.missingExternalCount ? ` - ${group.missingExternalCount} sans compte externe` : ' - complet'}
                              {group.exactDuplicateCount ? ` - ${group.exactDuplicateCount} doublon${group.exactDuplicateCount > 1 ? 's' : ''}` : ''}
                              {group.reviewCount || group.blockedCount ? ` - ${group.reviewCount + group.blockedCount} a traiter` : ''}
                            </span>
                          </div>
                        </button>

                        <div className="statement-import-group-controls">
                          <select
                            value={group.mixedTypes ? '' : group.currentTypeCode}
                            onChange={(event) => applyTypeToGroup(group.key, event.target.value)}
                            aria-label={`Type pour ${group.label}`}
                          >
                            <option value="">{group.mixedTypes ? 'Types differents' : 'Type'}</option>
                            {(typesQuery.data ?? []).map((type) => (
                              <option key={type.code} value={type.code}>
                                {type.libelleCourt}
                              </option>
                            ))}
                          </select>

                          <select
                            value={group.mixedExternalAccounts ? '' : group.currentExternalAccountId}
                            onChange={(event) => applyExternalAccountToGroup(group.key, event.target.value)}
                            aria-label={`Compte externe pour ${group.label}`}
                          >
                            <option value="">{group.mixedExternalAccounts ? 'Comptes differents' : 'Compte externe'}</option>
                            {externalAccounts.map((account) => (
                              <option key={account.identifiant} value={account.identifiant}>
                                {accountChoiceLabel(account)}
                              </option>
                            ))}
                          </select>

                          <select
                            value={group.mixedSousCategories ? '' : group.currentSousCategorie}
                            onChange={(event) => applySousCategorieToGroup(group.key, event.target.value)}
                            aria-label={`Sous-categorie pour ${group.label}`}
                          >
                            <option value="">{group.mixedSousCategories ? 'Sous-categories differentes' : 'Sous-categorie'}</option>
                            {(sousCategoriesQuery.data ?? []).map((item) => (
                              <option key={item.nom} value={item.nom}>
                                {item.nom}
                              </option>
                            ))}
                          </select>

                          <button type="button" className="statement-import-beneficiary-field group-field" onClick={() => openGroupBeneficiaryPicker(group)}>
                            {group.mixedBeneficiaries ? 'Beneficiaires differents' : `Selectionne ${group.currentBeneficiaries.length}`}
                          </button>
                        </div>

                        {groupExpanded ? <div className="statement-import-group-details">{groupDrafts.map((draft) => renderSimilarGroupOperation(draft))}</div> : null}
                      </div>
                    )
                  })}
                </div> : null}
              </section>
            ) : null}

            {renderDraftPaginationControls('top')}

            <div className="statement-import-list">
              {visibleFilteredDrafts.map((draft) => {
                const allAccounts = [...internalAccounts, ...externalAccounts]
                const depenseOptions = accountOptionsWithCurrent(
                  accountOptionsForField(draft.codeTypeOperation, 'depense', internalAccounts, externalAccounts),
                  draft.identifiantCompteDepense,
                  allAccounts,
                )
                const recetteOptions = accountOptionsWithCurrent(
                  accountOptionsForField(draft.codeTypeOperation, 'recette', internalAccounts, externalAccounts),
                  draft.identifiantCompteRecette,
                  allAccounts,
                )
                const counterpartyOptions = accountOptionsWithCurrent(
                  accountOptionsForField(draft.codeTypeOperation, draft.counterpartyAccountRole, internalAccounts, externalAccounts),
                  counterpartyAccountIdentifier(draft),
                  allAccounts,
                )
                const counterpartyLabel = draft.counterpartyAccountRole === 'depense' ? 'Origine' : 'Destination'
                const issue = draftIssue(draft)
                const reviewState = draftReviewState(draft)
                const expanded = expandedId === draft.id
                const showCorrectionStatus = activeFilter !== 'needs-action' && activeFilter !== 'ready' && activeFilter !== 'all'
                const showMemoryStatus = activeFilter !== 'ready' && activeFilter !== 'all'

                return (
                  <section
                    key={draft.id}
                    data-import-draft-id={draft.id}
                    className={cx(
                      'statement-import-card',
                      draft.codeTypeOperation === 'RECETTE' && 'statement-import-card-incoming',
                      draft.codeTypeOperation === 'DEPENSE' && 'statement-import-card-outgoing',
                      draft.duplicateStatus === 'DOUBLON_EXACT' && 'statement-import-card-duplicate',
                      draft.duplicateStatus === 'DOUBLON_PROBABLE' && 'statement-import-card-probable',
                      reviewState === 'blocked' && 'statement-import-card-blocked',
                      expanded && 'open',
                      draft.status === 'imported' && 'imported',
                    )}
                  >
                    <div className="statement-import-card-head">
                      <label className="statement-import-check">
                        <input
                          type="checkbox"
                          checked={draft.selected}
                          disabled={draft.status === 'imported'}
                          onChange={(event) => updateDraft(draft.id, { selected: event.target.checked, duplicateIgnored: event.target.checked ? false : draft.duplicateIgnored })}
                        />
                        <span />
                      </label>

                      <button type="button" className="statement-import-card-toggle" onClick={() => setExpandedId(expanded ? null : draft.id)}>
                        <div>
                          <strong>{draft.libelle || `Operation ${draft.sourceIndex}`}</strong>
                          <small>
                            #{draft.sourceIndex} - {draft.dateComptabilisation || draft.dateValeur || 'Date manquante'} - {formatCurrencyFromCents(Math.abs(parseMoneyToCents(draft.montant)))}
                            {draft.suggestedCounterpartyName ? ` - ${draft.suggestedCounterpartyName}` : ''}
                          </small>
                        </div>
                        <ChevronDown size={16} />
                      </button>

                      <div className="statement-import-card-status">
                        {draft.status === 'imported' ? <Badge tone="success">Importee</Badge> : null}
                        {draft.status === 'error' ? <Badge tone="warning">Erreur</Badge> : null}
                        {showCorrectionStatus && draft.status !== 'imported' && draft.status !== 'error' && issue && draft.selected ? <Badge tone="warning">A corriger</Badge> : null}
                        {renderDuplicatePreviewButton(draft, true)}
                        {showMemoryStatus && draft.status !== 'imported' && draft.status !== 'error' && !issue && draft.duplicateStatus === 'NOUVELLE' && draft.memoryWarning ? <Badge tone="warning">Memoire ?</Badge> : null}
                        {showMemoryStatus && draft.status !== 'imported' && draft.status !== 'error' && !issue && draft.duplicateStatus === 'NOUVELLE' && !draft.memoryWarning && draft.memoryApplied ? <Badge tone="success">Memoire</Badge> : null}
                        {draft.status !== 'imported' && draft.status !== 'error' && !issue && draft.duplicateStatus === 'NOUVELLE' && !draft.memoryWarning && !draft.memoryApplied ? (
                          <Badge tone={draft.selected ? 'success' : undefined}>{draft.selected ? 'Pret' : 'Lu'}</Badge>
                        ) : null}
                      </div>

                      {issue && draft.selected ? (
                        <div className="statement-import-quick-fix">
                          <span>{issue.label}</span>
                          {renderInlineCorrection(draft, issue, depenseOptions, recetteOptions)}
                        </div>
                      ) : null}

                      {draft.status !== 'imported' ? (
                        <div className="statement-import-inline-classification">
                          <label>
                            <span>Type</span>
                            <select value={draft.codeTypeOperation} onChange={(event) => updateDraftType(draft, event.target.value)}>
                              <option value="">Type</option>
                              {(typesQuery.data ?? []).map((type) => (
                                <option key={type.code} value={type.code}>
                                  {type.libelleCourt}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>{counterpartyLabel}</span>
                            <select
                              value={counterpartyAccountIdentifier(draft)}
                              onChange={(event) =>
                                updateDraft(
                                  draft.id,
                                  draft.counterpartyAccountRole === 'depense'
                                    ? { identifiantCompteDepense: event.target.value }
                                    : { identifiantCompteRecette: event.target.value },
                                )
                              }
                            >
                              <option value="">Compte externe</option>
                              {counterpartyOptions.map((account) => (
                                <option key={account.identifiant} value={account.identifiant}>
                                  {accountChoiceLabel(account)}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label>
                            <span>Sous-categorie</span>
                            <select value={draft.nomSousCategorie} onChange={(event) => updateDraft(draft.id, { nomSousCategorie: event.target.value })}>
                              <option value="">Aucune</option>
                              {(sousCategoriesQuery.data ?? []).map((item) => (
                                <option key={item.nom} value={item.nom}>
                                  {item.nom}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div className="statement-import-inline-beneficiaries">
                            <span>Beneficiaires</span>
                            <button type="button" className="statement-import-beneficiary-field" onClick={() => openDraftBeneficiaryPicker(draft)}>
                              {`Selectionne ${draft.nomsBeneficiaires.length}`}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {expanded ? (
                      <div className="statement-import-card-body">
                        <div className="form-grid three-columns">
                          <FormField label="Type">
                            <select value={draft.codeTypeOperation} onChange={(event) => updateDraftType(draft, event.target.value)}>
                              <option value="">Choisir</option>
                              {(typesQuery.data ?? []).map((type) => (
                                <option key={type.code} value={type.code}>
                                  {type.libelleCourt}
                                </option>
                              ))}
                            </select>
                          </FormField>

                          <FormField label="Date valeur">
                            <input type="date" value={draft.dateValeur} onChange={(event) => updateDraft(draft.id, { dateValeur: event.target.value })} />
                          </FormField>

                          <FormField label="Montant">
                            <input value={draft.montant} inputMode="decimal" onChange={(event) => updateDraft(draft.id, { montant: event.target.value })} />
                          </FormField>

                          <FormField label="Compte depense">
                            <select value={draft.identifiantCompteDepense} onChange={(event) => updateDraft(draft.id, { identifiantCompteDepense: event.target.value })}>
                              <option value="">Choisir</option>
                              {depenseOptions.map((account) => (
                                <option key={account.identifiant} value={account.identifiant}>
                                  {accountChoiceLabel(account)}
                                </option>
                              ))}
                            </select>
                          </FormField>

                          <FormField label="Compte recette">
                            <select value={draft.identifiantCompteRecette} onChange={(event) => updateDraft(draft.id, { identifiantCompteRecette: event.target.value })}>
                              <option value="">Choisir</option>
                              {recetteOptions.map((account) => (
                                <option key={account.identifiant} value={account.identifiant}>
                                  {accountChoiceLabel(account)}
                                </option>
                              ))}
                            </select>
                          </FormField>

                          <FormField label="Date compta">
                            <input
                              type="date"
                              value={draft.dateComptabilisation}
                              onChange={(event) => updateDraft(draft.id, { dateComptabilisation: event.target.value })}
                            />
                          </FormField>

                          <FormField label="Numero">
                            <input value={draft.numero} placeholder="Facultatif" onChange={(event) => updateDraft(draft.id, { numero: event.target.value })} />
                          </FormField>

                          <FormField label="Libelle">
                            <input value={draft.libelle} onChange={(event) => updateDraft(draft.id, { libelle: event.target.value })} />
                          </FormField>

                          <FormField label="Sous-categorie">
                            <select value={draft.nomSousCategorie} onChange={(event) => updateDraft(draft.id, { nomSousCategorie: event.target.value })}>
                              <option value="">Aucune</option>
                              {(sousCategoriesQuery.data ?? []).map((item) => (
                                <option key={item.nom} value={item.nom}>
                                  {item.nom}
                                </option>
                              ))}
                            </select>
                          </FormField>
                        </div>

                        <details className="statement-import-beneficiaries-details">
                          <summary>
                            <span>Beneficiaires</span>
                            <strong>{`Selectionne ${draft.nomsBeneficiaires.length}`}</strong>
                          </summary>
                          <div className="checkbox-grid">
                            {(beneficiairesQuery.data ?? []).map((item) => {
                              const checked = draft.nomsBeneficiaires.includes(item.nom)
                              return (
                                <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleBeneficiary(draft, item.nom)} />
                                  <span>{item.nom}</span>
                                </label>
                              )
                            })}
                            {!(beneficiairesQuery.data ?? []).length ? <span className="muted-text">Aucun beneficiaire reference.</span> : null}
                          </div>
                        </details>

                        <div className="statement-import-card-meta">
                          <span>Page {draft.page ?? '-'}</span>
                          <span>Confiance {confidenceLabel(draft.confidence)}</span>
                          {draft.suggestedCounterpartyName ? <span>Suggestion {draft.suggestedCounterpartyName}</span> : null}
                        </div>

                        {draft.warnings.length || draft.error || draft.memoryWarning || draft.duplicateStatus !== 'NOUVELLE' || (issue && draft.selected) ? (
                          <div className="statement-import-warning compact">
                            <AlertTriangle size={15} />
                            <div>
                              {draft.error ? <p>{draft.error}</p> : null}
                              {issue && draft.selected ? <p>{issue.message}</p> : null}
                              {draft.duplicateStatus !== 'NOUVELLE' ? (
                                <p>
                                  {draft.duplicateStatus === 'DOUBLON_EXACT' ? 'Doublon exact' : 'Doublon probable'}
                                  {draft.duplicateScore != null ? ` (${draft.duplicateScore}%)` : ''}
                                  {draft.duplicateOperationNumero ? ` avec ${draft.duplicateOperationNumero}` : ''}
                                  {draft.duplicateOperationDate ? ` du ${draft.duplicateOperationDate}` : ''}
                                  {draft.duplicateOperationAmount != null ? ` - ${formatCurrencyFromCents(draft.duplicateOperationAmount)}` : ''}
                                </p>
                              ) : null}
                              {draft.duplicateReasons.map((reason) => (
                                <p key={reason}>{reason}</p>
                              ))}
                              {draft.memoryWarning ? <p>{draft.memoryWarning}</p> : null}
                              {draft.warnings.map((warning) => (
                                <p key={warning}>{warning}</p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                )
              })}
              {!filteredDrafts.length ? <EmptyState title="Aucune operation dans ce filtre" description="Les autres statuts restent disponibles dans les filtres." /> : null}
            </div>

            {renderDraftPaginationControls('bottom')}

            <div className="statement-import-footer">
              {allImported ? <span className="positive-text">Toutes les operations selectionnees ont ete importees.</span> : null}
              <Button type="button" disabled={(!selectedDraftCount && !pendingDuplicateDeletionCount) || importMutation.isPending || loadingReferences} onClick={() => importMutation.mutate()}>
                {importMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                {selectedDraftCount
                  ? `Importer ${selectedDraftCount}${pendingDuplicateDeletionCount ? ` et supprimer ${pendingDuplicateDeletionCount}` : ''}`
                  : pendingDuplicateDeletionCount
                    ? `Supprimer ${pendingDuplicateDeletionCount}`
                    : 'Importer'}
              </Button>
            </div>
          </>
        ) : null}

        {!drafts.length && analyzeMutation.isSuccess ? <EmptyState title="Aucune operation detectee" description="Le PDF a ete lu, mais aucune operation exploitable n'a ete trouvee." /> : null}

      </div>
    </OverlayPanel>
    <OverlayPanel
      open={statementAccountPromptOpen}
      onClose={() => setStatementAccountPromptOpen(false)}
      title="Compte du releve"
      subtitle="Choisis le compte bancaire lu dans le PDF."
      width="regular"
      overlayClassName="overlay-super-top statement-import-create-overlay-layer statement-import-account-prompt-layer"
      closeOnBackdrop={false}
      actions={
        <Button type="button" tone="ghost" onClick={() => setStatementAccountPromptOpen(false)}>
          Passer
        </Button>
      }
    >
      <div className="statement-import-account-prompt">
        <div className="statement-import-account-choice-grid">
          {internalAccounts.map((account) => (
            <button
              key={account.identifiant}
              type="button"
              className={cx(statementAccountId === account.identifiant && 'selected')}
              onClick={() => {
                void chooseStatementAccountFromPrompt(account.identifiant)
              }}
            >
              <strong>{account.identifiant}</strong>
              <span>{account.libelle || 'Compte interne'}</span>
            </button>
          ))}
          {!internalAccounts.length ? <div className="statement-import-existing-operation">Aucun compte interne charge.</div> : null}
        </div>
      </div>
    </OverlayPanel>
    {duplicatePreviewOverlay && typeof document !== 'undefined' ? createPortal(duplicatePreviewOverlay, document.body) : null}
    {duplicateHoverTooltip && typeof document !== 'undefined'
      ? createPortal(
          <div className="statement-import-duplicate-hover-tooltip" style={{ left: duplicateHoverTooltip.x, top: duplicateHoverTooltip.y }}>
            {duplicateHoverTooltip.text}
          </div>,
          document.body,
        )
      : null}
    {correctionOverlay && typeof document !== 'undefined' ? createPortal(correctionOverlay, document.body) : null}
    <OverlayPanel
      open={creationChooserOpen}
      onClose={() => {
        setCreationChooserOpen(false)
        setCreationChooserStep('root')
      }}
      title="Creer"
      titlePrefix={
        creationChooserStep !== 'root' ? (
          <button type="button" className="statement-import-create-back-title" onClick={() => setCreationChooserStep('root')} aria-label="Retour">
            <ChevronLeft size={18} />
          </button>
        ) : undefined
      }
      width="regular"
      overlayClassName="overlay-super-top statement-import-create-overlay-layer"
    >
      <div className="statement-import-create-chooser">
        {creationChooserStep === 'root' ? (
          <>
            <button type="button" onClick={() => setCreationChooserStep('account')}>
              <strong>COMPTE</strong>
              <span>Creer un compte interne ou externe.</span>
            </button>
            <button type="button" onClick={() => setCreationChooserStep('reference')}>
              <strong>REFERENCE</strong>
              <span>Creer une categorie, sous-categorie ou beneficiaire.</span>
            </button>
          </>
        ) : null}

        {creationChooserStep === 'account' ? (
          <>
            <button type="button" onClick={() => openCreationTarget('internal-account')}>
              <strong>COMPTE INTERNE</strong>
              <span>Compte du releve importe.</span>
            </button>
            <button type="button" onClick={() => openCreationTarget('external-account')}>
              <strong>COMPTE EXTERNE</strong>
              <span>Origine ou destination de l'operation.</span>
            </button>
          </>
        ) : null}

        {creationChooserStep === 'reference' ? (
          <>
            <button type="button" onClick={() => openCreationTarget('categorie')}>
              <strong>CATEGORIE</strong>
              <span>Regroupement principal.</span>
            </button>
            <button type="button" onClick={() => openCreationTarget('souscategorie')}>
              <strong>SOUS-CATEGORIE</strong>
              <span>Classement de l'operation.</span>
            </button>
            <button type="button" onClick={() => openCreationTarget('beneficiaire')}>
              <strong>BENEFICIAIRE</strong>
              <span>Personne concernee par l'operation.</span>
            </button>
          </>
        ) : null}
      </div>
    </OverlayPanel>
    {beneficiaryPicker ? (
      <div className="statement-import-beneficiary-popover" role="dialog" aria-modal="true" aria-label="Choisir les beneficiaires">
        <div className="statement-import-beneficiary-popover-card">
          <div className="statement-import-beneficiary-popover-head">
            <strong>Beneficiaires</strong>
            <button type="button" onClick={() => setBeneficiaryPicker(null)}>
              Fermer
            </button>
          </div>
          <div className="statement-import-beneficiary-popover-list">
            {(beneficiairesQuery.data ?? []).map((item) => {
              const checked = beneficiaryPicker.values.includes(item.nom)
              return (
                <button key={item.nom} type="button" className={cx('statement-import-beneficiary-option', checked && 'selected')} onClick={() => togglePickedBeneficiary(item.nom)}>
                  {item.nom}
                </button>
              )
            })}
            {!(beneficiairesQuery.data ?? []).length ? <span className="muted-text">Aucun beneficiaire reference.</span> : null}
          </div>
          <div className="statement-import-beneficiary-popover-footer">
            <span>{`Selectionne ${beneficiaryPicker.values.length}`}</span>
            <Button type="button" onClick={validateBeneficiaryPicker}>
              Valider
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    <QuickReferenceOverlay dialog={quickReferenceDialog} onClose={() => setQuickReferenceDialog(null)} />
    <QuickAccountOverlay dialog={quickAccountDialog} onClose={() => setQuickAccountDialog(null)} />
    </>
  )
}
