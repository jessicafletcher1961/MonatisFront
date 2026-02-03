import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { monatisApi } from "../api/monatis";
import { ErrorNotice } from "../components/ErrorNotice";
import { SectionHeader } from "../components/SectionHeader";
import { SectionTabs } from "../components/SectionTabs";
import { useToast } from "../components/useToast";
import { formatCurrencyFromCents, formatDate, truncate } from "../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../lib/validation";
import type { BudgetRequestDto, BudgetsParReferenceResponseDto } from "../types/monatis";

type BudgetSectionConfig = {
  id: string;
  title: string;
  subtitle: string;
  queryKey: string[];
  fetcher: () => Promise<BudgetsParReferenceResponseDto[]>;
  create: (payload: BudgetRequestDto) => Promise<BudgetsParReferenceResponseDto>;
  reconduire: (payload: BudgetRequestDto) => Promise<BudgetsParReferenceResponseDto>;
  update: (payload: BudgetRequestDto) => Promise<BudgetsParReferenceResponseDto>;
  remove: (payload: BudgetRequestDto) => Promise<void>;
  referenceOptions: string[];
};

const sections: Omit<BudgetSectionConfig, "referenceOptions">[] = [
  {
    id: "categorie",
    title: "Budgets par catégorie",
    subtitle: "Gérez les budgets au niveau catégorie principale.",
    queryKey: ["budgets", "categorie"],
    fetcher: monatisApi.getBudgetsCategorie,
    create: monatisApi.createBudgetCategorie,
    reconduire: monatisApi.reconduireBudgetCategorie,
    update: monatisApi.updateBudgetCategorie,
    remove: monatisApi.deleteBudgetCategorie,
  },
  {
    id: "souscategorie",
    title: "Budgets par sous-catégorie",
    subtitle: "Affinez vos budgets pour un suivi plus détaillé.",
    queryKey: ["budgets", "souscategorie"],
    fetcher: monatisApi.getBudgetsSousCategorie,
    create: monatisApi.createBudgetSousCategorie,
    reconduire: monatisApi.reconduireBudgetSousCategorie,
    update: monatisApi.updateBudgetSousCategorie,
    remove: monatisApi.deleteBudgetSousCategorie,
  },
  {
    id: "beneficiaire",
    title: "Budgets par bénéficiaire",
    subtitle: "Suivez les budgets ciblés par bénéficiaire.",
    queryKey: ["budgets", "beneficiaire"],
    fetcher: monatisApi.getBudgetsBeneficiaire,
    create: monatisApi.createBudgetBeneficiaire,
    reconduire: monatisApi.reconduireBudgetBeneficiaire,
    update: monatisApi.updateBudgetBeneficiaire,
    remove: monatisApi.deleteBudgetBeneficiaire,
  },
];

function extractCodeType(typePeriode: string) {
  const match = /\[(.+)\]/.exec(typePeriode);
  return match ? match[1] : typePeriode;
}

function BudgetSection({
  title,
  subtitle,
  queryKey,
  fetcher,
  create,
  reconduire,
  update,
  remove,
  referenceOptions,
}: BudgetSectionConfig) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const csvMutation = useMutation({
    mutationFn: async ({
      fetcher,
      filename,
    }: {
      fetcher: () => Promise<Blob>;
      filename: string;
    }) => {
      const blob = await fetcher();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => push("Export CSV lancé."),
  });
  const [search, setSearch] = useState("");
  const [nomReference, setNomReference] = useState("");
  const [codeTypePeriode, setCodeTypePeriode] = useState("");
  const [dateCible, setDateCible] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const [showCreateErrors, setShowCreateErrors] = useState(false);
  const [showUpdateErrors, setShowUpdateErrors] = useState(false);
  const referenceListId = `budget-ref-${queryKey.join("-")}`;

  const budgetsQuery = useQuery({
    queryKey,
    queryFn: fetcher,
  });

  const createMutation = useMutation({
    mutationFn: create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Budget créé.");
    },
  });

  const reconduireMutation = useMutation({
    mutationFn: reconduire,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Budget reconduit.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Budget mis à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Budget supprimé.");
    },
  });

  const filtered = useMemo(() => {
    const data = budgetsQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter((item) => item.reference.nom.toLowerCase().includes(value));
  }, [budgetsQuery.data, search]);

  const montantEnCentimes = parseAmountToCents(montantEuros);
  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;
  const hasNom = nomReference.trim().length > 0;
  const hasCode = codeTypePeriode.trim().length > 0;
  const hasDate = dateCible.trim().length > 0;
  const hasMontant = montantValide;

  const payload: BudgetRequestDto = {
    nomReference: nomReference.trim(),
    codeTypePeriode: codeTypePeriode.trim() || undefined,
    dateCible: dateCible || undefined,
    montantEnCentimes: montantEnCentimes ?? undefined,
  };

  return (
    <section className="glass-card space-y-6 p-6">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            className="nav-pill nav-pill-inactive"
            onClick={() => {
              const map: Record<string, { fetcher: () => Promise<Blob>; filename: string }> = {
                categorie: { fetcher: monatisApi.getCsvBudgetsTables, filename: "budgets_tables.csv" },
                souscategorie: { fetcher: monatisApi.getCsvBudgetsTables, filename: "budgets_tables.csv" },
                beneficiaire: { fetcher: monatisApi.getCsvBudgetsTables, filename: "budgets_tables.csv" },
              };
              const key = queryKey[1] as string;
              const target = map[key] ?? { fetcher: monatisApi.getCsvBudgetsTables, filename: "budgets_tables.csv" };
              csvMutation.mutate(target);
            }}
            disabled={csvMutation.isPending}
          >
            Export CSV
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass-card space-y-4 px-5 py-4">
          <h4 className="text-lg font-semibold">Créer / Reconduire</h4>
          <div className="grid gap-3">
            <input
              className="input-glam"
              placeholder="Nom référence"
              list={referenceListId}
              value={nomReference}
              onChange={(event) => setNomReference(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Code type période (ex: MENSUEL)"
              value={codeTypePeriode}
              onChange={(event) => setCodeTypePeriode(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateCible}
              onChange={(event) => setDateCible(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Montant (EUR)"
              value={montantEuros}
              onChange={(event) => setMontantEuros(sanitizeAmountInput(event.target.value))}
              inputMode="decimal"
            />
            {showCreateErrors && !montantValide ? (
              <p className="text-xs text-red-200">Montant obligatoire (chiffres uniquement).</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-glam"
              disabled={!hasNom || !hasCode || !hasMontant || createMutation.isPending}
              onClick={() => {
                if (!hasNom || !hasCode || !hasMontant) {
                  setShowCreateErrors(true);
                  return;
                }
                createMutation.mutate(payload);
              }}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              disabled={!hasNom || !hasCode || reconduireMutation.isPending}
              onClick={() => {
                if (!hasNom || !hasCode) {
                  setShowCreateErrors(true);
                  return;
                }
                reconduireMutation.mutate(payload);
              }}
            >
              {reconduireMutation.isPending ? "Reconduction..." : "Reconduire"}
            </button>
          </div>
          {showCreateErrors && !hasNom ? (
            <p className="text-xs text-red-200">Nom référence obligatoire.</p>
          ) : null}
          {showCreateErrors && !hasCode ? (
            <p className="text-xs text-red-200">Code type période obligatoire.</p>
          ) : null}
        </div>

        <div className="glass-card space-y-4 px-5 py-4">
          <h4 className="text-lg font-semibold">Modifier / Supprimer</h4>
          <p className="text-xs text-[color:var(--glam-muted)]">
            La modification et la suppression nécessitent la date cible.
          </p>
          <div className="grid gap-3">
            <input
              className="input-glam"
              placeholder="Nom référence"
              list={referenceListId}
              value={nomReference}
              onChange={(event) => setNomReference(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Code type période"
              value={codeTypePeriode}
              onChange={(event) => setCodeTypePeriode(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateCible}
              onChange={(event) => setDateCible(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Montant (EUR)"
              value={montantEuros}
              onChange={(event) => setMontantEuros(sanitizeAmountInput(event.target.value))}
              inputMode="decimal"
            />
            {showUpdateErrors && !montantValide ? (
              <p className="text-xs text-red-200">Montant obligatoire (chiffres uniquement).</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-glam"
              disabled={!hasNom || !hasDate || !hasMontant || updateMutation.isPending}
              onClick={() => {
                if (!hasNom || !hasDate || !hasMontant) {
                  setShowUpdateErrors(true);
                  return;
                }
                updateMutation.mutate(payload);
              }}
            >
              {updateMutation.isPending ? "Mise à jour..." : "Modifier"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              disabled={!hasNom || !hasDate || deleteMutation.isPending}
              onClick={() => {
                if (!hasNom || !hasDate) {
                  setShowUpdateErrors(true);
                  return;
                }
                if (!window.confirm(`Supprimer le budget pour "${nomReference}" ?`)) return;
                deleteMutation.mutate(payload);
              }}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </button>
          </div>
          {showUpdateErrors && !hasNom ? (
            <p className="text-xs text-red-200">Nom référence obligatoire.</p>
          ) : null}
          {showUpdateErrors && !hasDate ? (
            <p className="text-xs text-red-200">Date cible obligatoire.</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-4">
        <input
          className="input-glam max-w-md"
          placeholder="Rechercher une référence..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {budgetsQuery.isError ? <ErrorNotice error={budgetsQuery.error} /> : null}
        {createMutation.isError ? <ErrorNotice error={createMutation.error} /> : null}
        {reconduireMutation.isError ? <ErrorNotice error={reconduireMutation.error} /> : null}
        {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
        {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}
        {csvMutation.isError ? <ErrorNotice error={csvMutation.error} /> : null}

        {budgetsQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement des budgets...</p>
        ) : null}

        {filtered.length === 0 && !budgetsQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucun budget disponible.</p>
        ) : null}

        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.reference.nom} className="glass-card space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{truncate(item.reference.nom, 34)}</p>
                  <p className="text-xs text-[color:var(--glam-muted)]">
                    {item.reference.libelle ?? "—"}
                  </p>
                </div>
                <button
                  className="nav-pill nav-pill-inactive"
                  onClick={() => {
                    setNomReference(item.reference.nom);
                    const last = item.budgets[item.budgets.length - 1];
                    if (last) {
                      setCodeTypePeriode(extractCodeType(last.typePeriode));
                      setDateCible(last.dateDebut);
                      setMontantEuros((last.montantEnCentimes / 100).toString());
                    }
                  }}
                >
                  Pré-remplir
                </button>
              </div>

              {item.budgets.length === 0 ? (
                <p className="text-sm text-[color:var(--glam-muted)]">Aucun budget associé.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {item.budgets.map((budget, index) => (
                    <div key={`${budget.dateDebut}-${index}`} className="glass-card px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                        {budget.typePeriode}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatCurrencyFromCents(budget.montantEnCentimes)}
                      </p>
                      <p className="text-xs text-[color:var(--glam-muted)]">
                        {formatDate(budget.dateDebut)} → {formatDate(budget.dateFin)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <datalist id={referenceListId}>
        {referenceOptions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </section>
  );
}

export function Budgets() {
  const categoriesQuery = useQuery({
    queryKey: ["references", "categorie"],
    queryFn: monatisApi.getCategories,
  });
  const sousCategoriesQuery = useQuery({
    queryKey: ["references", "souscategorie"],
    queryFn: monatisApi.getSousCategories,
  });
  const beneficiairesQuery = useQuery({
    queryKey: ["references", "beneficiaire"],
    queryFn: monatisApi.getBeneficiaires,
  });

  const categories = categoriesQuery.data?.map((item) => item.nom) ?? [];
  const sousCategories = sousCategoriesQuery.data?.map((item) => item.nom) ?? [];
  const beneficiaires = beneficiairesQuery.data?.map((item) => item.nom) ?? [];
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "categorie");

  const tabs = sections.map((section) => {
    const referenceOptions =
      section.id === "categorie"
        ? categories
        : section.id === "souscategorie"
          ? sousCategories
          : beneficiaires;
    return {
      id: section.id,
      label: section.title.replace("Budgets par ", ""),
      content: <BudgetSection key={section.id} {...section} referenceOptions={referenceOptions} />,
    };
  });

  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} activeId={activeId} onChange={setActiveId} />
    </div>
  );
}
