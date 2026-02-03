import { Link } from "react-router-dom";
import { Breadcrumbs } from "./Breadcrumbs";

export function Topbar() {
  return (
    <header className="glass-card flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between rise-in-glam">
      <div className="space-y-2">
        <Breadcrumbs />
        <h2 className="text-2xl font-semibold text-shadow-glam">Tableau de navigation</h2>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <input
          className="input-glam max-w-sm"
          placeholder="Rechercher un titulaire, compte, opération…"
        />
        <Link className="nav-pill nav-pill-inactive" to="/operations/special">
          Opération spécialisée
        </Link>
        <Link className="btn-glam" to="/operations/new">
          Créer une opération
        </Link>
      </div>
    </header>
  );
}
