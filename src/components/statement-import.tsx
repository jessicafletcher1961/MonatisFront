import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, FileText, LoaderCircle, Plus, Save, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

import { cx } from '../lib/cx'
import { formatCurrencyFromCents, nullIfBlank, parseMoneyToCents, toMoneyInput } from '../lib/format'
import { apiErrorMessage, type CompteSummary, monatisApi } from '../lib/monatis-api'
import { pdfImporterApi, type StatementOperationCandidate } from '../lib/pdf-import-api'
import { Badge, Button, EmptyState, ErrorState, FormField, LoadingState, OverlayPanel } from './ui'

type ImportDraftStatus = 'draft' | 'imported' | 'error'
type AccountField = 'depense' | 'recette'
type OperationTypeGroup = 'incoming' | 'outgoing' | 'internal' | 'technical' | 'other'
type DraftIssueField = 'codeTypeOperation' | 'dateValeur' | 'montant' | 'identifiantCompteDepense' | 'identifiantCompteRecette'

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
}

interface ImportOutcome {
  id: string
  ok: boolean
  error?: string
}

interface ImportGroup {
  key: string
  label: string
  count: number
  selectedCount: number
  missingExternalCount: number
  totalCents: number
  counterpartyAccountRole: AccountField
  currentExternalAccountId: string
  mixedExternalAccounts: boolean
  operationIds: string[]
}

interface CreateExternalAccountForGroupInput {
  group: ImportGroup
  identifiant: string
}

interface DraftIssue {
  field: DraftIssueField
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

function externalAccountIdentifierFromGroupLabel(label: string, externalAccounts: CompteSummary[]): string {
  const baseSegment =
    label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 34) || 'GROUPE'
  const base = `EXT-${baseSegment}`
  const existingIdentifiers = new Set(externalAccounts.map((account) => account.identifiant.toUpperCase()))

  if (!existingIdentifiers.has(base)) {
    return base
  }

  for (let index = 2; index < 100; index += 1) {
    const suffix = `-${index}`
    const candidate = `${base.slice(0, 48 - suffix.length)}${suffix}`
    if (!existingIdentifiers.has(candidate)) {
      return candidate
    }
  }

  return `${base.slice(0, 44)}-${Date.now().toString().slice(-3)}`
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
  const selectedDraftCount = drafts.filter((draft) => draft.selected && draft.status !== 'imported').length
  const importedCount = drafts.filter((draft) => draft.status === 'imported').length
  const importGroups = useMemo<ImportGroup[]>(() => {
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
        const totalCents = groupDrafts.reduce((total, draft) => total + Math.abs(parseMoneyToCents(draft.montant)), 0)

        return {
          key,
          label: firstDraft.groupLabel || firstDraft.suggestedCounterpartyName || firstDraft.libelle || `Groupe ${firstDraft.sourceIndex}`,
          count: groupDrafts.length,
          selectedCount: groupDrafts.filter((draft) => draft.selected).length,
          missingExternalCount: groupDrafts.filter((draft) => {
            const accountId = draft.counterpartyAccountRole === 'depense' ? draft.identifiantCompteDepense : draft.identifiantCompteRecette
            return !accountId
          }).length,
          totalCents,
          counterpartyAccountRole: firstDraft.counterpartyAccountRole,
          currentExternalAccountId: externalAccountIds.size === 1 ? Array.from(externalAccountIds)[0] : '',
          mixedExternalAccounts: externalAccountIds.size > 1,
          operationIds: groupDrafts.map((draft) => draft.id),
        }
      })
      .filter((group) => group.count > 1)
      .sort((left, right) => right.count - left.count || right.missingExternalCount - left.missingExternalCount || left.label.localeCompare(right.label))
  }, [drafts])

  const analyzeMutation = useMutation({
    mutationFn: (file: File) => pdfImporterApi.analyzeStatementPdf(file),
    onSuccess: (payload) => {
      setResultWarnings(payload.warnings ?? [])
      setBalanceControl(payload.stats?.balance_control ?? null)
      const defaultStatementAccountId = statementAccountId || (internalAccounts.length === 1 ? internalAccounts[0].identifiant : '')
      const mappedDrafts = (payload.operation_candidates ?? [])
        .map((candidate) => candidateToDraft(candidate, externalAccounts))
        .map((draft) => applyStatementAccount(draft, defaultStatementAccountId, externalAccounts))
      if (defaultStatementAccountId) {
        setStatementAccountId(defaultStatementAccountId)
      }
      setDrafts(mappedDrafts)
      setExpandedId(mappedDrafts[0]?.id ?? null)
    },
  })

  const createExternalAccountForGroupMutation = useMutation({
    mutationFn: ({ group, identifiant }: CreateExternalAccountForGroupInput) =>
      monatisApi.createExternalAccount({
        identifiant,
        libelle: group.label,
      }),
    onSuccess: async (account, { group }) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'externes'] })
      applyExternalAccountToGroup(group.key, account.identifiant)
    },
  })

  function draftIssue(draft: ImportDraft): DraftIssue | null {
    if (draft.status === 'imported') {
      return null
    }

    if (!draft.codeTypeOperation.trim()) {
      return { field: 'codeTypeOperation', label: 'Type', message: 'Type obligatoire.' }
    }

    if (!draft.dateValeur.trim()) {
      return { field: 'dateValeur', label: 'Date valeur', message: 'Date obligatoire.' }
    }

    if (Math.abs(parseMoneyToCents(draft.montant)) <= 0) {
      return { field: 'montant', label: 'Montant', message: 'Montant obligatoire.' }
    }

    if (!draft.identifiantCompteDepense.trim()) {
      return { field: 'identifiantCompteDepense', label: 'Compte depense', message: 'Compte depense obligatoire.' }
    }

    if (!draft.identifiantCompteRecette.trim()) {
      return { field: 'identifiantCompteRecette', label: 'Compte recette', message: 'Compte recette obligatoire.' }
    }

    return null
  }

  const invalidSelectedCount = drafts.filter((draft) => draft.selected && draft.status !== 'imported' && draftIssue(draft)).length

  const importMutation = useMutation({
    mutationFn: async () => {
      const outcomes: ImportOutcome[] = []
      const selectedDrafts = drafts.filter((draft) => draft.selected && draft.status !== 'imported')

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
        } catch (error) {
          outcomes.push({ id: draft.id, ok: false, error: apiErrorMessage(error) })
        }
      }

      return outcomes
    },
    onSuccess: async (outcomes) => {
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

      if (successCount) {
        await queryClient.invalidateQueries({ queryKey: ['operations'] })
        await onImported?.()
      }
    },
  })

  function resetImportState() {
    setSelectedFile(null)
    setResultWarnings([])
    setBalanceControl(null)
    setStatementAccountId('')
    setDrafts([])
    setExpandedId(null)
    analyzeMutation.reset()
    importMutation.reset()
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
    analyzeMutation.reset()
    importMutation.reset()
  }

  function updateDraft(id: string, patch: Partial<ImportDraft>) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? {
              ...draft,
              ...patch,
              status: draft.status === 'imported' ? 'imported' : 'draft',
              error: '',
            }
          : draft,
      ),
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

  function changeStatementAccount(nextStatementAccountId: string) {
    setStatementAccountId(nextStatementAccountId)
    setDrafts((current) =>
      current.map((draft) => (draft.status === 'imported' ? draft : applyStatementAccount(draft, nextStatementAccountId, externalAccounts))),
    )
  }

  function applyExternalAccountToGroup(groupKey: string, externalAccountId: string) {
    setDrafts((current) =>
      current.map((draft) => {
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
          status: 'draft',
          error: '',
        }
      }),
    )
  }

  function createExternalAccountForGroup(group: ImportGroup) {
    const identifiant = externalAccountIdentifierFromGroupLabel(group.label, externalAccounts)
    createExternalAccountForGroupMutation.mutate({ group, identifiant })
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

  const analyzeError = analyzeMutation.error ? apiErrorMessage(analyzeMutation.error) : ''
  const loadingReferences =
    typesQuery.isLoading ||
    internalAccountsQuery.isLoading ||
    externalAccountsQuery.isLoading ||
    sousCategoriesQuery.isLoading ||
    beneficiairesQuery.isLoading
  const referenceError =
    typesQuery.error || internalAccountsQuery.error || externalAccountsQuery.error || sousCategoriesQuery.error || beneficiairesQuery.error
  const externalGroupError = createExternalAccountForGroupMutation.error ? apiErrorMessage(createExternalAccountForGroupMutation.error) : ''
  const creatingGroupKey = createExternalAccountForGroupMutation.isPending ? createExternalAccountForGroupMutation.variables?.group.key : null
  const allImported = Boolean(drafts.length) && drafts.every((draft) => draft.status === 'imported')

  const selectedTotalCents = useMemo(
    () =>
      drafts.reduce((total, draft) => {
        if (!draft.selected || draft.status === 'imported') {
          return total
        }

        return total + Math.abs(parseMoneyToCents(draft.montant))
      }, 0),
    [drafts],
  )

  return (
    <OverlayPanel open={open} onClose={closeAndReset} title="Importer un releve" width="wide" overlayClassName="overlay-super-top">
      <div className="statement-import">
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
          <Button type="button" disabled={!selectedFile || analyzeMutation.isPending} onClick={() => selectedFile && analyzeMutation.mutate(selectedFile)}>
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
        {externalGroupError ? <ErrorState message={externalGroupError} /> : null}

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
            <div className="statement-import-toolbar">
              <FormField label="Compte interne du releve">
                <select value={statementAccountId} onChange={(event) => changeStatementAccount(event.target.value)}>
                  <option value="">Choisir</option>
                  {internalAccounts.map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {accountChoiceLabel(account)}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="statement-import-actions">
                <Button
                  type="button"
                  tone="ghost"
                  onClick={() => setDrafts((current) => current.map((draft) => (draft.status === 'imported' ? draft : { ...draft, selected: true })))}
                >
                  Tout selectionner
                </Button>
                <Button
                  type="button"
                  tone="ghost"
                  onClick={() => setDrafts((current) => current.map((draft) => (draft.status === 'imported' ? draft : { ...draft, selected: false })))}
                >
                  Tout retirer
                </Button>
              </div>
            </div>

            <div className="statement-import-summary">
              <Badge>{`${selectedDraftCount} selectionnee${selectedDraftCount > 1 ? 's' : ''}`}</Badge>
              <Badge>{formatCurrencyFromCents(selectedTotalCents)}</Badge>
              {invalidSelectedCount ? <Badge tone="warning">{`${invalidSelectedCount} a corriger`}</Badge> : null}
              {importedCount ? <Badge tone="success">{`${importedCount} importee${importedCount > 1 ? 's' : ''}`}</Badge> : null}
            </div>

            {importGroups.length ? (
              <section className="statement-import-groups">
                <div className="statement-import-groups-head">
                  <div>
                    <strong>Groupes recurrents</strong>
                    <span>Appliquer le compte externe a toutes les operations similaires.</span>
                  </div>
                  <Badge>{`${importGroups.length} groupe${importGroups.length > 1 ? 's' : ''}`}</Badge>
                </div>

                <div className="statement-import-group-list">
                  {importGroups.map((group) => {
                    const groupIsCreating = creatingGroupKey === group.key

                    return (
                      <div key={group.key} className="statement-import-group-row">
                        <div className="statement-import-group-main">
                          <strong>{group.label}</strong>
                          <span>
                            {group.count} ops - {formatCurrencyFromCents(group.totalCents)}
                            {group.selectedCount !== group.count ? ` - ${group.selectedCount} selectionnee${group.selectedCount > 1 ? 's' : ''}` : ''}
                            {group.missingExternalCount ? ` - ${group.missingExternalCount} sans compte externe` : ' - complet'}
                          </span>
                        </div>

                        <select
                          value={group.mixedExternalAccounts ? '' : group.currentExternalAccountId}
                          disabled={groupIsCreating}
                          onChange={(event) => applyExternalAccountToGroup(group.key, event.target.value)}
                          aria-label={`Compte externe pour ${group.label}`}
                        >
                          <option value="">{group.mixedExternalAccounts ? 'Comptes differents' : 'Choisir compte externe'}</option>
                          {externalAccounts.map((account) => (
                            <option key={account.identifiant} value={account.identifiant}>
                              {accountChoiceLabel(account)}
                            </option>
                          ))}
                        </select>

                        <Button
                          type="button"
                          tone="ghost"
                          className="statement-import-group-create"
                          disabled={groupIsCreating || !group.missingExternalCount}
                          onClick={() => createExternalAccountForGroup(group)}
                          title={`Creer ${externalAccountIdentifierFromGroupLabel(group.label, externalAccounts)}`}
                        >
                          {groupIsCreating ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />}
                          Creer
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <div className="statement-import-list">
              {drafts.map((draft) => {
                const depenseOptions = accountOptionsForField(draft.codeTypeOperation, 'depense', internalAccounts, externalAccounts)
                const recetteOptions = accountOptionsForField(draft.codeTypeOperation, 'recette', internalAccounts, externalAccounts)
                const issue = draftIssue(draft)
                const expanded = expandedId === draft.id

                return (
                  <section
                    key={draft.id}
                    className={cx(
                      'statement-import-card',
                      draft.codeTypeOperation === 'RECETTE' && 'statement-import-card-incoming',
                      draft.codeTypeOperation === 'DEPENSE' && 'statement-import-card-outgoing',
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
                          onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })}
                        />
                        <span />
                      </label>

                      <button type="button" className="statement-import-card-toggle" onClick={() => setExpandedId(expanded ? null : draft.id)}>
                        <div>
                          <strong>{draft.libelle || `Operation ${draft.sourceIndex}`}</strong>
                          <small>
                            #{draft.sourceIndex} - {draft.dateValeur || 'Date manquante'} - {formatCurrencyFromCents(Math.abs(parseMoneyToCents(draft.montant)))}
                            {draft.suggestedCounterpartyName ? ` - ${draft.suggestedCounterpartyName}` : ''}
                          </small>
                        </div>
                        <ChevronDown size={16} />
                      </button>

                      <div className="statement-import-card-status">
                        {draft.status === 'imported' ? <Badge tone="success">Importee</Badge> : null}
                        {draft.status === 'error' ? <Badge tone="warning">Erreur</Badge> : null}
                        {issue && draft.selected ? <Badge tone="warning">A corriger</Badge> : null}
                        {draft.isRecurring ? <Badge>{`x${draft.groupSize}`}</Badge> : null}
                        <Badge>{draft.codeTypeOperation}</Badge>
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
                            <div className="statement-import-beneficiary-picker">
                              <select value="" onChange={(event) => addBeneficiary(draft, event.target.value)}>
                                <option value="">Ajouter</option>
                                {(beneficiairesQuery.data ?? [])
                                  .filter((item) => !draft.nomsBeneficiaires.includes(item.nom))
                                  .map((item) => (
                                    <option key={item.nom} value={item.nom}>
                                      {item.nom}
                                    </option>
                                  ))}
                              </select>
                              {draft.nomsBeneficiaires.length ? (
                                <div className="statement-import-mini-chip-list">
                                  {draft.nomsBeneficiaires.map((name) => (
                                    <button key={name} type="button" className="statement-import-mini-chip" onClick={() => toggleBeneficiary(draft, name)}>
                                      {name}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
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

                        <div className="statement-import-beneficiaries">
                          <span className="form-field-label">Beneficiaires</span>
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
                        </div>

                        <div className="statement-import-card-meta">
                          <span>Page {draft.page ?? '-'}</span>
                          <span>Confiance {confidenceLabel(draft.confidence)}</span>
                          {draft.suggestedCounterpartyName ? <span>Suggestion {draft.suggestedCounterpartyName}</span> : null}
                        </div>

                        {draft.warnings.length || draft.error || (issue && draft.selected) ? (
                          <div className="statement-import-warning compact">
                            <AlertTriangle size={15} />
                            <div>
                              {draft.error ? <p>{draft.error}</p> : null}
                              {issue && draft.selected ? <p>{issue.message}</p> : null}
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
            </div>

            <div className="statement-import-footer">
              {allImported ? <span className="positive-text">Toutes les operations selectionnees ont ete importees.</span> : null}
              <Button type="button" disabled={!selectedDraftCount || importMutation.isPending || loadingReferences} onClick={() => importMutation.mutate()}>
                {importMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                Importer {selectedDraftCount || ''}
              </Button>
            </div>
          </>
        ) : null}

        {!drafts.length && analyzeMutation.isSuccess ? <EmptyState title="Aucune operation detectee" description="Le PDF a ete lu, mais aucune operation exploitable n'a ete trouvee." /> : null}
      </div>
    </OverlayPanel>
  )
}
