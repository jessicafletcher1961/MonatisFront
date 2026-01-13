import { http } from "./http";

async function fetchCsv(path: string): Promise<string> {
  const res = await http.get(path, { responseType: "text" as any });
  return res.data as string;
}

export async function getBudgetTypesCsv(): Promise<string> {
  return fetchCsv(`/monatis/csv/budgets/types`);
}

export async function getOperationTypesCsv(): Promise<string> {
  return fetchCsv(`/monatis/csv/operations/types`);
}

export async function getCompteTypesCsv(): Promise<string> {
  return fetchCsv(`/monatis/csv/comptes/types`);
}

export async function downloadCsv(path: string): Promise<Blob> {
  const res = await http.get(path, { responseType: "blob" });
  return res.data;
}
