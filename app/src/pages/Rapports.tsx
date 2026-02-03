import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { monatisApi } from "../api/monatis";
import { ErrorNotice } from "../components/ErrorNotice";
import { SectionHeader } from "../components/SectionHeader";
import { SectionTabs } from "../components/SectionTabs";
import { formatCurrency, formatDate, truncate } from "../lib/format";
import type {
  EtatPlusMoinsValueResponseDto,
  HistoriquePlusMoinsValueResponseDto,
  ListeResumeCompteInterneParTypeFonctionnementResponseDto,
  ReleveCompteResponseDto,
} from "../types/monatis";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function Rapports() {
  const [activeId, setActiveId] = useState("releve");
  const [identifiantCompte, setIdentifiantCompte] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [codeTypePeriode, setCodeTypePeriode] = useState("");
  const [dateCible, setDateCible] = useState("");

  const [releve, setReleve] = useState<ReleveCompteResponseDto | null>(null);
  const [historique, setHistorique] = useState<HistoriquePlusMoinsValueResponseDto | null>(null);
  const [etat, setEtat] = useState<EtatPlusMoinsValueResponseDto[] | null>(null);
  const [resume, setResume] = useState<ListeResumeCompteInterneParTypeFonctionnementResponseDto[] | null>(
    null
  );

  const releveMutation = useMutation({
    mutationFn: monatisApi.getReleveCompte,
    onSuccess: (data) => setReleve(data),
  });

  const relevePdfMutation = useMutation({
    mutationFn: monatisApi.getReleveComptePdf,
    onSuccess: (blob) => {
      downloadBlob(blob, `releve_${identifiantCompte || "compte"}.pdf`);
    },
  });

  const historiqueMutation = useMutation({
    mutationFn: monatisApi.getHistoriquePlusMoinsValue,
    onSuccess: (data) => setHistorique(data),
  });

  const etatMutation = useMutation({
    mutationFn: monatisApi.getEtatPlusMoinsValue,
    onSuccess: (data) => setEtat(data),
  });

  const resumeMutation = useMutation({
    mutationFn: monatisApi.getResumeComptesInternes,
    onSuccess: (data) => setResume(data),
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
      downloadBlob(blob, filename);
    },
  });

  const tabs = [
    {
      id: "releve",
      label: "Relevé",
      content: (
        <section className="glass-card space-y-6 p-6">
          <SectionHeader
            title="Relevé de compte"
            subtitle="Générez un relevé détaillé ou téléchargez le PDF officiel."
          />
          <form
            className="grid gap-4 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!identifiantCompte || !dateDebut) return;
              releveMutation.mutate({
                identifiantCompte,
                dateDebut,
                dateFin: dateFin || undefined,
              });
            }}
          >
            <input
              className="input-glam"
              placeholder="Identifiant compte"
              value={identifiantCompte}
              onChange={(event) => setIdentifiantCompte(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateDebut}
              onChange={(event) => setDateDebut(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateFin}
              onChange={(event) => setDateFin(event.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              <button className="btn-glam" type="submit" disabled={releveMutation.isPending}>
                {releveMutation.isPending ? "Génération..." : "Générer"}
              </button>
              <button
                className="nav-pill nav-pill-inactive"
                type="button"
                disabled={relevePdfMutation.isPending || !identifiantCompte || !dateDebut}
                onClick={() =>
                  relevePdfMutation.mutate({
                    identifiantCompte,
                    dateDebut,
                    dateFin: dateFin || undefined,
                  })
                }
              >
                {relevePdfMutation.isPending ? "PDF..." : "Télécharger PDF"}
              </button>
            </div>
          </form>

          {releveMutation.isError ? <ErrorNotice error={releveMutation.error} /> : null}
          {relevePdfMutation.isError ? <ErrorNotice error={relevePdfMutation.error} /> : null}

          {releve ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="glass-card space-y-2 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                    Période
                  </p>
                  <p className="text-sm font-semibold">
                    {formatDate(releve.dateDebutReleve)} → {formatDate(releve.dateFinReleve)}
                  </p>
                </div>
                <div className="glass-card space-y-2 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                    Solde début
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(releve.montantSoldeDebutReleveEnEuros)}
                  </p>
                </div>
                <div className="glass-card space-y-2 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                    Solde fin
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(releve.montantSoldeFinReleveEnEuros)}
                  </p>
                </div>
                <div className="glass-card space-y-2 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                    Total flux
                  </p>
                  <p className="text-sm font-semibold">
                    +{formatCurrency(releve.montantTotalOperationsRecetteEnEuros)} / -
                    {formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold">Recettes</h4>
                  {releve.operationsRecette.length === 0 ? (
                    <p className="text-sm text-[color:var(--glam-muted)]">Aucune recette.</p>
                  ) : (
                    <div className="grid gap-3">
                      {releve.operationsRecette.map((operation) => (
                        <div key={operation.numero} className="glass-card px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">
                              {truncate(operation.libelle ?? "Recette", 26)}
                            </p>
                            <span className="text-sm font-semibold">
                              {formatCurrency(operation.montantEnEuros)}
                            </span>
                          </div>
                          <p className="text-xs text-[color:var(--glam-muted)]">
                            {operation.codeTypeOperation} · {formatDate(operation.dateValeur)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <h4 className="text-lg font-semibold">Dépenses</h4>
                  {releve.operationsDepense.length === 0 ? (
                    <p className="text-sm text-[color:var(--glam-muted)]">Aucune dépense.</p>
                  ) : (
                    <div className="grid gap-3">
                      {releve.operationsDepense.map((operation) => (
                        <div key={operation.numero} className="glass-card px-4 py-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">
                              {truncate(operation.libelle ?? "Dépense", 26)}
                            </p>
                            <span className="text-sm font-semibold">
                              {formatCurrency(operation.montantEnEuros)}
                            </span>
                          </div>
                          <p className="text-xs text-[color:var(--glam-muted)]">
                            {operation.codeTypeOperation} · {formatDate(operation.dateValeur)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ),
    },
    {
      id: "historique",
      label: "Historique",
      content: (
        <section className="glass-card space-y-6 p-6">
          <SectionHeader
            title="Historique plus / moins value"
            subtitle="Analyse de performance sur une période ciblée."
          />
          <form
            className="grid gap-4 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!identifiantCompte) return;
              historiqueMutation.mutate({
                identifiantCompte,
                codeTypePeriode: codeTypePeriode || undefined,
                dateDebut: dateDebut || undefined,
                dateFin: dateFin || undefined,
              });
            }}
          >
            <input
              className="input-glam"
              placeholder="Identifiant compte"
              value={identifiantCompte}
              onChange={(event) => setIdentifiantCompte(event.target.value)}
            />
            <input
              className="input-glam"
              placeholder="Code période (ex: MENSUEL)"
              value={codeTypePeriode}
              onChange={(event) => setCodeTypePeriode(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateDebut}
              onChange={(event) => setDateDebut(event.target.value)}
            />
            <button className="btn-glam" type="submit" disabled={historiqueMutation.isPending}>
              {historiqueMutation.isPending ? "Chargement..." : "Afficher"}
            </button>
          </form>

          {historiqueMutation.isError ? <ErrorNotice error={historiqueMutation.error} /> : null}

          {historique ? (
            <div className="grid gap-3 md:grid-cols-2">
              {historique.plusMoinsValues.map((value, index) => (
                <div key={`${value.dateDebutEvaluation}-${index}`} className="glass-card px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                    {formatDate(value.dateDebutEvaluation)} → {formatDate(value.dateFinEvaluation)}
                  </p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(value.montantPlusMoinsValueEnEuros)} ({
                    value.montantPlusMoinsValueEnPourcentage.toFixed(2)}%)
                  </p>
                  <p className="text-xs text-[color:var(--glam-muted)]">
                    Réel: {formatCurrency(value.montantReelEnEuros)} · Technique:{" "}
                    {formatCurrency(value.montantTechniqueEnEuros)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ),
    },
    {
      id: "etat",
      label: "État",
      content: (
        <section className="glass-card space-y-6 p-6">
          <SectionHeader
            title="État plus / moins value"
            subtitle="Vision instantanée par période cible."
          />
          <form
            className="grid gap-4 lg:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!codeTypePeriode) return;
              etatMutation.mutate({
                codeTypePeriode,
                dateCible: dateCible || undefined,
              });
            }}
          >
            <input
              className="input-glam"
              placeholder="Code période (ex: MENSUEL)"
              value={codeTypePeriode}
              onChange={(event) => setCodeTypePeriode(event.target.value)}
            />
            <input
              className="input-glam"
              type="date"
              value={dateCible}
              onChange={(event) => setDateCible(event.target.value)}
            />
            <button className="btn-glam" type="submit" disabled={etatMutation.isPending}>
              {etatMutation.isPending ? "Chargement..." : "Afficher"}
            </button>
          </form>

          {etatMutation.isError ? <ErrorNotice error={etatMutation.error} /> : null}

          {etat ? (
            <div className="grid gap-3 md:grid-cols-2">
              {etat.map((item, index) => (
                <div key={index} className="glass-card px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
                    Compte
                  </p>
                  <p className="text-sm font-semibold">{JSON.stringify(item.enteteCompte)}</p>
                  <p className="text-xs text-[color:var(--glam-muted)]">
                    {formatCurrency(item.plusMoinsValue.montantPlusMoinsValueEnEuros)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ),
    },
    {
      id: "resume",
      label: "Résumé",
      content: (
        <section className="glass-card space-y-6 p-6">
          <SectionHeader
            title="Résumé comptes internes"
            subtitle="Synthèse des comptes par type de fonctionnement."
          />
          <form
            className="grid gap-4 lg:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              resumeMutation.mutate({
                dateCible: dateCible || undefined,
              });
            }}
          >
            <input
              className="input-glam"
              type="date"
              value={dateCible}
              onChange={(event) => setDateCible(event.target.value)}
            />
            <button className="btn-glam" type="submit" disabled={resumeMutation.isPending}>
              {resumeMutation.isPending ? "Chargement..." : "Afficher"}
            </button>
          </form>

          {resumeMutation.isError ? <ErrorNotice error={resumeMutation.error} /> : null}

          {resume ? (
            <div className="space-y-4">
              {resume.map((group, index) => (
                <div key={index} className="glass-card space-y-3 px-4 py-3">
                  <p className="text-sm font-semibold">{group.typeFonctionnement.libelle}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.comptesInternes.map((compte) => (
                      <div key={compte.compteInterne.identifiant} className="glass-card px-4 py-3">
                        <p className="text-sm font-semibold">
                          {truncate(compte.compteInterne.libelle ?? compte.compteInterne.identifiant, 26)}
                        </p>
                        <p className="text-xs text-[color:var(--glam-muted)]">
                          {formatDate(compte.dateSolde)} · {formatCurrency(compte.montantSoldeEnEuros)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ),
    },
    {
      id: "exports",
      label: "Exports",
      content: (
        <section className="glass-card space-y-6 p-6">
          <SectionHeader
            title="Exports CSV"
            subtitle="Téléchargez les exports de configuration et de tables."
          />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <button
              className="btn-glam"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvTypeOperation,
                  filename: "types_operation.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Types d'opérations
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
              Operations / Types
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvOperationsErreurs,
                  filename: "operations_erreurs.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Erreurs opérations
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvComptesTypes,
                  filename: "comptes_types.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Types comptes
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvComptesErreurs,
                  filename: "comptes_erreurs.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Erreurs comptes
            </button>
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
              Tables comptes
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvBudgetsTypes,
                  filename: "budgets_types.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Types budgets
            </button>
            <button
              className="nav-pill nav-pill-inactive"
              onClick={() =>
                csvMutation.mutate({
                  fetcher: monatisApi.getCsvBudgetsErreurs,
                  filename: "budgets_erreurs.csv",
                })
              }
              disabled={csvMutation.isPending}
            >
              Erreurs budgets
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
              Tables budgets
            </button>
          </div>

          {csvMutation.isError ? <ErrorNotice error={csvMutation.error} /> : null}
        </section>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <SectionTabs tabs={tabs} activeId={activeId} onChange={setActiveId} />
    </div>
  );
}
