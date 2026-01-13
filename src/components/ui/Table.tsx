import * as React from "react";
import { cn } from "@/utils/cn";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-white/10", className)} {...props} />
  );
}

export function TableInner({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-left text-sm", className)} {...props} />;
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("bg-white/5 px-3 py-2 font-medium text-white/80", className)} {...props} />;
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-t border-white/5 px-3 py-2 text-white/85", className)} {...props} />;
}
