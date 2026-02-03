import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { isValidIsoDate } from "../../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../../lib/validation";
import type { OperationCreationRequestDto } from "../../types/monatis";

export function OperationCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();

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

  const comptesInternes = comptesInternesQuery.data ?? [];
  const sousCategories = sousCategoriesQuery.data ?? [];
  const beneficiaires = beneficiairesQuery.data ?? [];

  const [numero, setNumero] = useState("");
  const [libelle, setLibelle] = useState("");
  const [codeTypeOperation, setCodeTypeOperation] = useState("");
  const [dateValeur, setDateValeur] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const [identifiantCompteDepense, setIdentifiantCompteDepense] = useState("");
  const [identifiantCompteRecette, setIdentifiantCompteRecette] = useState("");
  const [nomSousCategorie, setNomSousCategorie] = useState("");
  const [nomsBeneficiaires, setNomsBeneficiaires] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const montantEnCentimes = parseAmountToCents(montantEuros);

  const mutation = useMutation({
    mutationFn: (payload: OperationCreationRequestDto) => monatisApi.createOperation(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      push("Opération créée.");
      navigate(`/operations/${encodeURIComponent(data.numero)}`);
    },
  });

  const dateValid = isValidIsoDate(dateValeur);
  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;
  const canSubmit =
    codeTypeOperation.trim().length > 0 &&
    identifiantCompteDepense.trim().length > 0 &&
    identifiantCompteRecette.trim().length > 0 &&
    montantValide &&
    dateValid;

  return (
    <div className="glass-card space-y-6 p-6">
      <SectionHeader
        title="Nouvelle opération"
        subtitle="Créez une opération générique rapidement."
      />

      <form
        className="grid gap-4 lg:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || montantEnCentimes === null) {
            setShowErrors(true);
            return;
          }
          const payload: OperationCreationRequestDto = {
            numero: numero.trim() || undefined,
            libelle: libelle.trim() || undefined,
            codeTypeOperation: codeTypeOperation.trim(),
            dateValeur: dateValeur || undefined,
            montantEnCentimes,
            identifiantCompteDepense: identifiantCompteDepense.trim(),
            identifiantCompteRecette: identifiantCompteRecette.trim(),
            nomSousCategorie: nomSousCategorie.trim() || undefined,
            nomsBeneficiaires: nomsBeneficiaires
              ? nomsBeneficiaires.split(",").map((value) => value.trim()).filter(Boolean)
              : undefined,
          };
          mutation.mutate(payload);
        }}
      >
        <input
          className="input-glam"
          placeholder="Numéro (optionnel)"
          value={numero}
          onChange={(event) => setNumero(event.target.value)}
        />
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
        {showErrors && !codeTypeOperation.trim() ? (
          <p className="text-xs text-red-200">Code type opération obligatoire.</p>
        ) : null}
        <input
          className="input-glam"
          type="date"
          value={dateValeur}
          onChange={(event) => setDateValeur(event.target.value)}
        />
        {!dateValid ? (
          <p className="text-xs text-red-200">Date invalide (format attendu YYYY-MM-DD).</p>
        ) : null}
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
        <input
          className="input-glam"
          placeholder="Identifiant compte dépense"
          list="compte-interne-options"
          value={identifiantCompteDepense}
          onChange={(event) => setIdentifiantCompteDepense(event.target.value)}
        />
        {showErrors && !identifiantCompteDepense.trim() ? (
          <p className="text-xs text-red-200">Compte dépense obligatoire.</p>
        ) : null}
        <input
          className="input-glam"
          placeholder="Identifiant compte recette"
          list="compte-interne-options"
          value={identifiantCompteRecette}
          onChange={(event) => setIdentifiantCompteRecette(event.target.value)}
        />
        {showErrors && !identifiantCompteRecette.trim() ? (
          <p className="text-xs text-red-200">Compte recette obligatoire.</p>
        ) : null}
        <input
          className="input-glam"
          placeholder="Sous-catégorie (optionnel)"
          list="souscategorie-options"
          value={nomSousCategorie}
          onChange={(event) => setNomSousCategorie(event.target.value)}
        />
        <input
          className="input-glam"
          placeholder="Bénéficiaires (séparés par virgules)"
          list="beneficiaire-options"
          value={nomsBeneficiaires}
          onChange={(event) => setNomsBeneficiaires(event.target.value)}
        />

        <div className="flex flex-wrap gap-3 lg:col-span-2">
          <button className="btn-glam" type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? "Création..." : "Créer l'opération"}
          </button>
          <button
            type="button"
            className="nav-pill nav-pill-inactive"
            onClick={() => navigate("/operations")}
          >
            Annuler
          </button>
        </div>
      </form>

      {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}

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
