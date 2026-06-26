import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, Save, Search, Trash2, Upload, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { QuickAccountOverlay, QuickReferenceOverlay, type QuickAccountDialogState, type QuickAccountKind, type QuickReferenceDialogState } from '../components/quick-create'
import { StatementImportOverlay } from '../components/statement-import'
import { Badge, Button, EmptyState, ErrorState, FormField, LoadingState, OverlayPanel, PageHeader, QuickAddButton, SectionHeader, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { formatCurrencyFromCents, formatDate, nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../lib/format'
import { apiErrorMessage, type CompteSummary, type OperationBasic, type OperationLinePayload, type OperationPageRequest, type ReferenceListItem, type TypeOperation, monatisApi } from '../lib/monatis-api'
import { readableOperationLabel, technicalAccountFallback } from '../lib/reporting'

const operationLineSchema = z.object({
  numeroLigne: z.number().nullable().optional(),
  libelle: z.string().optional(),
  dateComptabilisation: z.string().optional(),
  montant: z.string().optional(),
  nomSousCategorie: z.string().optional(),
  nomsBeneficiaires: z.array(z.string()),
})

const createSchema = z.object({
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
type CreateOperationInput = {
  values: CreateFormValues
  continueWithSameSettings: boolean
}
type CreateStep = 'account-type' | 'account' | 'type' | 'counterparty' | 'amount' | 'review'
type QuickEditTarget = 'type' | 'depense' | 'recette' | 'amount' | null
type AccountField = 'depense' | 'recette'
type AccountTypeChoice = 'COURANT' | 'FINANCIER' | 'BIEN' | 'EXTERNE' | 'TECHNIQUE'
type OperationTypeGroup = 'incoming' | 'outgoing' | 'internal' | 'technical' | 'other'
type OperationFilterPicker = 'type' | 'account-type' | 'account' | 'beneficiary' | 'date' | 'amount' | null
type RangeFilterValue = { from: string; to: string }
type SubCategoryPickerTarget =
  | { kind: 'create' }
  | { kind: 'createLine'; index: number }
  | { kind: 'newCreateLine' }
  | { kind: 'line'; index: number }
  | { kind: 'newLine' }
  | null
type BeneficiaryPickerTarget =
  | { kind: 'create' }
  | { kind: 'createLine'; index: number }
  | { kind: 'newCreateLine' }
  | { kind: 'line'; index: number }
  | { kind: 'newLine' }
  | null

const CREATE_DEFAULTS: CreateFormValues = {
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

const ACCOUNT_TYPE_META: Array<{ key: AccountTypeChoice; label: string; description: string }> = [
  { key: 'COURANT', label: 'Courant', description: 'Banque, caisse, compte courant' },
  { key: 'FINANCIER', label: 'Financier', description: 'Placement, epargne, investissement' },
  { key: 'BIEN', label: 'Bien', description: 'Maison, voiture, objet suivi' },
  { key: 'EXTERNE', label: 'Externe', description: 'Commerce, organisme, personne externe' },
  { key: 'TECHNIQUE', label: 'Technique', description: 'Frais et remunerations' },
]

const OPERATION_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
const DEFAULT_OPERATION_PAGE_SIZE = 50
const ADVANCED_OPERATION_FETCH_PAGE_SIZE = 200
const HIDDEN_CREATE_OPERATION_TYPES = new Set(['INVEST', 'LIQUID'])

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

function operationPageSearchPayload(value: string): Pick<OperationPageRequest, 'recherche'> {
  const needle = value.trim()
  if (!needle) {
    return {}
  }

  return { recherche: needle }
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

function lineDisplayTitle(index: number, numeroLigne?: number | null): string {
  return `Ligne ${numeroLigne ?? index}`
}

function makeOperationLineValues(date: string, index?: number): OperationLineFormValues {
  return {
    numeroLigne: null,
    libelle: index == null ? '' : lineDisplayTitle(index),
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

function primaryLineIndex(lines: Array<{ numeroLigne?: number | null } | undefined>): number {
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

function appendUnique(values: string[], nextValue: string): string[] {
  return values.includes(nextValue) ? values : [...values, nextValue]
}

function operationReferenceSummary(operation: OperationBasic): {
  subCategories: string[]
  beneficiaries: string[]
} {
  const subCategories = Array.from(new Set(operation.lignes.map((line) => subCategoryNameForLine(line)).filter(Boolean)))
  const beneficiaries = Array.from(new Set(operation.lignes.flatMap((line) => beneficiaryNamesForDisplay(line)).filter(Boolean)))

  return { subCategories, beneficiaries }
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

function internalAccountsByType(internalAccounts: CompteSummary[], codeTypeFonctionnement: string): CompteSummary[] {
  return internalAccounts.filter((account) => account.codeTypeFonctionnement === codeTypeFonctionnement)
}

function compatibleAccountOptionsForField(
  codeTypeOperation: string,
  field: 'depense' | 'recette',
  internalAccounts: CompteSummary[],
  externalAccounts: CompteSummary[],
  technicalAccounts: CompteSummary[],
): CompteSummary[] {
  const courantAccounts = internalAccountsByType(internalAccounts, 'COURANT')
  const financierAccounts = internalAccountsByType(internalAccounts, 'FINANCIER')
  const bienAccounts = internalAccountsByType(internalAccounts, 'BIEN')

  switch (codeTypeOperation) {
    case 'RECETTE':
      return field === 'depense' ? externalAccounts : courantAccounts
    case 'DEPENSE':
      return field === 'depense' ? courantAccounts : externalAccounts
    case 'TRANSFERT':
      return courantAccounts
    case 'DEPOT':
    case 'INVEST':
      return field === 'depense' ? courantAccounts : financierAccounts
    case 'RETRAIT':
    case 'LIQUID':
      return field === 'depense' ? financierAccounts : courantAccounts
    case 'ACHAT':
      return field === 'depense' ? externalAccounts : bienAccounts
    case 'VENTE':
      return field === 'depense' ? bienAccounts : externalAccounts
    case 'COURANT+':
      return field === 'depense' ? technicalAccounts : courantAccounts
    case 'COURANT-':
      return field === 'depense' ? courantAccounts : technicalAccounts
    case 'FINANCIER+':
      return field === 'depense' ? technicalAccounts : financierAccounts
    case 'FINANCIER-':
      return field === 'depense' ? financierAccounts : technicalAccounts
    case 'BIEN+':
      return field === 'depense' ? technicalAccounts : bienAccounts
    case 'BIEN-':
      return field === 'depense' ? bienAccounts : technicalAccounts
    default:
      return [...internalAccounts, ...externalAccounts, ...technicalAccounts]
  }
}

function accountOptionsWithCurrent(options: CompteSummary[], currentIdentifiant: string, allAccounts: CompteSummary[]): CompteSummary[] {
  if (!currentIdentifiant || options.some((account) => account.identifiant === currentIdentifiant)) {
    return options
  }

  const knownAccount = allAccounts.find((account) => account.identifiant === currentIdentifiant)
  return [...options, knownAccount ?? { identifiant: currentIdentifiant, libelle: null }]
}

function accountsForTypeChoice(
  choice: AccountTypeChoice,
  internalAccounts: CompteSummary[],
  externalAccounts: CompteSummary[],
  technicalAccounts: CompteSummary[],
): CompteSummary[] {
  if (choice === 'EXTERNE') {
    return externalAccounts
  }

  if (choice === 'TECHNIQUE') {
    return technicalAccounts
  }

  return internalAccountsByType(internalAccounts, choice)
}

function accountTypeChoiceForAccount(
  account: CompteSummary | null | undefined,
  internalIds: Set<string>,
  externalIds: Set<string>,
  technicalIds: Set<string>,
): AccountTypeChoice | null {
  if (!account) {
    return null
  }

  if (externalIds.has(account.identifiant)) {
    return 'EXTERNE'
  }

  if (technicalIds.has(account.identifiant)) {
    return 'TECHNIQUE'
  }

  if (internalIds.has(account.identifiant) && ['COURANT', 'FINANCIER', 'BIEN'].includes(account.codeTypeFonctionnement ?? '')) {
    return account.codeTypeFonctionnement as AccountTypeChoice
  }

  return null
}

function accountKindForTypeChoice(choice: AccountTypeChoice): QuickAccountKind {
  if (choice === 'EXTERNE') {
    return 'externe'
  }

  if (choice === 'TECHNIQUE') {
    return 'technique'
  }

  return 'interne'
}

function accountTypeLabel(choice: AccountTypeChoice): string {
  return ACCOUNT_TYPE_META.find((item) => item.key === choice)?.label ?? choice
}

function compactFilterLabel(values: string[], emptyLabel: string, singleLabel?: string): string {
  if (!values.length) {
    return emptyLabel
  }

  if (values.length === 1) {
    return singleLabel ?? values[0]
  }

  return `${values.length} selectionnes`
}

function beneficiarySelectionLabel(values: string[]): string {
  return compactFilterLabel(values, 'Choisir')
}

function activeRangeFilters(values: RangeFilterValue[]): RangeFilterValue[] {
  return values.filter((item) => item.from.trim() || item.to.trim())
}

function normalizeRangeRows(values: RangeFilterValue[]): RangeFilterValue[] {
  const activeRows = activeRangeFilters(values)
  return [...activeRows, { from: '', to: '' }]
}

function wholeEuroToCents(value: string, rangeEnd = false): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace('€', '').replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return null
  }

  const wholeEuro = Math.trunc(Math.abs(parsed))
  return wholeEuro * 100 + (rangeEnd ? 99 : 0)
}

function amountFilterLabel(filter: RangeFilterValue): string {
  const from = filter.from.trim()
  const to = filter.to.trim()

  if (from && to) {
    return `${from} - ${to} €`
  }

  return `${from || to} €`
}

async function fetchAllOperationPages(request: OperationPageRequest): Promise<OperationBasic[]> {
  const firstPage = await monatisApi.listOperationsPage({
    ...request,
    numeroPage: 1,
    taillePage: ADVANCED_OPERATION_FETCH_PAGE_SIZE,
  })
  const operations = [...firstPage.operations]

  for (let page = 2; page <= firstPage.totalPages; page += 1) {
    const nextPage = await monatisApi.listOperationsPage({
      ...request,
      numeroPage: page,
      taillePage: ADVANCED_OPERATION_FETCH_PAGE_SIZE,
    })
    operations.push(...nextPage.operations)
  }

  return operations
}

function operationMatchesSearch(operation: OperationBasic, searchValue: string, accountById: Map<string, CompteSummary>): boolean {
  const needle = searchValue.trim()
  if (!needle) {
    return true
  }

  const depense = depenseId(operation)
  const recette = recetteId(operation)
  const haystack = [
    operation.numero,
    operation.libelle,
    readableOperationLabel(operation),
    operationAccountingDate(operation),
    formatDate(operationAccountingDate(operation)),
    formatCurrencyFromCents(operation.montantEnCentimes),
    depense,
    recette,
    operation.compteDepense?.libelle,
    operation.compteRecette?.libelle,
    accountById.get(depense)?.libelle,
    accountById.get(recette)?.libelle,
  ]
    .filter(Boolean)
    .join(' ')

  return matchesNeedle(haystack, needle)
}

function operationMatchesDates(operation: OperationBasic, filters: RangeFilterValue[]): boolean {
  const activeFilters = activeRangeFilters(filters)
  if (!activeFilters.length) {
    return true
  }

  const dateComptabilisation = operationAccountingDate(operation)
  if (!dateComptabilisation) {
    return false
  }

  return activeFilters.some((filter) => {
    const left = filter.from || filter.to
    const right = filter.to || filter.from
    if (!left || !right) {
      return false
    }

    const start = left <= right ? left : right
    const end = left <= right ? right : left
    return dateComptabilisation >= start && dateComptabilisation <= end
  })
}

function operationMatchesAmounts(operation: OperationBasic, filters: RangeFilterValue[]): boolean {
  const activeFilters = activeRangeFilters(filters)
  if (!activeFilters.length) {
    return true
  }

  return activeFilters.some((filter) => {
    const minimum = wholeEuroToCents(filter.from || filter.to)
    const maximum = filter.to ? wholeEuroToCents(filter.to, true) : filter.from ? wholeEuroToCents(filter.from, true) : null

    if (minimum == null && maximum == null) {
      return true
    }

    const start = minimum ?? maximum ?? 0
    const end = maximum ?? minimum ?? 0
    return operation.montantEnCentimes >= Math.min(start, end) && operation.montantEnCentimes <= Math.max(start, end)
  })
}

function accountTypeChoicesFromOptions(
  options: CompteSummary[],
  internalIds: Set<string>,
  externalIds: Set<string>,
  technicalIds: Set<string>,
): AccountTypeChoice[] {
  const choices = new Set<AccountTypeChoice>()

  options.forEach((account) => {
    const choice = accountTypeChoiceForAccount(account, internalIds, externalIds, technicalIds)
    if (choice) {
      choices.add(choice)
    }
  })

  return ACCOUNT_TYPE_META.map((item) => item.key).filter((choice) => choices.has(choice))
}

function operationDetailTitle(operation: OperationBasic): string {
  const directLabel = operation.libelle?.trim()
  if (directLabel) {
    return directLabel
  }

  const lineLabel = operation.lignes.find((line) => line.libelle?.trim())?.libelle?.trim()
  return lineLabel || 'Operation sans libelle'
}

function operationHistoryMeta(operation: OperationBasic): string {
  return formatDate(operationAccountingDate(operation))
}

function operationAccountingDate(operation: OperationBasic): string {
  const primaryIndex = primaryLineIndex(operation.lignes)
  return operation.lignes[primaryIndex]?.dateComptabilisation || operation.dateValeur
}

function compareOperationsByAccountingDate(left: OperationBasic, right: OperationBasic): number {
  const dateGap = operationAccountingDate(right).localeCompare(operationAccountingDate(left))
  if (dateGap !== 0) {
    return dateGap
  }

  return left.numero.localeCompare(right.numero)
}

function operationHistoryReferenceLabel(summary: ReturnType<typeof operationReferenceSummary>): string {
  const references = [...summary.subCategories, ...summary.beneficiaries]

  if (!references.length) {
    return 'Sans reference'
  }

  if (references.length === 1) {
    return references[0]
  }

  return `${references[0]} +${references.length - 1}`
}

function previewTip(label: string, value: string): string {
  return `${label}. ${value.trim() || 'Vide'}`
}

function operationAccountKinds(
  codeType: string,
  step: AccountField,
  options: CompteSummary[],
  internalIds: Set<string>,
  externalIds: Set<string>,
  technicalIds: Set<string>,
): QuickAccountKind[] {
  const inferredKinds = new Set<QuickAccountKind>()

  options.forEach((account) => {
    if (internalIds.has(account.identifiant)) {
      inferredKinds.add('interne')
    }

    if (externalIds.has(account.identifiant)) {
      inferredKinds.add('externe')
    }

    if (technicalIds.has(account.identifiant)) {
      inferredKinds.add('technique')
    }
  })

  if (inferredKinds.size) {
    return Array.from(inferredKinds)
  }

  const group = operationTypeGroup(codeType)

  if (group === 'incoming') {
    return step === 'depense' ? ['externe'] : ['interne']
  }

  if (group === 'outgoing') {
    return step === 'depense' ? ['interne'] : ['externe']
  }

  if (group === 'internal') {
    return ['interne']
  }

  if (group === 'technical') {
    return step === 'depense' ? ['interne', 'technique'] : ['interne', 'technique']
  }

  return ['interne', 'externe', 'technique']
}

function quickAccountLabel(kinds: QuickAccountKind[], internalType?: AccountTypeChoice | ''): string {
  if (kinds.length === 1) {
    if (kinds[0] === 'interne') {
      return internalType && internalType !== 'EXTERNE' && internalType !== 'TECHNIQUE' ? `Creer un compte ${accountTypeLabel(internalType).toLowerCase()}` : 'Creer un compte interne'
    }

    return kinds[0] === 'externe' ? 'Creer un compte externe' : 'Creer un compte technique'
  }

  return 'Creer un nouveau compte'
}

function quickAccountTitle(kinds: QuickAccountKind[], internalType?: AccountTypeChoice | ''): string {
  if (kinds.length === 1) {
    if (kinds[0] === 'interne') {
      return internalType && internalType !== 'EXTERNE' && internalType !== 'TECHNIQUE' ? `Nouveau compte ${accountTypeLabel(internalType).toLowerCase()}` : 'Nouveau compte interne'
    }

    return kinds[0] === 'externe' ? 'Nouveau compte externe' : 'Nouveau compte technique'
  }

  return 'Nouveau compte'
}

export function OperationsPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedNumero, setSelectedNumero] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTypeFilters, setSelectedTypeFilters] = useState<string[]>([])
  const [selectedAccountTypeFilters, setSelectedAccountTypeFilters] = useState<AccountTypeChoice[]>([])
  const [selectedAccountFilters, setSelectedAccountFilters] = useState<string[]>([])
  const [selectedBeneficiaryFilters, setSelectedBeneficiaryFilters] = useState<string[]>([])
  const [dateFilters, setDateFilters] = useState<RangeFilterValue[]>([{ from: '', to: '' }])
  const [amountFilters, setAmountFilters] = useState<RangeFilterValue[]>([{ from: '', to: '' }])
  const [operationPageIndex, setOperationPageIndex] = useState(1)
  const [operationPageSize, setOperationPageSize] = useState(DEFAULT_OPERATION_PAGE_SIZE)
  const [operationFilterPicker, setOperationFilterPicker] = useState<OperationFilterPicker>(null)
  const [accountFilterSearch, setAccountFilterSearch] = useState('')
  const [beneficiaryFilterSearch, setBeneficiaryFilterSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [statementImportOpen, setStatementImportOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>('account-type')
  const [createPrimaryAccountType, setCreatePrimaryAccountType] = useState<AccountTypeChoice | ''>('')
  const [createPrimaryAccountId, setCreatePrimaryAccountId] = useState('')
  const [createPrimaryRole, setCreatePrimaryRole] = useState<AccountField | ''>('')
  const [expandedCreateLineIndex, setExpandedCreateLineIndex] = useState<number | null>(null)
  const [createLineCreateOpen, setCreateLineCreateOpen] = useState(false)
  const [createLineBaselines, setCreateLineBaselines] = useState<OperationLineFormValues[]>([])
  const [quickEditTarget, setQuickEditTarget] = useState<QuickEditTarget>(null)
  const [accountSearch, setAccountSearch] = useState('')
  const [counterpartySearch, setCounterpartySearch] = useState('')
  const [depenseSearch, setDepenseSearch] = useState('')
  const [recetteSearch, setRecetteSearch] = useState('')
  const [expandedLineIndex, setExpandedLineIndex] = useState<number | null>(null)
  const [lineCreateOpen, setLineCreateOpen] = useState(false)
  const [lineBudgetCents, setLineBudgetCents] = useState<number | null>(null)
  const [detailLineBaselines, setDetailLineBaselines] = useState<OperationLineFormValues[]>([])
  const [openCategoryNames, setOpenCategoryNames] = useState<string[]>([])
  const [subCategoryPickerTarget, setSubCategoryPickerTarget] = useState<SubCategoryPickerTarget>(null)
  const [subCategorySearch, setSubCategorySearch] = useState('')
  const [beneficiaryPickerTarget, setBeneficiaryPickerTarget] = useState<BeneficiaryPickerTarget>(null)
  const [beneficiaryPickerSearch, setBeneficiaryPickerSearch] = useState('')
  const [quickReferenceDialog, setQuickReferenceDialog] = useState<QuickReferenceDialogState | null>(null)
  const [quickAccountDialog, setQuickAccountDialog] = useState<QuickAccountDialogState | null>(null)
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const quickAmountInputRef = useRef<HTMLInputElement | null>(null)
  const createLineCardRefs = useRef<Array<HTMLDivElement | null>>([])
  const lineCardRefs = useRef<Array<HTMLDivElement | null>>([])
  const deferredSearch = useDeferredValue(search)
  const deferredAccountSearch = useDeferredValue(accountSearch)
  const deferredCounterpartySearch = useDeferredValue(counterpartySearch)
  const deferredDepenseSearch = useDeferredValue(depenseSearch)
  const deferredRecetteSearch = useDeferredValue(recetteSearch)
  const deferredAccountFilterSearch = useDeferredValue(accountFilterSearch)
  const deferredBeneficiaryFilterSearch = useDeferredValue(beneficiaryFilterSearch)
  const deferredSubCategorySearch = useDeferredValue(subCategorySearch)
  const deferredBeneficiaryPickerSearch = useDeferredValue(beneficiaryPickerSearch)
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

  const createPrimaryCompatQuery = useQuery({
    queryKey: ['operations', 'compat', 'types', createPrimaryAccountId],
    queryFn: () => monatisApi.getOperationCompatibleTypesByAccount(createPrimaryAccountId),
    enabled: Boolean(createOpen && createPrimaryAccountId),
  })

  const refinedDepenseQuery = useQuery({
    queryKey: ['operations', 'compat', 'depense', createType, createRecette],
    queryFn: () => monatisApi.getOperationCompatibleDepenseByRecette(createType, createRecette),
    enabled: Boolean(createType && createRecette && compatQuery.data?.comptesCompatiblesDepense),
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
    if (!createType || createStep !== 'counterparty' || !compatQuery.data || !technicalFallbackId || !createPrimaryRole) {
      return
    }

    if (createPrimaryRole === 'depense' && compatQuery.data.comptesCompatiblesRecette === null) {
      createForm.setValue('identifiantCompteRecette', technicalFallbackId)
      window.requestAnimationFrame(() => setCreateStep('amount'))
    }

    if (createPrimaryRole === 'recette' && compatQuery.data.comptesCompatiblesDepense === null) {
      createForm.setValue('identifiantCompteDepense', technicalFallbackId)
      window.requestAnimationFrame(() => setCreateStep('amount'))
    }
  }, [compatQuery.data, createForm, createPrimaryRole, createStep, createType, technicalFallbackId])

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
      setCreateStep('account-type')
      setCreatePrimaryAccountType('')
      setCreatePrimaryAccountId('')
      setCreatePrimaryRole('')
      setExpandedCreateLineIndex(null)
      setCreateLineCreateOpen(false)
      setCreateLineBaselines([])
      setQuickEditTarget(null)
      setAccountSearch('')
      setCounterpartySearch('')
      setDepenseSearch('')
      setRecetteSearch('')
      setOpenCategoryNames([])
      setSubCategoryPickerTarget(null)
      setSubCategorySearch('')
      setBeneficiaryPickerTarget(null)
      setBeneficiaryPickerSearch('')
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
    if (!createOpen || createStep !== 'review' || expandedCreateLineIndex == null) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      createLineCardRefs.current[expandedCreateLineIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [createOpen, createStep, expandedCreateLineIndex])

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

  const allAccounts = useMemo(
    () => [
      ...(internalAccountsQuery.data ?? []),
      ...(externalAccountsQuery.data ?? []),
      ...(technicalAccountsQuery.data ?? []),
    ],
    [externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )

  const internalAccountIds = useMemo(() => new Set((internalAccountsQuery.data ?? []).map((account) => account.identifiant)), [internalAccountsQuery.data])
  const externalAccountIds = useMemo(() => new Set((externalAccountsQuery.data ?? []).map((account) => account.identifiant)), [externalAccountsQuery.data])
  const technicalAccountIds = useMemo(() => new Set((technicalAccountsQuery.data ?? []).map((account) => account.identifiant)), [technicalAccountsQuery.data])
  const filteredAccountChoicesForFilter = useMemo(() => {
    const typeFilteredAccounts = selectedAccountTypeFilters.length
      ? allAccounts.filter((account) =>
          selectedAccountTypeFilters.includes(accountTypeChoiceForAccount(account, internalAccountIds, externalAccountIds, technicalAccountIds) as AccountTypeChoice),
        )
      : allAccounts

    return typeFilteredAccounts.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredAccountFilterSearch))
  }, [allAccounts, deferredAccountFilterSearch, externalAccountIds, internalAccountIds, selectedAccountTypeFilters, technicalAccountIds])
  const operationAccountFilterIds = useMemo(() => {
    const typeAccounts = selectedAccountTypeFilters.length
      ? allAccounts.filter((account) =>
          selectedAccountTypeFilters.includes(accountTypeChoiceForAccount(account, internalAccountIds, externalAccountIds, technicalAccountIds) as AccountTypeChoice),
        )
      : allAccounts
    const typeAccountIds = new Set(typeAccounts.map((account) => account.identifiant))
    const selectedIds = selectedAccountFilters.length ? selectedAccountFilters.filter((identifiant) => typeAccountIds.has(identifiant)) : Array.from(typeAccountIds)

    if (!selectedAccountTypeFilters.length && !selectedAccountFilters.length) {
      return []
    }

    return selectedIds
  }, [allAccounts, externalAccountIds, internalAccountIds, selectedAccountFilters, selectedAccountTypeFilters, technicalAccountIds])
  const operationAmountFilterPayload = useMemo(
    () =>
      activeRangeFilters(amountFilters)
        .map((filter) => ({
          montantEnCentimesPlancher: wholeEuroToCents(filter.from || filter.to),
          montantEnCentimesPlafond: filter.to ? wholeEuroToCents(filter.to, true) : filter.from ? wholeEuroToCents(filter.from, true) : null,
        }))
        .filter((filter) => filter.montantEnCentimesPlancher != null || filter.montantEnCentimesPlafond != null),
    [amountFilters],
  )
  const operationDateFilterPayload = useMemo(() => activeRangeFilters(dateFilters), [dateFilters])
  const accountById = useMemo(() => new Map(allAccounts.map((account) => [account.identifiant, account])), [allAccounts])
  const operationUsesClientAccountingDateOrdering = true
  const operationHasAdvancedFilters =
    operationUsesClientAccountingDateOrdering ||
    Boolean(selectedAccountTypeFilters.length) ||
    Boolean(selectedAccountFilters.length) ||
    Boolean(selectedBeneficiaryFilters.length) ||
    Boolean(activeRangeFilters(dateFilters).length) ||
    Boolean(operationAmountFilterPayload.length)
  const operationNeedsAccountFilterSources = Boolean(selectedAccountTypeFilters.length) || Boolean(selectedAccountFilters.length)
  const operationFilterSourcesReady =
    !operationNeedsAccountFilterSources || (!internalAccountsQuery.isLoading && !externalAccountsQuery.isLoading && !technicalAccountsQuery.isLoading)
  const operationFilterRequest = useMemo<OperationPageRequest>(
    () => ({
      ...operationPageSearchPayload(deferredSearch),
      codesTypeOperation: selectedTypeFilters.length ? selectedTypeFilters : null,
      identifiantCompte1: operationAccountFilterIds.length === 1 ? operationAccountFilterIds[0] : null,
      nomsBeneficiaires: selectedBeneficiaryFilters.length ? selectedBeneficiaryFilters : null,
      dateValeurDepuisLe: operationDateFilterPayload.length === 1 ? operationDateFilterPayload[0].from || operationDateFilterPayload[0].to || null : null,
      dateValeurJusqueAu: operationDateFilterPayload.length === 1 ? operationDateFilterPayload[0].to || operationDateFilterPayload[0].from || null : null,
      montantEnCentimesPlancher: operationAmountFilterPayload.length === 1 ? operationAmountFilterPayload[0].montantEnCentimesPlancher : null,
      montantEnCentimesPlafond: operationAmountFilterPayload.length === 1 ? operationAmountFilterPayload[0].montantEnCentimesPlafond : null,
    }),
    [
      deferredSearch,
      operationAccountFilterIds,
      operationAmountFilterPayload,
      operationDateFilterPayload,
      selectedBeneficiaryFilters,
      selectedTypeFilters,
    ],
  )
  const operationPageRequest = useMemo<OperationPageRequest>(
    () => ({
      numeroPage: operationPageIndex,
      taillePage: operationPageSize,
      ...operationFilterRequest,
    }),
    [operationFilterRequest, operationPageIndex, operationPageSize],
  )
  const operationsQuery = useQuery({
    queryKey: ['operations', 'page', operationPageRequest],
    queryFn: () => monatisApi.listOperationsPage(operationPageRequest),
    enabled: !operationHasAdvancedFilters,
  })
  const advancedOperationsQuery = useQuery({
    queryKey: ['operations', 'advanced-page', operationFilterRequest],
    queryFn: () => fetchAllOperationPages(operationFilterRequest),
    enabled: operationHasAdvancedFilters && operationFilterSourcesReady,
  })

  const advancedFilteredOperations = useMemo(() => {
    if (!operationHasAdvancedFilters) {
      return []
    }

    return (advancedOperationsQuery.data ?? []).filter((operation) => {
      const operationAccounts = [depenseId(operation), recetteId(operation)]

      if (selectedTypeFilters.length && !selectedTypeFilters.includes(operationTypeCode(operation))) {
        return false
      }

      if (operationAccountFilterIds.length && !operationAccounts.some((identifiant) => operationAccountFilterIds.includes(identifiant))) {
        return false
      }

      if ((selectedAccountTypeFilters.length || selectedAccountFilters.length) && !operationAccountFilterIds.length) {
        return false
      }

      if (
        selectedBeneficiaryFilters.length &&
        !operation.lignes.some((line) => beneficiaryNamesForDisplay(line).some((nom) => selectedBeneficiaryFilters.includes(nom)))
      ) {
        return false
      }

      return operationMatchesSearch(operation, deferredSearch, accountById) && operationMatchesDates(operation, dateFilters) && operationMatchesAmounts(operation, amountFilters)
    }).sort(compareOperationsByAccountingDate)
  }, [
    accountById,
    advancedOperationsQuery.data,
    amountFilters,
    dateFilters,
    deferredSearch,
    operationAccountFilterIds,
    operationHasAdvancedFilters,
    selectedAccountFilters.length,
    selectedAccountTypeFilters.length,
    selectedBeneficiaryFilters,
    selectedTypeFilters,
  ])
  const advancedOperationTotalCount = advancedFilteredOperations.length
  const advancedOperationTotalPages = advancedOperationTotalCount ? Math.ceil(advancedOperationTotalCount / operationPageSize) : 0
  const advancedOperationCurrentPage = Math.max(1, Math.min(operationPageIndex, Math.max(advancedOperationTotalPages, 1)))
  const advancedOperationFirstVisible = advancedOperationTotalCount ? (advancedOperationCurrentPage - 1) * operationPageSize + 1 : 0
  const advancedOperationLastVisible = advancedOperationTotalCount ? Math.min(advancedOperationCurrentPage * operationPageSize, advancedOperationTotalCount) : 0
  const filteredOperations = useMemo(
    () =>
      operationHasAdvancedFilters
        ? advancedFilteredOperations.slice(advancedOperationFirstVisible ? advancedOperationFirstVisible - 1 : 0, advancedOperationLastVisible)
        : [...(operationsQuery.data?.operations ?? [])].sort(compareOperationsByAccountingDate),
    [advancedFilteredOperations, advancedOperationFirstVisible, advancedOperationLastVisible, operationHasAdvancedFilters, operationsQuery.data?.operations],
  )
  const operationTotalCount = operationHasAdvancedFilters ? advancedOperationTotalCount : operationsQuery.data?.totalOperations ?? 0
  const operationTotalPages = operationHasAdvancedFilters ? advancedOperationTotalPages : operationsQuery.data?.totalPages ?? 0
  const operationCurrentPage = operationHasAdvancedFilters ? advancedOperationCurrentPage : operationsQuery.data?.numeroPage ?? operationPageIndex
  const operationFirstVisible = operationHasAdvancedFilters ? advancedOperationFirstVisible : operationsQuery.data?.premierElement ?? 0
  const operationLastVisible = operationHasAdvancedFilters ? advancedOperationLastVisible : operationsQuery.data?.dernierElement ?? 0
  const operationListLoading = operationHasAdvancedFilters ? !operationFilterSourcesReady || advancedOperationsQuery.isLoading : operationsQuery.isLoading
  const operationListError = operationHasAdvancedFilters ? advancedOperationsQuery.error : operationsQuery.error
  const operationPageLabel = operationTotalCount ? `${operationCurrentPage}/${Math.max(operationTotalPages, 1)}` : '0/0'

  const selectedOperationSummary = useMemo(
    () => filteredOperations.find((operation) => operation.numero === selectedNumero) ?? null,
    [filteredOperations, selectedNumero],
  )
  const selectedOperationIndex = useMemo(
    () => (selectedNumero ? filteredOperations.findIndex((operation) => operation.numero === selectedNumero) : -1),
    [filteredOperations, selectedNumero],
  )
  const selectedOperationPosition = selectedOperationIndex >= 0 ? selectedOperationIndex + 1 : 0
  const selectedOperationForDisplay = selectedOperationSummary ?? detailQuery.data ?? null
  const selectedOperationTitle = selectedOperationForDisplay ? operationDetailTitle(selectedOperationForDisplay) : 'Operation'
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
  const detailAccountingDate = useMemo(() => {
    const watchedPrimaryDate = detailPrimaryLineIndex === -1 ? '' : watchedLines[detailPrimaryLineIndex]?.dateComptabilisation ?? ''
    return watchedPrimaryDate || (detailQuery.data ? operationAccountingDate(detailQuery.data) : '')
  }, [detailPrimaryLineIndex, detailQuery.data, watchedLines])
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

    const currentPrimaryLine = createLines[createPrimaryLineIndex]

    if ((currentPrimaryLine?.dateComptabilisation ?? '') !== createDateValeur) {
      createForm.setValue(`lignes.${createPrimaryLineIndex}.dateComptabilisation`, createDateValeur, { shouldDirty: false })
    }
  }, [createDateValeur, createForm, createLines, createPrimaryLineIndex])

  useEffect(() => {
    if (detailPrimaryLineIndex === -1) {
      return
    }

    const currentAmount = parseMoneyToCents(watchedLines[detailPrimaryLineIndex]?.montant ?? '')
    if (currentAmount !== detailPrimaryRemainingCents) {
      editForm.setValue(`lignes.${detailPrimaryLineIndex}.montant`, toMoneyInput(detailPrimaryRemainingCents), { shouldDirty: false })
    }
  }, [detailPrimaryLineIndex, detailPrimaryRemainingCents, editForm, watchedLines])

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

  const selectableOperationTypes = useMemo(
    () => sortedOperationTypes.filter((type) => !HIDDEN_CREATE_OPERATION_TYPES.has(type.code)),
    [sortedOperationTypes],
  )

  const groupedOperationTypes = useMemo(
    () =>
      OPERATION_TYPE_GROUP_META.map((group) => ({
        ...group,
        items: selectableOperationTypes.filter((type) => operationTypeGroup(type.code) === group.key),
      })).filter((group) => group.items.length),
    [selectableOperationTypes],
  )

  const accountTypeChoices = useMemo(
    () =>
      ACCOUNT_TYPE_META.map((item) => ({
        ...item,
        count: accountsForTypeChoice(item.key, internalAccountsQuery.data ?? [], externalAccountsQuery.data ?? [], technicalAccountsQuery.data ?? []).length,
      })),
    [externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )

  const createPrimaryAccountOptions = useMemo(
    () =>
      createPrimaryAccountType
        ? accountsForTypeChoice(createPrimaryAccountType, internalAccountsQuery.data ?? [], externalAccountsQuery.data ?? [], technicalAccountsQuery.data ?? [])
        : [],
    [createPrimaryAccountType, externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )

  const filteredCreatePrimaryAccountOptions = useMemo(
    () => createPrimaryAccountOptions.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredAccountSearch)),
    [createPrimaryAccountOptions, deferredAccountSearch],
  )

  const filteredBeneficiaryFilterOptions = useMemo(
    () => (beneficiairesQuery.data ?? []).filter((beneficiaire) => matchesNeedle(`${beneficiaire.nom} ${beneficiaire.libelle ?? ''}`, deferredBeneficiaryFilterSearch)),
    [beneficiairesQuery.data, deferredBeneficiaryFilterSearch],
  )
  const filteredBeneficiaryPickerOptions = useMemo(
    () => (beneficiairesQuery.data ?? []).filter((beneficiaire) => matchesNeedle(`${beneficiaire.nom} ${beneficiaire.libelle ?? ''}`, deferredBeneficiaryPickerSearch)),
    [beneficiairesQuery.data, deferredBeneficiaryPickerSearch],
  )

  const groupedFilterOperationTypes = useMemo(
    () =>
      OPERATION_TYPE_GROUP_META.map((group) => ({
        ...group,
        items: sortedOperationTypes.filter((type) => operationTypeGroup(type.code) === group.key),
      })).filter((group) => group.items.length),
    [sortedOperationTypes],
  )

  const filteredDepenseOptions = useMemo(
    () => depenseOptions.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredDepenseSearch)),
    [deferredDepenseSearch, depenseOptions],
  )

  const filteredRecetteOptions = useMemo(
    () => recetteOptions.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredRecetteSearch)),
    [deferredRecetteSearch, recetteOptions],
  )

  const createCompatibleTypeChoices = useMemo(() => {
    const depenseCodes = new Set((createPrimaryCompatQuery.data?.typesOperationsCompatiblesDepense ?? []).map((type) => type.code))
    const recetteCodes = new Set((createPrimaryCompatQuery.data?.typesOperationsCompatiblesRecette ?? []).map((type) => type.code))

    return selectableOperationTypes.flatMap((type) => {
      const choices: Array<{ key: string; type: TypeOperation; role: AccountField }> = []

      if (depenseCodes.has(type.code)) {
        choices.push({ key: `${type.code}-depense`, type, role: 'depense' })
      }

      if (recetteCodes.has(type.code)) {
        choices.push({ key: `${type.code}-recette`, type, role: 'recette' })
      }

      return choices
    })
  }, [createPrimaryCompatQuery.data, selectableOperationTypes])
  const groupedCreateCompatibleTypes = useMemo(
    () =>
      OPERATION_TYPE_GROUP_META.map((group) => ({
        ...group,
        items: createCompatibleTypeChoices.filter((choice) => operationTypeGroup(choice.type.code) === group.key),
      })).filter((group) => group.items.length),
    [createCompatibleTypeChoices],
  )
  const createCounterpartyRole: AccountField = createPrimaryRole === 'recette' ? 'depense' : 'recette'
  const counterpartyOptions = useMemo(() => {
    if (!createType || !createPrimaryRole) {
      return []
    }

    if (createPrimaryRole === 'depense') {
      return refinedRecetteQuery.data?.comptesCompatiblesRecette ?? compatQuery.data?.comptesCompatiblesRecette ?? []
    }

    return refinedDepenseQuery.data?.comptesCompatiblesDepense ?? compatQuery.data?.comptesCompatiblesDepense ?? []
  }, [compatQuery.data?.comptesCompatiblesDepense, compatQuery.data?.comptesCompatiblesRecette, createPrimaryRole, createType, refinedDepenseQuery.data?.comptesCompatiblesDepense, refinedRecetteQuery.data?.comptesCompatiblesRecette])
  const filteredCounterpartyOptions = useMemo(
    () => counterpartyOptions.filter((account) => matchesNeedle(accountChoiceLabel(account), deferredCounterpartySearch)),
    [counterpartyOptions, deferredCounterpartySearch],
  )
  const counterpartyTypeChoices = useMemo(
    () => accountTypeChoicesFromOptions(counterpartyOptions, internalAccountIds, externalAccountIds, technicalAccountIds),
    [counterpartyOptions, externalAccountIds, internalAccountIds, technicalAccountIds],
  )

  const selectedType = useMemo(
    () => (typesQuery.data ?? []).find((type) => type.code === createType) ?? null,
    [createType, typesQuery.data],
  )
  const selectedTypeFilterItems = useMemo(
    () => sortedOperationTypes.filter((type) => selectedTypeFilters.includes(type.code)),
    [selectedTypeFilters, sortedOperationTypes],
  )
  const selectedAccountFilterItems = useMemo(
    () => allAccounts.filter((account) => selectedAccountFilters.includes(account.identifiant)),
    [allAccounts, selectedAccountFilters],
  )
  const activeDateFilters = useMemo(() => activeRangeFilters(dateFilters), [dateFilters])
  const activeAmountFilters = useMemo(() => activeRangeFilters(amountFilters), [amountFilters])
  const createFlowLabels = useMemo(() => flowLabelsForType(createType), [createType])
  const createDepenseKinds = useMemo(
    () => operationAccountKinds(createType, 'depense', depenseOptions, internalAccountIds, externalAccountIds, technicalAccountIds),
    [createType, depenseOptions, externalAccountIds, internalAccountIds, technicalAccountIds],
  )
  const createRecetteKinds = useMemo(
    () => operationAccountKinds(createType, 'recette', recetteOptions, internalAccountIds, externalAccountIds, technicalAccountIds),
    [createType, externalAccountIds, internalAccountIds, recetteOptions, technicalAccountIds],
  )
  const counterpartyKinds = useMemo(() => {
    const kinds = counterpartyTypeChoices.map((choice) => accountKindForTypeChoice(choice))
    return Array.from(new Set(kinds))
  }, [counterpartyTypeChoices])
  const counterpartySingleType = counterpartyTypeChoices.length === 1 ? counterpartyTypeChoices[0] : ''
  const counterpartyIsLoading = createPrimaryRole === 'depense' ? refinedRecetteQuery.isLoading : refinedDepenseQuery.isLoading
  const editFlowLabels = useMemo(
    () => flowLabelsForType(editType || detailQuery.data?.typeOperation?.code || detailQuery.data?.codeTypeOperation || ''),
    [detailQuery.data?.codeTypeOperation, detailQuery.data?.typeOperation?.code, editType],
  )
  const detailOperationCode = editType || detailQuery.data?.typeOperation?.code || detailQuery.data?.codeTypeOperation || ''
  const editDepenseOptions = useMemo(
    () =>
      accountOptionsWithCurrent(
        compatibleAccountOptionsForField(
          detailOperationCode,
          'depense',
          internalAccountsQuery.data ?? [],
          externalAccountsQuery.data ?? [],
          technicalAccountsQuery.data ?? [],
        ),
        editDepense || (detailQuery.data ? depenseId(detailQuery.data) : ''),
        allAccounts,
      ),
    [allAccounts, detailOperationCode, detailQuery.data, editDepense, externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )
  const editRecetteOptions = useMemo(
    () =>
      accountOptionsWithCurrent(
        compatibleAccountOptionsForField(
          detailOperationCode,
          'recette',
          internalAccountsQuery.data ?? [],
          externalAccountsQuery.data ?? [],
          technicalAccountsQuery.data ?? [],
        ),
        editRecette || (detailQuery.data ? recetteId(detailQuery.data) : ''),
        allAccounts,
      ),
    [allAccounts, detailOperationCode, detailQuery.data, editRecette, externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )
  const editDepenseKinds = useMemo(
    () => operationAccountKinds(detailOperationCode, 'depense', editDepenseOptions, internalAccountIds, externalAccountIds, technicalAccountIds),
    [detailOperationCode, editDepenseOptions, externalAccountIds, internalAccountIds, technicalAccountIds],
  )
  const editRecetteKinds = useMemo(
    () => operationAccountKinds(detailOperationCode, 'recette', editRecetteOptions, internalAccountIds, externalAccountIds, technicalAccountIds),
    [detailOperationCode, editRecetteOptions, externalAccountIds, internalAccountIds, technicalAccountIds],
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
    mutationFn: ({ values }: CreateOperationInput) => {
      return monatisApi.createOperation({
        numero: null,
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
    onSuccess: async (response, { values, continueWithSameSettings }) => {
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
      setOperationPageIndex(1)
      setSelectedNumero(null)
      setExpandedLineIndex(null)
      if (continueWithSameSettings) {
        continueCreateFlowWithSameSettings(values)
      } else {
        resetCreateFlow()
        setCreateOpen(false)
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: EditFormValues) => {
      const lignes = buildOperationLinePayloads(values.lignes ?? [])

      return monatisApi.updateOperation(selectedNumero!, {
        numero: null,
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
    mutationFn: (numero: string) => monatisApi.deleteOperation(numero),
    onSuccess: async (_deletedOperation, deletedNumero) => {
      setOperationPageIndex(1)
      setLineBudgetCents(null)
      setSelectedNumero(null)
      setExpandedLineIndex(null)
      setLineCreateOpen(false)
      closeSubCategoryPicker()
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
      queryClient.removeQueries({ queryKey: ['operations', deletedNumero] })
      closeBeneficiaryPicker()
      await queryClient.invalidateQueries({ queryKey: ['operations'] })
    },
  })

  const hasError =
    operationListError ||
    detailQuery.error ||
    typesQuery.error ||
    internalAccountsQuery.error ||
    externalAccountsQuery.error ||
    technicalAccountsQuery.error ||
    categoriesQuery.error ||
    sousCategoriesQuery.error ||
    beneficiairesQuery.error ||
    compatQuery.error ||
    createPrimaryCompatQuery.error ||
    refinedDepenseQuery.error ||
    refinedRecetteQuery.error ||
    createMutation.error ||
    updateMutation.error ||
    deleteMutation.error

  const currentTypeNeedsReference = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(createType)
  const depenseIsTechnical = compatQuery.data?.comptesCompatiblesDepense === null
  const recetteIsTechnical = compatQuery.data?.comptesCompatiblesRecette === null
  const counterpartyIsTechnical = createCounterpartyRole === 'depense' ? depenseIsTechnical : recetteIsTechnical
  const depenseReady = depenseIsTechnical ? Boolean(technicalFallbackId) : Boolean(createDepense)
  const recetteReady = recetteIsTechnical ? Boolean(technicalFallbackId) : Boolean(createRecette)
  const createReady = Boolean(createType) && amountReady && depenseReady && recetteReady
  const createSubmitDisabled = createMutation.isPending || !createReady || hasCreateLineOverflow || hasCreateLineDrafts || createLineTotalMismatch

  function resetCreateFlow() {
    createForm.reset(CREATE_DEFAULTS)
    setCreateStep('account-type')
    setCreatePrimaryAccountType('')
    setCreatePrimaryAccountId('')
    setCreatePrimaryRole('')
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setQuickEditTarget(null)
    setAccountSearch('')
    setCounterpartySearch('')
    setDepenseSearch('')
    setRecetteSearch('')
    setOpenCategoryNames([])
    setSubCategoryPickerTarget(null)
    setSubCategorySearch('')
    setBeneficiaryPickerTarget(null)
    setBeneficiaryPickerSearch('')
    newCreateLineForm.reset(makeOperationLineValues(todayIso()))
  }

  function continueCreateFlowWithSameSettings(values: CreateFormValues) {
    const nextDate = values.dateValeur || todayIso()
    const keepReferences = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(values.codeTypeOperation)

    createForm.reset({
      ...CREATE_DEFAULTS,
      codeTypeOperation: values.codeTypeOperation,
      dateValeur: nextDate,
      libelle: values.libelle ?? '',
      identifiantCompteDepense: values.identifiantCompteDepense ?? '',
      identifiantCompteRecette: values.identifiantCompteRecette ?? '',
      nomSousCategorie: keepReferences ? values.nomSousCategorie ?? '' : '',
      nomsBeneficiaires: keepReferences ? values.nomsBeneficiaires ?? [] : [],
      montant: '',
      lignes: [],
    })
    if (createPrimaryRole === 'depense') {
      setCreatePrimaryAccountId(values.identifiantCompteDepense ?? '')
    } else if (createPrimaryRole === 'recette') {
      setCreatePrimaryAccountId(values.identifiantCompteRecette ?? '')
    }
    setCreateStep('amount')
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setQuickEditTarget(null)
    setDepenseSearch('')
    setRecetteSearch('')
    setSubCategoryPickerTarget(null)
    setSubCategorySearch('')
    setBeneficiaryPickerTarget(null)
    setBeneficiaryPickerSearch('')
    newCreateLineForm.reset(makeOperationLineValues(nextDate))
  }

  async function submitCreateOperation(values: CreateFormValues, continueWithSameSettings: boolean) {
    await createMutation.mutateAsync({ values, continueWithSameSettings })
  }

  function openCreateFlow() {
    resetCreateFlow()
    setSelectedNumero(null)
    setStatementImportOpen(false)
    setCreateOpen(true)
  }

  function closeCreateFlow() {
    resetCreateFlow()
    setCreateOpen(false)
  }

  function selectPrimaryAccountType(choice: AccountTypeChoice) {
    setCreatePrimaryAccountType(choice)
    setCreatePrimaryAccountId('')
    setCreatePrimaryRole('')
    setAccountSearch('')
    createForm.setValue('codeTypeOperation', '')
    createForm.setValue('identifiantCompteDepense', '')
    createForm.setValue('identifiantCompteRecette', '')
    setCreateStep('account')
  }

  function selectPrimaryAccount(identifiant: string) {
    setCreatePrimaryAccountId(identifiant)
    setCreatePrimaryRole('')
    createForm.setValue('codeTypeOperation', '')
    createForm.setValue('identifiantCompteDepense', '')
    createForm.setValue('identifiantCompteRecette', '')
    setCounterpartySearch('')
    setCreateStep('type')
  }

  function selectType(code: string, primaryRole: AccountField) {
    const keepReferences = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(code)
    createForm.reset({
      ...CREATE_DEFAULTS,
      dateValeur: createDateValeur || todayIso(),
      libelle: createLibelle,
      montant: createAmount,
      nomSousCategorie: keepReferences ? createNomSousCategorie : '',
      nomsBeneficiaires: keepReferences ? createBeneficiaries : [],
      codeTypeOperation: code,
      identifiantCompteDepense: primaryRole === 'depense' ? createPrimaryAccountId : '',
      identifiantCompteRecette: primaryRole === 'recette' ? createPrimaryAccountId : '',
      lignes: [],
    })
    setCreatePrimaryRole(primaryRole)
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setDepenseSearch('')
    setRecetteSearch('')
    setCounterpartySearch('')
    setCreateStep('counterparty')
  }

  function selectTypeInQuickEditor(code: string) {
    const keepReferences = ['RECETTE', 'DEPENSE', 'ACHAT', 'VENTE'].includes(code)
    createForm.reset({
      ...CREATE_DEFAULTS,
      dateValeur: createDateValeur || todayIso(),
      libelle: createLibelle,
      montant: createAmount,
      nomSousCategorie: keepReferences ? createNomSousCategorie : '',
      nomsBeneficiaires: keepReferences ? createBeneficiaries : [],
      codeTypeOperation: code,
      lignes: [],
    })
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    setCreateLineBaselines([])
    setDepenseSearch('')
    setRecetteSearch('')
    setQuickEditTarget('depense')
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

  function selectRecetteInQuickEditor(identifiant: string) {
    createForm.setValue('identifiantCompteRecette', identifiant)
    setQuickEditTarget(amountReady ? null : 'amount')
  }

  function selectCounterpartyAccount(identifiant: string) {
    if (createPrimaryRole === 'depense') {
      createForm.setValue('identifiantCompteRecette', identifiant)
    } else {
      createForm.setValue('identifiantCompteDepense', identifiant)
    }

    setCreateStep('amount')
  }

  function continueFromAmount() {
    if (!amountReady) {
      return
    }

    if (!createLines.length) {
      const defaultLine = normalizeOperationLineValues({
        numeroLigne: 0,
        libelle: lineDisplayTitle(0, 0),
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
    closeBeneficiaryPicker()
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
    newCreateLineForm.reset(makeOperationLineValues(createForm.getValues('dateValeur') || todayIso(), createLineFieldArray.fields.length))
    setCreateLineCreateOpen(true)
  }

  function closeCreateLineCreatePanel() {
    setExpandedCreateLineIndex(null)
    setCreateLineCreateOpen(false)
    newCreateLineForm.reset(makeOperationLineValues(createForm.getValues('dateValeur') || todayIso()))
    if (subCategoryPickerTarget?.kind === 'newCreateLine') {
      closeSubCategoryPicker()
    }
    if (beneficiaryPickerTarget?.kind === 'newCreateLine') {
      closeBeneficiaryPicker()
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
    newLineForm.reset(makeOperationLineValues(editForm.getValues('dateValeur') || todayIso(), lineFieldArray.fields.length))
    setLineCreateOpen(true)
  }

  function closeLineCreatePanel() {
    setExpandedLineIndex(null)
    setLineCreateOpen(false)
    newLineForm.reset(makeOperationLineValues(editForm.getValues('dateValeur') || todayIso()))
    if (subCategoryPickerTarget?.kind === 'newLine') {
      closeSubCategoryPicker()
    }
    if (beneficiaryPickerTarget?.kind === 'newLine') {
      closeBeneficiaryPicker()
    }
  }

  function goBack() {
    if (createStep === 'review') {
      setCreateStep('amount')
      return
    }

    if (createStep === 'amount') {
      setCreateStep('counterparty')
      return
    }

    if (createStep === 'counterparty') {
      setCreateStep('type')
      return
    }

    if (createStep === 'type') {
      setCreateStep('account')
      return
    }

    if (createStep === 'account') {
      setCreateStep('account-type')
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

    if (step === 'counterparty' && createType && createPrimaryRole) {
      setCreateStep('counterparty')
      return
    }

    if (step === 'type' && createPrimaryAccountId) {
      setCreateStep('type')
      return
    }

    if (step === 'account' && createPrimaryAccountType) {
      setCreateStep('account')
      return
    }

    setCreateStep('account-type')
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
    setOperationPageIndex(1)
    setSelectedTypeFilters((current) => (current.includes(code) ? current.filter((value) => value !== code) : [...current, code]))
  }

  function clearTypeFilters() {
    setOperationPageIndex(1)
    setSelectedTypeFilters([])
  }

  function toggleAccountTypeFilter(choice: AccountTypeChoice) {
    setOperationPageIndex(1)
    setSelectedAccountTypeFilters((current) => (current.includes(choice) ? current.filter((value) => value !== choice) : [...current, choice]))
  }

  function toggleAccountFilter(identifiant: string) {
    setOperationPageIndex(1)
    setSelectedAccountFilters((current) => (current.includes(identifiant) ? current.filter((value) => value !== identifiant) : [...current, identifiant]))
  }

  function toggleBeneficiaryFilter(nom: string) {
    setOperationPageIndex(1)
    setSelectedBeneficiaryFilters((current) => (current.includes(nom) ? current.filter((value) => value !== nom) : [...current, nom]))
  }

  function updateDateFilter(index: number, field: keyof RangeFilterValue, value: string) {
    setOperationPageIndex(1)
    setDateFilters((current) => normalizeRangeRows(current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))))
  }

  function updateAmountFilter(index: number, field: keyof RangeFilterValue, value: string) {
    setOperationPageIndex(1)
    setAmountFilters((current) => normalizeRangeRows(current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))))
  }

  function clearDateFilters() {
    setOperationPageIndex(1)
    setDateFilters([{ from: '', to: '' }])
  }

  function clearAmountFilters() {
    setOperationPageIndex(1)
    setAmountFilters([{ from: '', to: '' }])
  }

  function clearOperationFilters() {
    setOperationPageIndex(1)
    setSelectedTypeFilters([])
    setSelectedAccountTypeFilters([])
    setSelectedAccountFilters([])
    setSelectedBeneficiaryFilters([])
    setDateFilters([{ from: '', to: '' }])
    setAmountFilters([{ from: '', to: '' }])
  }

  function changeOperationPageSize(value: string) {
    const nextSize = Number(value)
    if (!OPERATION_PAGE_SIZE_OPTIONS.includes(nextSize)) {
      return
    }

    setOperationPageSize(nextSize)
    setOperationPageIndex(1)
  }

  function changeOperationPage(nextPage: number) {
    if (!operationTotalCount) {
      return
    }

    setOperationPageIndex(Math.max(1, Math.min(Math.max(operationTotalPages, 1), nextPage)))
  }

  function renderOperationPaginationControls(position: 'top' | 'bottom') {
    return (
      <div className={cx('catalog-list-controls', position === 'bottom' && 'bottom')} aria-label={`Pagination des operations ${position === 'bottom' ? 'bas' : 'haut'}`}>
        <div className="catalog-list-count">
          <strong>{operationTotalCount ? `${operationFirstVisible}-${operationLastVisible}` : '0'}</strong>
          <span>{`sur ${operationTotalCount}`}</span>
        </div>

        <label className="catalog-page-size">
          <span>Afficher</span>
          <select value={operationPageSize} onChange={(event) => changeOperationPageSize(event.target.value)} aria-label="Nombre d'operations affichees">
            {OPERATION_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="catalog-page-buttons">
          <button type="button" disabled={!operationTotalCount || operationCurrentPage <= 1} onClick={() => changeOperationPage(operationCurrentPage - 1)} aria-label="Page precedente">
            <ChevronLeft size={15} />
          </button>
          <span>{operationPageLabel}</span>
          <button
            type="button"
            disabled={!operationTotalCount || operationCurrentPage >= Math.max(operationTotalPages, 1)}
            onClick={() => changeOperationPage(operationCurrentPage + 1)}
            aria-label="Page suivante"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  function renderOperationFilterButton(label: string, value: string, picker: Exclude<OperationFilterPicker, null>) {
    return (
      <button type="button" className="picker-field picker-field-compact operation-filter-button" onClick={() => setOperationFilterPicker(picker)}>
        <div className="picker-field-content">
          <span className="operation-filter-button-label">{label}</span>
          <strong>{value}</strong>
        </div>
        <ChevronDown size={16} />
      </button>
    )
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

  function openBeneficiaryPicker(target: Exclude<BeneficiaryPickerTarget, null>) {
    setBeneficiaryPickerTarget(target)
    setBeneficiaryPickerSearch('')
  }

  function closeBeneficiaryPicker() {
    setBeneficiaryPickerTarget(null)
    setBeneficiaryPickerSearch('')
  }

  function currentBeneficiaryValues(): string[] {
    if (!beneficiaryPickerTarget) {
      return []
    }

    if (beneficiaryPickerTarget.kind === 'create') {
      return createForm.getValues('nomsBeneficiaires') ?? []
    }

    if (beneficiaryPickerTarget.kind === 'createLine') {
      return createForm.getValues(`lignes.${beneficiaryPickerTarget.index}.nomsBeneficiaires`) ?? []
    }

    if (beneficiaryPickerTarget.kind === 'newCreateLine') {
      return newCreateLineForm.getValues('nomsBeneficiaires') ?? []
    }

    if (beneficiaryPickerTarget.kind === 'newLine') {
      return newLineForm.getValues('nomsBeneficiaires') ?? []
    }

    return editForm.getValues(`lignes.${beneficiaryPickerTarget.index}.nomsBeneficiaires`) ?? []
  }

  function setCurrentBeneficiaryValues(values: string[]) {
    const nextValues = [...values].sort((left, right) => left.localeCompare(right))

    if (beneficiaryPickerTarget?.kind === 'createLine') {
      createForm.setValue(`lignes.${beneficiaryPickerTarget.index}.nomsBeneficiaires`, nextValues, { shouldDirty: true, shouldTouch: true })
    } else if (beneficiaryPickerTarget?.kind === 'newCreateLine') {
      newCreateLineForm.setValue('nomsBeneficiaires', nextValues, { shouldDirty: true, shouldTouch: true })
    } else if (beneficiaryPickerTarget?.kind === 'newLine') {
      newLineForm.setValue('nomsBeneficiaires', nextValues, { shouldDirty: true, shouldTouch: true })
    } else if (beneficiaryPickerTarget?.kind === 'line') {
      editForm.setValue(`lignes.${beneficiaryPickerTarget.index}.nomsBeneficiaires`, nextValues, { shouldDirty: true, shouldTouch: true })
    } else {
      createForm.setValue('nomsBeneficiaires', nextValues, { shouldDirty: true, shouldTouch: true })
    }
  }

  function toggleCurrentBeneficiary(name: string) {
    const current = currentBeneficiaryValues()
    setCurrentBeneficiaryValues(current.includes(name) ? current.filter((value) => value !== name) : [...current, name])
  }

  function appendCurrentBeneficiary(name: string) {
    setCurrentBeneficiaryValues(appendUnique(currentBeneficiaryValues(), name))
  }

  function clearCurrentBeneficiaries() {
    setCurrentBeneficiaryValues([])
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

  function openQuickReferenceDialog(dialog: QuickReferenceDialogState) {
    setQuickReferenceDialog(dialog)
  }

  function closeQuickReferenceDialog() {
    setQuickReferenceDialog(null)
  }

  function openQuickAccountDialog(dialog: QuickAccountDialogState) {
    setQuickAccountDialog(dialog)
  }

  function closeQuickAccountDialog() {
    setQuickAccountDialog(null)
  }

  function openTypedQuickAccountDialog(kinds: QuickAccountKind[], onCreated: (identifiant: string) => void, internalType?: AccountTypeChoice | '') {
    openQuickAccountDialog({
      title: quickAccountTitle(kinds, internalType),
      initialKind: kinds[0] ?? 'interne',
      initialInternalType: internalType && internalType !== 'EXTERNE' && internalType !== 'TECHNIQUE' ? internalType : undefined,
      allowedKinds: kinds,
      onCreated,
    })
  }

  function applyDetailLineCollection(lines: OperationLineFormValues[]) {
    const normalizedLines = lines.map((line) => normalizeOperationLineValues(line))
    lineFieldArray.replace(normalizedLines)
    setDetailLineBaselines(normalizedLines.map((line) => normalizeOperationLineValues(line)))
  }

  const createTrail = useMemo(() => {
    const items: Array<{ key: CreateStep; label: string }> = []

    if (createPrimaryAccountType) {
      items.push({ key: 'account', label: accountTypeLabel(createPrimaryAccountType) })
    }

    if (createPrimaryAccountId) {
      items.push({ key: 'type', label: selectedAccountLabel(allAccounts, createPrimaryAccountId) })
    }

    if (createType) {
      items.push({ key: 'counterparty', label: selectedType?.libelleCourt ?? createType })
    }

    if ((createStep === 'amount' || createStep === 'review') && depenseReady && recetteReady) {
      items.push({
        key: 'amount',
        label: selectedAccountLabel(allAccounts, createPrimaryRole === 'depense' ? createRecette || technicalFallbackId : createDepense || technicalFallbackId),
      })
    }

    if (createStep === 'review' && (createAmount || createLinePayloads.length)) {
      items.push({
        key: 'review',
        label: formatCurrencyFromCents(createEffectiveAmountCents),
      })
    }

    return items
  }, [
    allAccounts,
    createAmount,
    createDepense,
    createEffectiveAmountCents,
    createLinePayloads.length,
    createPrimaryAccountId,
    createPrimaryAccountType,
    createPrimaryRole,
    createRecette,
    createStep,
    createType,
    depenseReady,
    recetteReady,
    selectedType,
    technicalFallbackId,
  ])
  const amountField = createForm.register('montant')

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations"
        title="Operations"
        actions={
          <>
            <Button type="button" tone={statementImportOpen ? 'ghost' : 'soft'} disabled={createOpen} onClick={() => setStatementImportOpen((current) => !current)}>
              <Upload size={16} />
              {statementImportOpen ? 'Fermer import' : 'Importer releve'}
            </Button>
            <Button type="button" tone={createOpen ? 'ghost' : 'primary'} onClick={createOpen ? closeCreateFlow : openCreateFlow}>
              {createOpen ? <X size={16} /> : <Plus size={16} />}
              {createOpen ? 'Fermer' : 'Nouvelle operation'}
            </Button>
          </>
        }
      />

      {createOpen ? (
        <div className="operation-create-overlay" role="dialog" aria-modal="true" aria-label="Nouvelle operation">
          <button type="button" className="operation-create-backdrop" aria-label="Fond de la saisie" disabled />
          <div className="operation-create-dialog">
            <Surface className="operation-create-panel">
              <div className="wizard-compact-top">
                <div className="wizard-compact-leading">
                  {createStep !== 'account-type' ? (
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
                  await submitCreateOperation(values, false)
                })}
              >
            {createStep === 'account-type' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>Compte</h2>
                </div>

                <div className="wizard-choice-grid">
                  {accountTypeChoices.map((type) => (
                    <button
                      key={type.key}
                      type="button"
                      className={cx('wizard-choice-card', createPrimaryAccountType === type.key && 'active')}
                      onClick={() => selectPrimaryAccountType(type.key)}
                    >
                      <div>
                        <strong>{type.label}</strong>
                        <span>{type.description}</span>
                      </div>
                      <Badge>{type.count}</Badge>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {createStep === 'account' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>{createPrimaryAccountType ? `Compte ${accountTypeLabel(createPrimaryAccountType).toLowerCase()}` : 'Compte'}</h2>
                </div>

                <div className="search-action-row">
                  <label className="search-field search-field-thin">
                    <Search size={14} />
                    <input value={accountSearch} onChange={(event) => setAccountSearch(event.target.value)} placeholder="Chercher un compte..." />
                  </label>
                  <QuickAddButton
                    label={createPrimaryAccountType ? quickAccountLabel([accountKindForTypeChoice(createPrimaryAccountType)], createPrimaryAccountType) : 'Creer un compte'}
                    onClick={() => {
                      if (createPrimaryAccountType) {
                        openTypedQuickAccountDialog([accountKindForTypeChoice(createPrimaryAccountType)], (identifiant) => selectPrimaryAccount(identifiant), createPrimaryAccountType)
                      }
                    }}
                  />
                </div>

                {!filteredCreatePrimaryAccountOptions.length ? (
                  <EmptyState title="Aucun compte" description="Aucun compte ne correspond a cette selection." />
                ) : (
                  <div className="wizard-choice-grid">
                    {filteredCreatePrimaryAccountOptions.map((account) => (
                      <button
                        key={account.identifiant}
                        type="button"
                        className={cx('wizard-choice-card', createPrimaryAccountId === account.identifiant && 'active')}
                        onClick={() => selectPrimaryAccount(account.identifiant)}
                      >
                        <div>
                          <strong>{account.identifiant}</strong>
                          <span>{account.libelle ?? ' '}</span>
                        </div>
                        {createPrimaryAccountId === account.identifiant ? <Check size={16} /> : null}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {createStep === 'type' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>Type</h2>
                </div>

                {createPrimaryCompatQuery.isLoading ? (
                  <LoadingState label="Chargement..." />
                ) : !groupedCreateCompatibleTypes.length ? (
                  <EmptyState title="Aucun type" description="Aucun type compatible avec ce compte." />
                ) : (
                  groupedCreateCompatibleTypes.map((group) => (
                    <div key={group.key} className="wizard-choice-section">
                      <span className="wizard-choice-section-label">{group.label}</span>
                      <div className="wizard-choice-grid">
                        {group.items.map((choice) => (
                          <button
                            key={choice.key}
                            type="button"
                            className={cx('wizard-choice-card', createType === choice.type.code && createPrimaryRole === choice.role && 'active')}
                            onClick={() => selectType(choice.type.code, choice.role)}
                          >
                            <div>
                              <strong>{choice.type.libelleCourt}</strong>
                              <span>{choice.role === 'depense' ? 'Ce compte paie' : 'Ce compte recoit'}</span>
                            </div>
                            {createType === choice.type.code && createPrimaryRole === choice.role ? <Check size={16} /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </section>
            ) : null}

            {createStep === 'counterparty' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>{createPrimaryRole === 'depense' ? createFlowLabels.recetteStep : createFlowLabels.depenseStep}</h2>
                </div>

                {counterpartyIsLoading ? (
                  <LoadingState label="Chargement..." />
                ) : counterpartyIsTechnical ? (
                  <div className="wizard-locked">
                    <Badge>Technique</Badge>
                    <strong>{technicalFallbackId}</strong>
                  </div>
                ) : (
                  <>
                    <div className="search-action-row">
                      <label className="search-field search-field-thin">
                        <Search size={14} />
                        <input value={counterpartySearch} onChange={(event) => setCounterpartySearch(event.target.value)} placeholder="Chercher..." />
                      </label>
                      <QuickAddButton
                        label={counterpartyKinds.length ? quickAccountLabel(counterpartyKinds, counterpartySingleType) : 'Creer un compte'}
                        onClick={() => {
                          if (counterpartyKinds.length) {
                            openTypedQuickAccountDialog(counterpartyKinds, (identifiant) => selectCounterpartyAccount(identifiant), counterpartySingleType)
                          }
                        }}
                      />
                    </div>
                    {!filteredCounterpartyOptions.length ? (
                      <EmptyState title="Aucun compte" description="Aucun compte compatible." />
                    ) : (
                      <div className="wizard-choice-grid">
                        {filteredCounterpartyOptions.map((account) => (
                          <button
                            key={account.identifiant}
                            type="button"
                            className={cx('wizard-choice-card', (createCounterpartyRole === 'depense' ? createDepense : createRecette) === account.identifiant && 'active')}
                            onClick={() => selectCounterpartyAccount(account.identifiant)}
                          >
                            <div>
                              <strong>{account.identifiant}</strong>
                              <span>{account.libelle ?? ' '}</span>
                            </div>
                            {(createCounterpartyRole === 'depense' ? createDepense : createRecette) === account.identifiant ? <Check size={16} /> : null}
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

            {createStep === 'review' ? (
              <section className="wizard-step">
                <div className="wizard-step-head">
                  <h2>Valider</h2>
                </div>

                <div className="wizard-summary">
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('type')}>
                    <span>Type</span>
                    <strong>{selectedType?.libelleCourt ?? createType}</strong>
                  </button>
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('depense')}>
                    <span>{createFlowLabels.depenseSummary}</span>
                    <strong>{selectedAccountLabel(allAccounts, createDepense || technicalFallbackId)}</strong>
                  </button>
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('recette')}>
                    <span>{createFlowLabels.recetteSummary}</span>
                    <strong>{selectedAccountLabel(allAccounts, createRecette || technicalFallbackId)}</strong>
                  </button>
                  <button type="button" className="wizard-summary-card editable" onClick={() => setQuickEditTarget('amount')}>
                    <span>Montant</span>
                    <strong>{formatCurrencyFromCents(createEffectiveAmountCents)}</strong>
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
                  <FormField label="Beneficiaires">
                    <button type="button" className="picker-field" onClick={() => openBeneficiaryPicker({ kind: 'create' })}>
                      <div className="picker-field-content">
                        <strong>{beneficiarySelectionLabel(createBeneficiaries)}</strong>
                      </div>
                      <ChevronDown size={16} />
                    </button>
                  </FormField>
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

                <div className="page-stack operation-lines-section">
                      <div className="section-header">
                        <div>
                          <h2>Lignes</h2>
                        </div>
                        <Button type="button" tone="ghost" disabled={hasCreateLineOverflow} onClick={openCreateLineCreatePanel}>
                          <Plus size={16} />
                          Ajouter ligne
                        </Button>
                      </div>

                      {createLineFieldArray.fields.length ? (
                        <div className="page-stack">
                          {createLineFieldArray.fields.map((field, index) => {
                            const currentLine = createLines[index]
                            const isPrimaryLine = index === createPrimaryLineIndex
                            const currentBenefs = currentLine?.nomsBeneficiaires ?? []
                            const lineDirty = createLineIsDirty(index)
                            const lineAmountError = createLineErrors[index]
                            const isOpen = expandedCreateLineIndex === index
                            const lineTitle = lineDisplayTitle(index, isPrimaryLine ? 0 : field.numeroLigne)

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
                                      </div>
                                      <ChevronDown size={16} />
                                    </button>

                                    <div className="line-editor-actions">
                                      {currentLine?.nomSousCategorie ? <Badge>{currentLine.nomSousCategorie}</Badge> : null}
                                      {currentBenefs.length ? <Badge>{beneficiarySelectionLabel(currentBenefs)}</Badge> : null}
                                      {!isPrimaryLine ? (
                                        <Button
                                          type="button"
                                          tone="danger"
                                          className="line-editor-delete-button"
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
                                          Supprimer
                                        </Button>
                                      ) : null}
                                    </div>
                                  </div>

                                  {isOpen ? (
                                    <div className="line-editor-body">
                                      <div className="section-header">
                                        <div>
                                          <h2>{lineTitle}</h2>
                                          {currentLine?.nomSousCategorie || currentBenefs.length ? (
                                            <div className="pill-list">
                                              {currentLine?.nomSousCategorie ? <Badge>{currentLine.nomSousCategorie}</Badge> : null}
                                              {currentBenefs.map((name) => (
                                                <Badge key={`${field.id}-${name}`}>{name}</Badge>
                                              ))}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="form-grid three-columns">
                                        <FormField label="Libelle">
                                          <input {...createForm.register(`lignes.${index}.libelle`)} />
                                        </FormField>

                                        <FormField label="Date">
                                          <input type="date" {...createForm.register(`lignes.${index}.dateComptabilisation`)} />
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
                                            onClick={() => openSubCategoryPicker({ kind: 'createLine', index })}
                                          >
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

                                        <FormField label="Beneficiaires">
                                          <button type="button" className="picker-field" onClick={() => openBeneficiaryPicker({ kind: 'createLine', index })}>
                                            <div className="picker-field-content">
                                              <strong>{beneficiarySelectionLabel(currentBenefs)}</strong>
                                            </div>
                                            <ChevronDown size={16} />
                                          </button>
                                        </FormField>
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
                  <Button type="button" tone="soft" disabled={createSubmitDisabled} onClick={createForm.handleSubmit((values) => submitCreateOperation(values, true))}>
                    <Plus size={16} />
                    Valider + nouvelle similaire
                  </Button>
                  <Button type="submit" disabled={createSubmitDisabled}>
                    <Save size={16} />
                    Valider
                  </Button>
                </div>
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
                          <div className="search-action-row">
                            <label className="search-field search-field-thin">
                              <Search size={14} />
                              <input value={depenseSearch} onChange={(event) => setDepenseSearch(event.target.value)} placeholder="Chercher..." />
                            </label>
                            <QuickAddButton
                              label={quickAccountLabel(createDepenseKinds)}
                              onClick={() => openTypedQuickAccountDialog(createDepenseKinds, (identifiant) => selectDepenseInQuickEditor(identifiant))}
                            />
                          </div>
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
                          <div className="search-action-row">
                            <label className="search-field search-field-thin">
                              <Search size={14} />
                              <input value={recetteSearch} onChange={(event) => setRecetteSearch(event.target.value)} placeholder="Chercher..." />
                            </label>
                            <QuickAddButton
                              label={quickAccountLabel(createRecetteKinds)}
                              onClick={() => openTypedQuickAccountDialog(createRecetteKinds, (identifiant) => selectRecetteInQuickEditor(identifiant))}
                            />
                          </div>
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
        {operationListLoading ? <LoadingState label="Chargement des operations..." /> : null}
        {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

        <Surface className="catalog-panel">
          <div className="operation-filter-stack">
            <div className="operation-filter-row">
              {renderOperationFilterButton(
                'Type',
                compactFilterLabel(selectedTypeFilterItems.map((type) => type.libelleCourt), 'Tous'),
                'type',
              )}
              {renderOperationFilterButton(
                'Type compte',
                compactFilterLabel(selectedAccountTypeFilters.map(accountTypeLabel), 'Tous'),
                'account-type',
              )}
              {renderOperationFilterButton(
                'Compte',
                compactFilterLabel(selectedAccountFilterItems.map((account) => account.identifiant), 'Tous'),
                'account',
              )}
              {renderOperationFilterButton('Beneficiaires', compactFilterLabel(selectedBeneficiaryFilters, 'Tous'), 'beneficiary')}
              <Button type="button" tone="ghost" onClick={clearOperationFilters}>
                Reinitialiser
              </Button>
            </div>

            <div className="operation-filter-row operation-filter-row-secondary">
              {renderOperationFilterButton(
                'Montant',
                compactFilterLabel(activeAmountFilters.map(amountFilterLabel), 'Tous'),
                'amount',
              )}
              {renderOperationFilterButton(
                'Date',
                compactFilterLabel(activeDateFilters.map((filter) => (filter.to ? `${filter.from || filter.to} - ${filter.to}` : filter.from || filter.to)), 'Toutes'),
                'date',
              )}
            </div>

            <div className="operation-search-pagination-row">
              <label className="search-field operation-history-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setOperationPageIndex(1)
                  }}
                  placeholder="Chercher par libelle ou compte..."
                />
              </label>

              {renderOperationPaginationControls('top')}
            </div>
          </div>

          {!operationListLoading && !filteredOperations.length ? (
            <EmptyState title="Aucune operation visible" description="La liste est vide ou le filtre ne matche rien." />
          ) : (
            <div className="operation-history-list">
              {filteredOperations.map((operation) => {
                const summary = operationReferenceSummary(operation)
                const typeCode = operationTypeCode(operation)
                const label = readableOperationLabel(operation)
                const depenseLabel = selectedAccountLabel(allAccounts, depenseId(operation))
                const recetteLabel = selectedAccountLabel(allAccounts, recetteId(operation))
                const flowLabel = `${flowLabelsForType(typeCode).depenseSummary}: ${depenseLabel} · ${flowLabelsForType(typeCode).recetteSummary}: ${recetteLabel}`
                return (
                  <button
                    key={operation.numero}
                    type="button"
                    className={cx('operation-history-row', selectedNumero === operation.numero && 'selected')}
                    onClick={() => {
                      setLineBudgetCents(operation.montantEnCentimes)
                      setSelectedNumero(operation.numero)
                      setExpandedLineIndex(null)
                    }}
                  >
                    <div className="operation-history-main">
                      <strong title={label}>{label}</strong>
                      <span>{operationHistoryMeta(operation)}</span>
                    </div>

                    <div className="operation-history-flow" title={flowLabel}>
                      <span>{depenseLabel}</span>
                      <ChevronRight size={12} aria-hidden="true" />
                      <span>{recetteLabel}</span>
                    </div>

                    <Badge>{typeCode}</Badge>
                    <span className="operation-history-reference" title={operationHistoryReferenceLabel(summary)}>
                      {operationHistoryReferenceLabel(summary)}
                    </span>
                    <strong className="operation-history-amount">{formatCurrencyFromCents(operation.montantEnCentimes)}</strong>
                  </button>
                )
              })}
            </div>
          )}

          {renderOperationPaginationControls('bottom')}
        </Surface>
      </div>

      <OverlayPanel
        open={operationFilterPicker === 'type'}
        onClose={() => setOperationFilterPicker(null)}
        title="Type d'operations"
        width="regular"
        overlayClassName="overlay-top"
        className="filter-panel"
      >
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={clearTypeFilters}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setOperationFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>

          {!groupedFilterOperationTypes.length ? (
            <EmptyState title="Aucun type" description="Aucun type d operation disponible." />
          ) : (
            groupedFilterOperationTypes.map((group) => (
              <div key={group.key} className="wizard-choice-section filter-choice-section">
                <span className="wizard-choice-section-label">{group.label}</span>
                <div className="wizard-choice-grid filter-choice-grid dense">
                  {group.items.map((type) => {
                    const active = selectedTypeFilters.includes(type.code)
                    return (
                      <button key={type.code} type="button" className={cx('wizard-choice-card filter-choice-card dense', active && 'active')} onClick={() => toggleTypeFilter(type.code)}>
                        <div>
                          <strong>{type.libelleCourt}</strong>
                          <span>{type.code}</span>
                        </div>
                        {active ? <Check size={15} /> : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel
        open={operationFilterPicker === 'account-type'}
        onClose={() => setOperationFilterPicker(null)}
        title="Types de comptes"
        width="regular"
        overlayClassName="overlay-top"
        className="filter-panel"
      >
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setOperationPageIndex(1)
                setSelectedAccountTypeFilters([])
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setOperationFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {ACCOUNT_TYPE_META.map((type) => {
              const active = selectedAccountTypeFilters.includes(type.key)
              return (
                <button key={type.key} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => toggleAccountTypeFilter(type.key)}>
                  <div>
                    <strong>{type.label}</strong>
                    <span>{type.description}</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={operationFilterPicker === 'account'} onClose={() => setOperationFilterPicker(null)} title="Comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setOperationPageIndex(1)
                setSelectedAccountFilters([])
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setOperationFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={accountFilterSearch} onChange={(event) => setAccountFilterSearch(event.target.value)} placeholder="Chercher un compte..." />
            </label>
          </div>

          {!filteredAccountChoicesForFilter.length ? (
            <EmptyState title="Aucun compte" description="Aucun compte ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredAccountChoicesForFilter.map((account) => {
                const active = selectedAccountFilters.includes(account.identifiant)
                return (
                  <button key={account.identifiant} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => toggleAccountFilter(account.identifiant)}>
                    <div>
                      <strong>{account.identifiant}</strong>
                      <span>{account.libelle ?? accountTypeLabel(accountTypeChoiceForAccount(account, internalAccountIds, externalAccountIds, technicalAccountIds) ?? 'EXTERNE')}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={operationFilterPicker === 'beneficiary'} onClose={() => setOperationFilterPicker(null)} title="Beneficiaires" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setOperationPageIndex(1)
                setSelectedBeneficiaryFilters([])
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setOperationFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={beneficiaryFilterSearch} onChange={(event) => setBeneficiaryFilterSearch(event.target.value)} placeholder="Chercher un beneficiaire..." />
            </label>
          </div>

          {!filteredBeneficiaryFilterOptions.length ? (
            <EmptyState title="Aucun beneficiaire" description="Aucun beneficiaire ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredBeneficiaryFilterOptions.map((beneficiaire) => {
                const active = selectedBeneficiaryFilters.includes(beneficiaire.nom)
                return (
                  <button key={beneficiaire.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => toggleBeneficiaryFilter(beneficiaire.nom)}>
                    <div>
                      <strong>{beneficiaire.nom}</strong>
                      <span>{beneficiaire.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={operationFilterPicker === 'date'} onClose={() => setOperationFilterPicker(null)} title="Dates" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={clearDateFilters}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setOperationFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            {dateFilters.map((filter, index) => (
              <div key={index} className="range-filter-row">
                <FormField label={index === 0 ? 'Jour ou debut' : 'Autre jour ou debut'}>
                  <input type="date" value={filter.from} onChange={(event) => updateDateFilter(index, 'from', event.target.value)} />
                </FormField>
                {filter.from || filter.to ? (
                  <FormField label="Fin de periode">
                    <input type="date" value={filter.to} onChange={(event) => updateDateFilter(index, 'to', event.target.value)} />
                  </FormField>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={operationFilterPicker === 'amount'} onClose={() => setOperationFilterPicker(null)} title="Montants" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={clearAmountFilters}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setOperationFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            {amountFilters.map((filter, index) => (
              <div key={index} className="range-filter-row">
                <FormField label={index === 0 ? 'Montant ou minimum' : 'Autre montant ou minimum'}>
                  <input value={filter.from} inputMode="numeric" onChange={(event) => updateAmountFilter(index, 'from', event.target.value)} placeholder="Ex. 25" />
                </FormField>
                {filter.from || filter.to ? (
                  <FormField label="Maximum">
                    <input value={filter.to} inputMode="numeric" onChange={(event) => updateAmountFilter(index, 'to', event.target.value)} placeholder="Ex. 80" />
                  </FormField>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={Boolean(subCategoryPickerTarget)} onClose={closeSubCategoryPicker} title="Sous-categories" width="regular" overlayClassName="overlay-super-top">
        <div className="page-stack">
          <div className="search-action-row">
            <label className="search-field search-field-thin">
              <Search size={14} />
              <input value={subCategorySearch} onChange={(event) => setSubCategorySearch(event.target.value)} placeholder="Chercher une sous-categorie..." />
            </label>
            <QuickAddButton
              label="Creer une nouvelle sous-categorie"
              onClick={() =>
                openQuickReferenceDialog({
                  resource: 'souscategorie',
                  title: 'Nouvelle sous-categorie',
                  initialCategoryName: openCategoryNames[openCategoryNames.length - 1] ?? '',
                  onCreated: (name) => {
                    toggleSubCategory(name)
                  },
                })
              }
            />
          </div>

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
                        <span>{item.libelle ?? ' '}</span>
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

      <OverlayPanel open={Boolean(beneficiaryPickerTarget)} onClose={closeBeneficiaryPicker} title="Beneficiaires" width="regular" overlayClassName="overlay-super-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar beneficiary-picker-toolbar">
              <label className="search-field search-field-thin beneficiary-picker-search">
                <Search size={14} />
                <input value={beneficiaryPickerSearch} onChange={(event) => setBeneficiaryPickerSearch(event.target.value)} placeholder="Chercher un beneficiaire..." />
              </label>
              <QuickAddButton
                label="Creer un nouveau beneficiaire"
                onClick={() =>
                  openQuickReferenceDialog({
                    resource: 'beneficiaire',
                    title: 'Nouveau beneficiaire',
                    onCreated: appendCurrentBeneficiary,
                  })
                }
              />
              <Button type="button" tone="ghost" onClick={clearCurrentBeneficiaries}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={closeBeneficiaryPicker}>
                Valider
              </Button>
            </div>
          </div>

          {!filteredBeneficiaryPickerOptions.length ? (
            <EmptyState title="Aucun beneficiaire" description="Aucun beneficiaire ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredBeneficiaryPickerOptions.map((beneficiaire) => {
                const active = currentBeneficiaryValues().includes(beneficiaire.nom)
                return (
                  <button key={beneficiaire.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => toggleCurrentBeneficiary(beneficiaire.nom)}>
                    <div>
                      <strong>{beneficiaire.nom}</strong>
                      <span>{beneficiaire.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
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

            <FormField label="Beneficiaires">
              <button type="button" className="picker-field" onClick={() => openBeneficiaryPicker({ kind: 'newCreateLine' })}>
                <div className="picker-field-content">
                  <strong>{beneficiarySelectionLabel(newCreateLineBeneficiaries)}</strong>
                </div>
                <ChevronDown size={16} />
              </button>
            </FormField>
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

            <FormField label="Beneficiaires">
              <button type="button" className="picker-field" onClick={() => openBeneficiaryPicker({ kind: 'newLine' })}>
                <div className="picker-field-content">
                  <strong>{beneficiarySelectionLabel(newLineBeneficiaries)}</strong>
                </div>
                <ChevronDown size={16} />
              </button>
            </FormField>
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
        width="wide"
        navigator={{
          label: `Opération ${selectedOperationPosition || 0}/${filteredOperations.length}`,
          title: selectedOperationTitle,
          previousDisabled: selectedOperationIndex <= 0,
          nextDisabled: selectedOperationIndex < 0 || selectedOperationIndex >= filteredOperations.length - 1,
          onPrevious: () => {
            const operation = filteredOperations[selectedOperationIndex - 1]
            if (!operation) {
              return
            }

            setLineBudgetCents(operation.montantEnCentimes)
            setSelectedNumero(operation.numero)
            setExpandedLineIndex(null)
            setLineCreateOpen(false)
          },
          onNext: () => {
            const operation = filteredOperations[selectedOperationIndex + 1]
            if (!operation) {
              return
            }

            setLineBudgetCents(operation.montantEnCentimes)
            setSelectedNumero(operation.numero)
            setExpandedLineIndex(null)
            setLineCreateOpen(false)
          },
        }}
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
                <div className="field-action-row">
                  <select {...editForm.register('identifiantCompteDepense')}>
                    <option value="">Choisir</option>
                    {editDepenseOptions.map((account) => (
                      <option key={account.identifiant} value={account.identifiant}>
                        {accountChoiceLabel(account)}
                      </option>
                    ))}
                  </select>
                  <QuickAddButton
                    label={quickAccountLabel(editDepenseKinds)}
                    onClick={() =>
                      openTypedQuickAccountDialog(editDepenseKinds, (identifiant) =>
                        editForm.setValue('identifiantCompteDepense', identifiant, { shouldDirty: true, shouldTouch: true }),
                      )
                    }
                  />
                </div>
              </div>
              <div className="operation-overview-card preview-tip" data-tooltip={previewTip(editFlowLabels.recetteSummary, selectedAccountLabel(allAccounts, editRecette || recetteId(detailQuery.data)))}>
                <span>{editFlowLabels.recetteSummary}</span>
                <div className="field-action-row">
                  <select {...editForm.register('identifiantCompteRecette')}>
                    <option value="">Choisir</option>
                    {editRecetteOptions.map((account) => (
                      <option key={account.identifiant} value={account.identifiant}>
                        {accountChoiceLabel(account)}
                      </option>
                    ))}
                  </select>
                  <QuickAddButton
                    label={quickAccountLabel(editRecetteKinds)}
                    onClick={() =>
                      openTypedQuickAccountDialog(editRecetteKinds, (identifiant) =>
                        editForm.setValue('identifiantCompteRecette', identifiant, { shouldDirty: true, shouldTouch: true }),
                      )
                    }
                  />
                </div>
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
              <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Date de comptabilisation', detailAccountingDate ? formatDate(detailAccountingDate) : 'Aucune')}>
                <span>Date compta</span>
                <strong>{detailAccountingDate ? formatDate(detailAccountingDate) : 'Aucune'}</strong>
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

            <div className="page-stack operation-lines-section">
              <SectionHeader
                title="Lignes"
                aside={
                  <Button type="button" tone="ghost" disabled={hasDetailLineOverflow} onClick={openLineCreatePanel}>
                    <Plus size={16} />
                    Ajouter ligne
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
                    const lineTitle = lineDisplayTitle(index, isPrimaryLine ? 0 : field.numeroLigne)

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
                              </div>
                              <ChevronDown size={16} />
                            </button>

                            <div className="line-editor-actions">
                              {currentLine?.nomSousCategorie ? <Badge>{currentLine.nomSousCategorie}</Badge> : null}
                              {currentBenefs.length ? <Badge>{beneficiarySelectionLabel(currentBenefs)}</Badge> : null}
                              {!isPrimaryLine ? (
                                <Button
                                  type="button"
                                  tone="danger"
                                  className="line-editor-delete-button"
                                  disabled={updateMutation.isPending}
                                  onClick={() => {
                                    const nextLines = editForm.getValues('lignes').filter((_, lineIndex) => lineIndex !== index)
                                    applyDetailLineCollection(nextLines)
                                    setExpandedLineIndex(null)
                                  }}
                                >
                                  <Trash2 size={16} />
                                  Supprimer
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          {isOpen ? (
                            <div className="line-editor-body">
                              <div className="section-header">
                                <div>
                                  <h2>{lineTitle}</h2>
                                  {currentLine?.nomSousCategorie || currentBenefs.length ? (
                                    <div className="pill-list">
                                      {currentLine?.nomSousCategorie ? <Badge>{currentLine.nomSousCategorie}</Badge> : null}
                                      {currentBenefs.map((name) => (
                                        <Badge key={`${field.id}-${name}`}>{name}</Badge>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
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

                                <FormField label="Beneficiaires">
                                  <button type="button" className="picker-field" onClick={() => openBeneficiaryPicker({ kind: 'line', index })}>
                                    <div className="picker-field-content">
                                      <strong>{beneficiarySelectionLabel(currentBenefs)}</strong>
                                    </div>
                                    <ChevronDown size={16} />
                                  </button>
                                </FormField>
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

            <div className="detail-footer-actions">
              <div className="detail-footer-primary">
                {editForm.formState.isDirty ? (
                  <>
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
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  const numeroToDelete = selectedNumero
                  const labelToDelete = selectedOperationTitle
                  if (numeroToDelete && window.confirm(`Supprimer ${labelToDelete} ?`)) {
                    void deleteMutation.mutateAsync(numeroToDelete)
                  }
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
            </div>
          </form>
        )}
      </OverlayPanel>

      <QuickReferenceOverlay dialog={quickReferenceDialog} onClose={closeQuickReferenceDialog} />
      <QuickAccountOverlay dialog={quickAccountDialog} onClose={closeQuickAccountDialog} />
      <StatementImportOverlay
        open={statementImportOpen}
        onClose={() => setStatementImportOpen(false)}
        onImported={async () => {
          await queryClient.invalidateQueries({ queryKey: ['operations'] })
          setOperationPageIndex(1)
          setSelectedNumero(null)
        }}
      />
    </div>
  )
}
