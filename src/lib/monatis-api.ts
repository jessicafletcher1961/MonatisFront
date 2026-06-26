export type ReferenceResource = 'banque' | 'titulaire' | 'beneficiaire' | 'categorie' | 'souscategorie'
export type BudgetResource = 'beneficiaire' | 'categorie' | 'souscategorie'
export type TypologyResource = 'fonctionnement' | 'compte' | 'operation' | 'periode' | 'budget' | 'programmation' | 'reference'
export type CsvExportKey =
  | 'comptes-types'
  | 'comptes-erreurs'
  | 'comptes-tables'
  | 'operations-types'
  | 'operations-erreurs'
  | 'budgets-types'
  | 'budgets-erreurs'
  | 'budgets-tables'
  | 'type-operation'

const API_BASE_URL = import.meta.env.VITE_MONATIS_API_URL ?? 'http://localhost:8082'

export interface ApiError {
  typeErreur?: string
  typeDomaine?: string
  code?: string
  libelle?: string
  cause?: ApiError | null
}

export interface ReferenceBase {
  id?: number
  nom: string
  libelle: string | null
}

export interface ReferenceListItem extends ReferenceBase {
  identifiantsComptesInternes?: string[]
  nomsSousCategories?: string[]
  nomCategorie?: string
}

export interface TypeFonctionnement {
  code: string
  libelle: string
}

export interface TypeOperation {
  name: string
  code: string
  libelleCourt: string
  libelle: string
  fluxTechnique?: boolean
  categorisable?: boolean
}

export interface CompteSummary {
  id?: number
  identifiant: string
  libelle: string | null
  codeTypeFonctionnement?: string
}

export interface CompteInterneBasic extends CompteSummary {
  dateCloture: string | null
  codeTypeFonctionnement: string
  dateSoldeInitial: string
  montantSoldeInitialEnCentimes: number
  nomBanque: string | null
  nomsTitulaires: string[]
}

export interface CompteInterneDetail extends CompteSummary {
  dateCloture: string | null
  typeFonctionnement: TypeFonctionnement
  dateSoldeInitial: string
  montantSoldeInitialEnCentimes: number
  banque: ReferenceBase | null
  titulaires: ReferenceBase[]
}

export type CompteExterneBasic = CompteSummary

export type CompteTechniqueBasic = CompteSummary

export type CompteTechniqueDetail = CompteSummary

export interface ComptePageRequest {
  numeroPage?: number
  taillePage?: number
  recherche?: string | null
  codesTypeFonctionnement?: string[] | null
  nomsTitulaires?: string[] | null
}

export interface ComptePageResponse<T extends CompteSummary> {
  comptes: T[]
  numeroPage: number
  taillePage: number
  totalComptes: number
  totalPages: number
  premierElement: number
  dernierElement: number
}

export interface ReferenceDetail extends ReferenceBase {
  comptesInternes?: Array<CompteInterneDetail | CompteInterneBasic | CompteSummary>
  sousCategories?: ReferenceBase[]
  categorie?: ReferenceBase | null
}

export interface ReferencePageRequest {
  numeroPage?: number
  taillePage?: number
  recherche?: string | null
}

export interface ReferencePageResponse {
  references: ReferenceListItem[]
  numeroPage: number
  taillePage: number
  totalReferences: number
  totalPages: number
  premierElement: number
  dernierElement: number
}

export interface EvaluationBasic {
  cle: string
  dateSolde: string
  montantSoldeEnCentimes: number
  libelle: string | null
  identifiantCompteInterne?: string
  compteInterne?: CompteSummary
}

export type EvaluationDetail = EvaluationBasic

export interface OperationLineBasic {
  numeroLigne: number
  dateComptabilisation: string
  montantEnCentimes: number
  libelle: string | null
  nomSousCategorie?: string | null
  nomsBeneficiaires?: string[]
  sousCategorie?: ReferenceBase | null
  beneficiaires?: ReferenceBase[]
}

export interface OperationBasic {
  numero: string
  libelle: string | null
  dateValeur: string
  dateCreation?: string | null
  montantEnCentimes: number
  pointee: boolean
  codeTypeOperation?: string
  identifiantCompteDepense?: string
  identifiantCompteRecette?: string
  typeOperation?: TypeOperation
  compteRecette?: CompteSummary
  compteDepense?: CompteSummary
  lignes: OperationLineBasic[]
}

export interface CompatibilitesResponse {
  comptesCompatiblesDepense?: CompteSummary[] | null
  comptesCompatiblesRecette?: CompteSummary[] | null
  typesOperationsCompatiblesDepense?: TypeOperation[] | null
  typesOperationsCompatiblesRecette?: TypeOperation[] | null
}

export interface ReferencePayload {
  nom: string
  libelle: string | null
}

export interface SousCategoriePayload extends ReferencePayload {
  nomCategorie: string
}

export interface CompteExternePayload {
  identifiant: string
  libelle: string | null
}

export type CompteTechniquePayload = CompteExternePayload

export interface CompteInternePayload {
  identifiant: string
  libelle: string | null
  dateCloture: string | null
  codeTypeFonctionnement: string
  dateSoldeInitial: string | null
  montantSoldeInitialEnCentimes: number | null
  nomBanque: string | null
  nomsTitulaires: string[]
}

export interface EvaluationPayload {
  cle: string | null
  identifiantCompteInterne: string | null
  dateSolde: string | null
  libelle: string | null
  montantSoldeEnCentimes: number | null
}

export interface EvaluationSelectionPayload {
  cleContient?: string | null
  libelleContient?: string | null
  identifiantCompteInterne?: string | null
  avantLe?: string | null
}

export interface OperationLinePayload {
  numeroLigne?: number | null
  libelle: string | null
  dateComptabilisation: string | null
  montantEnCentimes: number | null
  nomSousCategorie: string | null
  nomsBeneficiaires: string[]
}

export interface OperationCreatePayload {
  numero: string | null
  libelle: string | null
  codeTypeOperation: string
  dateValeur: string | null
  montantEnCentimes: number
  identifiantCompteDepense: string
  identifiantCompteRecette: string
  nomSousCategorie: string | null
  nomsBeneficiaires: string[]
}

export interface OperationUpdatePayload {
  numero: string | null
  libelle: string | null
  codeTypeOperation: string | null
  dateValeur: string | null
  montantEnCentimes: number | null
  identifiantCompteDepense: string | null
  identifiantCompteRecette: string | null
  pointee: boolean | null
  lignes: OperationLinePayload[]
}

export interface OperationPageRequest {
  numeroPage?: number
  taillePage?: number
  recherche?: string | null
  numeroContient?: string | null
  libelleContient?: string | null
  dateCreationApproximative?: string | null
  dateValeurDepuisLe?: string | null
  dateValeurJusqueAu?: string | null
  identifiantCompte1?: string | null
  identifiantCompte2?: string | null
  pointee?: boolean | null
  montantEnCentimesPlancher?: number | null
  montantEnCentimesPlafond?: number | null
  nomsSousCategories?: string[] | null
  nomsBeneficiaires?: string[] | null
  codesTypeOperation?: string[] | null
  compte1Id?: number | null
  compte2Id?: number | null
  sousCategoriesIds?: number[] | null
  beneficiairesIds?: number[] | null
}

export interface OperationExampleRequest {
  numeroPage?: number | null
  taillePage?: number | null
  libelle?: string | null
  identifiantCompteRecette?: string | null
  identifiantCompteDepense?: string | null
  codeTypeOperation?: string | null
  dateValeur?: string | null
  montantEnCentimes?: number | null
}

export interface OperationPageResponse {
  operations: OperationBasic[]
  numeroPage: number
  taillePage: number
  totalOperations: number
  totalPages: number
  premierElement: number
  dernierElement: number
}

export interface Typology {
  code: string
  libelle: string
  libelleCourt?: string
  fluxTechnique?: boolean
  categorisable?: boolean
}

export interface BudgetPayload {
  cle: string | null
  nomReference: string | null
  codeTypePeriode: string | null
  dateCible: string | null
  codeTypeBudget: string | null
  montantBudgetEnCentimes: number | null
  libelle: string | null
}

export interface BudgetSelectionPayload {
  cleContient?: string | null
  libelleContient?: string | null
  nomReference?: string | null
  avantLe?: string | null
  apresLe?: string | null
  dateCible?: string | null
  codeTypeBudget?: string | null
}

export interface BudgetDetail {
  id?: number
  cle: string
  libelle: string | null
  reference: ReferenceBase | null
  typePeriode: Typology | null
  dateDebut: string
  dateFin: string
  codeTypeBudget?: Typology | null
  typeBudget?: Typology | null
  montantBudgetEnCentimes: number
}

export interface LoanConditionPayload {
  libelle: string | null
  tauxAnnuel: number | null
  capitalEmprunteEnCentimes: number | null
  duree: number | null
  codeTypePeriodeEcheances: string | null
  numeroPremiereEcheance: number | null
  datePremiereEcheance: string | null
  montantTotalEcheanceEnCentimes: number | null
  montantFraisFixesEcheanceEnCentimes: number | null
}

export interface LoanCreatePayload {
  cle: string | null
  libelle: string | null
  identifiantCompteInterne: string | null
  conditionEmpruntInitiale: LoanConditionPayload
}

export interface LoanUpdatePayload {
  cle: string | null
  libelle: string | null
  identifiantCompteInterne: string | null
  conditionsEmprunt: LoanConditionPayload[]
}

export interface LoanCondition {
  libelle: string | null
  tauxAnnuel: number
  capitalEmprunteEnCentimes: number
  duree: number
  typePeriodeEcheances?: Typology | null
  codeTypePeriodeEcheances?: string | null
  numeroPremiereEcheance: number
  datePremiereEcheance: string
  montantTotalEcheanceEnCentimes: number
  montantFraisFixesEcheanceEnCentimes: number
  echeances?: LoanPayment[]
}

export interface LoanBasic {
  cle: string
  libelle: string | null
  identifiantCompteInterne: string | null
  conditionEmpruntInitiale: LoanCondition | null
  revisions: LoanCondition[]
}

export interface LoanDetail {
  cle: string
  libelle: string | null
  compteInterne: CompteSummary | null
  identifiantCompteInterne?: string | null
  conditionEmpruntInitiale: LoanCondition | null
  revisions: LoanCondition[]
}

export interface LoanPayment {
  numero: number
  date: string
  montantPaiementEnCentimes: number
  partCapitalEnCentimes: number
  partInteretEnCentimes: number
  partFraisFixesEnCentimes: number
  capitalEmprunteRestantDuEnCentimes: number
  capitalEmprunteDejaRembourseEnCentimes: number
  operationPaiement?: OperationBasic | null
  operationPartInterets?: OperationBasic | null
  operationPartFraisFixes?: OperationBasic | null
}

export interface AdminBackup {
  nom: string
  date: string
}

export interface ReportTypology {
  code: string
  libelle: string
}

export interface ReportReference {
  nom: string
  libelle: string | null
}

export interface ReportAccountHeader {
  identifiantCompte?: string
  libelleCompte?: string | null
  codeTypeCompte?: string
  libelleTypeCompte?: string
  codeTypeFonctionnement?: string
  libelleBanque?: string | null
  libellesTitulaires?: string[] | null
  dateSoldeInitial?: string
  montantSoldeInitialEnEuros?: number
}

export interface ReportReleveCompteOperation {
  numero: string
  codeTypeOperation: string
  dateValeur: string
  dateComptabilisation: string | null
  libelle: string | null
  montantEnEuros: number
  identifiantAutreCompte: string
  libelleAutreCompte: string | null
  codeTypeAutreCompte: string
}

export interface ReportReleveCompteResponse {
  enteteCompte: ReportAccountHeader
  dateDebutReleve: string
  dateFinReleve: string
  montantSoldeDebutReleveEnEuros: number
  montantSoldeFinReleveEnEuros: number
  montantTotalOperationsRecetteEnEuros: number
  montantTotalOperationsDepenseEnEuros: number
  montantEcartEnEuros: number
  operationsRecette: ReportReleveCompteOperation[]
  operationsDepense: ReportReleveCompteOperation[]
  numeroPageOperationsRecette?: number | null
  taillePageOperationsRecette?: number | null
  totalOperationsRecette?: number | null
  totalPagesOperationsRecette?: number | null
  premierElementOperationsRecette?: number | null
  dernierElementOperationsRecette?: number | null
  numeroPageOperationsDepense?: number | null
  taillePageOperationsDepense?: number | null
  totalOperationsDepense?: number | null
  totalPagesOperationsDepense?: number | null
  premierElementOperationsDepense?: number | null
  dernierElementOperationsDepense?: number | null
}

export interface ReportResumeCompteInterneResponse {
  compteInterne: ReportAccountHeader
  dateSolde: string
  montantSoldeEnEuros: number
}

export interface ReportPeriodDepenseRecette {
  dateDebutPeriode: string
  dateFinPeriode: string
  montantRecetteEnEuros: number
  montantDepenseEnEuros: number
  soldeDepenseRecetteEnEuros: number
}

export interface ReportDepenseRecetteSousCategorieLine {
  sousCategorie: ReportReference
  periodes: ReportPeriodDepenseRecette[]
}

export interface ReportDepenseRecetteCategorieLine {
  categorie: ReportReference
  lignesSousCategorie: ReportDepenseRecetteSousCategorieLine[]
  cumuls: ReportPeriodDepenseRecette[]
}

export interface ReportDepenseRecetteResponse {
  dateDebutEtat: string
  dateFinEtat: string
  typePeriode: ReportTypology
  sousCategories: ReportReference[]
  categories: ReportReference[]
  beneficiaire: ReportReference
  lignesCategorie: ReportDepenseRecetteCategorieLine[]
  cumuls: ReportPeriodDepenseRecette[]
}

export interface ReportPeriodRemunerationsFrais {
  dateDebutPeriode: string
  dateFinPeriode: string
  montantRemunerationsEnEuros: number
  montantFraisEnEuros: number
  soldeRemunerationsFraisEnEuros: number
}

export interface ReportRemunerationsFraisCompteLine {
  compteInterne: ReportAccountHeader
  periodes: ReportPeriodRemunerationsFrais[]
}

export interface ReportRemunerationsFraisTypeLine {
  typeFonctionnement: ReportTypology
  lignesCompteInterne: ReportRemunerationsFraisCompteLine[]
  cumulsPeriodes: ReportPeriodRemunerationsFrais[]
}

export interface ReportRemunerationsFraisResponse {
  dateDebutEtat: string
  dateFinEtat: string
  typePeriode: ReportTypology
  comptesInternes: ReportAccountHeader[]
  typesFonctionnements: ReportTypology[]
  titulaire: ReportReference
  lignesTypeFonctionnement: ReportRemunerationsFraisTypeLine[]
  cumuls: ReportPeriodRemunerationsFrais[]
}

export interface ReportPeriodBilan {
  dateDebutPeriode: string
  dateFinPeriode: string
  montantSoldeInitialEnEuros?: number
  montantSoldeFinalEnEuros: number
  montantTotalRecetteEnEuros: number
  montantTotalDepenseEnEuros: number
  soldeTotalTechniqueEnEuros: number
  montantEcartNonJustifieEnEuros: number
}

export interface ReportBilanCompteLine {
  compteInterne: ReportAccountHeader
  montantSoldeInitialEnEuros: number
  periodes: ReportPeriodBilan[]
}

export interface ReportBilanTypeLine {
  typeFonctionnement: ReportTypology
  lignesCompteInterne: ReportBilanCompteLine[]
  montantSoldeInitialEnEuros: number
  cumulsPeriodes: ReportPeriodBilan[]
}

export interface ReportBilanPatrimoineResponse {
  dateDebutEtat: string
  dateFinEtat: string
  typePeriode: ReportTypology
  comptesInternes: ReportAccountHeader[]
  typesFonctionnements: ReportTypology[]
  titulaire: ReportReference
  lignesTypeFonctionnement: ReportBilanTypeLine[]
  montantSoldeInitialEnEuros: number
  cumuls: ReportPeriodBilan[]
}

export type ImportRuleRole = 'DEPENSE' | 'RECETTE'

export interface StatementImportRule {
  id: number
  cleLibelleNormalisee: string
  libelleExemple: string | null
  roleCompteExterne: ImportRuleRole
  codeTypeOperation: string
  compteInterneContexteId: number | null
  identifiantCompteInterneContexte: string | null
  libelleCompteInterneContexte: string | null
  compteExterneId: number | null
  identifiantCompteExterne: string | null
  libelleCompteExterne: string | null
  sousCategorieId: number | null
  nomSousCategorie: string | null
  libelleSousCategorie: string | null
  beneficiaireIds: number[]
  nomsBeneficiaires: string[]
  nombreUtilisations: number
  dateDerniereUtilisation: string | null
  active: boolean
}

export interface StatementImportRuleSuggestionOperationRequest {
  operationImportId: string
  libelle: string
  groupKey: string
  roleCompteExterne: ImportRuleRole
  compteInterneContexteId?: number | null
  identifiantCompteInterneContexte?: string | null
}

export interface StatementImportRuleSuggestionRequest {
  operations: StatementImportRuleSuggestionOperationRequest[]
}

export interface StatementImportRuleSuggestionOperationResponse {
  index: number
  operationImportId: string
  cleLibelleNormalisee: string | null
  suggestionTrouvee: boolean
  regle: StatementImportRule | null
}

export interface StatementImportRuleSuggestionResponse {
  operations: StatementImportRuleSuggestionOperationResponse[]
}

export interface StatementImportRuleLearningItemRequest {
  libelle: string
  groupKey: string
  roleCompteExterne: ImportRuleRole
  codeTypeOperation: string
  compteInterneContexteId?: number | null
  identifiantCompteInterneContexte?: string | null
  compteExterneId?: number | null
  identifiantCompteExterne?: string | null
  sousCategorieId?: number | null
  nomSousCategorie?: string | null
  beneficiaireIds?: number[]
  nomsBeneficiaires?: string[]
}

export interface StatementImportRuleLearningRequest {
  operations: StatementImportRuleLearningItemRequest[]
}

export type StatementImportDuplicateStatus = 'NOUVELLE' | 'DOUBLON_PROBABLE' | 'DOUBLON_EXACT'

export interface StatementImportDuplicateOperationRequest {
  operationImportId: string
  libelle: string
  dateValeur: string | null
  dateComptabilisation: string | null
  montantEnCentimes: number | null
  codeTypeOperation: string
  identifiantCompteDepense: string
  identifiantCompteRecette: string
}

export interface StatementImportDuplicateRequest {
  operations: StatementImportDuplicateOperationRequest[]
}

export interface StatementImportDuplicateExistingOperation {
  numero: string
  libelle: string | null
  dateValeur: string | null
  dateComptabilisation: string | null
  dateCreation?: string | null
  montantEnCentimes: number | null
  codeTypeOperation: string | null
  identifiantCompteDepense: string | null
  libelleCompteDepense: string | null
  identifiantCompteRecette: string | null
  libelleCompteRecette: string | null
}

export interface StatementImportDuplicateOperationResponse {
  index: number
  operationImportId: string
  statut: StatementImportDuplicateStatus
  score: number
  raisons: string[]
  operationExistante: StatementImportDuplicateExistingOperation | null
}

export interface StatementImportDuplicateResponse {
  operations: StatementImportDuplicateOperationResponse[]
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    return (await response.json()) as ApiError
  } catch {
    return {
      libelle: `Erreur HTTP ${response.status}`,
      code: String(response.status),
    }
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...init,
  })

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

const referencePaths: Record<ReferenceResource, string> = {
  banque: '/monatis/references/banque',
  titulaire: '/monatis/references/titulaire',
  beneficiaire: '/monatis/references/beneficiaire',
  categorie: '/monatis/references/categorie',
  souscategorie: '/monatis/references/souscategorie',
}

const budgetPaths: Record<BudgetResource, string> = {
  beneficiaire: '/monatis/budgets/beneficiaire',
  categorie: '/monatis/budgets/categorie',
  souscategorie: '/monatis/budgets/souscategorie',
}

const typologyPaths: Record<TypologyResource, string> = {
  fonctionnement: '/monatis/typologies/fonctionnement',
  compte: '/monatis/typologies/compte',
  operation: '/monatis/typologies/operation',
  periode: '/monatis/typologies/periode',
  budget: '/monatis/typologies/budget',
  programmation: '/monatis/typologies/programmation',
  reference: '/monatis/typologies/reference',
}

const csvPaths: Record<CsvExportKey, string> = {
  'comptes-types': '/monatis/csv/comptes/types',
  'comptes-erreurs': '/monatis/csv/comptes/erreurs',
  'comptes-tables': '/monatis/csv/comptes/tables',
  'operations-types': '/monatis/csv/operations/types',
  'operations-erreurs': '/monatis/csv/operations/erreurs',
  'budgets-types': '/monatis/csv/budgets/types',
  'budgets-erreurs': '/monatis/csv/budgets/erreurs',
  'budgets-tables': '/monatis/csv/budgets/tables',
  'type-operation': '/monatis/csv/type/operation',
}

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
}

function normalizeNeedle(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function matchesSearch(values: unknown[], search: string | null | undefined): boolean {
  const needle = normalizeNeedle(search)
  if (!needle) {
    return true
  }

  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value) => value != null)
    .some((value) => String(value).toLowerCase().includes(needle))
}

function pageWindow(totalItems: number, numeroPage?: number, taillePage?: number) {
  const page = Math.max(1, numeroPage ?? 1)
  const size = Math.max(1, taillePage ?? (totalItems || 1))
  const totalPages = totalItems ? Math.ceil(totalItems / size) : 0
  const start = (page - 1) * size
  const end = start + size

  return { page, size, totalPages, start, end }
}

function paginateItems<T>(items: T[], numeroPage?: number, taillePage?: number) {
  const totalItems = items.length
  const { page, size, totalPages, start, end } = pageWindow(totalItems, numeroPage, taillePage)
  const pageItems = items.slice(start, end)

  return {
    pageItems,
    page,
    size,
    totalItems,
    totalPages,
    first: pageItems.length ? start + 1 : 0,
    last: pageItems.length ? start + pageItems.length : 0,
  }
}

function buildComptePageResponse<T extends CompteSummary>(items: T[], payload: ComptePageRequest): ComptePageResponse<T> {
  const page = paginateItems(items, payload.numeroPage, payload.taillePage)

  return {
    comptes: page.pageItems,
    numeroPage: page.page,
    taillePage: page.size,
    totalComptes: page.totalItems,
    totalPages: page.totalPages,
    premierElement: page.first,
    dernierElement: page.last,
  }
}

function buildReferencePageResponse(items: ReferenceListItem[], payload: ReferencePageRequest): ReferencePageResponse {
  const page = paginateItems(items, payload.numeroPage, payload.taillePage)

  return {
    references: page.pageItems,
    numeroPage: page.page,
    taillePage: page.size,
    totalReferences: page.totalItems,
    totalPages: page.totalPages,
    premierElement: page.first,
    dernierElement: page.last,
  }
}

export const monatisApi = {
  baseUrl: API_BASE_URL,

  listReferences(resource: ReferenceResource) {
    return requestJson<ReferenceListItem[]>(`${referencePaths[resource]}/all`)
  },

  async listReferencesPage(resource: ReferenceResource, payload: ReferencePageRequest) {
    const references = await requestJson<ReferenceListItem[]>(`${referencePaths[resource]}/all`)
    const filtered = references.filter((item) =>
      matchesSearch([item.nom, item.libelle, item.nomCategorie, item.identifiantsComptesInternes, item.nomsSousCategories], payload.recherche),
    )

    return buildReferencePageResponse(filtered, payload)
  },

  getReference(resource: ReferenceResource, nom: string) {
    return requestJson<ReferenceDetail>(`${referencePaths[resource]}/get/${encodeURIComponent(nom)}`)
  },

  createReference(resource: Exclude<ReferenceResource, 'souscategorie'>, payload: ReferencePayload) {
    return requestJson<ReferenceDetail>(`${referencePaths[resource]}/new`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateReference(resource: Exclude<ReferenceResource, 'souscategorie'>, currentNom: string, payload: ReferencePayload) {
    return requestJson<ReferenceDetail>(`${referencePaths[resource]}/mod/${encodeURIComponent(currentNom)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  createSousCategorie(payload: SousCategoriePayload) {
    return requestJson<ReferenceDetail>('/monatis/references/souscategorie/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateSousCategorie(currentNom: string, payload: SousCategoriePayload) {
    return requestJson<ReferenceDetail>(`/monatis/references/souscategorie/mod/${encodeURIComponent(currentNom)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteReference(resource: ReferenceResource, nom: string) {
    return requestJson<void>(`${referencePaths[resource]}/del/${encodeURIComponent(nom)}`, {
      method: 'DELETE',
    })
  },

  listExternalAccounts() {
    return requestJson<CompteExterneBasic[]>('/monatis/comptes/externe/all')
  },

  async listExternalAccountsPage(payload: ComptePageRequest) {
    const accounts = await requestJson<CompteExterneBasic[]>('/monatis/comptes/externe/all')
    const filtered = accounts.filter((account) => matchesSearch([account.identifiant, account.libelle], payload.recherche))

    return buildComptePageResponse(filtered, payload)
  },

  getExternalAccount(identifiant: string) {
    return requestJson<CompteExterneBasic>(`/monatis/comptes/externe/get/${encodeURIComponent(identifiant)}`)
  },

  createExternalAccount(payload: CompteExternePayload) {
    return requestJson<CompteExterneBasic>('/monatis/comptes/externe/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateExternalAccount(currentIdentifiant: string, payload: CompteExternePayload) {
    return requestJson<CompteExterneBasic>(`/monatis/comptes/externe/mod/${encodeURIComponent(currentIdentifiant)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteExternalAccount(identifiant: string) {
    return requestJson<void>(`/monatis/comptes/externe/del/${encodeURIComponent(identifiant)}`, {
      method: 'DELETE',
    })
  },

  listInternalAccounts() {
    return requestJson<CompteInterneBasic[]>('/monatis/comptes/interne/all')
  },

  async listInternalAccountsPage(payload: ComptePageRequest) {
    const accounts = await requestJson<CompteInterneBasic[]>('/monatis/comptes/interne/all')
    const filtered = accounts
      .filter((account) => matchesSearch([account.identifiant, account.libelle, account.nomBanque, account.nomsTitulaires], payload.recherche))
      .filter((account) => !payload.codesTypeFonctionnement?.length || payload.codesTypeFonctionnement.includes(account.codeTypeFonctionnement))
      .filter((account) => !payload.nomsTitulaires?.length || account.nomsTitulaires.some((nom) => payload.nomsTitulaires?.includes(nom)))

    return buildComptePageResponse(filtered, payload)
  },

  listInternalAccountsByType(codeTypeFonctionnement: string) {
    return requestJson<CompteInterneBasic[]>(`/monatis/comptes/interne/fonctionnement/${encodeURIComponent(codeTypeFonctionnement)}`)
  },

  getInternalAccount(identifiant: string) {
    return requestJson<CompteInterneDetail>(`/monatis/comptes/interne/get/${encodeURIComponent(identifiant)}`)
  },

  createInternalAccount(payload: CompteInternePayload) {
    return requestJson<CompteInterneDetail>('/monatis/comptes/interne/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateInternalAccount(currentIdentifiant: string, payload: CompteInternePayload) {
    return requestJson<CompteInterneDetail>(`/monatis/comptes/interne/mod/${encodeURIComponent(currentIdentifiant)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteInternalAccount(identifiant: string) {
    return requestJson<void>(`/monatis/comptes/interne/del/${encodeURIComponent(identifiant)}`, {
      method: 'DELETE',
    })
  },

  listTechnicalAccounts() {
    return requestJson<CompteTechniqueBasic[]>('/monatis/comptes/technique/all')
  },

  getTechnicalAccount(identifiant: string) {
    return requestJson<CompteTechniqueDetail>(`/monatis/comptes/technique/get/${encodeURIComponent(identifiant)}`)
  },

  createTechnicalAccount(payload: CompteTechniquePayload) {
    return requestJson<CompteTechniqueBasic>('/monatis/comptes/technique/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateTechnicalAccount(currentIdentifiant: string, payload: CompteTechniquePayload) {
    return requestJson<CompteTechniqueDetail>(`/monatis/comptes/technique/mod/${encodeURIComponent(currentIdentifiant)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteTechnicalAccount(identifiant: string) {
    return requestJson<void>(`/monatis/comptes/technique/del/${encodeURIComponent(identifiant)}`, {
      method: 'DELETE',
    })
  },

  listTypeFonctionnements() {
    return requestJson<TypeFonctionnement[]>('/monatis/comptes/interne/typologie/fonctionnement')
  },

  listTypologies(resource: TypologyResource) {
    return requestJson<Typology[]>(typologyPaths[resource])
  },

  listEvaluations() {
    return requestJson<EvaluationBasic[]>('/monatis/evaluations/all')
  },

  getEvaluation(cle: string) {
    return requestJson<EvaluationDetail>(`/monatis/evaluations/get/${encodeURIComponent(cle)}`)
  },

  selectEvaluations(payload: EvaluationSelectionPayload) {
    return requestJson<EvaluationBasic[]>('/monatis/evaluations/selection', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  createEvaluation(payload: EvaluationPayload) {
    return requestJson<EvaluationBasic>('/monatis/evaluations/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateEvaluation(cle: string, payload: EvaluationPayload) {
    return requestJson<EvaluationBasic>(`/monatis/evaluations/mod/${encodeURIComponent(cle)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteEvaluation(cle: string) {
    return requestJson<void>(`/monatis/evaluations/del/${encodeURIComponent(cle)}`, {
      method: 'DELETE',
    })
  },

  listOperations() {
    return requestJson<OperationBasic[]>('/monatis/operations/all')
  },

  listOperationsPage(payload: OperationPageRequest) {
    return requestJson<OperationPageResponse>('/monatis/operations/page', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  listOperationSuggestions(payload: OperationExampleRequest) {
    return requestJson<OperationPageResponse>('/monatis/operations/suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  listOperationDuplicates(payload: OperationExampleRequest) {
    return requestJson<OperationPageResponse>('/monatis/operations/doublons', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  getOperation(numero: string) {
    return requestJson<OperationBasic>(`/monatis/operations/get/${encodeURIComponent(numero)}`)
  },

  listOperationTypes() {
    return requestJson<TypeOperation[]>('/monatis/operations/typologie/operation')
  },

  getOperationCompatibilitiesByType(codeTypeOperation: string) {
    return requestJson<CompatibilitesResponse>(`/monatis/operations/compatibilite/comptes/${encodeURIComponent(codeTypeOperation)}`)
  },

  getOperationCompatibleTypesByAccount(identifiantCompte: string) {
    return requestJson<CompatibilitesResponse>(`/monatis/operations/compatibilite/typesoperations/${encodeURIComponent(identifiantCompte)}`)
  },

  getOperationCompatibleDepenseByRecette(codeTypeOperation: string, identifiantCompteRecette: string) {
    return requestJson<CompatibilitesResponse>(
      `/monatis/operations/compatibilite/comptes/depense/${encodeURIComponent(codeTypeOperation)}/${encodeURIComponent(identifiantCompteRecette)}`,
    )
  },

  getOperationCompatibleRecetteByDepense(codeTypeOperation: string, identifiantCompteDepense: string) {
    return requestJson<CompatibilitesResponse>(
      `/monatis/operations/compatibilite/comptes/recette/${encodeURIComponent(codeTypeOperation)}/${encodeURIComponent(identifiantCompteDepense)}`,
    )
  },

  createOperation(payload: OperationCreatePayload) {
    return requestJson<OperationBasic>('/monatis/operations/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateOperation(numero: string, payload: OperationUpdatePayload) {
    return requestJson<OperationBasic>(`/monatis/operations/mod/${encodeURIComponent(numero)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteOperation(numero: string) {
    return requestJson<void>(`/monatis/operations/del/${encodeURIComponent(numero)}`, {
      method: 'DELETE',
    })
  },

  createOperationsFromCsv(nomFichierCsv: string) {
    return requestJson<OperationBasic[]>(`/monatis/operations/addcsv/${encodeURIComponent(nomFichierCsv)}`)
  },

  listBudgets(resource: BudgetResource) {
    return requestJson<BudgetDetail[]>(`${budgetPaths[resource]}/all`)
  },

  getBudget(resource: BudgetResource, cle: string) {
    return requestJson<BudgetDetail>(`${budgetPaths[resource]}/get/${encodeURIComponent(cle)}`)
  },

  selectBudgets(resource: BudgetResource, payload: BudgetSelectionPayload) {
    return requestJson<BudgetDetail[]>(`${budgetPaths[resource]}/selection`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  createBudget(resource: BudgetResource, payload: BudgetPayload) {
    return requestJson<BudgetDetail>(`${budgetPaths[resource]}/new`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  renewBudget(resource: BudgetResource, cle: string) {
    return requestJson<BudgetDetail>(`${budgetPaths[resource]}/next/${encodeURIComponent(cle)}`, {
      method: 'POST',
    })
  },

  updateBudget(resource: BudgetResource, cle: string, payload: BudgetPayload) {
    return requestJson<BudgetDetail>(`${budgetPaths[resource]}/mod/${encodeURIComponent(cle)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteBudget(resource: BudgetResource, cle: string) {
    return requestJson<void>(`${budgetPaths[resource]}/del/${encodeURIComponent(cle)}`, {
      method: 'DELETE',
    })
  },

  listLoans() {
    return requestJson<LoanBasic[]>('/monatis/emprunts/all')
  },

  getLoan(cle: string) {
    return requestJson<LoanDetail>(`/monatis/emprunts/get/${encodeURIComponent(cle)}`)
  },

  createLoan(payload: LoanCreatePayload) {
    return requestJson<LoanBasic>('/monatis/emprunts/new', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  updateLoan(cle: string, payload: LoanUpdatePayload) {
    return requestJson<LoanBasic>(`/monatis/emprunts/mod/${encodeURIComponent(cle)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  deleteLoan(cle: string) {
    return requestJson<void>(`/monatis/emprunts/del/${encodeURIComponent(cle)}`, {
      method: 'DELETE',
    })
  },

  getLoanPaymentByDate(cle: string, dateEcheance: string) {
    return requestJson<LoanPayment | null>(`/monatis/emprunts/get/${encodeURIComponent(cle)}/date/${encodeURIComponent(dateEcheance)}`)
  },

  getLoanPaymentByNumber(cle: string, numeroEcheance: number) {
    return requestJson<LoanPayment | null>(`/monatis/emprunts/get/${encodeURIComponent(cle)}/numero/${encodeURIComponent(String(numeroEcheance))}`)
  },

  listStatementImportRules() {
    return requestJson<StatementImportRule[]>('/monatis/imports-releves/regles/all')
  },

  suggestStatementImportRules(payload: StatementImportRuleSuggestionRequest) {
    return requestJson<StatementImportRuleSuggestionResponse>('/monatis/imports-releves/regles/suggestions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  learnStatementImportRules(payload: StatementImportRuleLearningRequest) {
    return requestJson<StatementImportRule[]>('/monatis/imports-releves/regles/apprentissage', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  deleteStatementImportRule(id: number) {
    return requestJson<void>(`/monatis/imports-releves/regles/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    })
  },

  detectStatementImportDuplicates(payload: StatementImportDuplicateRequest) {
    return requestJson<StatementImportDuplicateResponse>('/monatis/imports-releves/doublons', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  csvDownloadUrl(key: CsvExportKey) {
    return apiUrl(csvPaths[key])
  },

  listAdminBackups() {
    return requestJson<AdminBackup[]>('/monatis/admin/sauvegarde/show')
  },

  createAdminBackup(nomSauvegarde?: string | null) {
    const suffix = nomSauvegarde?.trim() ? `/${encodeURIComponent(nomSauvegarde.trim())}` : ''
    return requestJson<void>(`/monatis/admin/sauvegarde${suffix}`)
  },

  restoreAdminBackup(nomFichierZip: string) {
    return requestJson<void>(`/monatis/admin/restauration/${encodeURIComponent(nomFichierZip)}`)
  },

  clearDatabase() {
    return requestJson<void>('/monatis/admin/vidange')
  },

  executeAdminScript(nomFichierScript: string) {
    return requestJson<void>(`/monatis/admin/execution/${encodeURIComponent(nomFichierScript)}`)
  },

  exportAdminTable(nomTable: string, nomFichierCsv: string) {
    return requestJson<void>(`/monatis/admin/export/${encodeURIComponent(nomTable)}/${encodeURIComponent(nomFichierCsv)}`)
  },

  importAdminTable(nomFichierCsv: string, nomTable: string) {
    return requestJson<void>(`/monatis/admin/import/${encodeURIComponent(nomFichierCsv)}/${encodeURIComponent(nomTable)}`)
  },
}

export function apiErrorMessage(error: unknown): string {
  if (!error) {
    return 'Une erreur inconnue est survenue.'
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object' && error !== null && 'libelle' in error) {
    return String((error as ApiError).libelle ?? 'Erreur de communication avec MONATIS.')
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Erreur de communication avec MONATIS.'
}
