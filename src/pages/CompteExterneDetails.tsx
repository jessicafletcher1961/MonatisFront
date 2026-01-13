import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getCompteExterne } from "@/api/comptes";
import { listOperations } from "@/api/operations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { safeFormatLocalDate } from "@/utils/dates";
import { Eye } from "lucide-react";

function euros(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function CompteExterneDetails() {
  const nav = useNavigate();
  const { identifiant } = useParams();

  const q = useQuery({
    queryKey: ["comptes", "externe", identifiant],
    queryFn: () => getCompteExterne(identifiant || ""),
    enabled: !!identifiant
  });

  const opsQ = useQuery({ queryKey: ["operations"], queryFn: listOperations });

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

  function autreCompte(op: any) {
    const id = identifiant || "";
    const dep = op.compteDepense?.identifiant === id;
    const rec = op.compteRecette?.identifiant === id;
    if (dep && !rec) return op.compteRecette;
    if (rec && !dep) return op.compteDepense;
    // si les deux côtés == id (rare), on retourne compteDepense par défaut
    return op.compteDepense;
  }

  return (
    <div>
      <PageHeader
        title={identifiant ? `Compte externe · ${identifiant}` : "Compte externe"}
        subtitle="Détail du compte externe + opérations liées."
        right={<Button variant="secondary" onClick={() => nav("/comptes-externes")}>Retour à la liste</Button>}
      />

      {q.isLoading ? (
        <div className="text-sm text-white/60">Chargement…</div>
      ) : q.isError ? (
        <div className="text-sm text-blush-200">Impossible de charger ce compte externe.</div>
      ) : !q.data ? (
        <div className="text-sm text-white/60">Compte introuvable.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <div>
                  <CardTitle>Informations</CardTitle>
                  <CardDescription>Identifiant + libellé.</CardDescription>
                </div>
              </CardHeader>

              <div className="grid grid-cols-1 gap-4 p-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Identifiant</div>
                  <div className="mt-1 font-mono text-sm text-white">{q.data.identifiant}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Libellé</div>
                  <div className="mt-1 text-sm text-white">{q.data.libelle || "—"}</div>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Opérations liées</CardTitle>
                  <CardDescription>{relatedOps.length} opération(s) trouvée(s).</CardDescription>
                </div>
              </CardHeader>

              {opsQ.isLoading ? (
                <div className="p-4 text-sm text-white/60">Chargement…</div>
              ) : relatedOps.length === 0 ? (
                <div className="p-4 text-sm text-white/60">Aucune opération liée à ce compte externe.</div>
              ) : (
                <div className="p-4 pt-0">
                  <Table>
                    <TableInner>
                      <thead>
                        <tr>
                          <Th>Date</Th>
                          <Th>Type</Th>
                          <Th>Libellé</Th>
                          <Th>Sens</Th>
                          <Th>Autre compte</Th>
                          <Th className="text-right">Montant (€)</Th>
                          <Th className="text-right">Ouvrir</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatedOps.map(op => {
                          const other = autreCompte(op);
                          return (
                            <tr key={op.numero} className="hover:bg-white/5">
                              <Td className="text-sm">{safeFormatLocalDate(op.dateValeur)}</Td>
                              <Td className="text-sm">{op.typeOperation?.libelle || op.typeOperation?.code || "—"}</Td>
                              <Td>
                                <div className="font-medium text-white">{op.numero}</div>
                                <div className="text-xs text-white/55">{op.libelle || "—"}</div>
                              </Td>
                              <Td className="text-sm">{sensFor(op)}</Td>
                              <Td>
                                <div className="text-sm text-white">{other?.identifiant || "—"}</div>
                                <div className="text-xs text-white/55">{other?.libelle || "—"}</div>
                              </Td>
                              <Td className="text-right font-semibold">{euros(op.montantEnCentimes ?? 0)}</Td>
                              <Td className="text-right">
                                <Link
                                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
                                  to={`/operations?open=${encodeURIComponent(op.numero)}`}
                                >
                                  <Eye className="h-4 w-4" />
                                  Ouvrir
                                </Link>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </TableInner>
                  </Table>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
