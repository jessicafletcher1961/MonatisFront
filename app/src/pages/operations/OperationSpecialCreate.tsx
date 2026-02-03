import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { isValidIsoDate } from "../../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../../lib/validation";
import type { OperationRequestDto } from "../../types/monatis";

type OperationSpecialType =
  | "transfert"
  | "depense"
  | "recette"
  | "vente"
  | "achat"
  | "retrait"
  | "liquidation"
  | "depot"
  | "investissement";

const SPECIAL_TYPES: { value: OperationSpecialType; label: string; helper: string }[] = [
  {
    value: "transfert",
    label: "Transfert",
    helper: "Entre deux comptes courants internes.",
  },
  {
    value: "depense",
    label: "Dépense",
    helper: "Compte externe → compte courant.",
  },
  {
    value: "recette",
    label: "Recette",
    helper: "Compte externe → compte courant.",
  },
  {
    value: "vente",
    label: "Vente",
    helper: "Bien patrimonial → compte externe.",
  },
  {
    value: "achat",
    label: "Achat",
    helper: "Compte externe → bien patrimonial.",
  },
  {
    value: "retrait",
    label: "Retrait",
    helper: "Financier → courant.",
  },
  {
    value: "liquidation",
    label: "Liquidation",
    helper: "Financier → courant.",
  },
  {
    value: "depot",
    label: "Dépôt",
    helper: "Courant → financier.",
  },
  {
    value: "investissement",
    label: "Investissement",
    helper: "Courant → financier.",
  },
];

export function OperationSpecialCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();

  const comptesInternesQuery = useQuery({
    queryKey: ["comptes", "interne"],
    queryFn: monatisApi.getComptesInternes,
  });
  const comptesExternesQuery = useQuery({
    queryKey: ["comptes", "externe"],
    queryFn: monatisApi.getComptesExternes,
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
  const comptesExternes = comptesExternesQuery.data ?? [];
  const sousCategories = sousCategoriesQuery.data ?? [];
  const beneficiaires = beneficiairesQuery.data ?? [];

  const [type, setType] = useState<OperationSpecialType>("transfert");
  const [numero, setNumero] = useState("");
  const [libelle, setLibelle] = useState("");
  const [dateValeur, setDateValeur] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const [identifiantCompteExterne, setIdentifiantCompteExterne] = useState("");
  const [identifiantCompteCourant, setIdentifiantCompteCourant] = useState("");
  const [identifiantCompteCourantRecette, setIdentifiantCompteCourantRecette] = useState("");
  const [identifiantCompteCourantDepense, setIdentifiantCompteCourantDepense] = useState("");
  const [identifiantCompteFinancier, setIdentifiantCompteFinancier] = useState("");
  const [identifiantCompteBien, setIdentifiantCompteBien] = useState("");
  const [nomSousCategorie, setNomSousCategorie] = useState("");
  const [nomsBeneficiaires, setNomsBeneficiaires] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const montantEnCentimes = parseAmountToCents(montantEuros);

  const mutation = useMutation({
    mutationFn: (payload: OperationRequestDto) => {
      const map = {
        transfert: monatisApi.createOperationTransfert,
        depense: monatisApi.createOperationDepense,
        recette: monatisApi.createOperationRecette,
        vente: monatisApi.createOperationVente,
        achat: monatisApi.createOperationAchat,
        retrait: monatisApi.createOperationRetrait,
        liquidation: monatisApi.createOperationLiquidation,
        depot: monatisApi.createOperationDepot,
        investissement: monatisApi.createOperationInvestissement,
      } as const;
      return map[type](payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      push("Opération créée.");
      navigate(`/operations/${encodeURIComponent(data.numero)}`);
    },
  });

  const requiredFields = useMemo(() => {
    switch (type) {
      case "transfert":
        return ["identifiantCompteCourantDepense", "identifiantCompteCourantRecette"];
      case "depense":
      case "recette":
        return ["identifiantCompteExterne", "identifiantCompteCourant"];
      case "vente":
      case "achat":
        return ["identifiantCompteExterne", "identifiantCompteBien"];
      case "retrait":
      case "liquidation":
      case "depot":
      case "investissement":
        return ["identifiantCompteFinancier", "identifiantCompteCourant"];
      default:
        return [];
    }
  }, [type]);

  const dateValid = isValidIsoDate(dateValeur);
  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;
  const canSubmit = Boolean(
    montantValide &&
      requiredFields.every((field) => {
        switch (field) {
          case "identifiantCompteCourantDepense":
            return identifiantCompteCourantDepense.trim().length > 0;
          case "identifiantCompteCourantRecette":
            return identifiantCompteCourantRecette.trim().length > 0;
          case "identifiantCompteExterne":
            return identifiantCompteExterne.trim().length > 0;
          case "identifiantCompteCourant":
            return identifiantCompteCourant.trim().length > 0;
          case "identifiantCompteFinancier":
            return identifiantCompteFinancier.trim().length > 0;
          case "identifiantCompteBien":
            return identifiantCompteBien.trim().length > 0;
          default:
            return true;
        }
      }) &&
    dateValid
  );

  const payload: OperationRequestDto = {
    numero: numero.trim() || undefined,
    libelle: libelle.trim() || undefined,
    dateValeur: dateValeur || undefined,
    montantEnCentimes: montantEnCentimes ?? undefined,
    identifiantCompteExterne: identifiantCompteExterne.trim() || undefined,
    identifiantCompteCourant: identifiantCompteCourant.trim() || undefined,
    identifiantCompteCourantRecette: identifiantCompteCourantRecette.trim() || undefined,
    identifiantCompteCourantDepense: identifiantCompteCourantDepense.trim() || undefined,
    identifiantCompteFinancier: identifiantCompteFinancier.trim() || undefined,
    identifiantCompteBien: identifiantCompteBien.trim() || undefined,
    nomSousCategorie: nomSousCategorie.trim() || undefined,
    nomsBeneficiaires: nomsBeneficiaires
      ? nomsBeneficiaires.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined,
  };

  const showCompteCourant = ["depense", "recette", "retrait", "liquidation", "depot", "investissement"].includes(type);
  const showCompteCourantTransfert = type === "transfert";
  const showCompteExterne = ["depense", "recette", "vente", "achat"].includes(type);
  const showCompteBien = ["vente", "achat"].includes(type);
  const showCompteFinancier = ["retrait", "liquidation", "depot", "investissement"].includes(type);
  const showDetails = ["depense", "recette"].includes(type);

  return (
    <div className="glass-card space-y-6 p-6">
      <SectionHeader
        title="Opération spécialisée"
        subtitle="Choisissez un type et renseignez les comptes requis."
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
            Type d'opération
          </label>
          <div className="mt-2 grid gap-2">
            {SPECIAL_TYPES.map((option) => (
              <button
                key={option.value}
                className={`glass-card px-4 py-3 text-left transition ${
                  type === option.value ? "glow-border" : ""
                }`}
                onClick={() => setType(option.value)}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="text-xs text-[color:var(--glam-muted)]">{option.helper}</p>
              </button>
            ))}
          </div>
        </div>

        <form
          className="glass-card space-y-4 px-5 py-4 lg:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit || montantEnCentimes === null) {
              setShowErrors(true);
              return;
            }
            mutation.mutate(payload);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
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
          </div>

          {showCompteCourantTransfert ? (
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input-glam"
                placeholder="Compte courant dépense"
                list="compte-interne-options"
                value={identifiantCompteCourantDepense}
                onChange={(event) => setIdentifiantCompteCourantDepense(event.target.value)}
              />
              {showErrors && !identifiantCompteCourantDepense.trim() ? (
                <p className="text-xs text-red-200">Compte courant dépense obligatoire.</p>
              ) : null}
              <input
                className="input-glam"
                placeholder="Compte courant recette"
                list="compte-interne-options"
                value={identifiantCompteCourantRecette}
                onChange={(event) => setIdentifiantCompteCourantRecette(event.target.value)}
              />
              {showErrors && !identifiantCompteCourantRecette.trim() ? (
                <p className="text-xs text-red-200">Compte courant recette obligatoire.</p>
              ) : null}
            </div>
          ) : null}

          {showCompteCourant ? (
            <>
              <input
                className="input-glam"
                placeholder="Compte courant"
                list="compte-interne-options"
                value={identifiantCompteCourant}
                onChange={(event) => setIdentifiantCompteCourant(event.target.value)}
              />
              {showErrors && !identifiantCompteCourant.trim() ? (
                <p className="text-xs text-red-200">Compte courant obligatoire.</p>
              ) : null}
            </>
          ) : null}

          {showCompteExterne ? (
            <>
              <input
                className="input-glam"
                placeholder="Compte externe"
                list="compte-externe-options"
                value={identifiantCompteExterne}
                onChange={(event) => setIdentifiantCompteExterne(event.target.value)}
              />
              {showErrors && !identifiantCompteExterne.trim() ? (
                <p className="text-xs text-red-200">Compte externe obligatoire.</p>
              ) : null}
            </>
          ) : null}

          {showCompteBien ? (
            <>
              <input
                className="input-glam"
                placeholder="Compte bien"
                list="compte-interne-options"
                value={identifiantCompteBien}
                onChange={(event) => setIdentifiantCompteBien(event.target.value)}
              />
              {showErrors && !identifiantCompteBien.trim() ? (
                <p className="text-xs text-red-200">Compte bien obligatoire.</p>
              ) : null}
            </>
          ) : null}

          {showCompteFinancier ? (
            <>
              <input
                className="input-glam"
                placeholder="Compte financier"
                list="compte-interne-options"
                value={identifiantCompteFinancier}
                onChange={(event) => setIdentifiantCompteFinancier(event.target.value)}
              />
              {showErrors && !identifiantCompteFinancier.trim() ? (
                <p className="text-xs text-red-200">Compte financier obligatoire.</p>
              ) : null}
            </>
          ) : null}

          {showDetails ? (
            <div className="grid gap-3 md:grid-cols-2">
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
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
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

          {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
        </form>
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
      <datalist id="compte-externe-options">
        {comptesExternes.map((compte) => (
          <option
            key={compte.identifiant}
            value={compte.identifiant}
            label={compte.libelle ?? compte.identifiant}
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
