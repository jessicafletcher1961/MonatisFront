import { Outlet } from "react-router-dom";
import { ComptesList } from "./ComptesList";

export function ComptesLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="glass-card space-y-4 p-6">
        <ComptesList />
      </div>
      <div className="min-h-[520px]">
        <Outlet />
      </div>
    </div>
  );
}
