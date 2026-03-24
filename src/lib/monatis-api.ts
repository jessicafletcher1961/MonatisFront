export type ReferenceResource = 'banque' | 'titulaire' | 'beneficiaire' | 'categorie' | 'souscategorie'

const API_BASE_URL = import.meta.env.VITE_MONATIS_API_URL ?? 'http://localhost:8082'

export interface ApiError {
  typeErreur?: string
  typeDomaine?: string
  code?: string
  libelle?: string
  cause?: ApiError | null
}

export interface ReferenceBase {
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
}

export interface CompteSummary {
  identifiant: string
  libelle: string | null
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

export interface ReferenceDetail extends ReferenceBase {
  comptesInternes?: Array<CompteInterneDetail | CompteInterneBasic | CompteSummary>
  sousCategories?: ReferenceBase[]
  categorie?: ReferenceBase | null
}

export interface EvaluationBasic {
  cle: string
  dateSolde: string
  montantSoldeEnCentimes: number
  libelle: string | null
  identifiantCompteInterne?: string
  compteInterne?: CompteSummary
}

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
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

export const monatisApi = {
  baseUrl: API_BASE_URL,

  listReferences(resource: ReferenceResource) {
    return requestJson<ReferenceListItem[]>(`${referencePaths[resource]}/all`)
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

  listTypeFonctionnements() {
    return requestJson<TypeFonctionnement[]>('/monatis/comptes/interne/typologie/fonctionnement')
  },

  listEvaluations() {
    return requestJson<EvaluationBasic[]>('/monatis/evaluations/all')
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
