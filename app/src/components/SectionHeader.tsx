import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rise-in-glam">
      <div>
        <h3 className="text-2xl font-semibold">{title}</h3>
        {subtitle ? <p className="text-sm text-[color:var(--glam-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
