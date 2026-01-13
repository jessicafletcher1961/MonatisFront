import { http } from "./http";
import type { ReferenceRequestDto, ReferenceResponseDto } from "@/types/dto";

/**
 * Références simples (nom/libelle) : banque, categorie, souscategorie, beneficiaire, titulaire
 * Les endpoints sont ceux listés dans le catalogue backend.
 */
export type ReferenceKind = "banque" | "categorie" | "souscategorie" | "beneficiaire" | "titulaire";

const baseByKind: Record<ReferenceKind, string> = {
  banque: "/monatis/references/banque",
  categorie: "/monatis/references/categorie",
  souscategorie: "/monatis/references/souscategorie",
  beneficiaire: "/monatis/references/beneficiaire",
  titulaire: "/monatis/references/titulaire"
};

export async function listReferences(kind: ReferenceKind): Promise<ReferenceResponseDto[]> {
  const { data } = await http.get(`${baseByKind[kind]}/all`);
  return data;
}

export async function getReference(kind: ReferenceKind, nom: string): Promise<ReferenceResponseDto> {
  const { data } = await http.get(`${baseByKind[kind]}/get/${encodeURIComponent(nom)}`);
  return data;
}

export async function createReference(kind: ReferenceKind, dto: ReferenceRequestDto): Promise<ReferenceResponseDto> {
  const { data } = await http.post(`${baseByKind[kind]}/new`, dto);
  return data;
}

export async function updateReference(kind: ReferenceKind, nom: string, dto: ReferenceRequestDto): Promise<ReferenceResponseDto> {
  const { data } = await http.put(`${baseByKind[kind]}/mod/${encodeURIComponent(nom)}`, dto);
  return data;
}

export async function deleteReference(kind: ReferenceKind, nom: string): Promise<void> {
  // DELETE disponible pour toutes les références (banque, catégories, etc.).
  await http.delete(`${baseByKind[kind]}/del/${encodeURIComponent(nom)}`);
}

export type SousCategorieRequestDto = ReferenceRequestDto & { nomCategorie: string };

export async function createSousCategorie(dto: SousCategorieRequestDto) {
  const { data } = await http.post(`/monatis/references/souscategorie/new`, dto);
  return data as ReferenceResponseDto;
}

export async function updateSousCategorie(nom: string, dto: SousCategorieRequestDto) {
  const { data } = await http.put(`/monatis/references/souscategorie/mod/${encodeURIComponent(nom)}`, dto);
  return data as ReferenceResponseDto;
}
