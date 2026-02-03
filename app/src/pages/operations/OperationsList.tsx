import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { NavLink, Link } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { formatCurrencyFromCents, formatDate, truncate } from "../../lib/format";

export function OperationsList() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { push } = useToast();

  const operationsQuery = useQuery({
    queryKey: ["operations"],
    queryFn: monatisApi.getOperations,
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
    const data = operationsQuery.data ?? [];
    return data.filter((item) => {
      const value = search.toLowerCase();
      const matchesSearch =
        !value ||
        item.numero.toLowerCase().includes(value) ||
        (item.libelle ?? "").toLowerCase().includes(value);
      const matchesType =
        !typeFilter.trim() ||
        (item.codeTypeOperation ?? "").toLowerCase().includes(typeFilter.toLowerCase());
      const dateValue = new Date(item.dateValeur).getTime();
      const fromOk = !dateFrom || dateValue >= new Date(dateFrom).getTime();
      const toOk = !dateTo || dateValue <= new Date(dateTo).getTime();
      return matchesSearch && matchesType && fromOk && toOk;
    });
  }, [search, operationsQuery.data, typeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

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
        title="Opérations"
        subtitle="Sélectionnez une opération pour voir le détail."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvOperationsTypes,
                  filename: "operations_types.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Export CSV
            </button>
            <Link className="nav-pill nav-pill-inactive" to="/operations/special">
              Spécialisée
            </Link>
            <Link className="btn-glam" to="/operations/new">
              Nouvelle
            </Link>
          </div>
        }
      />
      <input
        className="input-glam"
        placeholder="Rechercher une opération..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        ref={searchRef}
      />
      <div className="grid gap-3 md:grid-cols-3">
        <input
          className="input-glam"
          placeholder="Filtrer par type (ex: DEPENSE)"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
        />
        <input
          className="input-glam"
          type="date"
          value={dateFrom}
          onChange={(event) => setDateFrom(event.target.value)}
        />
        <input
          className="input-glam"
          type="date"
          value={dateTo}
          onChange={(event) => setDateTo(event.target.value)}
        />
      </div>
      {(typeFilter || dateFrom || dateTo) ? (
        <button
          className="nav-pill nav-pill-inactive"
          onClick={() => {
            setTypeFilter("");
            setDateFrom("");
            setDateTo("");
            setPage(1);
          }}
        >
          Réinitialiser les filtres
        </button>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-[color:var(--glam-muted)]">
          {filtered.length} opération(s)
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[color:var(--glam-muted)]">Page</span>
          <button
            className="nav-pill nav-pill-inactive"
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage <= 1}
          >
            Précédent
          </button>
          <span className="badge-glam">
            {currentPage} / {totalPages}
          </span>
          <button
            className="nav-pill nav-pill-inactive"
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
          >
            Suivant
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-[color:var(--glam-muted)]">
          Par page
          <select
            className="input-glam h-[36px] px-3 py-0"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 40].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {operationsQuery.isError ? <ErrorNotice error={operationsQuery.error} /> : null}
      {csvMutation.isError ? <ErrorNotice error={csvMutation.error} /> : null}

      <div className="space-y-3">
        {operationsQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement des opérations…</p>
        ) : null}
        {filtered.length === 0 && !operationsQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucune opération trouvée.</p>
        ) : null}
        {paged.map((operation) => (
          <NavLink
            key={operation.numero}
            to={encodeURIComponent(operation.numero)}
            className={({ isActive }) =>
              `glass-card flex items-center justify-between gap-3 px-4 py-3 transition hover:translate-y-[-1px] ${
                isActive ? "glow-border" : ""
              }`
            }
          >
            <div>
              <p className="text-sm font-semibold">{truncate(operation.libelle ?? "Sans libellé", 28)}</p>
              <p className="text-xs text-[color:var(--glam-muted)]">
                {operation.codeTypeOperation ?? "Type"} · {formatDate(operation.dateValeur)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">
                {formatCurrencyFromCents(operation.montantEnCentimes)}
              </span>
              <button
                className="nav-pill nav-pill-inactive"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const value = operation.numero;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(value);
                  }
                  push("Numéro copié.");
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
