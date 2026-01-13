import { useQuery } from "@tanstack/react-query";
import { listOperations } from "@/api/operations";
import { listComptesInternes, listComptesExternes, listComptesTechniques } from "@/api/comptes";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { safeFormatLocalDate } from "@/utils/dates";
import { centsToEuros } from "@/utils/money";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Dashboard() {
  const opsQ = useQuery({ queryKey: ["operations"], queryFn: listOperations });
  const ciQ = useQuery({ queryKey: ["comptes", "internes"], queryFn: listComptesInternes });
  const ceQ = useQuery({ queryKey: ["comptes", "externes"], queryFn: listComptesExternes });
  const ctQ = useQuery({ queryKey: ["comptes", "techniques"], queryFn: listComptesTechniques });

  const last = (opsQ.data ?? []).slice().sort((a,b) => (a.dateValeur < b.dateValeur ? 1 : -1)).slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle="Tes actions rapides, sans friction."
        right={
          <Link
            to="/depense"
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/15"
          >
            <Sparkles className="h-4 w-4" />
            Nouvelle dépense
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Comptes</CardTitle>
              <CardDescription>Internes, externes, techniques.</CardDescription>
            </div>
          </CardHeader>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-2xl font-semibold">{ciQ.data?.length ?? "—"}</div>
              <div className="text-xs text-white/60">Internes</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-2xl font-semibold">{ceQ.data?.length ?? "—"}</div>
              <div className="text-xs text-white/60">Externes</div>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <div className="text-2xl font-semibold">{ctQ.data?.length ?? "—"}</div>
              <div className="text-xs text-white/60">Techniques</div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Dernières opérations</CardTitle>
              <CardDescription>Un coup d'œil sur les mouvements récents.</CardDescription>
            </div>
            <Link to="/operations" className="text-sm text-ink-200 hover:text-ink-100">Voir tout</Link>
          </CardHeader>

          {opsQ.isLoading ? (
            <div className="text-sm text-white/60">Chargement…</div>
          ) : last.length === 0 ? (
            <div className="text-sm text-white/60">Aucune opération pour le moment.</div>
          ) : (
            <div className="space-y-2">
              {last.map(op => (
                <div key={op.numero} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{op.libelle}</div>
                    <div className="text-xs text-white/60">
                      {safeFormatLocalDate(op.dateValeur)} • {op.typeOperation?.libelle ?? op.typeOperation?.code ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{centsToEuros(op.montantEnCentimes)} €</div>
                    <div className="text-xs text-white/55">{op.compteDepense?.identifiant ?? "—"} → {op.compteRecette?.identifiant ?? "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Créer</CardTitle>
              <CardDescription>Les actions les plus fréquentes.</CardDescription>
            </div>
          </CardHeader>
          <div className="grid gap-2">
            <Link to="/depense" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">⚡ Dépense</Link>
            <Link to="/recette" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">💎 Recette</Link>
            <Link to="/transfert" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">🔁 Transfert</Link>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Références & budgets (pour que l'app soit fluide).</CardDescription>
            </div>
          </CardHeader>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Link to="/banques" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">🏦 Banques</Link>
            <Link to="/titulaires" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">👤 Titulaires</Link>
            <Link to="/categories" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">🏷️ Catégories</Link>
            <Link to="/sous-categories" className="rounded-2xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">🏷️ Sous-catégories</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
