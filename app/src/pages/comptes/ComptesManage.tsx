import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { SectionHeader } from "../../components/SectionHeader";
import { SectionTabs } from "../../components/SectionTabs";
import { useToast } from "../../components/useToast";
import { accountTypeLabel, formatDate, truncate } from "../../lib/format";
import { parseAmountToCents, sanitizeAmountInput } from "../../lib/validation";
import type { CompteInterneRequestDto, CompteRequestDto, CompteResponseDto } from "../../types/monatis";

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function CompteSimpleSection({
  title,
  subtitle,
  queryKey,
  fetcher,
  create,
  update,
  remove,
}: {
  title: string;
  subtitle: string;
  queryKey: string[];
  fetcher: () => Promise<CompteResponseDto[]>;
  create: (payload: CompteRequestDto) => Promise<CompteResponseDto>;
  update: (identifiant: string, payload: CompteRequestDto) => Promise<CompteResponseDto>;
  remove: (identifiant: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const comptesQuery = useQuery({
    queryKey,
    queryFn: fetcher,
  });

  const createMutation = useMutation({
    mutationFn: create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Compte créé.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CompteRequestDto) => update(identifiant, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Compte mis à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => remove(identifiant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      push("Compte supprimé.");
    },
  });

  const filtered = useMemo(() => {
    const data = comptesQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter((item) => item.identifiant.toLowerCase().includes(value));
  }, [comptesQuery.data, search]);

  const canSubmit = identifiant.trim().length > 0;

  return (
    <section className="glass-card space-y-6 p-6">
      <SectionHeader title={title} subtitle={subtitle} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="glass-card space-y-3 px-5 py-4">
          <h4 className="text-lg font-semibold">Créer / Modifier</h4>
          <input
            className="input-glam"
            placeholder="Identifiant"
            value={identifiant}
            onChange={(event) => setIdentifiant(event.target.value)}
          />
          <input
            className="input-glam"
            placeholder="Libellé"
            value={libelle}
            onChange={(event) => setLibelle(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-glam"
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => {
                if (!canSubmit) {
                  setShowErrors(true);
                  return;
                }
                createMutation.mutate({ identifiant: identifiant.trim(), libelle: libelle.trim() });
              }}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              disabled={!canSubmit || updateMutation.isPending}
              onClick={() => {
                if (!canSubmit) {
                  setShowErrors(true);
                  return;
                }
                updateMutation.mutate({ identifiant: identifiant.trim(), libelle: libelle.trim() });
              }}
            >
              {updateMutation.isPending ? "Mise à jour..." : "Modifier"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() => {
                setIdentifiant("");
                setLibelle("");
              }}
            >
              Effacer
            </button>
          </div>
          {showErrors && !canSubmit ? (
            <p className="text-xs text-red-200">Identifiant obligatoire.</p>
          ) : null}
          {createMutation.isError ? <ErrorNotice error={createMutation.error} /> : null}
          {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
        </div>

        <div className="glass-card space-y-3 px-5 py-4">
          <h4 className="text-lg font-semibold">Supprimer</h4>
          <button
            className="nav-pill nav-pill-inactive"
            disabled={!canSubmit || deleteMutation.isPending}
            onClick={() => {
              if (!window.confirm(`Supprimer "${identifiant}" ?`)) return;
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
          </button>
          {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}
        </div>
      </div>

      <div className="space-y-4">
        <input
          className="input-glam max-w-md"
          placeholder="Rechercher un compte..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {comptesQuery.isError ? <ErrorNotice error={comptesQuery.error} /> : null}
        {comptesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement...</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((compte) => (
            <button
              key={compte.identifiant}
              className="glass-card flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:translate-y-[-1px]"
              onClick={() => {
                setIdentifiant(compte.identifiant);
                setLibelle(compte.libelle ?? "");
              }}
            >
              <div>
                <p className="text-sm font-semibold">{truncate(compte.identifiant, 28)}</p>
                <p className="text-xs text-[color:var(--glam-muted)]">{compte.libelle ?? "—"}</p>
              </div>
              <span className="badge-glam">Éditer</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompteInterneSection() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [search, setSearch] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [libelle, setLibelle] = useState("");
  const [codeTypeFonctionnement, setCodeTypeFonctionnement] = useState("");
  const [dateSoldeInitial, setDateSoldeInitial] = useState("");
  const [montantEuros, setMontantEuros] = useState("");
  const [nomBanque, setNomBanque] = useState("");
  const [nomsTitulaires, setNomsTitulaires] = useState("");
  const [dateCloture, setDateCloture] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const typeOptions = ["COURANT", "FINANCIER", "BIEN"];

  const banquesQuery = useQuery({
    queryKey: ["references", "banque"],
    queryFn: monatisApi.getBanques,
  });
  const titulairesQuery = useQuery({
    queryKey: ["references", "titulaire"],
    queryFn: monatisApi.getTitulaires,
  });

  const banques = banquesQuery.data ?? [];
  const titulaires = titulairesQuery.data ?? [];

  const comptesQuery = useQuery({
    queryKey: ["comptes", "interne"],
    queryFn: monatisApi.getComptesInternes,
  });

  const createMutation = useMutation({
    mutationFn: monatisApi.createCompteInterne,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comptes", "interne"] });
      push("Compte interne créé.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CompteInterneRequestDto) =>
      monatisApi.updateCompteInterne(identifiant, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comptes", "interne"] });
      push("Compte interne mis à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteCompteInterne(identifiant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comptes", "interne"] });
      push("Compte interne supprimé.");
    },
  });

  const filtered = useMemo(() => {
    const data = comptesQuery.data ?? [];
    if (!search) return data;
    const value = search.toLowerCase();
    return data.filter((item) => item.identifiant.toLowerCase().includes(value));
  }, [comptesQuery.data, search]);

  const montantEnCentimes = parseAmountToCents(montantEuros);
  const payload: CompteInterneRequestDto = {
    identifiant: identifiant.trim() || undefined,
    libelle: libelle.trim() || undefined,
    codeTypeFonctionnement: codeTypeFonctionnement.trim() || undefined,
    dateSoldeInitial: dateSoldeInitial || undefined,
    montantSoldeInitialEnCentimes: montantEnCentimes ?? undefined,
    nomBanque: nomBanque.trim() || undefined,
    nomsTitulaires: nomsTitulaires ? parseList(nomsTitulaires) : undefined,
    dateCloture: dateCloture || undefined,
  };

  const montantValide = montantEnCentimes !== null && montantEnCentimes > 0;
  const canCreate =
    Boolean(payload.identifiant) &&
    Boolean(payload.codeTypeFonctionnement) &&
    Boolean(payload.dateSoldeInitial) &&
    montantValide;

  const canUpdate = Boolean(payload.identifiant);

  return (
    <section className="glass-card space-y-6 p-6">
      <SectionHeader title="Comptes internes" subtitle="Création et gestion des comptes internes." />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass-card space-y-3 px-5 py-4">
          <h4 className="text-lg font-semibold">Créer / Modifier</h4>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="input-glam"
              placeholder="Identifiant"
              value={identifiant}
              onChange={(event) => setIdentifiant(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Libellé"
              value={libelle}
              onChange={(event) => setLibelle(event.target.value)}
            />
            <select
              className="input-glam"
              value={codeTypeFonctionnement}
              onChange={(event) => setCodeTypeFonctionnement(event.target.value)}
            >
              <option value="">Type fonctionnement</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              className="input-glam"
              type="date"
              value={dateSoldeInitial}
              onChange={(event) => setDateSoldeInitial(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Montant solde initial (EUR)"
              value={montantEuros}
              onChange={(event) => setMontantEuros(sanitizeAmountInput(event.target.value))}
              inputMode="decimal"
            />
            <input
              className="input-glam"
              placeholder="Banque (nom)"
              list="banque-options"
              value={nomBanque}
              onChange={(event) => setNomBanque(event.target.value)}
            />
            <input
              className="input-glam md:col-span-2"
              placeholder="Titulaires (séparés par virgules)"
              list="titulaire-options"
              value={nomsTitulaires}
              onChange={(event) => setNomsTitulaires(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateCloture}
              onChange={(event) => setDateCloture(event.target.value)}
            />
          </div>
          {showErrors && !payload.identifiant ? (
            <p className="text-xs text-red-200">Identifiant obligatoire.</p>
          ) : null}
          {showErrors && !payload.codeTypeFonctionnement ? (
            <p className="text-xs text-red-200">
              Type fonctionnement obligatoire. Valeurs: COURANT, FINANCIER, BIEN.
            </p>
          ) : null}
          {showErrors && !payload.dateSoldeInitial ? (
            <p className="text-xs text-red-200">Date solde initial obligatoire.</p>
          ) : null}
          {showErrors && !montantValide ? (
            <p className="text-xs text-red-200">
              Montant obligatoire (chiffres uniquement).
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-glam"
              disabled={!canCreate || createMutation.isPending}
              onClick={() => {
                if (!canCreate) {
                  setShowErrors(true);
                  return;
                }
                createMutation.mutate(payload);
              }}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              disabled={!canUpdate || updateMutation.isPending}
              onClick={() => {
                if (!canUpdate) {
                  setShowErrors(true);
                  return;
                }
                updateMutation.mutate(payload);
              }}
            >
              {updateMutation.isPending ? "Mise à jour..." : "Modifier"}
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() => {
                setIdentifiant("");
                setLibelle("");
                setCodeTypeFonctionnement("");
                setDateSoldeInitial("");
                setMontantEuros("");
                setNomBanque("");
                setNomsTitulaires("");
                setDateCloture("");
              }}
            >
              Effacer
            </button>
          </div>
          {createMutation.isError ? <ErrorNotice error={createMutation.error} /> : null}
          {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
        </div>

        <div className="glass-card space-y-3 px-5 py-4">
          <h4 className="text-lg font-semibold">Supprimer</h4>
          <button
            className="nav-pill nav-pill-inactive"
            disabled={!identifiant || deleteMutation.isPending}
            onClick={() => {
              if (!identifiant) return;
              if (!window.confirm(`Supprimer "${identifiant}" ?`)) return;
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
          </button>
          {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}
        </div>
      </div>

      <div className="space-y-4">
        <input
          className="input-glam max-w-md"
          placeholder="Rechercher un compte interne..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {comptesQuery.isError ? <ErrorNotice error={comptesQuery.error} /> : null}
        {comptesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement...</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((compte) => (
            <button
              key={compte.identifiant}
              className="glass-card flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:translate-y-[-1px]"
              onClick={() => {
                setIdentifiant(compte.identifiant);
                setLibelle(compte.libelle ?? "");
                setCodeTypeFonctionnement(
                  typeOptions.includes(compte.codeTypeFonctionnement ?? "")
                    ? (compte.codeTypeFonctionnement ?? "")
                    : ""
                );
                setDateSoldeInitial(compte.dateSoldeInitial ?? "");
                setMontantEuros(
                  compte.montantSoldeInitialEnCentimes
                    ? (compte.montantSoldeInitialEnCentimes / 100).toString()
                    : ""
                );
                setNomBanque(compte.nomBanque ?? "");
                setNomsTitulaires(compte.nomsTitulaires?.join(", ") ?? "");
                setDateCloture(compte.dateCloture ?? "");
              }}
            >
              <div>
                <p className="text-sm font-semibold">{truncate(compte.identifiant, 28)}</p>
                <p className="text-xs text-[color:var(--glam-muted)]">{compte.libelle ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[color:var(--glam-muted)]">
                  {accountTypeLabel(compte.codeTypeFonctionnement)}
                </p>
                <p className="text-xs text-[color:var(--glam-muted)]">
                  {compte.dateSoldeInitial ? formatDate(compte.dateSoldeInitial) : "—"}
                </p>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && !comptesQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucun compte interne.</p>
        ) : null}
      </div>

      <datalist id="banque-options">
        {banques.map((banque) => (
          <option key={banque.nom} value={banque.nom} label={banque.libelle ?? banque.nom} />
        ))}
      </datalist>
      <datalist id="titulaire-options">
        {titulaires.map((titulaire) => (
          <option
            key={titulaire.nom}
            value={titulaire.nom}
            label={titulaire.libelle ?? titulaire.nom}
          />
        ))}
      </datalist>
    </section>
  );
}

export function ComptesManage() {
  const [activeId, setActiveId] = useState("interne");
  const tabs = [
    {
      id: "interne",
      label: "Internes",
      content: <CompteInterneSection />,
    },
    {
      id: "externe",
      label: "Externes",
      content: (
        <CompteSimpleSection
          title="Comptes externes"
          subtitle="Gestion des comptes externes."
          queryKey={["comptes", "externe"]}
          fetcher={monatisApi.getComptesExternes}
          create={monatisApi.createCompteExterne}
          update={monatisApi.updateCompteExterne}
          remove={monatisApi.deleteCompteExterne}
        />
      ),
    },
    {
      id: "technique",
      label: "Techniques",
      content: (
        <CompteSimpleSection
          title="Comptes techniques"
          subtitle="Gestion des comptes techniques."
          queryKey={["comptes", "technique"]}
          fetcher={monatisApi.getComptesTechniques}
          create={monatisApi.createCompteTechnique}
          update={monatisApi.updateCompteTechnique}
          remove={monatisApi.deleteCompteTechnique}
        />
      ),
    },
  ];
  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} activeId={activeId} onChange={setActiveId} />
    </div>
  );
}
