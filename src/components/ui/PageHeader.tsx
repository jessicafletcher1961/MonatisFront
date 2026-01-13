import * as React from "react";
import { cn } from "@/utils/cn";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-white/65">{subtitle}</p> : null}
      </div>
      {right ? <div className={cn("flex items-center gap-2")}>{right}</div> : null}
    </div>
  );
}
