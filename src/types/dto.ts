// Types alignés sur le catalogue DTO du backend Monatis (PDF)
export type ReferenceResponseDto = {
  nom: string;
  libelle: string;
};

export type ReferenceRequestDto = {
  nom: string;
  libelle: string;
};

export type BudgetRequestDto = {
  nomReference: string;
  codeTypePeriode: string;
  dateCible: string; // LocalDate (YYYY-MM-DD)
  montantEnCentimes: number;
};

export type BudgetResponseDto = {
  typePeriode: string;
  dateDebut: string;
  dateFin: string;
  montantEnCentimes: number;
};

export type BudgetsParReferenceResponseDto = {
  reference: ReferenceResponseDto;
  budgets: BudgetResponseDto[];
};

export type CompteResponseDto = {
  identifiant: string;
  libelle: string;
};

export type CompteExterneRequestDto = {
  identifiant: string;
  libelle: string;
};

export type CompteTechniqueRequestDto = {
  identifiant: string;
  libelle: string;
};

export type CompteInterneRequestDto = {
  identifiant: string;
  libelle: string;
  codeTypeFonctionnement: string;
  dateSoldeInitial: string; // LocalDate
  montantSoldeInitialEnCentimes: number;
  nomBanque: string;
  nomsTitulaires: string[];
};

export type TypeOperationResponseDto = {
  code: string;
  libelle: string;
};

export type OperationBaseRequestDto = {
  numeroOperation: string;
  identifiantCompteDepense: string;
  identifiantCompteRecette: string;
  montantOperationEnCentimes: number;
  dateOperation: string; // LocalDate
  libelleOperation: string;
};

export type OperationCompleteRequestDto = OperationBaseRequestDto & {
  nomSousCategorie: string;
  nomsBeneficiaires: string[];
};

export type OperationLigneRequestDto = {
  numeroLigne: number;
  libelle: string;
  dateComptabilisation: string; // LocalDate
  montantEnCentimes: number;
  nomSousCategorie: string;
  nomsBeneficiaires: string[];
};

export type OperationModificationRequestDto = {
  codeTypeOperation: string;
  numero: string;
  libelle: string;
  dateValeur: string; // LocalDate
  montantEnCentimes: number;
  identifiantCompteDepense: string;
  identifiantCompteRecette: string;
  lignes: OperationLigneRequestDto[];
};

export type OperationLigneDetailedResponseDto = {
  numeroLigne: number;
  dateComptabilisation: string;
  montantEnCentimes: number;
  libelle: string;
  sousCategorie: ReferenceResponseDto;
  beneficiaires: ReferenceResponseDto[];
};

export type OperationDetailedResponseDto = {
  numero: string;
  libelle: string;
  typeOperation: TypeOperationResponseDto;
  dateValeur: string;
  montantEnCentimes: number;
  compteRecette: CompteResponseDto;
  compteDepense: CompteResponseDto;
  lignes: OperationLigneDetailedResponseDto[];
};

export type OperationLigneSimpleResponseDto = {
  numeroLigne: number;
  dateComptabilisation: string;
  montantEnCentimes: number;
  libelle: string;
  sousCategorie: ReferenceResponseDto;
  beneficiaires: ReferenceResponseDto[];
};

export type OperationSimpleResponseDto = {
  numero: string;
  libelle: string;
  typeOperation: TypeOperationResponseDto;
  dateValeur: string;
  montantEnCentimes: number;
  compteRecette: CompteResponseDto;
  compteDepense: CompteResponseDto;
  lignes: OperationLigneSimpleResponseDto[];
};

export type EvaluationCreationRequestDto = {
  cle: string;
  identifiantCompteInterne: string;
  dateSolde: string; // LocalDate
  libelle: string;
  montantSoldeEnCentimes: number;
};

export type EvaluationModificationRequestDto = {
  cle: string;
  identifiantCompteInterne: string;
  dateSolde: string;
  montantSoldeEnCentimes: number;
  libelle: string;
};

export type CompteInterneBasicResponseDto = {
  identifiant: string;
  libelle: string;
  codeTypeFonctionnement: string;
  dateSoldeInitial: string;
  montantSoldeInitialEnCentimes: number;
  nomBanque: string;
  nomsTitulaires: string[];
};

export type CompteTechniqueBasicResponseDto = {
  identifiant: string;
  libelle: string;
};

export type OperationBasicResponseDto = {
  numero: string;
  libelle: string;
  codeTypeOperation: string;
  dateValeur: string;
  montantEnCentimes: number;
  identifiantCompteRecette: string;
  identifiantCompteDepense: string;
  lignes: any[];
};

export type EvaluationSimpleResponseDto = {
  cle: string;
  compteInterne: CompteInterneBasicResponseDto;
  compteTechnique: CompteTechniqueBasicResponseDto;
  dateSolde: string;
  libelle: string;
  montantSoldeEnCentimes: number;
  operationPlusMoinsSolde: OperationBasicResponseDto;
};

export type EvaluationDetailedResponseDto = {
  cle: string;
  compteInterne: any;
  compteTechnique: any;
  dateSolde: string;
  libelle: string;
  montantSoldeEnCentimes: number;
  operationPlusMoinsSolde: any;
};

export type EtatPlusMoinsValueRequestDto = {
  codeTypePeriode: string;
  dateCible: string; // LocalDate
};

export type PlusMoinsValueResponseDto = {
  dateDebutEvaluation: string;
  dateFinEvaluation: string;
  montantSoldeInitialEnEuros: number;
  montantSoldeFinalEnEuros: number;
  montantMouvementsEnEuros: number;
  montantRemunerationEnEuros: number;
  montantReevaluationEnEuros: number;
  montantPlusMoinsValueEnPourcentage: number;
};

export type EnteteCompteResponseDto =
  | EnteteCompteInterneResponseDto
  | EnteteCompteExterneResponseDto
  | EnteteCompteTechniqueResponseDto;

export type EnteteCompteInterneResponseDto = {
  identifiantCompte: string;
  libelleCompte: string;
  codeTypeCompte: string;
  codeTypeFonctionnement: string;
  libelleBanque: string;
  libellesTitulaires: string[];
  dateSoldeInitial: string;
  montantSoldeInitialEnEuros: number;
};

export type EnteteCompteExterneResponseDto = {
  identifiantCompte: string;
  libelleCompte: string;
  codeTypeCompte: string;
};

export type EnteteCompteTechniqueResponseDto = {
  identifiantCompte: string;
  libelleCompte: string;
  codeTypeCompte: string;
};

export type EtatPlusMoinsValueResponseDto = {
  enteteCompte: EnteteCompteResponseDto;
  plusMoinsValue: PlusMoinsValueResponseDto;
};

export type HistoriquePlusMoinsValueRequestDto = {
  identifiantCompte: string;
  codeTypePeriode: string;
  dateDebut: string;
  dateFin: string;
};

export type HistoriquePlusMoinsValueResponseDto = {
  enteteCompte: EnteteCompteResponseDto;
  plusMoinsValues: PlusMoinsValueResponseDto[];
};

export type ReleveCompteRequestDto = {
  identifiantCompte: string;
  dateDebut: string;
  dateFin: string;
};

export type ReleveCompteOperationResponseDto = {
  numero: string;
  codeTypeOperation: string;
  dateValeur: string;
  libelle: string;
  montantEnEuros: number;
  identifiantAutreCompte: string;
  libelleAutreCompte: string;
  codeTypeAutreCompte: string;
};

export type ReleveCompteResponseDto = {
  enteteCompte: EnteteCompteResponseDto;
  dateDebutReleve: string;
  dateFinReleve: string;
  montantSoldeDebutReleveEnEuros: number;
  montantSoldeFinReleveEnEuros: number;
  montantTotalOperationsRecetteEnEuros: number;
  montantTotalOperationsDepenseEnEuros: number;
  operationsRecette: ReleveCompteOperationResponseDto[];
  operationsDepense: ReleveCompteOperationResponseDto[];
};

// ErreurDto (si le backend le renvoie)
export type ErreurDto = {
  typeErreur: string;
  typeDomaine: string;
  code: string;
  libelle: string;
  cause?: ErreurDto;
};
