import { useQuery } from "@tanstack/react-query";
import { getBudgetTypesCsv, getOperationTypesCsv, getCompteTypesCsv } from "@/api/csv";
import { parseSimpleCsv } from "@/utils/csv";

type TypeItem = { code: string; libelle: string };

function toTypes(csv: string): TypeItem[] {
  const rows = parseSimpleCsv(csv);
  // If header exists, drop if contains 'code'
  const normalized = rows[0] && rows[0][0].toLowerCase().includes("code") ? rows.slice(1) : rows;
  return normalized
    .filter(r => r.length >= 2)
    .map(r => ({ code: r[0], libelle: r.slice(1).join(" ") }));
}

export function useOperationTypes() {
  const q = useQuery({ queryKey: ["csv","operations","types"], queryFn: getOperationTypesCsv });
  return {
    items: q.data ? toTypes(q.data) : [],
    isLoading: q.isLoading,
    error: q.error
  };
}

export function useBudgetTypes() {
  const q = useQuery({ queryKey: ["csv","budgets","types"], queryFn: getBudgetTypesCsv });
  return {
    items: q.data ? toTypes(q.data) : [],
    isLoading: q.isLoading
  };
}

export function useCompteTypes() {
  const q = useQuery({ queryKey: ["csv","comptes","types"], queryFn: getCompteTypesCsv });
  return {
    items: q.data ? toTypes(q.data) : [],
    isLoading: q.isLoading
  };
}
