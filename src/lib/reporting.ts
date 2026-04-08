import { parseISO } from 'date-fns'

import {
  type CompteExterneBasic,
  type CompteInterneBasic,
  type CompteTechniqueBasic,
  type EvaluationBasic,
  type OperationBasic,
  type ReferenceBase,
  type ReferenceListItem,
} from './monatis-api'
import { buildPeriodBuckets, dayBefore, formatShortDate, isIsoWithinRange, type MonatisPeriodCode, type PeriodBucket } from './format'

export interface ReleveRow {
  numero: string
  codeTypeOperation: string
  dateValeur: string
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

export function computeBalanceAtDate(
  account: CompteInterneBasic,
  operations: OperationBasic[],
  targetDate: string,
  evaluations: EvaluationBasic[] = [],
): number {
  let balance = account.montantSoldeInitialEnCentimes ?? 0
  let referenceDate = account.dateSoldeInitial

  const latestEvaluation = latestEvaluationAtDate(account.identifiant, evaluations, targetDate)
  if (latestEvaluation && latestEvaluation.dateSolde >= referenceDate) {
    balance = latestEvaluation.montantSoldeEnCentimes
    referenceDate = latestEvaluation.dateSolde
  }

  if (targetDate < referenceDate) {
    return centsToEuros(balance)
  }

  operations.forEach((operation) => {
    if (!operationAffectsAccount(operation, account.identifiant)) {
      return
    }

    if (operation.dateValeur <= referenceDate || operation.dateValeur > targetDate) {
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
    .filter((operation) => isIsoWithinRange(operation.dateValeur, start, end))
    .sort((left, right) => left.dateValeur.localeCompare(right.dateValeur) || left.numero.localeCompare(right.numero))
    .forEach((operation) => {
      const isRecette = recetteId(operation) === account.identifiant
      const otherId = isRecette ? depenseId(operation) : recetteId(operation)
      const other = lookup.get(otherId)
      const row: ReleveRow = {
        numero: operation.numero,
        codeTypeOperation: operationCode(operation),
        dateValeur: operation.dateValeur,
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
  const technicalIds = new Set(params.technicalAccounts.map((item) => item.identifiant))
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
          isIsoWithinRange(operation.dateValeur, period.start, period.end) &&
          operation.dateValeur >= account.dateSoldeInitial,
      )

      const initial = computeBalanceAtDate(account, params.operations, dayBefore(period.start), params.evaluations ?? [])
      const final = computeBalanceAtDate(account, params.operations, period.end, params.evaluations ?? [])

      const totalRecette = roundMoney(
        periodOperations
          .filter((operation) => recetteId(operation) === account.identifiant)
          .reduce((total, operation) => total + centsToEuros(operation.montantEnCentimes), 0),
      )
      const totalDepense = roundMoney(
        periodOperations
          .filter((operation) => depenseId(operation) === account.identifiant)
          .reduce((total, operation) => total + centsToEuros(operation.montantEnCentimes), 0),
      )

      const technical = roundMoney(
        periodOperations.reduce((total, operation) => {
          const otherId = recetteId(operation) === account.identifiant ? depenseId(operation) : recetteId(operation)
          if (!technicalIds.has(otherId)) {
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
        montantEcartNonJustifieEnEuros: roundMoney(final - (initial + totalRecette - totalDepense)),
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
