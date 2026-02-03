import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { monatisApi } from "../api/monatis";
import { ErrorNotice } from "../components/ErrorNotice";
import { SectionHeader } from "../components/SectionHeader";
import { SectionTabs } from "../components/SectionTabs";
import { useToast } from "../components/useToast";
import { truncate } from "../lib/format";
import type { ReferenceRequestDto, ReferenceResponseDto } from "../types/monatis";

type ReferenceSectionConfig = {
  id: string;
  title: string;
  subtitle: string;
  queryKey: string[];
  fetcher: () => Promise<ReferenceResponseDto[]>;
  create: (payload: ReferenceRequestDto) => Promise<ReferenceResponseDto>;
  update: (nom: string, payload: ReferenceRequestDto) => Promise<ReferenceResponseDto>;
  remove: (nom: string) => Promise<void>;
};

const sections: ReferenceSectionConfig[] = [
  {
    id: "banque",
    title: "Banques",
    subtitle: "Références bancaires disponibles.",
    queryKey: ["references", "banque"],
    fetcher: monatisApi.getBanques,
    create: monatisApi.createBanque,
    update: monatisApi.updateBanque,
    remove: monatisApi.deleteBanque,
  },
  {
    id: "categorie",
    title: "Catégories",
    subtitle: "Catégories principales pour classer les opérations.",
    queryKey: ["references", "categorie"],
    fetcher: monatisApi.getCategories,
    create: monatisApi.createCategorie,
    update: monatisApi.updateCategorie,
    remove: monatisApi.deleteCategorie,
  },
  {
    id: "souscategorie",
    title: "Sous-catégories",
    subtitle: "Affinez votre plan de classement.",
    queryKey: ["references", "souscategorie"],
    fetcher: monatisApi.getSousCategories,
    create: monatisApi.createSousCategorie,
    update: monatisApi.updateSousCategorie,
    remove: monatisApi.deleteSousCategorie,
  },
  {
    id: "beneficiaire",
    title: "Bénéficiaires",
    subtitle: "Liste des bénéficiaires associés aux opérations.",
    queryKey: ["references", "beneficiaire"],
    fetcher: monatisApi.getBeneficiaires,
    create: monatisApi.createBeneficiaire,
    update: monatisApi.updateBeneficiaire,
    remove: monatisApi.deleteBeneficiaire,
  },
];

function ReferenceSection({ title, subtitle, queryKey, fetcher, create, update, remove }: ReferenceSectionConfig) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [nomOriginal, setNomOriginal] = useState("");
  const [nom, setNom] = useState("");
  const [libelle, setLibelle] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const referencesQuery = useQuery({
    queryKey,
    queryFn: fetcher,
  });

  const createMutation = useMutation({
    mutationFn: create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Référence créée.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ReferenceRequestDto) => update(nomOriginal, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Référence mise à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => remove(nomOriginal || nom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Référence supprimée.");
    },
  });

  const filtered = useMemo(() => {
    const data = referencesQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter((item) => item.nom.toLowerCase().includes(value));
  }, [referencesQuery.data, search]);

  const payload: ReferenceRequestDto = {
    nom: nom.trim() || undefined,
    libelle: libelle.trim() || undefined,
  };

  const canCreate = Boolean(payload.nom);
  const canUpdate = Boolean(nomOriginal) && Boolean(payload.nom);
  const canDelete = Boolean(nomOriginal || nom);

  return (
    <section className="glass-card space-y-6 p-6">
      <SectionHeader title={title} subtitle={subtitle} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass-card space-y-4 px-5 py-4">
          <h4 className="text-lg font-semibold">Créer / Modifier</h4>
          <div className="grid gap-3">
            <input
              className="input-glam"
              placeholder="Nom"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Libellé (optionnel)"
              value={libelle}
              onChange={(event) => setLibelle(event.target.value)}
            />
          </div>
          {nomOriginal ? (
            <p className="text-xs text-[color:var(--glam-muted)]">
              Modification de: {truncate(nomOriginal, 32)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-glam"
              disabled={!canCreate || createMutation.isPending}
              onClick={() => {
                if (!canCreate) {
                  setShowErrors(true);
                  return;
                }
                createMutation.mutate(payload);
              }}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              disabled={!canUpdate || updateMutation.isPending}
              onClick={() => {
                if (!canUpdate) {
                  setShowErrors(true);
                  return;
                }
                updateMutation.mutate(payload);
              }}
            >
              {updateMutation.isPending ? "Mise à jour..." : "Modifier"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() => {
                setNomOriginal("");
                setNom("");
                setLibelle("");
              }}
            >
              Effacer
            </button>
          </div>
          {showErrors && !payload.nom ? (
            <p className="text-xs text-red-200">Nom obligatoire.</p>
          ) : null}
        </div>

        <div className="glass-card space-y-4 px-5 py-4">
          <h4 className="text-lg font-semibold">Supprimer</h4>
          <p className="text-xs text-[color:var(--glam-muted)]">
            Sélectionnez une référence ci-dessous ou remplissez le nom.
          </p>
          <button
            className="nav-pill nav-pill-inactive"
            disabled={!canDelete || deleteMutation.isPending}
            onClick={() => {
              const target = nomOriginal || nom;
              if (!target) return;
              if (!window.confirm(`Supprimer "${target}" ?`)) return;
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <input
          className="input-glam max-w-md"
          placeholder="Rechercher une référence..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {referencesQuery.isError ? <ErrorNotice error={referencesQuery.error} /> : null}
        {createMutation.isError ? <ErrorNotice error={createMutation.error} /> : null}
        {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
        {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}

        {referencesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement des références...</p>
        ) : null}

        {filtered.length === 0 && !referencesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucune référence disponible.</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => (
            <button
              key={item.nom}
              className="glass-card flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:translate-y-[-1px]"
              onClick={() => {
                setNomOriginal(item.nom);
                setNom(item.nom);
                setLibelle(item.libelle ?? "");
              }}
            >
              <div>
                <p className="text-sm font-semibold">{truncate(item.nom, 28)}</p>
                <p className="text-xs text-[color:var(--glam-muted)]">{item.libelle ?? "—"}</p>
              </div>
              <span className="badge-glam">Éditer</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function References() {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "banque");
  const tabs = sections.map((section) => ({
    id: section.id,
    label: section.title,
    content: <ReferenceSection key={section.id} {...section} />,
  }));

  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} activeId={activeId} onChange={setActiveId} />
    </div>
  );
}
