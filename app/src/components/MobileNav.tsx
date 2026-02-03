import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Accueil", to: "/" },
  { label: "Réfs", to: "/references" },
  { label: "Titulaires", to: "/references/titulaires" },
  { label: "Comptes", to: "/comptes/interne" },
  { label: "Opérations", to: "/operations" },
  { label: "Évals", to: "/evaluations" },
  { label: "Budgets", to: "/budgets" },
  { label: "Rapports", to: "/rapports" },
];

export function MobileNav() {
  return (
    <nav className="glass-card fixed bottom-4 left-1/2 z-50 flex w-[92%] -translate-x-1/2 justify-between gap-2 px-3 py-2 lg:hidden fade-in-glam">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/" || item.to === "/references"}
          className={({ isActive }) =>
            `rounded-full px-3 py-2 text-xs font-semibold transition ${
              isActive
                ? "bg-[rgba(214,178,94,0.2)] text-[color:var(--glam-champagne)]"
                : "text-[color:var(--glam-muted)]"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
