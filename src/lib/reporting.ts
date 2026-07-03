import { parseISO } from 'date-fns'

import {
  type CompteExterneBasic,
  type CompteInterneBasic,
  type CompteTechniqueBasic,
  type EvaluationBasic,
  type OperationBasic,
  type ReportAccountHeader,
  type ReportBilanPatrimoineResponse,
  type ReportDepenseRecetteResponse,
  type ReportPeriodBilan,
  type ReportPeriodDepenseRecette,
  type ReportPeriodRemunerationsFrais,
  type ReportReleveCompteResponse,
  type ReportRemunerationsFraisResponse,
  type ReportResumeCompteInterneResponse,
  type ReferenceBase,
  type ReferenceListItem,
} from './monatis-api'
import { buildPeriodBuckets, dayAfter, dayBefore, formatShortDate, isIsoWithinRange, type MonatisPeriodCode, type PeriodBucket } from './format'

export interface ReleveRow {
  numero: string
  codeTypeOperation: string
  dateValeur: string
  dateComptabilisation: string
  libelle: string | null
  montantEnEuros: number
  identifiantAutreCompte: string
  libelleAutreCompte: string | null
  codeTypeAutreCompte: string
}

export interface ReleveCompteView {
  enteteCompte: {
    identifiant: string
    libelle: string | null
    typeCompte: string
    typeFonctionnement?: string | null
    banque?: string | null
    titulaires?: string[]
  }
  dateDebutReleve: string
  dateFinReleve: string
  montantSoldeDebutReleveEnEuros: number
  montantSoldeFinReleveEnEuros: number
  montantTotalOperationsRecetteEnEuros: number
  montantTotalOperationsDepenseEnEuros: number
  montantEcartEnEuros: number
  operationsRecette: ReleveRow[]
  operationsDepense: ReleveRow[]
  numeroPageOperationsRecette: number | null
  taillePageOperationsRecette: number | null
  totalOperationsRecette: number | null
  totalPagesOperationsRecette: number | null
  premierElementOperationsRecette: number | null
  dernierElementOperationsRecette: number | null
  numeroPageOperationsDepense: number | null
  taillePageOperationsDepense: number | null
  totalOperationsDepense: number | null
  totalPagesOperationsDepense: number | null
  premierElementOperationsDepense: number | null
  dernierElementOperationsDepense: number | null
}

export interface ResumeCompteView {
  identifiant: string
  libelle: string | null
  typeFonctionnement: string
  dateSolde: string
  montantSoldeEnEuros: number
  banque: string | null
  titulaires: string[]
}

export interface PeriodTotalView {
  start: string
  end: string
  label: string
  recette: number
  depense: number
  solde: number
  details: Array<{
    numero: string
    date: string
    libelle: string | null
    montantEnEuros: number
    sousCategorieNom: string | null
    beneficiaires: string[]
  }>
}

export interface DepenseRecetteSubcategoryView {
  sousCategorie: ReferenceBase | null
  periods: PeriodTotalView[]
}

export interface DepenseRecetteCategoryView {
  categorie: ReferenceBase | null
  totals: PeriodTotalView[]
  children: DepenseRecetteSubcategoryView[]
}

export interface DepenseRecetteView {
  periods: PeriodBucket[]
  categories: DepenseRecetteCategoryView[]
  totals: PeriodTotalView[]
}

export interface RemunerationsAccountView {
  identifiant: string
  libelle: string | null
  banque: string | null
  periods: PeriodTotalView[]
}

export interface RemunerationsTypeView {
  typeFonctionnement: string
  periods: PeriodTotalView[]
  accounts: RemunerationsAccountView[]
}

export interface RemunerationsFraisView {
  periods: PeriodBucket[]
  groups: RemunerationsTypeView[]
  totals: PeriodTotalView[]
}

export interface BilanPeriodView {
  start: string
  end: string
  label: string
  montantSoldeInitialEnEuros: number
  montantSoldeFinalEnEuros: number
  montantTotalRecetteEnEuros: number
  montantTotalDepenseEnEuros: number
  soldeTotalTechniqueEnEuros: number
  montantEcartNonJustifieEnEuros: number
}

export interface BilanAccountView {
  identifiant: string
  libelle: string | null
  banque: string | null
  montantSoldeInitialEnEuros: number
  periods: BilanPeriodView[]
}

export interface BilanTypeView {
  typeFonctionnement: string
  montantSoldeInitialEnEuros: number
  periods: BilanPeriodView[]
  accounts: BilanAccountView[]
}

export interface BilanPatrimoineView {
  periods: PeriodBucket[]
  montantSoldeInitialEnEuros: number
  groups: BilanTypeView[]
  totals: BilanPeriodView[]
}

export interface PlusMoinsValuePeriodView {
  start: string
  end: string
  label: string
  montantSoldeInitialEnEuros: number
  montantOperationsEnEuros: number
  montantPlusMoinsValueNetteEnEuros: number
  tauxPlusMoinsValueNette: number | null
  montantSoldeFinalEnEuros: number
  montantFraisEnEuros: number
  tauxFrais: number | null
}

export interface PlusMoinsValueAccountView {
  identifiant: string
  libelle: string | null
  banque: string | null
  periods: PlusMoinsValuePeriodView[]
}

export interface PlusMoinsValueTypeView {
  typeFonctionnement: string
  periods: PlusMoinsValuePeriodView[]
  accounts: PlusMoinsValueAccountView[]
}

export interface PlusMoinsValueView {
  periods: PeriodBucket[]
  groups: PlusMoinsValueTypeView[]
  totals: PlusMoinsValuePeriodView[]
}

export interface AccountLookupEntry {
  identifiant: string
  libelle: string | null
  codeTypeCompte: 'INTERNE' | 'EXTERNE' | 'TECHNIQUE'
  codeTypeFonctionnement?: string | null
  banque?: string | null
  titulaires?: string[]
}

interface NormalizedLine {
  date: string
  montantEnCentimes: number
  libelle: string | null
  sousCategorieNom: string | null
  beneficiaires: string[]
}

function centsToEuros(value: number): number {
  return value / 100
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

function roundRate(value: number | null): number | null {
  return value == null ? null : Number.parseFloat(value.toFixed(2))
}

function isoToUtcDay(value: string): number {
  const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10))
  return Date.UTC(year, month - 1, day) / 86_400_000
}

function daysBetweenInclusive(start: string, end: string): number {
  return Math.max(1, isoToUtcDay(end) - isoToUtcDay(start) + 1)
}

function periodTemplate(periods: PeriodBucket[]): PeriodTotalView[] {
  return periods.map((period) => ({
    start: period.start,
    end: period.end,
    label: period.label,
    recette: 0,
    depense: 0,
    solde: 0,
    details: [],
  }))
}

function bilanTemplate(periods: PeriodBucket[]): BilanPeriodView[] {
  return periods.map((period) => ({
    start: period.start,
    end: period.end,
    label: period.label,
    montantSoldeInitialEnEuros: 0,
    montantSoldeFinalEnEuros: 0,
    montantTotalRecetteEnEuros: 0,
    montantTotalDepenseEnEuros: 0,
    soldeTotalTechniqueEnEuros: 0,
    montantEcartNonJustifieEnEuros: 0,
  }))
}

function plusMoinsValueTemplate(periods: PeriodBucket[]): PlusMoinsValuePeriodView[] {
  return periods.map((period) => ({
    start: period.start,
    end: period.end,
    label: period.label,
    montantSoldeInitialEnEuros: 0,
    montantOperationsEnEuros: 0,
    montantPlusMoinsValueNetteEnEuros: 0,
    tauxPlusMoinsValueNette: null,
    montantSoldeFinalEnEuros: 0,
    montantFraisEnEuros: 0,
    tauxFrais: null,
  }))
}

function bucketIndex(periods: PeriodBucket[], iso: string): number {
  return periods.findIndex((period) => isIsoWithinRange(iso, period.start, period.end))
}

function normalizeLines(operation: OperationBasic): NormalizedLine[] {
  return operation.lignes.map((line) => ({
    date: line.dateComptabilisation ?? operation.dateValeur,
    montantEnCentimes: line.montantEnCentimes,
    libelle: line.libelle ?? operation.libelle,
    sousCategorieNom: line.nomSousCategorie ?? line.sousCategorie?.nom ?? null,
    beneficiaires: line.nomsBeneficiaires ?? line.beneficiaires?.map((item) => item.nom) ?? [],
  }))
}

function operationCode(operation: OperationBasic): string {
  return operation.codeTypeOperation ?? operation.typeOperation?.code ?? ''
}

function depenseId(operation: OperationBasic): string {
  return operation.identifiantCompteDepense ?? operation.compteDepense?.identifiant ?? ''
}

function recetteId(operation: OperationBasic): string {
  return operation.identifiantCompteRecette ?? operation.compteRecette?.identifiant ?? ''
}

function evaluationAccountId(evaluation: EvaluationBasic): string {
  return evaluation.identifiantCompteInterne ?? evaluation.compteInterne?.identifiant ?? ''
}

function latestEvaluationAtDate(accountId: string, evaluations: EvaluationBasic[], targetDate: string): EvaluationBasic | null {
  return (
    evaluations
      .filter((evaluation) => evaluationAccountId(evaluation) === accountId)
      .filter((evaluation) => evaluation.dateSolde <= targetDate)
      .sort((left, right) => right.dateSolde.localeCompare(left.dateSolde) || right.cle.localeCompare(left.cle))[0] ?? null
  )
}

function periodLabel(start: string, end: string): string {
  return `${formatShortDate(start)} - ${formatShortDate(end)}`
}

function periodKey(start: string, end: string): string {
  return `${start}_${end}`
}

function reportPeriodBucket(start: string, end: string): PeriodBucket {
  return {
    key: periodKey(start, end),
    label: periodLabel(start, end),
    start,
    end,
  }
}

function mapReportAccountHeader(header?: ReportAccountHeader | null): ReleveCompteView['enteteCompte'] {
  return {
    identifiant: header?.identifiantCompte ?? '',
    libelle: header?.libelleCompte ?? null,
    typeCompte: header?.codeTypeCompte ?? 'INCONNU',
    typeFonctionnement: header?.codeTypeFonctionnement ?? null,
    banque: header?.libelleBanque ?? null,
    titulaires: header?.libellesTitulaires ?? [],
  }
}

function mapReportDepenseRecettePeriod(period: ReportPeriodDepenseRecette): PeriodTotalView {
  return {
    start: period.dateDebutPeriode,
    end: period.dateFinPeriode,
    label: periodLabel(period.dateDebutPeriode, period.dateFinPeriode),
    recette: roundMoney(period.montantRecetteEnEuros ?? 0),
    depense: roundMoney(period.montantDepenseEnEuros ?? 0),
    solde: roundMoney(period.soldeDepenseRecetteEnEuros ?? 0),
    details: [],
  }
}

function mapReportRemunerationsPeriod(period: ReportPeriodRemunerationsFrais): PeriodTotalView {
  return {
    start: period.dateDebutPeriode,
    end: period.dateFinPeriode,
    label: periodLabel(period.dateDebutPeriode, period.dateFinPeriode),
    recette: roundMoney(period.montantRemunerationsEnEuros ?? 0),
    depense: roundMoney(period.montantFraisEnEuros ?? 0),
    solde: roundMoney(period.soldeRemunerationsFraisEnEuros ?? 0),
    details: [],
  }
}

function mapReportBilanPeriod(period: ReportPeriodBilan): BilanPeriodView {
  return {
    start: period.dateDebutPeriode,
    end: period.dateFinPeriode,
    label: periodLabel(period.dateDebutPeriode, period.dateFinPeriode),
    montantSoldeInitialEnEuros: roundMoney(period.montantSoldeInitialEnEuros ?? 0),
    montantSoldeFinalEnEuros: roundMoney(period.montantSoldeFinalEnEuros ?? 0),
    montantTotalRecetteEnEuros: roundMoney(period.montantTotalRecetteEnEuros ?? 0),
    montantTotalDepenseEnEuros: roundMoney(period.montantTotalDepenseEnEuros ?? 0),
    soldeTotalTechniqueEnEuros: roundMoney(period.soldeTotalTechniqueEnEuros ?? 0),
    montantEcartNonJustifieEnEuros: roundMoney(period.montantEcartNonJustifieEnEuros ?? 0),
  }
}

function hasPeriodTotal(periods: PeriodTotalView[]): boolean {
  return periods.some((period) => period.recette !== 0 || period.depense !== 0 || period.solde !== 0)
}

function hasBilanPeriodTotal(periods: BilanPeriodView[]): boolean {
  return periods.some(
    (period) =>
      period.montantSoldeInitialEnEuros !== 0 ||
      period.montantSoldeFinalEnEuros !== 0 ||
      period.montantTotalRecetteEnEuros !== 0 ||
      period.montantTotalDepenseEnEuros !== 0 ||
      period.soldeTotalTechniqueEnEuros !== 0 ||
      period.montantEcartNonJustifieEnEuros !== 0,
  )
}

export function mapReportReleveCompte(dto: ReportReleveCompteResponse): ReleveCompteView {
  return {
    enteteCompte: mapReportAccountHeader(dto.enteteCompte),
    dateDebutReleve: dto.dateDebutReleve,
    dateFinReleve: dto.dateFinReleve,
    montantSoldeDebutReleveEnEuros: roundMoney(dto.montantSoldeDebutReleveEnEuros),
    montantSoldeFinReleveEnEuros: roundMoney(dto.montantSoldeFinReleveEnEuros),
    montantTotalOperationsRecetteEnEuros: roundMoney(dto.montantTotalOperationsRecetteEnEuros),
    montantTotalOperationsDepenseEnEuros: roundMoney(dto.montantTotalOperationsDepenseEnEuros),
    montantEcartEnEuros: roundMoney(dto.montantEcartEnEuros),
    numeroPageOperationsRecette: dto.numeroPageOperationsRecette ?? null,
    taillePageOperationsRecette: dto.taillePageOperationsRecette ?? null,
    totalOperationsRecette: dto.totalOperationsRecette ?? null,
    totalPagesOperationsRecette: dto.totalPagesOperationsRecette ?? null,
    premierElementOperationsRecette: dto.premierElementOperationsRecette ?? null,
    dernierElementOperationsRecette: dto.dernierElementOperationsRecette ?? null,
    numeroPageOperationsDepense: dto.numeroPageOperationsDepense ?? null,
    taillePageOperationsDepense: dto.taillePageOperationsDepense ?? null,
    totalOperationsDepense: dto.totalOperationsDepense ?? null,
    totalPagesOperationsDepense: dto.totalPagesOperationsDepense ?? null,
    premierElementOperationsDepense: dto.premierElementOperationsDepense ?? null,
    dernierElementOperationsDepense: dto.dernierElementOperationsDepense ?? null,
    operationsRecette: (dto.operationsRecette ?? []).map((operation) => ({
      numero: operation.numero,
      codeTypeOperation: operation.codeTypeOperation,
      dateValeur: operation.dateValeur,
      dateComptabilisation: operation.dateComptabilisation ?? operation.dateValeur,
      libelle: operation.libelle,
      montantEnEuros: roundMoney(operation.montantEnEuros),
      identifiantAutreCompte: operation.identifiantAutreCompte,
      libelleAutreCompte: operation.libelleAutreCompte,
      codeTypeAutreCompte: operation.codeTypeAutreCompte,
    })),
    operationsDepense: (dto.operationsDepense ?? []).map((operation) => ({
      numero: operation.numero,
      codeTypeOperation: operation.codeTypeOperation,
      dateValeur: operation.dateValeur,
      dateComptabilisation: operation.dateComptabilisation ?? operation.dateValeur,
      libelle: operation.libelle,
      montantEnEuros: roundMoney(Math.abs(operation.montantEnEuros)),
      identifiantAutreCompte: operation.identifiantAutreCompte,
      libelleAutreCompte: operation.libelleAutreCompte,
      codeTypeAutreCompte: operation.codeTypeAutreCompte,
    })),
  }
}

export function mapReportResumesComptes(dtos: ReportResumeCompteInterneResponse[]): ResumeCompteView[] {
  return dtos
    .map((dto) => ({
      identifiant: dto.compteInterne?.identifiantCompte ?? '',
      libelle: dto.compteInterne?.libelleCompte ?? null,
      typeFonctionnement: dto.compteInterne?.codeTypeFonctionnement ?? 'INTERNE',
      dateSolde: dto.dateSolde,
      montantSoldeEnEuros: roundMoney(dto.montantSoldeEnEuros ?? 0),
      banque: dto.compteInterne?.libelleBanque ?? null,
      titulaires: dto.compteInterne?.libellesTitulaires ?? [],
    }))
    .filter((row) => row.identifiant)
    .sort((left, right) => left.identifiant.localeCompare(right.identifiant))
}

export function mapReportDepenseRecette(dto: ReportDepenseRecetteResponse): DepenseRecetteView {
  const periods = (dto.cumuls ?? []).map((period) => reportPeriodBucket(period.dateDebutPeriode, period.dateFinPeriode))
  const categories = (dto.lignesCategorie ?? [])
    .map((category) => {
      const totals = (category.cumuls ?? []).map(mapReportDepenseRecettePeriod)
      const children = (category.lignesSousCategorie ?? [])
        .map((child) => ({
          sousCategorie: child.sousCategorie
            ? {
                nom: child.sousCategorie.nom,
                libelle: child.sousCategorie.libelle ?? null,
              }
            : null,
          periods: (child.periodes ?? []).map(mapReportDepenseRecettePeriod),
        }))
        .filter((child) => hasPeriodTotal(child.periods))

      return {
        categorie: category.categorie
          ? {
              nom: category.categorie.nom,
              libelle: category.categorie.libelle ?? null,
            }
          : null,
        totals,
        children,
      }
    })
    .filter((category) => hasPeriodTotal(category.totals) || category.children.length > 0)

  return {
    periods,
    categories,
    totals: (dto.cumuls ?? []).map(mapReportDepenseRecettePeriod),
  }
}

export function mapReportRemunerationsFrais(dto: ReportRemunerationsFraisResponse): RemunerationsFraisView {
  return {
    periods: (dto.cumuls ?? []).map((period) => reportPeriodBucket(period.dateDebutPeriode, period.dateFinPeriode)),
    groups: (dto.lignesTypeFonctionnement ?? [])
      .map((group) => {
        const periods = (group.cumulsPeriodes ?? []).map(mapReportRemunerationsPeriod)
        return {
          typeFonctionnement: group.typeFonctionnement?.code ?? 'INDETERMINE',
          periods,
          accounts: (group.lignesCompteInterne ?? [])
            .map((account) => ({
              identifiant: account.compteInterne?.identifiantCompte ?? '',
              libelle: account.compteInterne?.libelleCompte ?? null,
              banque: account.compteInterne?.libelleBanque ?? null,
              periods: (account.periodes ?? []).map(mapReportRemunerationsPeriod),
            }))
            .filter((account) => account.identifiant && hasPeriodTotal(account.periods)),
        }
      })
      .filter((group) => hasPeriodTotal(group.periods) || group.accounts.length > 0),
    totals: (dto.cumuls ?? []).map(mapReportRemunerationsPeriod),
  }
}

export function mapReportBilanPatrimoine(dto: ReportBilanPatrimoineResponse): BilanPatrimoineView {
  return {
    periods: (dto.cumuls ?? []).map((period) => reportPeriodBucket(period.dateDebutPeriode, period.dateFinPeriode)),
    montantSoldeInitialEnEuros: roundMoney(dto.montantSoldeInitialEnEuros ?? 0),
    groups: (dto.lignesTypeFonctionnement ?? [])
      .map((group) => {
        const periods = (group.cumulsPeriodes ?? []).map(mapReportBilanPeriod)
        return {
          typeFonctionnement: group.typeFonctionnement?.code ?? 'INDETERMINE',
          montantSoldeInitialEnEuros: roundMoney(group.montantSoldeInitialEnEuros ?? 0),
          periods,
          accounts: (group.lignesCompteInterne ?? [])
            .map((account) => ({
              identifiant: account.compteInterne?.identifiantCompte ?? '',
              libelle: account.compteInterne?.libelleCompte ?? null,
              banque: account.compteInterne?.libelleBanque ?? null,
              montantSoldeInitialEnEuros: roundMoney(account.montantSoldeInitialEnEuros ?? 0),
              periods: (account.periodes ?? []).map(mapReportBilanPeriod),
            }))
            .filter((account) => account.identifiant && hasBilanPeriodTotal(account.periods)),
        }
      })
      .filter((group) => hasBilanPeriodTotal(group.periods) || group.accounts.length > 0),
    totals: (dto.cumuls ?? []).map(mapReportBilanPeriod),
  }
}

export function buildAccountLookup(
  internalAccounts: CompteInterneBasic[],
  externalAccounts: CompteExterneBasic[],
  technicalAccounts: CompteTechniqueBasic[],
): Map<string, AccountLookupEntry> {
  const lookup = new Map<string, AccountLookupEntry>()

  internalAccounts.forEach((account) => {
    lookup.set(account.identifiant, {
      identifiant: account.identifiant,
      libelle: account.libelle,
      codeTypeCompte: 'INTERNE',
      codeTypeFonctionnement: account.codeTypeFonctionnement,
      banque: account.nomBanque,
      titulaires: account.nomsTitulaires,
    })
  })

  externalAccounts.forEach((account) => {
    lookup.set(account.identifiant, {
      identifiant: account.identifiant,
      libelle: account.libelle,
      codeTypeCompte: 'EXTERNE',
    })
  })

  technicalAccounts.forEach((account) => {
    lookup.set(account.identifiant, {
      identifiant: account.identifiant,
      libelle: account.libelle,
      codeTypeCompte: 'TECHNIQUE',
    })
  })

  return lookup
}

function operationAffectsAccount(operation: OperationBasic, accountId: string): boolean {
  return depenseId(operation) === accountId || recetteId(operation) === accountId
}

function operationAccountingDate(operation: OperationBasic): string {
  const primaryLine = operation.lignes.find((line) => line.numeroLigne === 0) ?? operation.lignes[0]
  return primaryLine?.dateComptabilisation ?? operation.dateValeur
}

function operationIsTechnical(operation: OperationBasic): boolean {
  if (operation.typeOperation?.fluxTechnique != null) {
    return operation.typeOperation.fluxTechnique
  }

  const code = operationCode(operation)
  return code.includes('+') || code.includes('-')
}

export function computeBalanceAtDate(
  account: CompteInterneBasic,
  operations: OperationBasic[],
  targetDate: string,
  evaluations: EvaluationBasic[] = [],
): number {
  let balance = account.montantSoldeInitialEnCentimes ?? 0
  let referenceDate = account.dateSoldeInitial
  let operationStartDate = account.dateSoldeInitial

  const latestEvaluation = latestEvaluationAtDate(account.identifiant, evaluations, targetDate)
  if (latestEvaluation && latestEvaluation.dateSolde >= referenceDate) {
    balance = latestEvaluation.montantSoldeEnCentimes
    referenceDate = latestEvaluation.dateSolde
    operationStartDate = dayAfter(latestEvaluation.dateSolde)
  }

  const initialBalanceDate = dayBefore(account.dateSoldeInitial)
  if (targetDate < initialBalanceDate) {
    return 0
  }

  if (targetDate < referenceDate || !operationStartDate) {
    return centsToEuros(balance)
  }

  operations.forEach((operation) => {
    if (!operationAffectsAccount(operation, account.identifiant)) {
      return
    }

    const accountingDate = operationAccountingDate(operation)
    if (accountingDate < operationStartDate || accountingDate > targetDate) {
      return
    }

    if (recetteId(operation) === account.identifiant) {
      balance += operation.montantEnCentimes
    }

    if (depenseId(operation) === account.identifiant) {
      balance -= operation.montantEnCentimes
    }
  })

  return centsToEuros(balance)
}

export function buildReleveCompte(
  account: CompteInterneBasic,
  operations: OperationBasic[],
  lookup: Map<string, AccountLookupEntry>,
  start: string,
  end: string,
  evaluations: EvaluationBasic[] = [],
): ReleveCompteView {
  const operationsRecette: ReleveRow[] = []
  const operationsDepense: ReleveRow[] = []

  operations
    .filter((operation) => operationAffectsAccount(operation, account.identifiant))
    .filter((operation) => isIsoWithinRange(operationAccountingDate(operation), start, end))
    .sort((left, right) => operationAccountingDate(right).localeCompare(operationAccountingDate(left)) || left.numero.localeCompare(right.numero))
    .forEach((operation) => {
      const isRecette = recetteId(operation) === account.identifiant
      const otherId = isRecette ? depenseId(operation) : recetteId(operation)
      const other = lookup.get(otherId)
      const row: ReleveRow = {
        numero: operation.numero,
        codeTypeOperation: operationCode(operation),
        dateValeur: operation.dateValeur,
        dateComptabilisation: operationAccountingDate(operation),
        libelle: operation.libelle,
        montantEnEuros: roundMoney(centsToEuros(operation.montantEnCentimes)),
        identifiantAutreCompte: otherId,
        libelleAutreCompte: other?.libelle ?? null,
        codeTypeAutreCompte: other?.codeTypeCompte ?? 'INCONNU',
      }

      if (isRecette) {
        operationsRecette.push(row)
      } else {
        operationsDepense.push(row)
      }
    })

  const montantTotalOperationsRecetteEnEuros = roundMoney(
    operationsRecette.reduce((total, item) => total + item.montantEnEuros, 0),
  )
  const montantTotalOperationsDepenseEnEuros = roundMoney(
    operationsDepense.reduce((total, item) => total + item.montantEnEuros, 0),
  )
  const montantSoldeDebutReleveEnEuros = roundMoney(computeBalanceAtDate(account, operations, dayBefore(start), evaluations))
  const montantSoldeFinReleveEnEuros = roundMoney(computeBalanceAtDate(account, operations, end, evaluations))

  return {
    enteteCompte: {
      identifiant: account.identifiant,
      libelle: account.libelle,
      typeCompte: 'INTERNE',
      typeFonctionnement: account.codeTypeFonctionnement,
      banque: account.nomBanque,
      titulaires: account.nomsTitulaires,
    },
    dateDebutReleve: start,
    dateFinReleve: end,
    montantSoldeDebutReleveEnEuros,
    montantSoldeFinReleveEnEuros,
    montantTotalOperationsRecetteEnEuros,
    montantTotalOperationsDepenseEnEuros,
    montantEcartEnEuros: roundMoney(
      montantSoldeFinReleveEnEuros -
        (montantSoldeDebutReleveEnEuros + montantTotalOperationsRecetteEnEuros - montantTotalOperationsDepenseEnEuros),
    ),
    operationsRecette,
    operationsDepense,
    numeroPageOperationsRecette: null,
    taillePageOperationsRecette: null,
    totalOperationsRecette: null,
    totalPagesOperationsRecette: null,
    premierElementOperationsRecette: null,
    dernierElementOperationsRecette: null,
    numeroPageOperationsDepense: null,
    taillePageOperationsDepense: null,
    totalOperationsDepense: null,
    totalPagesOperationsDepense: null,
    premierElementOperationsDepense: null,
    dernierElementOperationsDepense: null,
  }
}

export function buildResumesComptes(
  internalAccounts: CompteInterneBasic[],
  operations: OperationBasic[],
  dateSolde: string,
  codesTypes?: string[],
  accountIds?: string[],
  evaluations: EvaluationBasic[] = [],
): ResumeCompteView[] {
  return internalAccounts
    .filter((account) => !codesTypes?.length || codesTypes.includes(account.codeTypeFonctionnement))
    .filter((account) => !accountIds?.length || accountIds.includes(account.identifiant))
    .filter((account) => account.dateSoldeInitial <= dateSolde)
    .map((account) => ({
      identifiant: account.identifiant,
      libelle: account.libelle,
      typeFonctionnement: account.codeTypeFonctionnement,
      dateSolde,
      montantSoldeEnEuros: roundMoney(computeBalanceAtDate(account, operations, dateSolde, evaluations)),
      banque: account.nomBanque,
      titulaires: account.nomsTitulaires,
    }))
    .sort((left, right) => left.identifiant.localeCompare(right.identifiant))
}

export function buildDepenseRecetteReport(params: {
  operations: OperationBasic[]
  internalAccounts: CompteInterneBasic[]
  categories: ReferenceListItem[]
  sousCategories: ReferenceListItem[]
  dateDebut: string
  dateFin: string
  codeTypePeriode?: MonatisPeriodCode
  nomsCategories?: string[]
  nomsSousCategories?: string[]
  nomBeneficiaire?: string | null
}): DepenseRecetteView {
  const periods = buildPeriodBuckets(params.dateDebut, params.dateFin, params.codeTypePeriode)
  const categoryMap = new Map(params.categories.map((item) => [item.nom, item]))
  const subcategoryMap = new Map(params.sousCategories.map((item) => [item.nom, item]))
  const courantAccounts = new Set(
    params.internalAccounts.filter((item) => item.codeTypeFonctionnement === 'COURANT').map((item) => item.identifiant),
  )

  const categoryRows = new Map<string, DepenseRecetteCategoryView>()

  params.operations
    .filter((operation) => ['RECETTE', 'DEPENSE'].includes(operationCode(operation)))
    .filter((operation) => courantAccounts.has(depenseId(operation)) || courantAccounts.has(recetteId(operation)))
    .forEach((operation) => {
      normalizeLines(operation).forEach((line) => {
        if (!isIsoWithinRange(line.date, params.dateDebut, params.dateFin)) {
          return
        }

        if (params.nomBeneficiaire && !line.beneficiaires.includes(params.nomBeneficiaire)) {
          return
        }

        if (params.nomsSousCategories?.length && (!line.sousCategorieNom || !params.nomsSousCategories.includes(line.sousCategorieNom))) {
          return
        }

        const subcategory = line.sousCategorieNom ? subcategoryMap.get(line.sousCategorieNom) : undefined
        const categoryName = subcategory?.nomCategorie ?? 'non-categorise'

        if (params.nomsCategories?.length && !params.nomsCategories.includes(categoryName)) {
          return
        }

        const categoryItem = categoryMap.get(categoryName) ?? { nom: 'non-categorise', libelle: 'Sans categorie' }
        const categoryKey = categoryItem.nom
        const subcategoryKey = subcategory?.nom ?? 'non-categorise'

        if (!categoryRows.has(categoryKey)) {
          categoryRows.set(categoryKey, {
            categorie: { nom: categoryItem.nom, libelle: categoryItem.libelle ?? null },
            totals: periodTemplate(periods),
            children: [],
          })
        }

        const categoryRow = categoryRows.get(categoryKey)!
        let subcategoryRow = categoryRow.children.find((item) => (item.sousCategorie?.nom ?? 'non-categorise') === subcategoryKey)

        if (!subcategoryRow) {
          subcategoryRow = {
            sousCategorie: subcategory ? { nom: subcategory.nom, libelle: subcategory.libelle ?? null } : null,
            periods: periodTemplate(periods),
          }
          categoryRow.children.push(subcategoryRow)
        }

        const index = bucketIndex(periods, line.date)
        if (index === -1) {
          return
        }

        const bucket = categoryRow.totals[index]
        const subBucket = subcategoryRow.periods[index]
        const amount = centsToEuros(line.montantEnCentimes)
        const detailItem = {
          numero: operation.numero,
          date: line.date,
          libelle: line.libelle,
          montantEnEuros: roundMoney(amount),
          sousCategorieNom: line.sousCategorieNom,
          beneficiaires: line.beneficiaires,
        }

        if (operationCode(operation) === 'RECETTE') {
          bucket.recette += amount
          subBucket.recette += amount
        } else {
          bucket.depense += amount
          subBucket.depense += amount
        }

        bucket.solde = bucket.recette - bucket.depense
        subBucket.solde = subBucket.recette - subBucket.depense
        bucket.details.push(detailItem)
        subBucket.details.push(detailItem)
      })
    })

  const categories = Array.from(categoryRows.values())
    .map((row) => ({
      ...row,
      totals: row.totals.map((item) => ({
        ...item,
        recette: roundMoney(item.recette),
        depense: roundMoney(item.depense),
        solde: roundMoney(item.solde),
      })),
      children: row.children
        .sort((left, right) => (left.sousCategorie?.nom ?? '').localeCompare(right.sousCategorie?.nom ?? ''))
        .map((child) => ({
          ...child,
          periods: child.periods.map((item) => ({
            ...item,
            recette: roundMoney(item.recette),
            depense: roundMoney(item.depense),
            solde: roundMoney(item.solde),
          })),
        })),
    }))
    .sort((left, right) => (left.categorie?.nom ?? '').localeCompare(right.categorie?.nom ?? ''))

  const totals = periodTemplate(periods)
  categories.forEach((category) => {
    category.totals.forEach((period, index) => {
      totals[index].recette += period.recette
      totals[index].depense += period.depense
      totals[index].solde = totals[index].recette - totals[index].depense
      totals[index].details.push(...period.details)
    })
  })

  return {
    periods,
    categories,
    totals: totals.map((item) => ({
      ...item,
      recette: roundMoney(item.recette),
      depense: roundMoney(item.depense),
      solde: roundMoney(item.solde),
    })),
  }
}

export function buildRemunerationsFraisReport(params: {
  operations: OperationBasic[]
  internalAccounts: CompteInterneBasic[]
  dateDebut: string
  dateFin: string
  codeTypePeriode?: MonatisPeriodCode
  accountIds?: string[]
  codesTypes?: string[]
  nomTitulaire?: string | null
}): RemunerationsFraisView {
  const periods = buildPeriodBuckets(params.dateDebut, params.dateFin, params.codeTypePeriode)
  const internalLookup = new Map(params.internalAccounts.map((item) => [item.identifiant, item]))
  const groups = new Map<string, RemunerationsTypeView>()

  params.operations
    .filter((operation) => operationCode(operation).includes('+') || operationCode(operation).includes('-'))
    .filter((operation) => isIsoWithinRange(operation.dateValeur, params.dateDebut, params.dateFin))
    .forEach((operation) => {
      const internalAccountId = internalLookup.has(depenseId(operation))
        ? depenseId(operation)
        : internalLookup.has(recetteId(operation))
          ? recetteId(operation)
          : null

      if (!internalAccountId) {
        return
      }

      const account = internalLookup.get(internalAccountId)!

      if (params.accountIds?.length && !params.accountIds.includes(account.identifiant)) {
        return
      }

      if (params.codesTypes?.length && !params.codesTypes.includes(account.codeTypeFonctionnement)) {
        return
      }

      if (params.nomTitulaire && !account.nomsTitulaires.includes(params.nomTitulaire)) {
        return
      }

      const groupKey = account.codeTypeFonctionnement
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          typeFonctionnement: groupKey,
          periods: periodTemplate(periods),
          accounts: [],
        })
      }

      const group = groups.get(groupKey)!
      let accountRow = group.accounts.find((item) => item.identifiant === account.identifiant)
      if (!accountRow) {
        accountRow = {
          identifiant: account.identifiant,
          libelle: account.libelle,
          banque: account.nomBanque,
          periods: periodTemplate(periods),
        }
        group.accounts.push(accountRow)
      }

      const index = bucketIndex(periods, operation.dateValeur)
      if (index === -1) {
        return
      }

      const amount = centsToEuros(operation.montantEnCentimes)
      const remuneration = operationCode(operation).includes('+') ? amount : 0
      const frais = operationCode(operation).includes('-') ? amount : 0

      group.periods[index].recette += remuneration
      group.periods[index].depense += frais
      group.periods[index].solde = group.periods[index].recette - group.periods[index].depense

      accountRow.periods[index].recette += remuneration
      accountRow.periods[index].depense += frais
      accountRow.periods[index].solde = accountRow.periods[index].recette - accountRow.periods[index].depense
    })

  const normalizedGroups = Array.from(groups.values())
    .map((group) => ({
      ...group,
      periods: group.periods.map((item) => ({
        ...item,
        recette: roundMoney(item.recette),
        depense: roundMoney(item.depense),
        solde: roundMoney(item.solde),
      })),
      accounts: group.accounts
        .sort((left, right) => left.identifiant.localeCompare(right.identifiant))
        .map((account) => ({
          ...account,
          periods: account.periods.map((item) => ({
            ...item,
            recette: roundMoney(item.recette),
            depense: roundMoney(item.depense),
            solde: roundMoney(item.solde),
          })),
        })),
    }))
    .sort((left, right) => left.typeFonctionnement.localeCompare(right.typeFonctionnement))

  const totals = periodTemplate(periods)
  normalizedGroups.forEach((group) => {
    group.periods.forEach((period, index) => {
      totals[index].recette += period.recette
      totals[index].depense += period.depense
      totals[index].solde = totals[index].recette - totals[index].depense
    })
  })

  return {
    periods,
    groups: normalizedGroups,
    totals: totals.map((item) => ({
      ...item,
      recette: roundMoney(item.recette),
      depense: roundMoney(item.depense),
      solde: roundMoney(item.solde),
    })),
  }
}

function computePlusMoinsValuePeriod(params: {
  account: CompteInterneBasic
  operations: OperationBasic[]
  evaluations: EvaluationBasic[]
  period: PeriodBucket
}): PlusMoinsValuePeriodView {
  const { account, operations, evaluations, period } = params
  const initial = computeBalanceAtDate(account, operations, dayBefore(period.start), evaluations)
  const final = computeBalanceAtDate(account, operations, period.end, evaluations)
  const daysInPeriod = daysBetweenInclusive(period.start, period.end)
  const periodOperations = operations
    .filter((operation) => operationAffectsAccount(operation, account.identifiant))
    .filter((operation) => isIsoWithinRange(operation.dateValeur, period.start, period.end))

  const weightedRecettes = periodOperations
    .filter((operation) => recetteId(operation) === account.identifiant)
    .filter((operation) => !operationIsTechnical(operation))
    .reduce((total, operation) => {
      const daysInvested = daysBetweenInclusive(operation.dateValeur, period.end)
      return total + (operation.montantEnCentimes * daysInvested) / daysInPeriod
    }, 0)

  const weightedDepenses = periodOperations
    .filter((operation) => depenseId(operation) === account.identifiant)
    .filter((operation) => !operationIsTechnical(operation))
    .reduce((total, operation) => {
      const daysInvested = daysBetweenInclusive(operation.dateValeur, period.end)
      return total + (operation.montantEnCentimes * daysInvested) / daysInPeriod
    }, 0)

  const initialOpeningInPeriod = account.dateSoldeInitial > period.start && account.dateSoldeInitial <= period.end ? account.montantSoldeInitialEnCentimes ?? 0 : 0
  const operationsAmount = centsToEuros(weightedRecettes + initialOpeningInPeriod - weightedDepenses)
  const startWithOperations = initial + operationsAmount
  const plusMoinsValue = final - startWithOperations
  const technicalFees = periodOperations
    .filter((operation) => depenseId(operation) === account.identifiant)
    .filter((operation) => operationIsTechnical(operation))
    .reduce((total, operation) => total + centsToEuros(operation.montantEnCentimes), 0)

  return {
    start: period.start,
    end: period.end,
    label: period.label,
    montantSoldeInitialEnEuros: roundMoney(initial),
    montantOperationsEnEuros: roundMoney(operationsAmount),
    montantPlusMoinsValueNetteEnEuros: roundMoney(plusMoinsValue),
    tauxPlusMoinsValueNette: roundRate(startWithOperations === 0 ? null : (100 * plusMoinsValue) / startWithOperations),
    montantSoldeFinalEnEuros: roundMoney(final),
    montantFraisEnEuros: roundMoney(technicalFees),
    tauxFrais: roundRate(final === 0 ? null : (100 * technicalFees) / final),
  }
}

function recomputePlusMoinsRates(period: PlusMoinsValuePeriodView): PlusMoinsValuePeriodView {
  const startWithOperations = period.montantSoldeInitialEnEuros + period.montantOperationsEnEuros

  return {
    ...period,
    montantSoldeInitialEnEuros: roundMoney(period.montantSoldeInitialEnEuros),
    montantOperationsEnEuros: roundMoney(period.montantOperationsEnEuros),
    montantPlusMoinsValueNetteEnEuros: roundMoney(period.montantPlusMoinsValueNetteEnEuros),
    tauxPlusMoinsValueNette: roundRate(startWithOperations === 0 ? null : (100 * period.montantPlusMoinsValueNetteEnEuros) / startWithOperations),
    montantSoldeFinalEnEuros: roundMoney(period.montantSoldeFinalEnEuros),
    montantFraisEnEuros: roundMoney(period.montantFraisEnEuros),
    tauxFrais: roundRate(period.montantSoldeFinalEnEuros === 0 ? null : (100 * period.montantFraisEnEuros) / period.montantSoldeFinalEnEuros),
  }
}

export function buildPlusMoinsValueReport(params: {
  operations: OperationBasic[]
  internalAccounts: CompteInterneBasic[]
  evaluations?: EvaluationBasic[]
  dateDebut: string
  dateFin: string
  codeTypePeriode?: MonatisPeriodCode
  accountIds?: string[]
  codesTypes?: string[]
  nomTitulaire?: string | null
}): PlusMoinsValueView {
  const periods = buildPeriodBuckets(params.dateDebut, params.dateFin, params.codeTypePeriode)
  const groups = new Map<string, PlusMoinsValueTypeView>()
  const evaluations = params.evaluations ?? []

  const eligibleAccounts = params.internalAccounts
    .filter((account) => !params.accountIds?.length || params.accountIds.includes(account.identifiant))
    .filter((account) => !params.codesTypes?.length || params.codesTypes.includes(account.codeTypeFonctionnement))
    .filter((account) => !params.nomTitulaire || account.nomsTitulaires.includes(params.nomTitulaire))

  eligibleAccounts.forEach((account) => {
    if (!groups.has(account.codeTypeFonctionnement)) {
      groups.set(account.codeTypeFonctionnement, {
        typeFonctionnement: account.codeTypeFonctionnement,
        periods: plusMoinsValueTemplate(periods),
        accounts: [],
      })
    }

    const accountPeriods = periods.map((period) => computePlusMoinsValuePeriod({ account, operations: params.operations, evaluations, period }))
    const group = groups.get(account.codeTypeFonctionnement)!
    group.accounts.push({
      identifiant: account.identifiant,
      libelle: account.libelle,
      banque: account.nomBanque,
      periods: accountPeriods,
    })

    accountPeriods.forEach((period, index) => {
      group.periods[index].montantSoldeInitialEnEuros += period.montantSoldeInitialEnEuros
      group.periods[index].montantOperationsEnEuros += period.montantOperationsEnEuros
      group.periods[index].montantPlusMoinsValueNetteEnEuros += period.montantPlusMoinsValueNetteEnEuros
      group.periods[index].montantSoldeFinalEnEuros += period.montantSoldeFinalEnEuros
      group.periods[index].montantFraisEnEuros += period.montantFraisEnEuros
    })
  })

  const normalizedGroups = Array.from(groups.values())
    .map((group) => ({
      ...group,
      periods: group.periods.map(recomputePlusMoinsRates),
      accounts: group.accounts
        .sort((left, right) => left.identifiant.localeCompare(right.identifiant))
        .map((account) => ({
          ...account,
          periods: account.periods.map(recomputePlusMoinsRates),
        })),
    }))
    .sort((left, right) => left.typeFonctionnement.localeCompare(right.typeFonctionnement))

  const totals = plusMoinsValueTemplate(periods)
  normalizedGroups.forEach((group) => {
    group.periods.forEach((period, index) => {
      totals[index].montantSoldeInitialEnEuros += period.montantSoldeInitialEnEuros
      totals[index].montantOperationsEnEuros += period.montantOperationsEnEuros
      totals[index].montantPlusMoinsValueNetteEnEuros += period.montantPlusMoinsValueNetteEnEuros
      totals[index].montantSoldeFinalEnEuros += period.montantSoldeFinalEnEuros
      totals[index].montantFraisEnEuros += period.montantFraisEnEuros
    })
  })

  return {
    periods,
    groups: normalizedGroups,
    totals: totals.map(recomputePlusMoinsRates),
  }
}

export function buildBilanPatrimoineReport(params: {
  operations: OperationBasic[]
  internalAccounts: CompteInterneBasic[]
  technicalAccounts: CompteTechniqueBasic[]
  evaluations?: EvaluationBasic[]
  dateDebut: string
  dateFin: string
  codeTypePeriode?: MonatisPeriodCode
  accountIds?: string[]
  codesTypes?: string[]
  nomTitulaire?: string | null
}): BilanPatrimoineView {
  const periods = buildPeriodBuckets(params.dateDebut, params.dateFin, params.codeTypePeriode)
  const groups = new Map<string, BilanTypeView>()

  const eligibleAccounts = params.internalAccounts
    .filter((account) => !params.accountIds?.length || params.accountIds.includes(account.identifiant))
    .filter((account) => !params.codesTypes?.length || params.codesTypes.includes(account.codeTypeFonctionnement))
    .filter((account) => !params.nomTitulaire || account.nomsTitulaires.includes(params.nomTitulaire))

  eligibleAccounts.forEach((account) => {
    if (!groups.has(account.codeTypeFonctionnement)) {
      groups.set(account.codeTypeFonctionnement, {
        typeFonctionnement: account.codeTypeFonctionnement,
        montantSoldeInitialEnEuros: 0,
        periods: bilanTemplate(periods),
        accounts: [],
      })
    }

    const group = groups.get(account.codeTypeFonctionnement)!
    const accountPeriods = periods.map((period) => {
      const periodOperations = params.operations.filter(
        (operation) =>
          operationAffectsAccount(operation, account.identifiant) &&
          isIsoWithinRange(operation.dateValeur, period.start, period.end),
      )

      const initial = computeBalanceAtDate(account, params.operations, dayBefore(period.start), params.evaluations ?? [])
      const final = computeBalanceAtDate(account, params.operations, period.end, params.evaluations ?? [])

      const totalRecette = roundMoney(
        periodOperations
          .filter((operation) => recetteId(operation) === account.identifiant)
          .filter((operation) => !operationIsTechnical(operation))
          .reduce((total, operation) => total + centsToEuros(operation.montantEnCentimes), 0),
      )
      const totalDepense = roundMoney(
        periodOperations
          .filter((operation) => depenseId(operation) === account.identifiant)
          .filter((operation) => !operationIsTechnical(operation))
          .reduce((total, operation) => total + centsToEuros(operation.montantEnCentimes), 0),
      )

      const technical = roundMoney(
        periodOperations.reduce((total, operation) => {
          if (!operationIsTechnical(operation)) {
            return total
          }

          return total + (recetteId(operation) === account.identifiant ? centsToEuros(operation.montantEnCentimes) : -centsToEuros(operation.montantEnCentimes))
        }, 0),
      )

      return {
        start: period.start,
        end: period.end,
        label: period.label,
        montantSoldeInitialEnEuros: roundMoney(initial),
        montantSoldeFinalEnEuros: roundMoney(final),
        montantTotalRecetteEnEuros: totalRecette,
        montantTotalDepenseEnEuros: totalDepense,
        soldeTotalTechniqueEnEuros: technical,
        montantEcartNonJustifieEnEuros: roundMoney(final - (initial + totalRecette - totalDepense + technical)),
      }
    })

    const accountView: BilanAccountView = {
      identifiant: account.identifiant,
      libelle: account.libelle,
      banque: account.nomBanque,
      montantSoldeInitialEnEuros: roundMoney(
        computeBalanceAtDate(account, params.operations, dayBefore(params.dateDebut), params.evaluations ?? []),
      ),
      periods: accountPeriods,
    }

    group.montantSoldeInitialEnEuros += accountView.montantSoldeInitialEnEuros
    group.accounts.push(accountView)
    accountPeriods.forEach((period, index) => {
      group.periods[index].montantSoldeInitialEnEuros += period.montantSoldeInitialEnEuros
      group.periods[index].montantSoldeFinalEnEuros += period.montantSoldeFinalEnEuros
      group.periods[index].montantTotalRecetteEnEuros += period.montantTotalRecetteEnEuros
      group.periods[index].montantTotalDepenseEnEuros += period.montantTotalDepenseEnEuros
      group.periods[index].soldeTotalTechniqueEnEuros += period.soldeTotalTechniqueEnEuros
      group.periods[index].montantEcartNonJustifieEnEuros += period.montantEcartNonJustifieEnEuros
    })
  })

  const normalizedGroups = Array.from(groups.values())
    .map((group) => ({
      ...group,
      montantSoldeInitialEnEuros: roundMoney(group.montantSoldeInitialEnEuros),
      periods: group.periods.map((period) => ({
        ...period,
        montantSoldeInitialEnEuros: roundMoney(period.montantSoldeInitialEnEuros),
        montantSoldeFinalEnEuros: roundMoney(period.montantSoldeFinalEnEuros),
        montantTotalRecetteEnEuros: roundMoney(period.montantTotalRecetteEnEuros),
        montantTotalDepenseEnEuros: roundMoney(period.montantTotalDepenseEnEuros),
        soldeTotalTechniqueEnEuros: roundMoney(period.soldeTotalTechniqueEnEuros),
        montantEcartNonJustifieEnEuros: roundMoney(period.montantEcartNonJustifieEnEuros),
      })),
      accounts: group.accounts.sort((left, right) => left.identifiant.localeCompare(right.identifiant)),
    }))
    .sort((left, right) => left.typeFonctionnement.localeCompare(right.typeFonctionnement))

  const totals = bilanTemplate(periods)
  let montantSoldeInitialEnEuros = 0

  normalizedGroups.forEach((group) => {
    montantSoldeInitialEnEuros += group.montantSoldeInitialEnEuros
    group.periods.forEach((period, index) => {
      totals[index].montantSoldeInitialEnEuros += period.montantSoldeInitialEnEuros
      totals[index].montantSoldeFinalEnEuros += period.montantSoldeFinalEnEuros
      totals[index].montantTotalRecetteEnEuros += period.montantTotalRecetteEnEuros
      totals[index].montantTotalDepenseEnEuros += period.montantTotalDepenseEnEuros
      totals[index].soldeTotalTechniqueEnEuros += period.soldeTotalTechniqueEnEuros
      totals[index].montantEcartNonJustifieEnEuros += period.montantEcartNonJustifieEnEuros
    })
  })

  return {
    periods,
    montantSoldeInitialEnEuros: roundMoney(montantSoldeInitialEnEuros),
    groups: normalizedGroups,
    totals: totals.map((period) => ({
      ...period,
      montantSoldeInitialEnEuros: roundMoney(period.montantSoldeInitialEnEuros),
      montantSoldeFinalEnEuros: roundMoney(period.montantSoldeFinalEnEuros),
      montantTotalRecetteEnEuros: roundMoney(period.montantTotalRecetteEnEuros),
      montantTotalDepenseEnEuros: roundMoney(period.montantTotalDepenseEnEuros),
      soldeTotalTechniqueEnEuros: roundMoney(period.soldeTotalTechniqueEnEuros),
      montantEcartNonJustifieEnEuros: roundMoney(period.montantEcartNonJustifieEnEuros),
    })),
  }
}

export function makeAccountLookupLabel(entry?: AccountLookupEntry): string {
  if (!entry) {
    return 'Compte inconnu'
  }

  const pieces = [entry.identifiant]
  if (entry.libelle) {
    pieces.push(entry.libelle)
  }
  if (entry.codeTypeFonctionnement) {
    pieces.push(entry.codeTypeFonctionnement)
  }
  return pieces.join(' · ')
}

export function describePeriod(period: PeriodBucket): string {
  return `${formatShortDate(period.start)} au ${formatShortDate(period.end)}`
}

export function technicalAccountFallback(technicalAccounts: CompteTechniqueBasic[]): string {
  return technicalAccounts.find((item) => item.identifiant === 'TECH-REMUNERATIONS-FRAIS')?.identifiant ?? 'TECH-REMUNERATIONS-FRAIS'
}

export function sortOperationsDesc(operations: OperationBasic[]): OperationBasic[] {
  return [...operations].sort((left, right) => {
    const dateDelta = right.dateValeur.localeCompare(left.dateValeur)
    if (dateDelta !== 0) {
      return dateDelta
    }

    return right.numero.localeCompare(left.numero)
  })
}

export function latestOperationsForAccount(operations: OperationBasic[], accountId: string, limit = 5): OperationBasic[] {
  return sortOperationsDesc(operations)
    .filter((operation) => operationAffectsAccount(operation, accountId))
    .slice(0, limit)
}

export function readableOperationLabel(operation: OperationBasic): string {
  const title = operation.libelle?.trim()
  if (title) {
    return title
  }

  const lines = normalizeLines(operation)
  if (lines[0]?.libelle) {
    return lines[0].libelle
  }

  return `Operation ${operation.numero}`
}

export function accountOpenedBefore(account: CompteInterneBasic, targetIso: string): boolean {
  return !parseISO(account.dateSoldeInitial) || account.dateSoldeInitial <= targetIso
}
