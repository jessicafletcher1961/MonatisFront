import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="badge-glam">404</span>
      <h3 className="text-3xl font-semibold">Page introuvable</h3>
      <p className="text-sm text-[color:var(--glam-muted)]">
        Cette page n'existe pas ou a été déplacée.
      </p>
      <Link className="btn-glam" to="/">
        Retour au tableau de bord
      </Link>
    </div>
  );
}
