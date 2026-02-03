import { Outlet } from "react-router-dom";
import { OperationsList } from "./OperationsList";

export function OperationsLayout() {
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="glass-card space-y-4 p-6">
        <OperationsList />
      </div>
      <div className="min-h-[520px]">
        <Outlet />
      </div>
    </div>
  );
}
