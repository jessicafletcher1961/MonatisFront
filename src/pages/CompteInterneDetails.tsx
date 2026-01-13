import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompteInterne } from "@/api/comptes";
import { listOperations } from "@/api/operations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { useReferenceOptions } from "@/hooks/useOptions";
import { safeFormatLocalDate } from "@/utils/dates";
import { centsToEuros } from "@/utils/money";
import { Eye } from "lucide-react";

function euros(cents: number) {
  return (cents / 100).toFixed(2);
}

function typeLabel(code?: string) {
  switch (code) {
    case "COURANT":
      return "COURANT — Compte courant";
    case "EPARGNE":
      return "EPARGNE — Épargne";
    case "INVEST":
      return "INVEST — Investissement";
    default:
      return code || "—";
  }
}

export default function CompteInterneDetails() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { identifiant } = useParams();

  // Fallback UX: si l'API "get" renvoie une forme minimaliste, on récupère
  // les champs enrichis depuis la liste (cache React Query) quand elle existe.
  const fromList: any | undefined = useMemo(() => {
    if (!identifiant) return undefined;
    const cached = qc.getQueryData(["comptes", "internes"]) as any[] | undefined;
    return cached?.find((c) => c?.identifiant === identifiant);
  }, [qc, identifiant]);

  const q = useQuery({
    queryKey: ["comptes", "interne", identifiant],
    queryFn: () => getCompteInterne(identifiant || ""),
    enabled: !!identifiant
  });

  const opsQ = useQuery({ queryKey: ["operations"], queryFn: listOperations });

  // Pour afficher le libellé des titulaires (optionnel) tout en gardant le nom en principal.
  const titulairesRef = useReferenceOptions("titulaire");
  const titulaireLabelByNom = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of titulairesRef.options) {
      map.set(o.value, o.meta || "");
    }
    return map;
  }, [titulairesRef.options]);

  const titulaires = useMemo(() => {
    const arr = q.data?.nomsTitulaires ?? fromList?.nomsTitulaires ?? [];
    return [...arr].sort((a, b) => a.localeCompare(b));
  }, [q.data?.nomsTitulaires, fromList?.nomsTitulaires]);

  // L'API peut renvoyer soit des champs "flat" (nomBanque, codeTypeFonctionnement),
  // soit des objets imbriqués (banque, typeFonctionnement). On supporte les deux.
  const codeType =
    (q.data as any)?.codeTypeFonctionnement ??
    (q.data as any)?.typeFonctionnement?.code ??
    (q.data as any)?.typeFonctionnement ??
    (fromList as any)?.codeTypeFonctionnement ??
    (fromList as any)?.typeFonctionnement?.code ??
    (fromList as any)?.typeFonctionnement ??
    "";

  const banqueNom =
    (q.data as any)?.nomBanque ??
    (q.data as any)?.banque?.nom ??
    (q.data as any)?.banque?.libelle ??
    (fromList as any)?.nomBanque ??
    (fromList as any)?.banque?.nom ??
    (fromList as any)?.banque?.libelle ??
    "";

  const relatedOps = useMemo(() => {
    const id = identifiant || "";
    if (!id) return [];
    const all = opsQ.data ?? [];
    const rel = all.filter(op => op.compteDepense?.identifiant === id || op.compteRecette?.identifiant === id);
    rel.sort((a, b) => (a.dateValeur < b.dateValeur ? 1 : -1));
    return rel;
  }, [identifiant, opsQ.data]);

  function sensFor(op: any): string {
    const id = identifiant || "";
    const dep = op.compteDepense?.identifiant === id;
    const rec = op.compteRecette?.identifiant === id;
    if (dep && rec) return "Transfert";
    if (dep) return "Dépense";
    if (rec) return "Recette";
    return "—";
  }

  return (
    <div>
      <PageHeader
        title={identifiant ? `Compte interne · ${identifiant}` : "Compte interne"}
        subtitle="Détails du compte (type de fonctionnement, banque, titulaires, solde initial…)."
        right={
          <Button variant="secondary" onClick={() => nav("/comptes-internes")}>
            Retour à la liste
          </Button>
        }
      />

      {q.isLoading ? (
        <div className="text-sm text-white/60">Chargement…</div>
      ) : q.isError ? (
        <div className="text-sm text-blush-200">Impossible de charger ce compte.</div>
      ) : !q.data ? (
        <div className="text-sm text-white/60">Compte introuvable.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>Informations</CardTitle>
                <CardDescription>Ce sont les champs issus de <code className="rounded bg-white/10 px-1">CompteInterne</code>.</CardDescription>
              </div>
            </CardHeader>

            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Identifiant</div>
                <div className="mt-1 font-mono text-sm text-white">{q.data.identifiant}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Libellé</div>
                <div className="mt-1 text-sm text-white">{q.data.libelle || "—"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Type de fonctionnement</div>
                <div className="mt-1 text-sm text-white">{typeLabel(codeType)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Banque</div>
                <div className="mt-1 text-sm text-white">{banqueNom || "—"}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Date solde initial</div>
                <div className="mt-1 text-sm text-white">{safeFormatLocalDate(q.data.dateSoldeInitial)}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs text-white/55">Solde initial</div>
                <div className="mt-1 text-sm font-semibold text-white">{euros(q.data.montantSoldeInitialEnCentimes)} €</div>
              </div>
            </div>
            </Card>

            <Card>
            <CardHeader>
              <div>
                <CardTitle>Titulaires</CardTitle>
                <CardDescription>{titulaires.length} titulaire(s).</CardDescription>
              </div>
            </CardHeader>

            <div className="p-4">
              {titulaires.length === 0 ? (
                <div className="text-sm text-white/60">Aucun titulaire.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {titulaires.map(t => (
                    <Link
                      key={t}
                      to={`/titulaires/${encodeURIComponent(t)}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                      title={titulaireLabelByNom.get(t) || t}
                    >
                      <span className="font-medium">{t}</span>
                      {titulaireLabelByNom.get(t) ? (
                        <span className="ml-2 text-[11px] text-white/55">{titulaireLabelByNom.get(t)}</span>
                      ) : null}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Opérations liées</CardTitle>
                <CardDescription>
                  {opsQ.isLoading ? "Chargement…" : `${relatedOps.length} opération(s) trouvée(s) pour ce compte.`}
                </CardDescription>
              </div>
            </CardHeader>

            {opsQ.isLoading ? (
              <div className="p-4 text-sm text-white/60">Chargement…</div>
            ) : relatedOps.length === 0 ? (
              <div className="p-4 text-sm text-white/60">Aucune opération liée pour le moment.</div>
            ) : (
              <div className="p-4 pt-0">
                <Table>
                  <TableInner>
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th>Libellé</Th>
                        <Th>Type</Th>
                        <Th>Sens</Th>
                        <Th className="text-right">Montant</Th>
                        <Th className="text-right">Ouvrir</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedOps.slice(0, 50).map(op => (
                        <tr key={op.numero} className="hover:bg-white/5">
                          <Td>{safeFormatLocalDate(op.dateValeur)}</Td>
                          <Td>
                            <div className="font-medium">{op.libelle}</div>
                            <div className="text-xs text-white/55">{op.numero}</div>
                          </Td>
                          <Td className="text-sm">{op.typeOperation?.libelle ?? op.typeOperation?.code ?? "—"}</Td>
                          <Td className="text-sm">{sensFor(op)}</Td>
                          <Td className="text-right font-semibold">{centsToEuros(op.montantEnCentimes)} €</Td>
                          <Td className="text-right">
                            <Link
                              to={`/operations?open=${encodeURIComponent(op.numero)}`}
                              className="inline-flex items-center gap-2 rounded-xl p-2 hover:bg-white/10"
                              aria-label="Voir l'opération"
                              title="Voir l'opération"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableInner>
                </Table>
                {relatedOps.length > 50 ? (
                  <div className="mt-2 text-xs text-white/55">Affichage limité aux 50 plus récentes.</div>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
