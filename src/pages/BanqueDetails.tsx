import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getReference } from "@/api/references";
import { listComptesInternes } from "@/api/comptes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { safeFormatLocalDate } from "@/utils/dates";

function euros(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function BanqueDetails() {
  const nav = useNavigate();
  const { nom } = useParams();

  const refQ = useQuery({
    queryKey: ["references", "banque", nom],
    queryFn: () => getReference("banque", nom || ""),
    enabled: !!nom
  });

  const comptesQ = useQuery({
    queryKey: ["comptes", "internes"],
    queryFn: listComptesInternes
  });

  const comptesAssocies = useMemo(() => {
    const all = comptesQ.data ?? [];
    const key = nom || "";
    return all
      .filter(c => (c.nomBanque ?? "") === key)
      .slice()
      .sort((a, b) => a.identifiant.localeCompare(b.identifiant));
  }, [comptesQ.data, nom]);

  return (
    <div>
      <PageHeader
        title={nom ? `Banque · ${nom}` : "Banque"}
        subtitle="Détail de la banque + comptes internes associés."
        right={<Button variant="secondary" onClick={() => nav("/banques")}>Retour à la liste</Button>}
      />

      {refQ.isLoading ? (
        <div className="text-sm text-white/60">Chargement…</div>
      ) : refQ.isError ? (
        <div className="text-sm text-blush-200">Impossible de charger cette banque.</div>
      ) : !refQ.data ? (
        <div className="text-sm text-white/60">Banque introuvable.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <div>
                  <CardTitle>Informations</CardTitle>
                  <CardDescription>Référence Banque (nom + libellé).</CardDescription>
                </div>
              </CardHeader>

              <div className="grid grid-cols-1 gap-4 p-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Nom</div>
                  <div className="mt-1 font-mono text-sm text-white">{refQ.data.nom}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/55">Libellé</div>
                  <div className="mt-1 text-sm text-white">{refQ.data.libelle || "—"}</div>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Comptes internes associés</CardTitle>
                  <CardDescription>{comptesAssocies.length} compte(s) trouvé(s).</CardDescription>
                </div>
              </CardHeader>

              {comptesQ.isLoading ? (
                <div className="p-4 text-sm text-white/60">Chargement…</div>
              ) : comptesAssocies.length === 0 ? (
                <div className="p-4 text-sm text-white/60">Aucun compte associé à cette banque.</div>
              ) : (
                <div className="p-4 pt-0">
                  <Table>
                    <TableInner>
                      <thead>
                        <tr>
                          <Th>Identifiant</Th>
                          <Th>Type</Th>
                          <Th>Date solde initial</Th>
                          <Th className="text-right">Solde initial (€)</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {comptesAssocies.map(c => (
                          <tr
                            key={c.identifiant}
                            className="cursor-pointer hover:bg-white/5"
                            onClick={() => nav(`/comptes-internes/${encodeURIComponent(c.identifiant)}`)}
                          >
                            <Td>
                              <div className="font-medium text-white">{c.identifiant}</div>
                              <div className="text-xs text-white/55">{c.libelle || "—"}</div>
                            </Td>
                            <Td className="text-sm">{c.codeTypeFonctionnement || "—"}</Td>
                            <Td className="text-sm">{safeFormatLocalDate(c.dateSoldeInitial)}</Td>
                            <Td className="text-right font-semibold">{euros(c.montantSoldeInitialEnCentimes ?? 0)}</Td>
                          </tr>
                        ))}
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
