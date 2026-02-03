export type DateISO = string;

export interface ErreurDto {
  typeErreur: string;
  typeDomaine: string;
  code: string;
  libelle: string;
  cause: ErreurDto | null;
}

export interface ReferenceRequestDto {
  nom?: string;
  libelle?: string;
}

export interface ReferenceResponseDto {
  nom: string;
  libelle: string | null;
}

export interface TypeOperationResponseDto {
  code: string;
  libelle: string;
}

export interface CompteRequestDto {
  identifiant?: string;
  libelle?: string;
}

export interface CompteResponseDto {
  identifiant: string;
  libelle: string | null;
}

export interface TypeFonctionnementDto {
  code: string;
  libelle: string;
}

export interface CompteInterneSimpleResponseDto extends CompteResponseDto {
  dateCloture?: DateISO | null;
  dateSoldeInitial?: DateISO;
  montantSoldeInitialEnCentimes?: number;
  codeTypeFonctionnement?: string;
  typeFonctionnement?: TypeFonctionnementDto;
  banque?: ReferenceResponseDto | null;
  nomBanque?: string | null;
  titulaires?: ReferenceResponseDto[] | null;
  nomsTitulaires?: string[] | null;
}

export interface CompteInterneRequestDto extends CompteRequestDto {
  dateCloture?: string | null;
  codeTypeFonctionnement?: string;
  dateSoldeInitial?: DateISO;
  montantSoldeInitialEnCentimes?: number;
  nomBanque?: string | null;
  nomsTitulaires?: string[] | null;
}

export interface TitulaireSimpleResponseDto extends ReferenceResponseDto {
  comptesInternes?: CompteResponseDto[] | null;
  identifiantsComptesInternes?: string[] | null;
}

export interface OperationResponseDto {
  numero: string;
  libelle: string | null;
  dateValeur: DateISO;
  montantEnCentimes: number;
  pointee?: boolean;
}

export interface OperationLigneBasicResponseDto {
  numeroLigne: number;
  dateComptabilisation: DateISO;
  montantEnCentimes: number;
  libelle: string | null;
  nomSousCategorie?: string | null;
  nomsBeneficiaires?: string[] | null;
  sousCategorie?: ReferenceResponseDto | null;
  beneficiaires?: ReferenceResponseDto[] | null;
}

export interface OperationBasicResponseDto extends OperationResponseDto {
  codeTypeOperation?: string;
  identifiantCompteDepense?: string;
  identifiantCompteRecette?: string;
  lignes?: OperationLigneBasicResponseDto[] | null;
  typeOperation?: TypeOperationResponseDto | null;
  compteRecette?: CompteResponseDto | null;
  compteDepense?: CompteResponseDto | null;
  nomSousCategorie?: string | null;
  nomsBeneficiaires?: string[] | null;
}

export interface OperationRequestDto {
  numero?: string;
  libelle?: string;
  dateValeur?: DateISO;
  montantEnCentimes?: number;
  identifiantCompteExterne?: string;
  identifiantCompteCourant?: string;
  identifiantCompteCourantRecette?: string;
  identifiantCompteCourantDepense?: string;
  identifiantCompteFinancier?: string;
  identifiantCompteBien?: string;
  nomSousCategorie?: string;
  nomsBeneficiaires?: string[];
}

export interface OperationCreationRequestDto {
  numero?: string;
  libelle?: string;
  codeTypeOperation: string;
  dateValeur?: DateISO;
  montantEnCentimes: number;
  identifiantCompteDepense: string;
  identifiantCompteRecette: string;
  nomSousCategorie?: string | null;
  nomsBeneficiaires?: string[] | null;
}

export interface OperationLigneModificationRequestDto {
  numeroLigne?: number | null;
  libelle?: string;
  dateComptabilisation?: DateISO;
  montantEnCentimes?: number;
  nomSousCategorie?: string;
  nomsBeneficiaires?: string[];
}

export interface OperationModificationRequestDto {
  numero?: string;
  libelle?: string;
  codeTypeOperation?: string;
  dateValeur?: DateISO;
  montantEnCentimes?: number;
  identifiantCompteDepense?: string;
  identifiantCompteRecette?: string;
  pointee?: boolean;
  lignes?: OperationLigneModificationRequestDto[];
}

export interface EvaluationResponseDto {
  cle: string;
  dateSolde: DateISO;
  montantSoldeEnCentimes: number;
  libelle: string | null;
}

export interface EvaluationCreationRequestDto {
  cle?: string;
  identifiantCompteInterne: string;
  dateSolde?: DateISO;
  libelle?: string;
  montantSoldeEnCentimes: number;
}

export interface EvaluationBasicResponseDto extends EvaluationResponseDto {
  identifiantCompteInterne: string;
  identifiantompteTechnique: string;
}

export interface EvaluationSimpleResponseDto extends EvaluationResponseDto {
  compteInterne: CompteResponseDto;
  compteTechnique: CompteResponseDto;
}

export interface BudgetRequestDto {
  nomReference: string;
  codeTypePeriode?: string;
  dateCible?: DateISO;
  montantEnCentimes?: number;
}

export interface BudgetResponseDto {
  typePeriode: string;
  dateDebut: DateISO;
  dateFin: DateISO;
  montantEnCentimes: number;
}

export interface BudgetsParReferenceResponseDto {
  reference: ReferenceResponseDto;
  budgets: BudgetResponseDto[];
}

export interface ReleveCompteRequestDto {
  identifiantCompte: string;
  dateDebut: DateISO;
  dateFin?: DateISO;
}

export interface ReleveCompteOperationResponseDto {
  numero: string;
  codeTypeOperation: string;
  dateValeur: DateISO;
  libelle: string | null;
  montantEnEuros: number;
  identifiantAutreCompte: string;
  libelleAutreCompte: string;
  codeTypeAutreCompte: string;
}

export interface ReleveCompteResponseDto {
  enteteCompte: unknown;
  dateDebutReleve: DateISO;
  dateFinReleve: DateISO;
  montantSoldeDebutReleveEnEuros: number;
  montantSoldeFinReleveEnEuros: number;
  montantTotalOperationsRecetteEnEuros: number;
  montantTotalOperationsDepenseEnEuros: number;
  operationsRecette: ReleveCompteOperationResponseDto[];
  operationsDepense: ReleveCompteOperationResponseDto[];
}

export interface HistoriquePlusMoinsValueRequestDto {
  identifiantCompte: string;
  codeTypePeriode?: string;
  dateDebut?: DateISO;
  dateFin?: DateISO;
}

export interface PlusMoinsValueResponseDto {
  dateDebutEvaluation: DateISO;
  dateFinEvaluation: DateISO;
  montantSoldeInitialEnEuros: number;
  montantSoldeFinalEnEuros: number;
  montantReelEnEuros: number;
  montantTechniqueEnEuros: number;
  montantPlusMoinsValueEnEuros: number;
  montantPlusMoinsValueEnPourcentage: number;
}

export interface HistoriquePlusMoinsValueResponseDto {
  enteteCompte: unknown;
  plusMoinsValues: PlusMoinsValueResponseDto[];
}

export interface EtatPlusMoinsValueRequestDto {
  codeTypePeriode: string;
  dateCible?: DateISO;
}

export interface EtatPlusMoinsValueResponseDto {
  enteteCompte: unknown;
  plusMoinsValue: PlusMoinsValueResponseDto;
}

export interface ListeCompteInterneRequestDto {
  dateCible?: DateISO;
}

export interface ResumeCompteInterneResponseDto {
  compteInterne: CompteResponseDto;
  dateSolde: DateISO;
  montantSoldeEnEuros: number;
}

export interface ListeResumeCompteInterneParTypeFonctionnementResponseDto {
  typeFonctionnement: TypeFonctionnementDto;
  comptesInternes: ResumeCompteInterneResponseDto[];
}
