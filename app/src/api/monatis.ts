import { fetchBlob, fetchJson } from "./http";
import type {
  BudgetRequestDto,
  BudgetsParReferenceResponseDto,
  CompteInterneRequestDto,
  CompteInterneSimpleResponseDto,
  CompteRequestDto,
  CompteResponseDto,
  EtatPlusMoinsValueRequestDto,
  EtatPlusMoinsValueResponseDto,
  EvaluationBasicResponseDto,
  EvaluationCreationRequestDto,
  EvaluationSimpleResponseDto,
  HistoriquePlusMoinsValueRequestDto,
  HistoriquePlusMoinsValueResponseDto,
  ListeCompteInterneRequestDto,
  ListeResumeCompteInterneParTypeFonctionnementResponseDto,
  OperationBasicResponseDto,
  OperationCreationRequestDto,
  OperationModificationRequestDto,
  OperationRequestDto,
  ReleveCompteRequestDto,
  ReleveCompteResponseDto,
  ReferenceRequestDto,
  ReferenceResponseDto,
  TitulaireSimpleResponseDto,
} from "../types/monatis";

export const monatisApi = {
  getTitulaires: () => fetchJson<ReferenceResponseDto[]>("/references/titulaire/all"),
  getTitulaire: (nom: string) =>
    fetchJson<TitulaireSimpleResponseDto>(`/references/titulaire/get/${encodeURIComponent(nom)}`),
  createTitulaire: (payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>("/references/titulaire/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTitulaire: (nom: string, payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>(`/references/titulaire/mod/${encodeURIComponent(nom)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteTitulaire: (nom: string) =>
    fetchJson<void>(`/references/titulaire/del/${encodeURIComponent(nom)}`, {
      method: "DELETE",
    }),
  getBanques: () => fetchJson<ReferenceResponseDto[]>("/references/banque/all"),
  getBanque: (nom: string) =>
    fetchJson<ReferenceResponseDto>(`/references/banque/get/${encodeURIComponent(nom)}`),
  createBanque: (payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>("/references/banque/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBanque: (nom: string, payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>(`/references/banque/mod/${encodeURIComponent(nom)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteBanque: (nom: string) =>
    fetchJson<void>(`/references/banque/del/${encodeURIComponent(nom)}`, {
      method: "DELETE",
    }),
  getCategories: () => fetchJson<ReferenceResponseDto[]>("/references/categorie/all"),
  getCategorie: (nom: string) =>
    fetchJson<ReferenceResponseDto>(`/references/categorie/get/${encodeURIComponent(nom)}`),
  createCategorie: (payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>("/references/categorie/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategorie: (nom: string, payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>(`/references/categorie/mod/${encodeURIComponent(nom)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCategorie: (nom: string) =>
    fetchJson<void>(`/references/categorie/del/${encodeURIComponent(nom)}`, {
      method: "DELETE",
    }),
  getSousCategories: () => fetchJson<ReferenceResponseDto[]>("/references/souscategorie/all"),
  getSousCategorie: (nom: string) =>
    fetchJson<ReferenceResponseDto>(`/references/souscategorie/get/${encodeURIComponent(nom)}`),
  createSousCategorie: (payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>("/references/souscategorie/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateSousCategorie: (nom: string, payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>(`/references/souscategorie/mod/${encodeURIComponent(nom)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteSousCategorie: (nom: string) =>
    fetchJson<void>(`/references/souscategorie/del/${encodeURIComponent(nom)}`, {
      method: "DELETE",
    }),
  getBeneficiaires: () => fetchJson<ReferenceResponseDto[]>("/references/beneficiaire/all"),
  getBeneficiaire: (nom: string) =>
    fetchJson<ReferenceResponseDto>(`/references/beneficiaire/get/${encodeURIComponent(nom)}`),
  createBeneficiaire: (payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>("/references/beneficiaire/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBeneficiaire: (nom: string, payload: ReferenceRequestDto) =>
    fetchJson<ReferenceResponseDto>(`/references/beneficiaire/mod/${encodeURIComponent(nom)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteBeneficiaire: (nom: string) =>
    fetchJson<void>(`/references/beneficiaire/del/${encodeURIComponent(nom)}`, {
      method: "DELETE",
    }),
  getComptesInternes: () => fetchJson<CompteInterneSimpleResponseDto[]>("/comptes/interne/all"),
  getCompteInterne: (identifiant: string) =>
    fetchJson<CompteInterneSimpleResponseDto>(
      `/comptes/interne/get/${encodeURIComponent(identifiant)}`
    ),
  createCompteInterne: (payload: CompteInterneRequestDto) =>
    fetchJson<CompteInterneSimpleResponseDto>("/comptes/interne/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCompteInterne: (identifiant: string, payload: CompteInterneRequestDto) =>
    fetchJson<CompteInterneSimpleResponseDto>(
      `/comptes/interne/mod/${encodeURIComponent(identifiant)}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    ),
  deleteCompteInterne: (identifiant: string) =>
    fetchJson<void>(`/comptes/interne/del/${encodeURIComponent(identifiant)}`, {
      method: "DELETE",
    }),
  getComptesExternes: () => fetchJson<CompteResponseDto[]>("/comptes/externe/all"),
  getCompteExterne: (identifiant: string) =>
    fetchJson<CompteResponseDto>(`/comptes/externe/get/${encodeURIComponent(identifiant)}`),
  createCompteExterne: (payload: CompteRequestDto) =>
    fetchJson<CompteResponseDto>("/comptes/externe/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCompteExterne: (identifiant: string, payload: CompteRequestDto) =>
    fetchJson<CompteResponseDto>(`/comptes/externe/mod/${encodeURIComponent(identifiant)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCompteExterne: (identifiant: string) =>
    fetchJson<void>(`/comptes/externe/del/${encodeURIComponent(identifiant)}`, {
      method: "DELETE",
    }),
  getComptesTechniques: () => fetchJson<CompteResponseDto[]>("/comptes/technique/all"),
  getCompteTechnique: (identifiant: string) =>
    fetchJson<CompteResponseDto>(`/comptes/technique/get/${encodeURIComponent(identifiant)}`),
  createCompteTechnique: (payload: CompteRequestDto) =>
    fetchJson<CompteResponseDto>("/comptes/technique/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCompteTechnique: (identifiant: string, payload: CompteRequestDto) =>
    fetchJson<CompteResponseDto>(`/comptes/technique/mod/${encodeURIComponent(identifiant)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteCompteTechnique: (identifiant: string) =>
    fetchJson<void>(`/comptes/technique/del/${encodeURIComponent(identifiant)}`, {
      method: "DELETE",
    }),
  getOperations: () => fetchJson<OperationBasicResponseDto[]>("/operations/all"),
  getOperation: (numero: string) =>
    fetchJson<OperationBasicResponseDto>(`/operations/get/${encodeURIComponent(numero)}`),
  createOperation: (payload: OperationCreationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateOperation: (numero: string, payload: OperationModificationRequestDto) =>
    fetchJson<OperationBasicResponseDto>(`/operations/mod/${encodeURIComponent(numero)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteOperation: (numero: string) =>
    fetchJson<void>(`/operations/del/${encodeURIComponent(numero)}`, {
      method: "DELETE",
    }),
  createOperationTransfert: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/transfert", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationDepense: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/depense", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationRecette: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/recette", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationVente: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/vente", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationAchat: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/achat", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationRetrait: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/retrait", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationLiquidation: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/liquidation", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationDepot: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/depot", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createOperationInvestissement: (payload: OperationRequestDto) =>
    fetchJson<OperationBasicResponseDto>("/operations/investissement", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getCompteInterneByIds: (ids: string[]) =>
    Promise.all(ids.map((id) => monatisApi.getCompteInterne(id))) as Promise<
      CompteResponseDto[]
    >,
  getEvaluations: () => fetchJson<EvaluationBasicResponseDto[]>("/evaluations/all"),
  getEvaluation: (cle: string) =>
    fetchJson<EvaluationSimpleResponseDto>(`/evaluations/get/${encodeURIComponent(cle)}`),
  createEvaluation: (payload: EvaluationCreationRequestDto) =>
    fetchJson<EvaluationSimpleResponseDto>("/evaluations/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateEvaluation: (cle: string, payload: EvaluationCreationRequestDto) =>
    fetchJson<EvaluationSimpleResponseDto>(`/evaluations/mod/${encodeURIComponent(cle)}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteEvaluation: (cle: string) =>
    fetchJson<void>(`/evaluations/del/${encodeURIComponent(cle)}`, {
      method: "DELETE",
    }),
  getBudgetsCategorie: () =>
    fetchJson<BudgetsParReferenceResponseDto[]>("/budgets/categorie/all"),
  getBudgetsSousCategorie: () =>
    fetchJson<BudgetsParReferenceResponseDto[]>("/budgets/souscategorie/all"),
  getBudgetsBeneficiaire: () =>
    fetchJson<BudgetsParReferenceResponseDto[]>("/budgets/beneficiaire/all"),
  createBudgetCategorie: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/categorie/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createBudgetSousCategorie: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/souscategorie/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createBudgetBeneficiaire: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/beneficiaire/new", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reconduireBudgetCategorie: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/categorie/next", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reconduireBudgetSousCategorie: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/souscategorie/next", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reconduireBudgetBeneficiaire: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/beneficiaire/next", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateBudgetCategorie: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/categorie/mod", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateBudgetSousCategorie: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/souscategorie/mod", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateBudgetBeneficiaire: (payload: BudgetRequestDto) =>
    fetchJson<BudgetsParReferenceResponseDto>("/budgets/beneficiaire/mod", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteBudgetCategorie: (payload: BudgetRequestDto) =>
    fetchJson<void>("/budgets/categorie/del", {
      method: "DELETE",
      body: JSON.stringify(payload),
    }),
  deleteBudgetSousCategorie: (payload: BudgetRequestDto) =>
    fetchJson<void>("/budgets/souscategorie/del", {
      method: "DELETE",
      body: JSON.stringify(payload),
    }),
  deleteBudgetBeneficiaire: (payload: BudgetRequestDto) =>
    fetchJson<void>("/budgets/beneficiaire/del", {
      method: "DELETE",
      body: JSON.stringify(payload),
    }),
  getReleveCompte: (payload: ReleveCompteRequestDto) =>
    fetchJson<ReleveCompteResponseDto>("/rapports/releve_compte", {
      method: "GET",
      body: JSON.stringify(payload),
    }),
  getReleveComptePdf: (payload: ReleveCompteRequestDto) =>
    fetchBlob("/rapports/releve_compte/pdf", {
      method: "GET",
      body: JSON.stringify(payload),
      headers: { Accept: "application/pdf" },
    }),
  getHistoriquePlusMoinsValue: (payload: HistoriquePlusMoinsValueRequestDto) =>
    fetchJson<HistoriquePlusMoinsValueResponseDto>("/rapports/plus_moins_value/historique", {
      method: "GET",
      body: JSON.stringify(payload),
    }),
  getEtatPlusMoinsValue: (payload: EtatPlusMoinsValueRequestDto) =>
    fetchJson<EtatPlusMoinsValueResponseDto[]>("/rapports/plus_moins_value/etat", {
      method: "GET",
      body: JSON.stringify(payload),
    }),
  getResumeComptesInternes: (payload: ListeCompteInterneRequestDto) =>
    fetchJson<ListeResumeCompteInterneParTypeFonctionnementResponseDto[]>(
      "/rapports/resumes_comptes_internes",
      {
        method: "GET",
        body: JSON.stringify(payload),
      }
    ),
  getCsvTypeOperation: () =>
    fetchBlob("/csv/type/operation", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvOperationsTypes: () =>
    fetchBlob("/csv/operations/types", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvOperationsErreurs: () =>
    fetchBlob("/csv/operations/erreurs", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvComptesTypes: () =>
    fetchBlob("/csv/comptes/types", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvComptesErreurs: () =>
    fetchBlob("/csv/comptes/erreurs", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvComptesTables: () =>
    fetchBlob("/csv/comptes/tables", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvBudgetsTypes: () =>
    fetchBlob("/csv/budgets/types", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvBudgetsErreurs: () =>
    fetchBlob("/csv/budgets/erreurs", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  getCsvBudgetsTables: () =>
    fetchBlob("/csv/budgets/tables", {
      method: "GET",
      headers: { Accept: "text/csv" },
    }),
  adminInitBasic: () =>
    fetchJson<void>("/admin/init/basic", {
      method: "GET",
    }),
  adminDeleteAll: () =>
    fetchJson<void>("/admin/delete/all", {
      method: "GET",
    }),
  adminSave: () =>
    fetchJson<void>("/admin/save", {
      method: "GET",
    }),
};
