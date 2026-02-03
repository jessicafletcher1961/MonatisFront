import type { ReactNode } from "react";

interface PlaceholderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function Placeholder({ title, subtitle, action }: PlaceholderProps) {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="badge-glam">En préparation</span>
      <h3 className="text-3xl font-semibold">{title}</h3>
      {subtitle ? <p className="text-sm text-[color:var(--glam-muted)]">{subtitle}</p> : null}
      {action}
    </div>
  );
}
