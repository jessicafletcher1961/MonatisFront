import { NavLink } from "react-router-dom";

const primaryNav = [
  { label: "Dashboard", to: "/" },
  { label: "Références", to: "/references" },
  { label: "Titulaires", to: "/references/titulaires" },
  { label: "Comptes", to: "/comptes/interne" },
  { label: "Gestion comptes", to: "/comptes/manage" },
  { label: "Opérations", to: "/operations" },
  { label: "Évaluations", to: "/evaluations" },
  { label: "Budgets", to: "/budgets" },
  { label: "Rapports", to: "/rapports" },
];

const secondaryNav = [{ label: "Admin", to: "/admin" }];

export function Sidebar() {
  return (
    <aside className="glass-card fixed left-6 top-6 z-40 hidden h-[calc(100vh-3rem)] w-[250px] flex-col justify-between gap-8 p-6 lg:flex rise-in-glam">
      <div className="flex min-h-0 flex-1 flex-col gap-8">
        <div className="space-y-2">
          <span className="badge-glam">Monatis</span>
          <h1 className="text-2xl font-semibold text-shadow-glam">Atelier Financier</h1>
          <p className="text-sm text-[color:var(--glam-muted)]">
            Navigation luxueuse et fluide pour piloter vos comptes.
          </p>
        </div>

        <nav className="space-y-3 overflow-y-auto pr-1">
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/" || item.to === "/references"}
              className={({ isActive }) =>
                `nav-pill ${isActive ? "nav-pill-active" : "nav-pill-inactive"}`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-3">
        <div className="divider-glam" />
        {secondaryNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `nav-pill ${isActive ? "nav-pill-active" : "nav-pill-inactive"}`
            }
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
