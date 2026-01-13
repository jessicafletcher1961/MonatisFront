import { http } from "./http";
import type {
  EvaluationCreationRequestDto,
  EvaluationDetailedResponseDto,
  EvaluationModificationRequestDto,
  EvaluationSimpleResponseDto
} from "@/types/dto";

export async function listEvaluations(): Promise<EvaluationSimpleResponseDto[]> {
  const { data } = await http.get(`/monatis/evaluations/all`);
  return data;
}

export async function getEvaluation(cle: string): Promise<EvaluationDetailedResponseDto> {
  const { data } = await http.get(`/monatis/evaluations/get/${encodeURIComponent(cle)}`);
  return data;
}

export async function deleteEvaluation(cle: string): Promise<void> {
  await http.delete(`/monatis/evaluations/del/${encodeURIComponent(cle)}`);
}

export async function createEvaluation(dto: EvaluationCreationRequestDto): Promise<EvaluationDetailedResponseDto> {
  const { data } = await http.post(`/monatis/evaluations/new`, dto);
  return data;
}

export async function updateEvaluation(cle: string, dto: EvaluationModificationRequestDto): Promise<EvaluationDetailedResponseDto> {
  const { data } = await http.put(`/monatis/evaluations/mod/${encodeURIComponent(cle)}`, dto);
  return data;
}
