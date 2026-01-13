import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { safeFormatLocalDate, toLocalDateString } from "@/utils/dates";
import { useAllAccountsOptions } from "@/hooks/useOptions";
import { useBudgetTypes } from "@/hooks/useTypes";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/useToast";
import {
  getEtatPlusMoinsValuePost,
  getHistoriquePlusMoinsValuePost,
  getReleveComptePost,
} from "@/api/rapports";
import type {
  EtatPlusMoinsValueResponseDto,
  HistoriquePlusMoinsValueResponseDto,
  ReleveCompteResponseDto
} from "@/types/dto";

type Tab = "etat" | "historique" | "releve";

export default function Rapports() {
  const { notify } = useApiError();
  const { toast } = useToast();

  const accounts = useAllAccountsOptions();
  const types = useBudgetTypes();

  const [tab, setTab] = useState<Tab>("etat");

  // Etat plus/moins value
  const [etatPeriod, setEtatPeriod] = useState<string>(types.items[0]?.code ?? "MONTH");
  const [etatDate, setEtatDate] = useState<string>(toLocalDateString(new Date()));
  const [etatRes, setEtatRes] = useState<EtatPlusMoinsValueResponseDto[] | null>(null);
  const [etatLoading, setEtatLoading] = useState(false);

  // Historique
  const [histAccount, setHistAccount] = useState<string>("");
  const [histPeriod, setHistPeriod] = useState<string>(types.items[0]?.code ?? "MONTH");
  const [histStart, setHistStart] = useState<string>(toLocalDateString(new Date(new Date().getFullYear(), 0, 1)));
  const [histEnd, setHistEnd] = useState<string>(toLocalDateString(new Date()));
  const [histRes, setHistRes] = useState<HistoriquePlusMoinsValueResponseDto | null>(null);
  const [histLoading, setHistLoading] = useState(false);

  // Relevé
  const [relAccount, setRelAccount] = useState<string>("");
  const [relStart, setRelStart] = useState<string>(toLocalDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [relEnd, setRelEnd] = useState<string>(toLocalDateString(new Date()));
  const [relRes, setRelRes] = useState<ReleveCompteResponseDto | null>(null);
  const [relLoading, setRelLoading] = useState(false);

  async function runEtat() {
    setEtatLoading(true);
    try {
      const data = await getEtatPlusMoinsValuePost({ codeTypePeriode: etatPeriod, dateCible: etatDate });
      setEtatRes(data);
    } catch (e) {
      notify(e, "Rapport état");
    } finally {
      setEtatLoading(false);
    }
  }

  async function runHist() {
    setHistLoading(true);
    try {
      const data = await getHistoriquePlusMoinsValuePost({
        identifiantCompte: histAccount,
        codeTypePeriode: histPeriod,
        dateDebut: histStart,
        dateFin: histEnd
      });
      setHistRes(data);
    } catch (e) {
      notify(e, "Rapport historique");
    } finally {
      setHistLoading(false);
    }
  }

  async function runReleve() {
    setRelLoading(true);
    try {
      const data = await getReleveComptePost({ identifiantCompte: relAccount, dateDebut: relStart, dateFin: relEnd });
      setRelRes(data);
    } catch (e) {
      notify(e, "Relevé de compte");
    } finally {
      setRelLoading(false);
    }
  }


  const periodOptions = (types.items.length ? types.items : [{ code: "MONTH", libelle: "Mensuel" }, { code: "YEAR", libelle: "Annuel" }])
    .map(x => ({ value: x.code, label: `${x.code} — ${x.libelle}` }));

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Plus/moins-value & relevés."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setTab("etat")} className={`rounded-2xl px-4 py-2 text-sm ${tab === "etat" ? "bg-white/10 ring-1 ring-ink-500/20" : "bg-white/5 hover:bg-white/10"}`}>État</button>
        <button onClick={() => setTab("historique")} className={`rounded-2xl px-4 py-2 text-sm ${tab === "historique" ? "bg-white/10 ring-1 ring-ink-500/20" : "bg-white/5 hover:bg-white/10"}`}>Historique</button>
        <button onClick={() => setTab("releve")} className={`rounded-2xl px-4 py-2 text-sm ${tab === "releve" ? "bg-white/10 ring-1 ring-ink-500/20" : "bg-white/5 hover:bg-white/10"}`}>Relevé de compte</button>
      </div>

      {tab === "etat" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Plus/Moins-value — État</CardTitle>
              <CardDescription>Par période, à une date cible.</CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Combobox label="Type de période" value={etatPeriod} onChange={setEtatPeriod} options={periodOptions} placeholder="Choisir…" />
            <Input label="Date cible" type="date" value={etatDate} onChange={(e) => setEtatDate(e.target.value)} />
            <div className="flex items-end">
              <Button onClick={runEtat} loading={etatLoading} type="button">Générer</Button>
            </div>
          </div>

          {etatRes ? (
            <div className="mt-5">
              <Table>
                <TableInner>
                  <thead>
                    <tr>
                      <Th>Compte</Th>
                      <Th>Période</Th>
                      <Th className="text-right">Solde init (€)</Th>
                      <Th className="text-right">Solde fin (€)</Th>
                      <Th className="text-right">Mouvements (€)</Th>
                      <Th className="text-right">+/- value (%)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {etatRes.map((r, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <Td className="font-medium">{(r.enteteCompte as any).identifiantCompte ?? (r.enteteCompte as any).libelleCompte}</Td>
                        <Td>{safeFormatLocalDate(r.plusMoinsValue.dateDebutEvaluation)} → {safeFormatLocalDate(r.plusMoinsValue.dateFinEvaluation)}</Td>
                        <Td className="text-right">{r.plusMoinsValue.montantSoldeInitialEnEuros.toFixed(2)}</Td>
                        <Td className="text-right">{r.plusMoinsValue.montantSoldeFinalEnEuros.toFixed(2)}</Td>
                        <Td className="text-right">{r.plusMoinsValue.montantMouvementsEnEuros.toFixed(2)}</Td>
                        <Td className="text-right font-semibold">{r.plusMoinsValue.montantPlusMoinsValueEnPourcentage.toFixed(2)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableInner>
              </Table>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "historique" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Plus/Moins-value — Historique</CardTitle>
              <CardDescription>Sur un compte et un intervalle.</CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Combobox label="Compte" value={histAccount || null} onChange={setHistAccount} options={accounts.options} placeholder="Choisir…" />
            <Combobox label="Type de période" value={histPeriod} onChange={setHistPeriod} options={periodOptions} placeholder="Choisir…" />
            <Input label="Début" type="date" value={histStart} onChange={(e) => setHistStart(e.target.value)} />
            <Input label="Fin" type="date" value={histEnd} onChange={(e) => setHistEnd(e.target.value)} />
            <div className="md:col-span-4 flex justify-end">
              <Button onClick={runHist} loading={histLoading} disabled={!histAccount} type="button">Générer</Button>
            </div>
          </div>

          {histRes ? (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                Compte: <b>{(histRes.enteteCompte as any).identifiantCompte ?? (histRes.enteteCompte as any).libelleCompte}</b>
              </div>

              <Table>
                <TableInner>
                  <thead>
                    <tr>
                      <Th>Période</Th>
                      <Th className="text-right">Solde init</Th>
                      <Th className="text-right">Solde fin</Th>
                      <Th className="text-right">Mouvements</Th>
                      <Th className="text-right">+/- value</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {histRes.plusMoinsValues.map((p, idx) => (
                      <tr key={idx} className="hover:bg-white/5">
                        <Td>{safeFormatLocalDate(p.dateDebutEvaluation)} → {safeFormatLocalDate(p.dateFinEvaluation)}</Td>
                        <Td className="text-right">{p.montantSoldeInitialEnEuros.toFixed(2)}</Td>
                        <Td className="text-right">{p.montantSoldeFinalEnEuros.toFixed(2)}</Td>
                        <Td className="text-right">{p.montantMouvementsEnEuros.toFixed(2)}</Td>
                        <Td className="text-right font-semibold">{p.montantPlusMoinsValueEnPourcentage.toFixed(2)}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableInner>
              </Table>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "releve" ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Relevé de compte</CardTitle>
              <CardDescription>Générer et visualiser les opérations sur une période.</CardDescription>
            </div>
          </CardHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Combobox label="Compte" value={relAccount || null} onChange={setRelAccount} options={accounts.options} placeholder="Choisir…" />
            <Input label="Début" type="date" value={relStart} onChange={(e) => setRelStart(e.target.value)} />
            <Input label="Fin" type="date" value={relEnd} onChange={(e) => setRelEnd(e.target.value)} />
            <div className="flex items-end">
              <Button onClick={runReleve} loading={relLoading} disabled={!relAccount} type="button">Générer</Button>
            </div>
          </div>

          {relRes ? (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Stat label="Solde début" value={relRes.montantSoldeDebutReleveEnEuros.toFixed(2) + " €"} />
                <Stat label="Solde fin" value={relRes.montantSoldeFinReleveEnEuros.toFixed(2) + " €"} />
                <Stat label="Total recettes" value={relRes.montantTotalOperationsRecetteEnEuros.toFixed(2) + " €"} />
                <Stat label="Total dépenses" value={relRes.montantTotalOperationsDepenseEnEuros.toFixed(2) + " €"} />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="p-4">
                  <div className="mb-2 text-sm font-semibold">Recettes</div>
                  <SmallOpsTable ops={relRes.operationsRecette} />
                </Card>
                <Card className="p-4">
                  <div className="mb-2 text-sm font-semibold">Dépenses</div>
                  <SmallOpsTable ops={relRes.operationsDepense} />
                </Card>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function SmallOpsTable({ ops }: { ops: any[] }) {
  if (!ops || ops.length === 0) return <div className="text-sm text-white/60">Aucune opération.</div>;
  return (
    <Table className="border-none">
      <TableInner>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Libellé</Th>
            <Th className="text-right">Montant</Th>
          </tr>
        </thead>
        <tbody>
          {ops.map((o, idx) => (
            <tr key={idx} className="hover:bg-white/5">
              <Td>{safeFormatLocalDate(o.dateValeur)}</Td>
              <Td className="text-xs">{o.libelle}</Td>
              <Td className="text-right font-semibold">{Number(o.montantEnEuros).toFixed(2)} €</Td>
            </tr>
          ))}
        </tbody>
      </TableInner>
    </Table>
  );
}
