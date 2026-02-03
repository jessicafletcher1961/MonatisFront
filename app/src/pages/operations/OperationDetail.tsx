import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { EmptyState } from "../../components/EmptyState";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { formatCurrencyFromCents, formatDate, truncate } from "../../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../../lib/validation";
import type { OperationModificationRequestDto } from "../../types/monatis";

type EditableLine = {
  numeroLigne?: number | null;
  libelle: string;
  dateComptabilisation: string;
  montantEuros: string;
  nomSousCategorie: string;
  nomsBeneficiaires: string;
};

export function OperationDetail() {
  const { numero } = useParams();
  const decodedNumero = numero ? decodeURIComponent(numero) : "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { push } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [libelle, setLibelle] = useState("");
  const [codeTypeOperation, setCodeTypeOperation] = useState("");
  const [dateValeur, setDateValeur] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const [identifiantCompteDepense, setIdentifiantCompteDepense] = useState("");
  const [identifiantCompteRecette, setIdentifiantCompteRecette] = useState("");
  const [pointee, setPointee] = useState(false);
  const [lignesEdit, setLignesEdit] = useState<EditableLine[]>([]);
  const [lastSousCategorie, setLastSousCategorie] = useState("");
  const [lastBeneficiaires, setLastBeneficiaires] = useState("");

  const operationQuery = useQuery({
    queryKey: ["operations", decodedNumero],
    queryFn: () => monatisApi.getOperation(decodedNumero),
    enabled: Boolean(decodedNumero),
  });
  const operationsListQuery = useQuery({
    queryKey: ["operations"],
    queryFn: monatisApi.getOperations,
    enabled: Boolean(decodedNumero),
  });
  const comptesInternesQuery = useQuery({
    queryKey: ["comptes", "interne"],
    queryFn: monatisApi.getComptesInternes,
  });
  const sousCategoriesQuery = useQuery({
    queryKey: ["references", "souscategorie"],
    queryFn: monatisApi.getSousCategories,
  });
  const beneficiairesQuery = useQuery({
    queryKey: ["references", "beneficiaire"],
    queryFn: monatisApi.getBeneficiaires,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: OperationModificationRequestDto) =>
      monatisApi.updateOperation(decodedNumero, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      queryClient.invalidateQueries({ queryKey: ["operations", decodedNumero] });
      setIsEditing(false);
      push("Opération mise à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteOperation(decodedNumero),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      push("Opération supprimée.");
      navigate("/operations");
    },
  });

  const operation = operationQuery.data;
  const lignes = operation?.lignes ?? [];
  const comptesInternes = comptesInternesQuery.data ?? [];
  const sousCategories = sousCategoriesQuery.data ?? [];
  const beneficiaires = beneficiairesQuery.data ?? [];
  const operationMeta = operation as (typeof operation & {
    nomSousCategorie?: string | null;
    nomsBeneficiaires?: string[] | string | null;
    typeOperation?: { code?: string | null } | null;
    compteDepense?: { identifiant?: string | null; libelle?: string | null } | null;
    compteRecette?: { identifiant?: string | null; libelle?: string | null } | null;
  });

  const linkedSousCategories = useMemo(() => {
    const set = new Set<string>();
    lignes.forEach((line) => {
      if (line.nomSousCategorie) set.add(line.nomSousCategorie);
      if (line.sousCategorie?.nom) set.add(line.sousCategorie.nom);
    });
    if (operationMeta?.nomSousCategorie) {
      set.add(operationMeta.nomSousCategorie);
    }
    return Array.from(set);
  }, [lignes, operationMeta?.nomSousCategorie]);

  const linkedBeneficiaires = useMemo(() => {
    const set = new Set<string>();
    lignes.forEach((line) => {
      (line.nomsBeneficiaires ?? []).forEach((name) => set.add(name));
      (line.beneficiaires ?? []).forEach((beneficiaire) => {
        if (beneficiaire?.nom) set.add(beneficiaire.nom);
      });
    });
    if (Array.isArray(operationMeta?.nomsBeneficiaires)) {
      operationMeta.nomsBeneficiaires.forEach((name) => set.add(name));
    } else if (typeof operationMeta?.nomsBeneficiaires === "string") {
      operationMeta.nomsBeneficiaires
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((name) => set.add(name));
    }
    return Array.from(set);
  }, [lignes, operationMeta?.nomsBeneficiaires]);

  const typeFromList = operationsListQuery.data?.find(
    (item) => item.numero === decodedNumero
  )?.codeTypeOperation;
  const typeLabel =
    operation?.codeTypeOperation || operationMeta?.typeOperation?.code || typeFromList || "—";

  const depenseId =
    operation?.identifiantCompteDepense || operationMeta?.compteDepense?.identifiant || "";
  const recetteId =
    operation?.identifiantCompteRecette || operationMeta?.compteRecette?.identifiant || "";
  const depenseLabel =
    operationMeta?.compteDepense?.libelle || operation?.identifiantCompteDepense || depenseId;
  const recetteLabel =
    operationMeta?.compteRecette?.libelle || operation?.identifiantCompteRecette || recetteId;

  const lineAmounts = useMemo(
    () => lignesEdit.map((line) => parseAmountToCents(line.montantEuros)),
    [lignesEdit]
  );
  const linesValid = lignesEdit.length === 0 || lineAmounts.every((value) => value !== null);
  const totalLines = lineAmounts.reduce((sum, value) => sum + (value ?? 0), 0);
  const montantEnCentimes =
    lignesEdit.length > 0 ? totalLines : parseAmountToCents(montantEuros);
  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;
  const invalidLineCount = lignesEdit.filter(
    (line) => line.montantEuros.trim().length > 0 && parseAmountToCents(line.montantEuros) === null
  ).length;
  const manualMontant = parseAmountToCents(montantEuros);
  const mismatch =
    lignesEdit.length > 0 &&
    manualMontant !== null &&
    Math.abs(totalLines - manualMontant) > 0;

  const payload: OperationModificationRequestDto = {
    libelle: libelle.trim() || undefined,
    codeTypeOperation: codeTypeOperation.trim() || undefined,
    dateValeur: dateValeur || undefined,
    montantEnCentimes:
      lignesEdit.length > 0 ? (manualMontant ?? undefined) : montantEnCentimes ?? undefined,
    identifiantCompteDepense: identifiantCompteDepense.trim() || undefined,
    identifiantCompteRecette: identifiantCompteRecette.trim() || undefined,
    pointee,
    lignes:
      lignesEdit.length > 0
        ? lignesEdit.map((line) => ({
            numeroLigne: line.numeroLigne ?? undefined,
            libelle: line.libelle.trim() || undefined,
            dateComptabilisation: line.dateComptabilisation || undefined,
            montantEnCentimes: parseAmountToCents(line.montantEuros) ?? undefined,
            nomSousCategorie: line.nomSousCategorie.trim() || undefined,
            nomsBeneficiaires: line.nomsBeneficiaires
              ? line.nomsBeneficiaires
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean)
              : undefined,
          }))
        : undefined,
  };

  if (!decodedNumero) {
    return (
      <EmptyState
        title="Choisissez une opération"
        subtitle="Sélectionnez une opération pour afficher ses lignes et détails."
      />
    );
  }

  return (
    <div className="glass-card space-y-6 p-6">
      <SectionHeader
        title={decodedNumero}
        subtitle={operation?.libelle ?? "Détail opération"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="nav-pill nav-pill-inactive" to="/operations">
              Retour
            </Link>
            {isEditing ? (
              <>
                <button
                  className="btn-glam"
                  onClick={() => {
                    if (!montantValide || !linesValid || mismatch) return;
                    updateMutation.mutate(payload);
                  }}
                  disabled={
                    updateMutation.isPending || !montantValide || !linesValid || mismatch
                  }
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
                    setLibelle(operation?.libelle ?? "");
                    setCodeTypeOperation(operation?.codeTypeOperation ?? "");
                    setDateValeur(operation?.dateValeur ?? "");
                    setMontantEuros(
                      operation?.montantEnCentimes
                        ? (operation.montantEnCentimes / 100).toString()
                        : ""
                    );
                    setIdentifiantCompteDepense(
                      operation?.identifiantCompteDepense ||
                        operationMeta?.compteDepense?.identifiant ||
                        ""
                    );
                    setIdentifiantCompteRecette(
                      operation?.identifiantCompteRecette ||
                        operationMeta?.compteRecette?.identifiant ||
                        ""
                    );
                    setPointee(Boolean(operation?.pointee));
                    setLignesEdit(
                      (operation?.lignes ?? []).map((line) => ({
                        numeroLigne: line.numeroLigne,
                        libelle: line.libelle ?? "",
                        dateComptabilisation: line.dateComptabilisation ?? "",
                        montantEuros: line.montantEnCentimes
                          ? (line.montantEnCentimes / 100).toString()
                          : "",
                        nomSousCategorie: line.nomSousCategorie ?? "",
                        nomsBeneficiaires: line.nomsBeneficiaires?.join(", ") ?? "",
                      }))
                    );
                  }}
                >
                  Modifier
                </button>
                <button
                  className="nav-pill nav-pill-inactive"
                  onClick={() => {
                    if (!window.confirm(`Supprimer l'opération "${decodedNumero}" ?`)) return;
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

      {operationQuery.isError ? <ErrorNotice error={operationQuery.error} /> : null}
      {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
      {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}

      {isEditing ? (
        <div className="glass-card space-y-3 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="input-glam"
              placeholder="Libellé"
              value={libelle}
              onChange={(event) => setLibelle(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Code type opération"
              value={codeTypeOperation}
              onChange={(event) => setCodeTypeOperation(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateValeur}
              onChange={(event) => setDateValeur(event.target.value)}
            />
            <input
              className={`input-glam ${mismatch ? "border-red-400/60" : ""}`}
              placeholder="Montant (EUR)"
              value={montantEuros}
              onChange={(event) => setMontantEuros(sanitizeAmountInput(event.target.value))}
              disabled={false}
              inputMode="decimal"
            />
            {montantEuros.trim().length > 0 && !montantValide ? (
              <p className="text-xs text-red-200">Montant invalide (doit être supérieur à 0).</p>
            ) : null}
            <input
              className="input-glam"
              placeholder="Compte dépense"
              list="compte-interne-options"
              value={identifiantCompteDepense}
              onChange={(event) => setIdentifiantCompteDepense(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Compte recette"
              list="compte-interne-options"
              value={identifiantCompteRecette}
              onChange={(event) => setIdentifiantCompteRecette(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pointee}
              onChange={(event) => setPointee(event.target.checked)}
            />
            Opération pointée
          </label>
        </div>
      ) : null}

      {isEditing ? (
        <div className="glass-card space-y-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold">Lignes détaillées</h4>
              <p className="text-xs text-[color:var(--glam-muted)]">
                La somme des lignes définit automatiquement le montant global.
              </p>
            </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="glass-card px-3 py-2 text-xs">
              <p className="text-[color:var(--glam-muted)]">Total lignes</p>
              <p className="font-semibold">{formatCurrencyFromCents(totalLines)}</p>
            </div>
            {invalidLineCount > 0 ? (
              <span className="badge-glam border-red-400/60 text-red-200">
                {invalidLineCount} ligne(s) invalides
              </span>
            ) : (
              <span className="badge-glam">Lignes OK</span>
            )}
            {mismatch ? (
              <span className="badge-glam border-red-400/60 text-red-200">
                Total lignes ≠ Montant
              </span>
            ) : null}
          </div>
            <button
              className="btn-glam"
              onClick={() =>
                setLignesEdit((prev) => [
                  ...prev,
                  {
                    libelle: "",
                    dateComptabilisation: dateValeur,
                    montantEuros: "",
                    nomSousCategorie: lastSousCategorie,
                    nomsBeneficiaires: lastBeneficiaires,
                  },
                ])
              }
            >
              Ajouter une ligne
            </button>
          </div>

          {lignesEdit.length === 0 ? (
            <p className="text-sm text-[color:var(--glam-muted)]">
              Aucune ligne définie. Ajoutez-en pour détailler l'opération.
            </p>
          ) : (
            <div className="space-y-3">
              {lignesEdit.map((line, index) => (
                <div
                  key={`${line.numeroLigne ?? "new"}-${index}`}
                  className="glass-card space-y-3 px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Ligne {index + 1}</p>
                    <button
                      className="nav-pill nav-pill-inactive"
                      onClick={() =>
                        setLignesEdit((prev) => prev.filter((_, idx) => idx !== index))
                      }
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      className="input-glam"
                      placeholder="Libellé"
                      value={line.libelle}
                      onChange={(event) =>
                        setLignesEdit((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, libelle: event.target.value } : item
                          )
                        )
                      }
                    />
                    <input
                      className="input-glam"
                      type="date"
                      value={line.dateComptabilisation}
                      onChange={(event) =>
                        setLignesEdit((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, dateComptabilisation: event.target.value } : item
                          )
                        )
                      }
                    />
                    <input
                      className={`input-glam ${
                        line.montantEuros.trim().length > 0 &&
                        parseAmountToCents(line.montantEuros) === null
                          ? "border-red-400/60"
                          : ""
                      }`}
                      placeholder="Montant (EUR)"
                      value={line.montantEuros}
                      onChange={(event) =>
                        setLignesEdit((prev) =>
                          prev.map((item, idx) =>
                            idx === index
                              ? { ...item, montantEuros: sanitizeAmountInput(event.target.value) }
                              : item
                          )
                        )
                      }
                      inputMode="decimal"
                    />
                    <input
                      className="input-glam"
                      placeholder="Sous-catégorie"
                      list="souscategorie-options"
                      value={line.nomSousCategorie}
                      onChange={(event) =>
                        setLignesEdit((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, nomSousCategorie: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) => setLastSousCategorie(event.target.value)}
                    />
                    <input
                      className="input-glam md:col-span-2"
                      placeholder="Bénéficiaires (séparés par virgules)"
                      list="beneficiaire-options"
                      value={line.nomsBeneficiaires}
                      onChange={(event) =>
                        setLignesEdit((prev) =>
                          prev.map((item, idx) =>
                            idx === index ? { ...item, nomsBeneficiaires: event.target.value } : item
                          )
                        )
                      }
                      onBlur={(event) => setLastBeneficiaires(event.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-card space-y-2 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Type</p>
          <p className="text-lg font-semibold">{typeLabel}</p>
        </div>
        <div className="glass-card space-y-2 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Date valeur</p>
          <p className="text-lg font-semibold">{formatDate(operation?.dateValeur)}</p>
        </div>
        <div className="glass-card space-y-2 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Montant</p>
          <p className="text-lg font-semibold">
            {operation ? formatCurrencyFromCents(operation.montantEnCentimes) : "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <h4 className="text-lg font-semibold">Comptes associés</h4>
          <div className="grid gap-3">
            {depenseId ? (
              <Link
                to={`/comptes/interne/${depenseId}`}
                className="glass-card flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-semibold">Compte dépense</span>
                <span className="text-xs text-[color:var(--glam-muted)]">
                  {truncate(depenseLabel || depenseId, 24)}
                </span>
              </Link>
            ) : null}
            {recetteId ? (
              <Link
                to={`/comptes/interne/${recetteId}`}
                className="glass-card flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm font-semibold">Compte recette</span>
                <span className="text-xs text-[color:var(--glam-muted)]">
                  {truncate(recetteLabel || recetteId, 24)}
                </span>
              </Link>
            ) : null}
            {!depenseId && !recetteId ? (
              <p className="text-sm text-[color:var(--glam-muted)]">Aucun compte associé.</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-lg font-semibold">Lignes détaillées</h4>
          {lignes.length === 0 ? (
            <p className="text-sm text-[color:var(--glam-muted)]">Aucune ligne associée.</p>
          ) : (
            <div className="grid gap-3">
              {lignes.map((ligne) => (
                <div key={ligne.numeroLigne} className="glass-card px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{truncate(ligne.libelle ?? "Ligne", 28)}</p>
                    <span className="text-xs text-[color:var(--glam-muted)]">
                      {formatCurrencyFromCents(ligne.montantEnCentimes)}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--glam-muted)]">
                    {formatDate(ligne.dateComptabilisation)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass-card space-y-3 px-5 py-4">
          <h4 className="text-lg font-semibold">Sous-catégories liées</h4>
          {linkedSousCategories.length === 0 ? (
            <p className="text-sm text-[color:var(--glam-muted)]">Aucune sous-catégorie liée.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {linkedSousCategories.map((name) => (
                <span key={name} className="badge-glam">
                  {name}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link className="nav-pill nav-pill-inactive" to="/references">
              Gérer les références
            </Link>
            <Link className="nav-pill nav-pill-inactive" to="/budgets">
              Voir les budgets
            </Link>
          </div>
        </div>

        <div className="glass-card space-y-3 px-5 py-4">
          <h4 className="text-lg font-semibold">Bénéficiaires liés</h4>
          {linkedBeneficiaires.length === 0 ? (
            <p className="text-sm text-[color:var(--glam-muted)]">Aucun bénéficiaire lié.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {linkedBeneficiaires.map((name) => (
                <span key={name} className="badge-glam">
                  {name}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link className="nav-pill nav-pill-inactive" to="/references">
              Gérer les bénéficiaires
            </Link>
            <Link className="nav-pill nav-pill-inactive" to="/rapports">
              Voir les rapports
            </Link>
          </div>
        </div>
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
      <datalist id="souscategorie-options">
        {sousCategories.map((item) => (
          <option key={item.nom} value={item.nom} label={item.libelle ?? item.nom} />
        ))}
      </datalist>
      <datalist id="beneficiaire-options">
        {beneficiaires.map((item) => (
          <option key={item.nom} value={item.nom} label={item.libelle ?? item.nom} />
        ))}
      </datalist>
    </div>
  );
}
