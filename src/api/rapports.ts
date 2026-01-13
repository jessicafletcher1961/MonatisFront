import { http } from "./http";
import type {
  EtatPlusMoinsValueRequestDto,
  EtatPlusMoinsValueResponseDto,
  HistoriquePlusMoinsValueRequestDto,
  HistoriquePlusMoinsValueResponseDto,
  ReleveCompteRequestDto,
  ReleveCompteResponseDto
} from "@/types/dto";

export async function getEtatPlusMoinsValue(dto: EtatPlusMoinsValueRequestDto): Promise<EtatPlusMoinsValueResponseDto[]> {
  const { data } = await http.get(`/monatis/rapports/plus_moins_value/etat`, { data: dto as any });
  // Note: le PDF indique "body" sur un GET; certains backends attendent plutôt POST.
  // On implémente aussi un fallback dans l'UI (POST) si besoin.
  return data;
}

export async function getEtatPlusMoinsValuePost(dto: EtatPlusMoinsValueRequestDto): Promise<EtatPlusMoinsValueResponseDto[]> {
  const { data } = await http.post(`/monatis/rapports/plus_moins_value/etat`, dto);
  return data;
}

export async function getHistoriquePlusMoinsValue(dto: HistoriquePlusMoinsValueRequestDto): Promise<HistoriquePlusMoinsValueResponseDto> {
  const { data } = await http.get(`/monatis/rapports/plus_moins_value/historique`, { data: dto as any });
  return data;
}

export async function getHistoriquePlusMoinsValuePost(dto: HistoriquePlusMoinsValueRequestDto): Promise<HistoriquePlusMoinsValueResponseDto> {
  const { data } = await http.post(`/monatis/rapports/plus_moins_value/historique`, dto);
  return data;
}

export async function getReleveCompte(dto: ReleveCompteRequestDto): Promise<ReleveCompteResponseDto> {
  const { data } = await http.get(`/monatis/rapports/releve_compte`, { data: dto as any });
  return data;
}

export async function getReleveComptePost(dto: ReleveCompteRequestDto): Promise<ReleveCompteResponseDto> {
  const { data } = await http.post(`/monatis/rapports/releve_compte`, dto);
  return data;
}
