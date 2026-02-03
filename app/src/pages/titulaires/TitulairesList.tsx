import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { truncate } from "../../lib/format";

export function TitulairesList() {
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [nom, setNom] = useState("");
  const [libelle, setLibelle] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [showErrors, setShowErrors] = useState(false);

  const titulairesQuery = useQuery({
    queryKey: ["titulaires"],
    queryFn: monatisApi.getTitulaires,
  });

  const createMutation = useMutation({
    mutationFn: monatisApi.createTitulaire,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titulaires"] });
      setNom("");
      setLibelle("");
      setIsCreating(false);
      push("Titulaire créé.");
    },
  });

  const filtered = useMemo(() => {
    const data = titulairesQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter((item) => item.nom.toLowerCase().includes(value));
  }, [search, titulairesQuery.data]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      if ((event.target as HTMLElement)?.tagName === "INPUT") return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Titulaires"
        subtitle="Cliquez pour révéler les comptes associés."
        action={
          <button className="btn-glam" onClick={() => setIsCreating((value) => !value)}>
            {isCreating ? "Fermer" : "Nouveau"}
          </button>
        }
      />

      {isCreating ? (
        <form
          className="glass-card space-y-3 px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!nom.trim()) {
              setShowErrors(true);
              return;
            }
            createMutation.mutate({ nom: nom.trim(), libelle: libelle.trim() || undefined });
          }}
        >
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
              Nom
            </label>
            <input
              className="input-glam"
              placeholder="Nom du titulaire"
              value={nom}
              onChange={(event) => setNom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
              Libellé
            </label>
            <input
              className="input-glam"
              placeholder="Libellé (optionnel)"
              value={libelle}
              onChange={(event) => setLibelle(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-glam"
              type="submit"
              disabled={createMutation.isPending || !nom.trim()}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </button>
            <button
              type="button"
              className="nav-pill nav-pill-inactive"
              onClick={() => setIsCreating(false)}
            >
              Annuler
            </button>
          </div>
          {showErrors && !nom.trim() ? (
            <p className="text-xs text-red-200">Nom obligatoire.</p>
          ) : null}
          {createMutation.isError ? <ErrorNotice error={createMutation.error} /> : null}
        </form>
      ) : null}

      <input
        className="input-glam"
        placeholder="Rechercher un titulaire..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        ref={searchRef}
      />

      {titulairesQuery.isError ? <ErrorNotice error={titulairesQuery.error} /> : null}

      <div className="space-y-3">
        {titulairesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement des titulaires…</p>
        ) : null}
        {filtered.length === 0 && !titulairesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucun titulaire trouvé.</p>
        ) : null}
        {filtered.map((titulaire) => (
          <NavLink
            key={titulaire.nom}
            to={encodeURIComponent(titulaire.nom)}
            className={({ isActive }) =>
              `glass-card flex items-center justify-between gap-3 px-4 py-3 transition hover:translate-y-[-1px] ${
                isActive ? "glow-border" : ""
              }`
            }
          >
            <div>
              <p className="text-sm font-semibold">{truncate(titulaire.nom, 24)}</p>
              <p className="text-xs text-[color:var(--glam-muted)]">{titulaire.libelle ?? "—"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge-glam">Voir</span>
              <button
                className="nav-pill nav-pill-inactive"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const value = titulaire.nom;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(value);
                  }
                  push("Nom copié.");
                }}
              >
                Copier
              </button>
            </div>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
