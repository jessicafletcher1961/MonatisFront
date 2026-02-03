import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { formatCurrencyFromCents, formatDate, truncate } from "../../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../../lib/validation";
import type { EvaluationCreationRequestDto } from "../../types/monatis";

export function EvaluationsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cle, setCle] = useState("");
  const [identifiantCompteInterne, setIdentifiantCompteInterne] = useState("");
  const [dateSolde, setDateSolde] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const { push } = useToast();
  const [showErrors, setShowErrors] = useState(false);

  const comptesInternesQuery = useQuery({
    queryKey: ["comptes", "interne"],
    queryFn: monatisApi.getComptesInternes,
  });

  const comptesInternes = comptesInternesQuery.data ?? [];

  const evaluationsQuery = useQuery({
    queryKey: ["evaluations"],
    queryFn: monatisApi.getEvaluations,
  });

  const createMutation = useMutation({
    mutationFn: (payload: EvaluationCreationRequestDto) => monatisApi.createEvaluation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      setCle("");
      setIdentifiantCompteInterne("");
      setDateSolde("");
      setLibelle("");
      setMontantEuros("");
      push("Évaluation créée.");
    },
  });

  const filtered = useMemo(() => {
    const data = evaluationsQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter(
      (item) =>
        item.cle.toLowerCase().includes(value) ||
        item.identifiantCompteInterne.toLowerCase().includes(value)
    );
  }, [evaluationsQuery.data, search]);

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

  const montantEnCentimes = parseAmountToCents(montantEuros);

  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;
  const canSubmit = identifiantCompteInterne.trim().length > 0 && montantValide;

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Évaluations"
        subtitle="Suivi des soldes et valorisations."
      />

      <form
        className="glass-card space-y-3 px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || montantEnCentimes === null) {
            setShowErrors(true);
            return;
          }
          createMutation.mutate({
            cle: cle.trim() || undefined,
            identifiantCompteInterne: identifiantCompteInterne.trim(),
            dateSolde: dateSolde || undefined,
            libelle: libelle.trim() || undefined,
            montantSoldeEnCentimes: montantEnCentimes,
          });
        }}
      >
        <div className="grid gap-3">
          <input
            className="input-glam"
            placeholder="Clé (optionnel)"
            value={cle}
            onChange={(event) => setCle(event.target.value)}
          />
          <input
            className="input-glam"
            placeholder="Identifiant compte interne"
            list="compte-interne-options"
            value={identifiantCompteInterne}
            onChange={(event) => setIdentifiantCompteInterne(event.target.value)}
          />
          {showErrors && !identifiantCompteInterne.trim() ? (
            <p className="text-xs text-red-200">Compte interne obligatoire.</p>
          ) : null}
          <input
            className="input-glam"
            type="date"
            value={dateSolde}
            onChange={(event) => setDateSolde(event.target.value)}
          />
          <input
            className="input-glam"
            placeholder="Libellé"
            value={libelle}
            onChange={(event) => setLibelle(event.target.value)}
          />
          <input
            className="input-glam"
            placeholder="Montant (EUR)"
            value={montantEuros}
            onChange={(event) => setMontantEuros(sanitizeAmountInput(event.target.value))}
            inputMode="decimal"
          />
          {showErrors && !montantValide ? (
            <p className="text-xs text-red-200">Montant obligatoire (chiffres uniquement).</p>
          ) : null}
        </div>
        <button className="btn-glam" type="submit" disabled={!canSubmit || createMutation.isPending}>
          {createMutation.isPending ? "Création..." : "Créer"}
        </button>
        {createMutation.isError ? <ErrorNotice error={createMutation.error} /> : null}
      </form>

      <input
        className="input-glam"
        placeholder="Rechercher une évaluation..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        ref={searchRef}
      />

      {evaluationsQuery.isError ? <ErrorNotice error={evaluationsQuery.error} /> : null}

      <div className="space-y-3">
        {evaluationsQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement des évaluations…</p>
        ) : null}
        {filtered.length === 0 && !evaluationsQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucune évaluation trouvée.</p>
        ) : null}
        {filtered.map((evaluation) => (
          <NavLink
            key={evaluation.cle}
            to={encodeURIComponent(evaluation.cle)}
            className={({ isActive }) =>
              `glass-card flex items-center justify-between gap-3 px-4 py-3 transition hover:translate-y-[-1px] ${
                isActive ? "glow-border" : ""
              }`
            }
          >
            <div>
              <p className="text-sm font-semibold">{truncate(evaluation.cle, 26)}</p>
              <p className="text-xs text-[color:var(--glam-muted)]">
                {evaluation.identifiantCompteInterne}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-[color:var(--glam-muted)]">
                  {formatDate(evaluation.dateSolde)}
                </p>
                <p className="text-sm font-semibold">
                  {formatCurrencyFromCents(evaluation.montantSoldeEnCentimes)}
                </p>
              </div>
              <button
                className="nav-pill nav-pill-inactive"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const value = evaluation.cle;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(value);
                  }
                  push("Clé copiée.");
                }}
              >
                Copier
              </button>
            </div>
          </NavLink>
        ))}
      </div>

      <datalist id="compte-interne-options">
        {comptesInternes.map((compte) => (
          <option
            key={compte.identifiant}
            value={compte.identifiant}
            label={`${compte.libelle ?? compte.identifiant} (${compte.codeTypeFonctionnement ?? "INTERNE"})`}
          />
        ))}
      </datalist>
    </div>
  );
}
