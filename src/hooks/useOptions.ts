import { useQuery } from "@tanstack/react-query";
import { listComptesInternes, listComptesExternes, listComptesTechniques } from "@/api/comptes";
import { listReferences } from "@/api/references";

export function useAllAccountsOptions() {
  const internes = useQuery({ queryKey: ["comptes","internes"], queryFn: listComptesInternes });
  const externes = useQuery({ queryKey: ["comptes","externes"], queryFn: listComptesExternes });
  const techniques = useQuery({ queryKey: ["comptes","techniques"], queryFn: listComptesTechniques });

  const options = [
    // UX: on affiche d'abord l'identifiant (ce que l'utilisateur tape comme "nom" de compte),
    // et le libellé en info secondaire.
    ...(internes.data ?? []).map(c => ({ value: c.identifiant, label: c.identifiant, meta: c.libelle || "Interne" })),
    ...(externes.data ?? []).map(c => ({ value: c.identifiant, label: c.identifiant, meta: c.libelle || "Externe" })),
    ...(techniques.data ?? []).map(c => ({ value: c.identifiant, label: c.identifiant, meta: c.libelle || "Technique" }))
  ];

  return {
    options,
    isLoading: internes.isLoading || externes.isLoading || techniques.isLoading
  };
}

export function useReferenceOptions(kind: Parameters<typeof listReferences>[0]) {
  const q = useQuery({ queryKey: ["references", kind], queryFn: () => listReferences(kind) });
  return {
    // UX: on garde le "nom" comme libellé principal, et on montre le libellé en secondaire.
    options: (q.data ?? []).map(r => ({ value: r.nom, label: r.nom, meta: r.libelle || undefined })),
    isLoading: q.isLoading
  };
}
