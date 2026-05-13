const PDF_IMPORTER_BASE_URL = import.meta.env.VITE_MONATIS_PDF_IMPORTER_URL ?? '/__monatis_pdf_reader'

export interface StatementBalanceControl {
  status: string
  opening_balance: number | null
  closing_balance: number | null
  transactions_total: number | null
  expected_delta: number | null
  difference: number | null
  passed: boolean
}

export interface StatementOperationCandidate {
  id: string
  sourceIndex: number
  selected: boolean
  codeTypeOperation: string
  dateValeur: string | null
  dateComptabilisation: string | null
  numero: string | null
  libelle: string
  montantEnCentimes: number | null
  montantSigneEnCentimes: number | null
  currency: string
  identifiantCompteDepense: string | null
  identifiantCompteRecette: string | null
  statementAccountRole: 'depense' | 'recette'
  counterpartyAccountRole: 'depense' | 'recette'
  suggestedCounterpartyName: string | null
  nomSousCategorie: string | null
  nomsBeneficiaires: string[]
  confidence: number | null
  page: number | null
  warnings: string[]
  groupKey: string
  groupLabel: string
  groupSize: number
  isRecurring: boolean
}

export interface StatementExternalAccountGroup {
  key: string
  label: string
  count: number
  operationIds: string[]
  totalAmountEnCentimes: number
  counterpartyAccountRole: 'depense' | 'recette'
  codeTypeOperation: string
  isRecurring: boolean
}

export interface StatementRawTransaction {
  operation_date: string | null
  value_date: string | null
  label_raw: string
  amount: number | null
  currency?: string | null
  page?: number | null
  confidence?: number | null
  warnings?: string[]
}

export interface StatementImportResult {
  filename: string
  bank: string | null
  document_type: string
  statement_year?: number | null
  statement_month?: number | null
  warnings: string[]
  stats?: {
    transaction_count?: number
    balance_control?: StatementBalanceControl
  }
  transactions?: StatementRawTransaction[]
  operation_candidates: StatementOperationCandidate[]
  monatis?: {
    candidate_count: number
    auto_selected_count: number
    requires_statement_account: boolean
    supported_operation_types: string[]
    external_account_groups?: StatementExternalAccountGroup[]
  }
}

function centsFromAmount(amount: number | null | undefined): number | null {
  if (amount == null || !Number.isFinite(Number(amount))) {
    return null
  }

  return Math.round(Number(amount) * 100)
}

function legacyCandidateId(index: number, transaction: StatementRawTransaction): string {
  return [
    'legacy',
    index,
    transaction.operation_date ?? '',
    transaction.value_date ?? '',
    transaction.amount ?? '',
    transaction.label_raw ?? '',
    transaction.page ?? '',
  ]
    .join('-')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 80)
}

function compactCounterpartyName(label: string): string | null {
  let cleaned = label.trim()
  if (!cleaned) {
    return null
  }

  cleaned = cleaned
    .replace(/^CB\s+/i, '')
    .replace(/^CARTE\s+\d+\s+/i, '')
    .replace(/^PRLV\s+(SEPA\s+)?/i, '')
    .replace(/^PRELEVEMENT\s+(SEPA\s+)?/i, '')
    .replace(/^VIR\s+(SEPA\s+)?(RECU\s+)?/i, '')
    .replace(/^VIREMENT\s+(SEPA\s+)?(RECU\s+)?/i, '')
    .replace(/^CHEQUE\s+N[°O]?\s*\d+\s*/i, '')
    .replace(/^REMISE\s+CHEQUES?\s+N[°O]?\s*\d+\s*/i, '')
    .replace(/\bFACT\s+\d{4,}\b.*$/i, '')
    .replace(/\bVALEUR\s+AU\s+\d{2}\/\d{2}\b.*$/i, '')
    .replace(/\s+-?\s*R[ée]f\..*$/i, '')
    .replace(/\s+-?\s*ID\s+CREANCIER.*$/i, '')
    .replace(/(?:\s+\d{4,})+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) {
    return null
  }

  return cleaned.length <= 48 ? cleaned : cleaned.slice(0, 48).trim()
}

function normalizedGroupToken(value: string): string {
  const ignoredWords = new Set([
    'ACHAT',
    'AU',
    'CARTE',
    'CB',
    'CHEQUE',
    'DE',
    'DU',
    'FACT',
    'FR',
    'LE',
    'LES',
    'N',
    'PAR',
    'PRELEVEMENT',
    'PRLV',
    'RECU',
    'REF',
    'REMISE',
    'SEPA',
    'VIR',
    'VIREMENT',
  ])

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token && !ignoredWords.has(token) && !/^\d+$/.test(token))
    .join(' ')
    .trim()
}

function candidateGroupLabel(candidate: Pick<StatementOperationCandidate, 'suggestedCounterpartyName' | 'libelle'>): string {
  return (candidate.suggestedCounterpartyName || candidate.libelle || 'Operation').trim()
}

function candidateGroupKey(candidate: Pick<StatementOperationCandidate, 'id' | 'suggestedCounterpartyName' | 'libelle' | 'counterpartyAccountRole' | 'codeTypeOperation'>): string {
  const label = candidateGroupLabel(candidate)
  const token = normalizedGroupToken(label) || normalizedGroupToken(candidate.libelle) || candidate.id
  return `${candidate.counterpartyAccountRole}-${candidate.codeTypeOperation}-${token}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

function withCandidateGroups(candidates: StatementOperationCandidate[]): StatementOperationCandidate[] {
  const groups = new Map<string, { label: string; count: number }>()
  const seededCandidates = candidates.map((candidate) => {
    const groupKey = candidate.groupKey || candidateGroupKey(candidate)
    const groupLabel = candidate.groupLabel || candidateGroupLabel(candidate)
    const group = groups.get(groupKey)

    if (group) {
      group.count += 1
      if (groupLabel.length < group.label.length) {
        group.label = groupLabel
      }
    } else {
      groups.set(groupKey, { label: groupLabel, count: 1 })
    }

    return {
      ...candidate,
      groupKey,
      groupLabel,
      groupSize: candidate.groupSize || 1,
      isRecurring: candidate.isRecurring ?? false,
    }
  })

  return seededCandidates.map((candidate) => {
    const group = groups.get(candidate.groupKey)
    const groupSize = group?.count ?? candidate.groupSize

    return {
      ...candidate,
      groupLabel: group?.label ?? candidate.groupLabel,
      groupSize,
      isRecurring: groupSize > 1,
    }
  })
}

function legacyTransactionToCandidate(transaction: StatementRawTransaction, index: number): StatementOperationCandidate {
  const signedCents = centsFromAmount(transaction.amount)
  const isCredit = (signedCents ?? 0) >= 0
  const statementAccountRole = isCredit ? 'recette' : 'depense'
  const counterpartyAccountRole = isCredit ? 'depense' : 'recette'
  const suggestedCounterpartyName = compactCounterpartyName(transaction.label_raw ?? '')

  return {
    id: legacyCandidateId(index, transaction),
    sourceIndex: index,
    selected: signedCents != null,
    codeTypeOperation: isCredit ? 'RECETTE' : 'DEPENSE',
    dateValeur: transaction.value_date ?? transaction.operation_date,
    dateComptabilisation: transaction.operation_date ?? transaction.value_date,
    numero: null,
    libelle: transaction.label_raw ?? '',
    montantEnCentimes: signedCents == null ? null : Math.abs(signedCents),
    montantSigneEnCentimes: signedCents,
    currency: transaction.currency ?? 'EUR',
    identifiantCompteDepense: null,
    identifiantCompteRecette: null,
    statementAccountRole,
    counterpartyAccountRole,
    suggestedCounterpartyName,
    nomSousCategorie: null,
    nomsBeneficiaires: [],
    confidence: transaction.confidence ?? null,
    page: transaction.page ?? null,
    warnings: transaction.warnings ?? [],
    groupKey: '',
    groupLabel: suggestedCounterpartyName ?? transaction.label_raw ?? 'Operation',
    groupSize: 1,
    isRecurring: false,
  }
}

function normalizeStatementImportResult(payload: StatementImportResult): StatementImportResult {
  const existingCandidates = Array.isArray(payload.operation_candidates) ? payload.operation_candidates : []
  const rawTransactions = Array.isArray(payload.transactions) ? payload.transactions : []
  const operationCandidates = withCandidateGroups(
    existingCandidates.length ? existingCandidates : rawTransactions.map((transaction, index) => legacyTransactionToCandidate(transaction, index + 1)),
  )

  return {
    ...payload,
    warnings: payload.warnings ?? [],
    operation_candidates: operationCandidates,
    monatis: payload.monatis ?? {
      candidate_count: operationCandidates.length,
      auto_selected_count: operationCandidates.filter((candidate) => candidate.selected).length,
      requires_statement_account: true,
      supported_operation_types: ['DEPENSE', 'RECETTE'],
      external_account_groups: [],
    },
  }
}

async function parseImportError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string }
    return payload.detail ?? `Erreur HTTP ${response.status}`
  } catch {
    return `Erreur HTTP ${response.status}`
  }
}

export async function analyzeStatementPdf(file: File): Promise<StatementImportResult> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${PDF_IMPORTER_BASE_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await parseImportError(response))
  }

  return normalizeStatementImportResult((await response.json()) as StatementImportResult)
}

export const pdfImporterApi = {
  baseUrl: PDF_IMPORTER_BASE_URL,
  analyzeStatementPdf,
}
