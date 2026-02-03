import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { accountTypeLabel, truncate } from "../../lib/format";

export function ComptesList() {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { push } = useToast();

  const comptesQuery = useQuery({
    queryKey: ["comptes", "interne"],
    queryFn: monatisApi.getComptesInternes,
  });

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

  const filtered = useMemo(() => {
    const data = comptesQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter(
      (item) =>
        item.identifiant.toLowerCase().includes(value) ||
        (item.libelle ?? "").toLowerCase().includes(value)
    );
  }, [search, comptesQuery.data]);

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
        title="Comptes internes"
        subtitle="Sélectionnez un compte pour voir le détail."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvComptesTables,
                  filename: "comptes_tables.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Export CSV
            </button>
            <Link className="nav-pill nav-pill-inactive" to="/comptes/manage">
              Gérer
            </Link>
            <Link className="btn-glam" to="/comptes/manage">
              Nouveau
            </Link>
          </div>
        }
      />
      <input
        className="input-glam"
        placeholder="Rechercher un compte..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        ref={searchRef}
      />

      {comptesQuery.isError ? <ErrorNotice error={comptesQuery.error} /> : null}
      {csvMutation.isError ? <ErrorNotice error={csvMutation.error} /> : null}

      <div className="space-y-3">
        {comptesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement des comptes…</p>
        ) : null}
        {filtered.length === 0 && !comptesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucun compte trouvé.</p>
        ) : null}
        {filtered.map((compte) => (
          <NavLink
            key={compte.identifiant}
            to={encodeURIComponent(compte.identifiant)}
            className={({ isActive }) =>
              `glass-card flex items-center justify-between gap-3 px-4 py-3 transition hover:translate-y-[-1px] ${
                isActive ? "glow-border" : ""
              }`
            }
          >
            <div>
              <p className="text-sm font-semibold">{truncate(compte.libelle ?? compte.identifiant, 24)}</p>
              <p className="text-xs text-[color:var(--glam-muted)]">{compte.identifiant}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge-glam">{accountTypeLabel(compte.codeTypeFonctionnement)}</span>
              <button
                className="nav-pill nav-pill-inactive"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const value = compte.identifiant;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(value);
                  }
                  push("Identifiant copié.");
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
