import { Outlet } from "react-router-dom";
import { TitulairesList } from "./TitulairesList";

export function TitulairesLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <div className="glass-card space-y-4 p-6">
        <TitulairesList />
      </div>
      <div className="min-h-[520px]">
        <Outlet />
      </div>
    </div>
  );
}
