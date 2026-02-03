import { Link, useLocation } from "react-router-dom";
import { truncate } from "../lib/format";

const LABELS: Record<string, string> = {
  references: "Références",
  titulaires: "Titulaires",
  comptes: "Comptes",
  interne: "Internes",
  manage: "Gestion",
  operations: "Opérations",
  special: "Spéciales",
  evaluations: "Évaluations",
  budgets: "Budgets",
  rapports: "Rapports",
  admin: "Admin",
};

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const to = `/${segments.slice(0, index + 1).join("/")}`;
    const label = LABELS[segment] ?? decodeURIComponent(segment);
    return { label: truncate(label, 24), to };
  });

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--glam-muted)]">
      <Link to="/" className="hover:text-[color:var(--glam-champagne)]">
        Accueil
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.to} className="flex items-center gap-2">
          <span className="text-[color:var(--glam-border)]">/</span>
          <Link to={crumb.to} className="hover:text-[color:var(--glam-champagne)]">
            {crumb.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
