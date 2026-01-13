import { http } from "./http";
import type {
  CompteExterneRequestDto,
  CompteInterneRequestDto,
  CompteResponseDto,
  CompteTechniqueRequestDto,
  CompteInterneBasicResponseDto
} from "@/types/dto";

// Le backend peut renvoyer plusieurs formes (Basic vs Detailed) selon les versions.
// On normalise ici pour que l'UI puisse toujours afficher :
// - codeTypeFonctionnement
// - nomBanque
// - nomsTitulaires
// - dateSoldeInitial / montantSoldeInitialEnCentimes
function normalizeCompteInterne(data: any): CompteInterneBasicResponseDto {
  const identifiant = data?.identifiant ?? "";
  const libelle = data?.libelle ?? "";

  // Type fonctionnement
  const codeTypeFonctionnement =
    data?.codeTypeFonctionnement ??
    data?.typeFonctionnement?.code ??
    data?.typeFonctionnement?.codeTypeFonctionnement ??
    data?.typeFonctionnement ??
    "";

  // Banque
  const nomBanque = data?.nomBanque ?? data?.banque?.nom ?? data?.banque?.libelle ?? "";

  // Titulaires
  const nomsTitulaires: string[] =
    data?.nomsTitulaires ??
    (Array.isArray(data?.titulaires)
      ? data.titulaires
          .map((t: any) => t?.nom ?? t?.libelle ?? t)
          .filter(Boolean)
      : []);

  // Champs solde initial
  const dateSoldeInitial = data?.dateSoldeInitial ?? data?.dateSoldeInitial?.toString?.() ?? "";
  const montantSoldeInitialEnCentimes =
    data?.montantSoldeInitialEnCentimes ??
    data?.montantSoldeInitialEnCentimes?.value ??
    0;

  return {
    identifiant,
    libelle,
    codeTypeFonctionnement,
    dateSoldeInitial,
    montantSoldeInitialEnCentimes,
    nomBanque,
    nomsTitulaires
  };
}

// v2: la route "all" renvoie la forme la plus riche (type fonctionnement, banque, titulaires, solde initial)
// ce qui permet une UX plus agréable (tri / détail / pré-remplissage du formulaire).
export async function listComptesInternes(): Promise<CompteInterneBasicResponseDto[]> {
  const { data } = await http.get(`/monatis/comptes/interne/all`);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeCompteInterne);
}
export async function getCompteInterne(identifiant: string): Promise<CompteInterneBasicResponseDto> {
  const { data } = await http.get(`/monatis/comptes/interne/get/${encodeURIComponent(identifiant)}`);
  return normalizeCompteInterne(data);
}
export async function createCompteInterne(dto: CompteInterneRequestDto): Promise<CompteResponseDto> {
  const { data } = await http.post(`/monatis/comptes/interne/new`, dto);
  return data;
}
export async function updateCompteInterne(identifiant: string, dto: CompteInterneRequestDto): Promise<CompteResponseDto> {
  const { data } = await http.put(`/monatis/comptes/interne/mod/${encodeURIComponent(identifiant)}`, dto);
  return data;
}

export async function deleteCompteInterne(identifiant: string): Promise<void> {
  await http.delete(`/monatis/comptes/interne/del/${encodeURIComponent(identifiant)}`);
}

export async function listComptesExternes(): Promise<CompteResponseDto[]> {
  const { data } = await http.get(`/monatis/comptes/externe/all`);
  return data;
}
export async function getCompteExterne(identifiant: string): Promise<CompteResponseDto> {
  const { data } = await http.get(`/monatis/comptes/externe/get/${encodeURIComponent(identifiant)}`);
  return data;
}
export async function createCompteExterne(dto: CompteExterneRequestDto): Promise<CompteResponseDto> {
  const { data } = await http.post(`/monatis/comptes/externe/new`, dto);
  return data;
}
export async function updateCompteExterne(identifiant: string, dto: CompteExterneRequestDto): Promise<CompteResponseDto> {
  const { data } = await http.put(`/monatis/comptes/externe/mod/${encodeURIComponent(identifiant)}`, dto);
  return data;
}

export async function deleteCompteExterne(identifiant: string): Promise<void> {
  await http.delete(`/monatis/comptes/externe/del/${encodeURIComponent(identifiant)}`);
}

export async function listComptesTechniques(): Promise<CompteResponseDto[]> {
  const { data } = await http.get(`/monatis/comptes/technique/all`);
  return data;
}
export async function getCompteTechnique(identifiant: string): Promise<CompteResponseDto> {
  const { data } = await http.get(`/monatis/comptes/technique/get/${encodeURIComponent(identifiant)}`);
  return data;
}
export async function createCompteTechnique(dto: CompteTechniqueRequestDto): Promise<CompteResponseDto> {
  const { data } = await http.post(`/monatis/comptes/technique/new`, dto);
  return data;
}
export async function updateCompteTechnique(identifiant: string, dto: CompteTechniqueRequestDto): Promise<CompteResponseDto> {
  const { data } = await http.put(`/monatis/comptes/technique/mod/${encodeURIComponent(identifiant)}`, dto);
  return data;
}

export async function deleteCompteTechnique(identifiant: string): Promise<void> {
  await http.delete(`/monatis/comptes/technique/del/${encodeURIComponent(identifiant)}`);
}
