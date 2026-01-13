import { Link, useLocation } from "react-router-dom";
import { cn } from "@/utils/cn";
import {
  LayoutDashboard,
  PlusCircle,
  ArrowLeftRight,
  ListOrdered,
  Wallet,
  Landmark,
  Tags,
  Users,
  Building2,
  PieChart,
  Shield,
  Database,
  Activity
} from "lucide-react";

type Item = { path: string; label: string; icon: React.ReactNode };
type Section = { type: "header"; label: string } | Item;

const sections: Section[] = [
  { path: "/", label: "Tableau de bord", icon: <LayoutDashboard className="h-4 w-4" /> },
  { path: "/depense", label: "Nouvelle Dépense", icon: <PlusCircle className="h-4 w-4" /> },
  { path: "/recette", label: "Nouvelle Recette", icon: <PlusCircle className="h-4 w-4" /> },
  { path: "/transfert", label: "Transfert", icon: <ArrowLeftRight className="h-4 w-4" /> },
  { type: "header", label: "Suivi" },
  { path: "/operations", label: "Journal des Opérations", icon: <ListOrdered className="h-4 w-4" /> },
  { path: "/budgets", label: "Budgets", icon: <PieChart className="h-4 w-4" /> },
  { path: "/rapports", label: "Rapports", icon: <PieChart className="h-4 w-4" /> },
  { path: "/evaluations", label: "Évaluations", icon: <Activity className="h-4 w-4" /> },
  { type: "header", label: "Comptes" },
  { path: "/comptes-internes", label: "Comptes Internes", icon: <Landmark className="h-4 w-4" /> },
  { path: "/comptes-externes", label: "Comptes Externes", icon: <Wallet className="h-4 w-4" /> },
  { path: "/comptes-techniques", label: "Comptes Techniques", icon: <Shield className="h-4 w-4" /> },
  { type: "header", label: "Références" },
  { path: "/banques", label: "Banques", icon: <Building2 className="h-4 w-4" /> },
  { path: "/categories", label: "Catégories", icon: <Tags className="h-4 w-4" /> },
  { path: "/sous-categories", label: "Sous-Catégories", icon: <Tags className="h-4 w-4" /> },
  { path: "/beneficiaires", label: "Bénéficiaires", icon: <Users className="h-4 w-4" /> },
  { path: "/titulaires", label: "Titulaires", icon: <Users className="h-4 w-4" /> },
  { type: "header", label: "Admin" },
  { path: "/admin", label: "Sauvegarde & Exports", icon: <Database className="h-4 w-4" /> }
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-ink-500 to-blush-500 shadow-glow" />
          <div>
            <div className="text-sm font-semibold leading-none">Monatis</div>
            <div className="text-xs text-white/60">Gestion douce & précise</div>
          </div>
        </div>
      </div>

      <div className="px-2 pb-4">
        {sections.map((it, idx) => {
          if ((it as any).type === "header") {
            return (
              <div key={idx} className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {(it as any).label}
              </div>
            );
          }
          const item = it as Item;
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                "mb-1 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-white/80 transition hover:bg-white/10",
                active && "bg-white/10 text-white ring-1 ring-ink-500/20"
              )}
            >
              <span className={cn("text-white/70", active && "text-white")}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto px-4 pb-5 text-xs text-white/40">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="font-medium text-white/70">Astuce</div>
          <div className="mt-1">Clique dans les champs : tu as des listes et recherches rapides ✨</div>
        </div>
      </div>
    </div>
  );
}
