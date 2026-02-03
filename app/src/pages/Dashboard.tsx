import { useMutation, useQueries } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { monatisApi } from "../api/monatis";
import { ErrorNotice } from "../components/ErrorNotice";
import { formatCurrencyFromCents, formatDate, truncate } from "../lib/format";
import { SectionHeader } from "../components/SectionHeader";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function Dashboard() {
  const results = useQueries({
    queries: [
      { queryKey: ["titulaires"], queryFn: monatisApi.getTitulaires },
      { queryKey: ["comptes", "interne"], queryFn: monatisApi.getComptesInternes },
      { queryKey: ["operations"], queryFn: monatisApi.getOperations },
      { queryKey: ["evaluations"], queryFn: monatisApi.getEvaluations },
    ],
  });

  const [titulairesQuery, comptesQuery, operationsQuery, evaluationsQuery] = results;

  const titulaires = titulairesQuery.data ?? [];
  const comptes = comptesQuery.data ?? [];
  const operations = operationsQuery.data ?? [];
  const evaluations = evaluationsQuery.data ?? [];

  const lastOperations = [...operations]
    .sort((a, b) => new Date(b.dateValeur).getTime() - new Date(a.dateValeur).getTime())
    .slice(0, 6);

  const lastEvaluations = [...evaluations]
    .sort((a, b) => new Date(b.dateSolde).getTime() - new Date(a.dateSolde).getTime())
    .slice(0, 4);

  const csvMutation = useMutation({
    mutationFn: async ({
      fetcher,
      filename,
    }: {
      fetcher: () => Promise<Blob>;
      filename: string;
    }) => {
      const blob = await fetcher();
      downloadBlob(blob, filename);
    },
  });

  return (
    <div className="space-y-6">
      <section className="glass-card space-y-6 p-6">
        <SectionHeader
          title="Panorama instantané"
          subtitle="Un regard élégant sur vos flux et vos comptes."
          action={
            <Link className="btn-glam" to="/rapports">
              Exporter un rapport
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="glass-card glow-border space-y-2 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Titulaires</p>
            <p className="text-3xl font-semibold text-shadow-glam">{titulaires.length}</p>
            <p className="text-sm text-[color:var(--glam-muted)]">Identités actives dans la gestion.</p>
          </div>
          <div className="glass-card glow-border space-y-2 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Comptes internes</p>
            <p className="text-3xl font-semibold text-shadow-glam">{comptes.length}</p>
            <p className="text-sm text-[color:var(--glam-muted)]">Comptes suivis et analysés.</p>
          </div>
          <div className="glass-card glow-border space-y-2 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Opérations</p>
            <p className="text-3xl font-semibold text-shadow-glam">{operations.length}</p>
            <p className="text-sm text-[color:var(--glam-muted)]">Derniers mouvements enregistrés.</p>
          </div>
          <div className="glass-card glow-border space-y-2 px-6 py-5">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Évaluations</p>
            <p className="text-3xl font-semibold text-shadow-glam">{evaluations.length}</p>
            <p className="text-sm text-[color:var(--glam-muted)]">Suivis et valorisations.</p>
          </div>
        </div>
        <div className="glass-card space-y-3 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
            Exports rapides CSV
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <button
              className="btn-glam"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvComptesTables,
                  filename: "comptes_tables.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Comptes
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvBudgetsTables,
                  filename: "budgets_tables.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Budgets
            </button>
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
              Opérations
            </button>
          </div>
          {csvMutation.isError ? <ErrorNotice error={csvMutation.error} /> : null}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="glass-card space-y-4 p-6">
          <SectionHeader
            title="Dernières opérations"
            subtitle="Vision rapide des flux récents."
            action={
              <Link className="btn-glam" to="/operations">
                Voir toutes les opérations
              </Link>
            }
          />
          <div className="space-y-3">
            {lastOperations.length === 0 ? (
              <p className="text-sm text-[color:var(--glam-muted)]">Aucune opération disponible.</p>
            ) : (
              lastOperations.map((operation) => (
                <Link
                  key={operation.numero}
                  to={`/operations/${operation.numero}`}
                  className="glass-card flex items-center justify-between gap-4 px-5 py-4 transition hover:translate-y-[-2px]"
                >
                  <div>
                    <p className="text-sm font-semibold">{truncate(operation.libelle ?? "Sans libellé", 40)}</p>
                    <p className="text-xs text-[color:var(--glam-muted)]">
                      {operation.codeTypeOperation ?? "Type"} · {formatDate(operation.dateValeur)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrencyFromCents(operation.montantEnCentimes)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="glass-card space-y-4 p-6">
            <SectionHeader
              title="Comptes internes"
              subtitle="Accès direct à vos comptes suivis."
              action={
                <Link className="btn-glam" to="/comptes/interne">
                  Explorer les comptes
                </Link>
              }
            />
            <div className="space-y-3">
              {comptes.slice(0, 5).map((compte) => (
                <Link
                  key={compte.identifiant}
                  to={`/comptes/interne/${compte.identifiant}`}
                  className="glass-card flex items-center justify-between gap-4 px-5 py-4 transition hover:translate-y-[-2px]"
                >
                  <div>
                    <p className="text-sm font-semibold">{compte.libelle ?? compte.identifiant}</p>
                    <p className="text-xs text-[color:var(--glam-muted)]">{compte.identifiant}</p>
                  </div>
                  <span className="badge-glam">Interne</span>
                </Link>
              ))}
              {comptes.length === 0 ? (
                <p className="text-sm text-[color:var(--glam-muted)]">Aucun compte disponible.</p>
              ) : null}
            </div>
          </section>

          <section className="glass-card space-y-4 p-6">
            <SectionHeader
              title="Évaluations récentes"
              subtitle="Dernières valorisations enregistrées."
              action={
                <Link className="btn-glam" to="/evaluations">
                  Voir toutes les évaluations
                </Link>
              }
            />
            <div className="space-y-3">
              {lastEvaluations.length === 0 ? (
                <p className="text-sm text-[color:var(--glam-muted)]">Aucune évaluation disponible.</p>
              ) : (
                lastEvaluations.map((evaluation) => (
                  <Link
                    key={evaluation.cle}
                    to={`/evaluations/${evaluation.cle}`}
                    className="glass-card flex items-center justify-between gap-4 px-5 py-4 transition hover:translate-y-[-2px]"
                  >
                    <div>
                      <p className="text-sm font-semibold">{truncate(evaluation.cle, 30)}</p>
                      <p className="text-xs text-[color:var(--glam-muted)]">
                        {evaluation.identifiantCompteInterne}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[color:var(--glam-muted)]">
                        {formatDate(evaluation.dateSolde)}
                      </p>
                      <p className="text-sm font-semibold">
                        {formatCurrencyFromCents(evaluation.montantSoldeEnCentimes)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
