import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { EmptyState } from "../../components/EmptyState";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { formatCurrencyFromCents, formatDate } from "../../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../../lib/validation";
import type { EvaluationCreationRequestDto } from "../../types/monatis";

export function EvaluationDetail() {
  const { cle } = useParams();
  const decodedCle = cle ? decodeURIComponent(cle) : "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { push } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [identifiantCompteInterne, setIdentifiantCompteInterne] = useState("");
  const [dateSolde, setDateSolde] = useState("");
  const [libelle, setLibelle] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const evaluationQuery = useQuery({
    queryKey: ["evaluations", decodedCle],
    queryFn: () => monatisApi.getEvaluation(decodedCle),
    enabled: Boolean(decodedCle),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: EvaluationCreationRequestDto) =>
      monatisApi.updateEvaluation(decodedCle, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      queryClient.invalidateQueries({ queryKey: ["evaluations", decodedCle] });
      setIsEditing(false);
      push("Évaluation mise à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteEvaluation(decodedCle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
      push("Évaluation supprimée.");
      navigate("/evaluations");
    },
  });

  if (!decodedCle) {
    return (
      <EmptyState
        title="Choisissez une évaluation"
        subtitle="Sélectionnez une évaluation pour afficher son détail."
      />
    );
  }

  const evaluation = evaluationQuery.data;
  const montantEnCentimes = parseAmountToCents(montantEuros);
  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;

  return (
    <div className="glass-card space-y-6 p-6">
      <SectionHeader
        title={decodedCle}
        subtitle={evaluation?.libelle ?? "Détail évaluation"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="nav-pill nav-pill-inactive" to="/evaluations">
              Retour
            </Link>
            {isEditing ? (
              <>
                <button
                  className="btn-glam"
                  onClick={() => {
                    if (!montantValide || !identifiantCompteInterne.trim()) {
                      setShowErrors(true);
                      return;
                    }
                    updateMutation.mutate({
                      cle: decodedCle,
                      identifiantCompteInterne: identifiantCompteInterne.trim(),
                      dateSolde: dateSolde || undefined,
                      libelle: libelle.trim() || undefined,
                      montantSoldeEnCentimes: montantEnCentimes ?? undefined,
                    });
                  }}
                  disabled={updateMutation.isPending || !montantValide}
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  className="nav-pill nav-pill-inactive"
                  onClick={() => setIsEditing(false)}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-glam"
                  onClick={() => {
                    setIsEditing(true);
                    setIdentifiantCompteInterne(evaluation?.compteInterne?.identifiant ?? "");
                    setDateSolde(evaluation?.dateSolde ?? "");
                    setLibelle(evaluation?.libelle ?? "");
                    setMontantEuros(
                      evaluation?.montantSoldeEnCentimes
                        ? (evaluation.montantSoldeEnCentimes / 100).toString()
                        : ""
                    );
                  }}
                >
                  Modifier
                </button>
                <button
                  className="nav-pill nav-pill-inactive"
                  onClick={() => {
                    if (!window.confirm(`Supprimer l'évaluation "${decodedCle}" ?`)) return;
                    deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        }
      />

      {evaluationQuery.isError ? <ErrorNotice error={evaluationQuery.error} /> : null}
      {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
      {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}

      {evaluation ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-card space-y-2 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
              Date solde
            </p>
            <p className="text-lg font-semibold">{formatDate(evaluation.dateSolde)}</p>
          </div>
          <div className="glass-card space-y-2 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
              Montant
            </p>
            <p className="text-lg font-semibold">
              {formatCurrencyFromCents(evaluation.montantSoldeEnCentimes)}
            </p>
          </div>
          <div className="glass-card space-y-2 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
              Compte interne
            </p>
            <p className="text-lg font-semibold">{evaluation.compteInterne?.identifiant ?? "—"}</p>
          </div>
        </div>
      ) : null}

      {isEditing ? (
        <div className="glass-card space-y-3 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="input-glam"
              placeholder="Identifiant compte interne"
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
        </div>
      ) : null}
    </div>
  );
}
