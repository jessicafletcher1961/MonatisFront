import { http } from "./http";
import type {
  OperationBaseRequestDto,
  OperationCompleteRequestDto,
  OperationDetailedResponseDto,
  OperationModificationRequestDto,
  OperationSimpleResponseDto
} from "@/types/dto";

export async function listOperations(): Promise<OperationSimpleResponseDto[]> {
  const { data } = await http.get(`/monatis/operations/all`);
  return data;
}

export async function getOperation(numero: string): Promise<OperationDetailedResponseDto> {
  const { data } = await http.get(`/monatis/operations/get/${encodeURIComponent(numero)}`);
  return data;
}

export async function deleteOperation(numero: string): Promise<void> {
  await http.delete(`/monatis/operations/del/${encodeURIComponent(numero)}`);
}

export async function updateOperation(numero: string, dto: OperationModificationRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.put(`/monatis/operations/mod/${encodeURIComponent(numero)}`, dto);
  return data;
}

// Créations spécialisées
export async function effectuerDepense(dto: OperationCompleteRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/depense`, dto);
  return data;
}

export async function effectuerRecette(dto: OperationCompleteRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/recette`, dto);
  return data;
}

export async function effectuerAchat(dto: OperationBaseRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/achat`, dto);
  return data;
}

export async function effectuerDepot(dto: OperationBaseRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/depot`, dto);
  return data;
}

export async function effectuerRetrait(dto: OperationBaseRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/retrait`, dto);
  return data;
}

export async function effectuerTransfert(dto: OperationBaseRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/transfert`, dto);
  return data;
}

export async function effectuerVente(dto: OperationBaseRequestDto): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/vente`, dto);
  return data;
}

// Création générique (si tu l'utilises côté backend)
export async function creerOperation(dto: any): Promise<OperationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/operations/new`, dto);
  return data;
}
