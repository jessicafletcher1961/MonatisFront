import { http } from "./http";
import type { BudgetRequestDto, BudgetsParReferenceResponseDto } from "@/types/dto";

export type BudgetKind = "categorie" | "souscategorie" | "beneficiaire";

const baseByKind: Record<BudgetKind, string> = {
  categorie: "/monatis/budgets/categorie",
  souscategorie: "/monatis/budgets/souscategorie",
  beneficiaire: "/monatis/budgets/beneficiaire"
};

export async function listBudgets(kind: BudgetKind): Promise<BudgetsParReferenceResponseDto[]> {
  const { data } = await http.get(`${baseByKind[kind]}/all`);
  return data;
}

export async function getBudgetsByReference(kind: BudgetKind, nom: string): Promise<BudgetsParReferenceResponseDto> {
  const { data } = await http.get(`${baseByKind[kind]}/get/${encodeURIComponent(nom)}`);
  return data;
}

export async function createBudget(kind: BudgetKind, dto: BudgetRequestDto): Promise<BudgetsParReferenceResponseDto> {
  const { data } = await http.post(`${baseByKind[kind]}/new`, dto);
  return data;
}

export async function updateBudget(kind: BudgetKind, dto: BudgetRequestDto): Promise<BudgetsParReferenceResponseDto> {
  const { data } = await http.put(`${baseByKind[kind]}/mod`, dto);
  return data;
}

export async function nextBudget(kind: BudgetKind, dto: BudgetRequestDto): Promise<BudgetsParReferenceResponseDto> {
  const { data } = await http.post(`${baseByKind[kind]}/next`, dto);
  return data;
}

// Le PDF v2 indique un DELETE avec body (BudgetRequestDto).
export async function deleteBudget(kind: BudgetKind, dto: BudgetRequestDto): Promise<void> {
  await http.delete(`${baseByKind[kind]}/del`, { data: dto as any });
}
