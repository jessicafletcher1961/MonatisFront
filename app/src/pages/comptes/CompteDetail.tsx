import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { EmptyState } from "../../components/EmptyState";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { accountTypeLabel, formatCurrencyFromCents, formatDate, truncate } from "../../lib/format";

export function CompteDetail() {
  const { identifiant } = useParams();
  const decodedId = identifiant ? decodeURIComponent(identifiant) : "";

  const compteQuery = useQuery({
    queryKey: ["comptes", "interne", decodedId],
    queryFn: () => monatisApi.getCompteInterne(decodedId),
    enabled: Boolean(decodedId),
  });

  const operationsQuery = useQuery({
    queryKey: ["operations"],
    queryFn: monatisApi.getOperations,
  });

  const relatedOperations = useMemo(() => {
    if (!decodedId) return [];
    const ops = operationsQuery.data ?? [];
    return ops
      .filter(
        (op) => op.identifiantCompteDepense === decodedId || op.identifiantCompteRecette === decodedId
      )
      .sort((a, b) => new Date(b.dateValeur).getTime() - new Date(a.dateValeur).getTime())
      .slice(0, 6);
  }, [decodedId, operationsQuery.data]);

  if (!decodedId) {
    return (
      <EmptyState
        title="Choisissez un compte"
        subtitle="Sélectionnez un compte pour afficher ses opérations et associations."
      />
    );
  }

  const compte = compteQuery.data;
  const titulaires = compte?.titulaires?.map((titulaire) => titulaire.nom) ?? compte?.nomsTitulaires ?? [];

  return (
    <div className="glass-card space-y-6 p-6">
      <SectionHeader
        title={decodedId}
        subtitle={compte?.libelle ?? "Compte interne"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="nav-pill nav-pill-inactive" to="/comptes/interne">
              Retour
            </Link>
            <Link className="btn-glam" to="/operations/new">
              Nouvelle opération
            </Link>
          </div>
        }
      />

      {compteQuery.isError ? <ErrorNotice error={compteQuery.error} /> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card space-y-2 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Type</p>
          <p className="text-lg font-semibold">
            {compte?.typeFonctionnement?.libelle ??
              accountTypeLabel(compte?.codeTypeFonctionnement) ??
              "—"}
          </p>
          <p className="text-xs text-[color:var(--glam-muted)]">Fonctionnement</p>
        </div>
        <div className="glass-card space-y-2 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Banque</p>
          <p className="text-lg font-semibold">{compte?.banque?.nom ?? compte?.nomBanque ?? "—"}</p>
          <p className="text-xs text-[color:var(--glam-muted)]">Établissement rattaché</p>
        </div>
        <div className="glass-card space-y-2 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Solde initial</p>
          <p className="text-lg font-semibold">
            {compte?.montantSoldeInitialEnCentimes
              ? formatCurrencyFromCents(compte.montantSoldeInitialEnCentimes)
              : "—"}
          </p>
          <p className="text-xs text-[color:var(--glam-muted)]">
            {compte?.dateSoldeInitial ? formatDate(compte.dateSoldeInitial) : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h4 className="text-lg font-semibold">Titulaires associés</h4>
          {titulaires.length === 0 ? (
            <p className="text-sm text-[color:var(--glam-muted)]">Aucun titulaire associé.</p>
          ) : (
            <div className="grid gap-3">
              {titulaires.map((nomTitulaire) => (
                <Link
                  key={nomTitulaire}
                  to={`/references/titulaires/${encodeURIComponent(nomTitulaire)}`}
                  className="glass-card flex items-center justify-between gap-3 px-4 py-3 transition hover:translate-y-[-1px]"
                >
                  <span className="text-sm font-semibold">{truncate(nomTitulaire, 28)}</span>
                  <span className="badge-glam">Voir</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-lg font-semibold">Opérations liées</h4>
          {operationsQuery.isLoading ? (
            <p className="text-sm text-[color:var(--glam-muted)]">Chargement des opérations…</p>
          ) : null}
          {relatedOperations.length === 0 && !operationsQuery.isLoading ? (
            <p className="text-sm text-[color:var(--glam-muted)]">Aucune opération liée.</p>
          ) : (
            <div className="grid gap-3">
              {relatedOperations.map((operation) => (
                <Link
                  key={operation.numero}
                  to={`/operations/${operation.numero}`}
                  className="glass-card flex items-center justify-between gap-3 px-4 py-3 transition hover:translate-y-[-1px]"
                >
                  <div>
                    <p className="text-sm font-semibold">{truncate(operation.libelle ?? "Sans libellé", 26)}</p>
                    <p className="text-xs text-[color:var(--glam-muted)]">
                      {operation.codeTypeOperation ?? "Type"} · {formatDate(operation.dateValeur)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrencyFromCents(operation.montantEnCentimes)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
