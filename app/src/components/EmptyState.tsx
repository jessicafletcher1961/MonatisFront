import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="glass-card flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center rise-in-glam">
      <span className="badge-glam">Focus</span>
      <h3 className="text-xl font-semibold">{title}</h3>
      {subtitle ? <p className="text-sm text-[color:var(--glam-muted)]">{subtitle}</p> : null}
      {action}
    </div>
  );
}
