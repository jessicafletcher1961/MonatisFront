import * as React from "react";
import { cn } from "@/utils/cn";
import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
};

export function Select({ className, label, hint, error, options, placeholder, ...props }: Props) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-white/75">{label}</div> : null}
      <div className={cn("relative", className)}>
        <select
          className={cn(
            "h-11 w-full appearance-none rounded-2xl border border-white/10 bg-[#0f081a] px-3 pr-10 text-sm text-white outline-none transition focus:border-ink-500/40 focus:ring-2 focus:ring-ink-500/20",
            error && "border-blush-500/40 focus:border-blush-500/60 focus:ring-blush-500/20"
          )}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
      </div>
      {error ? <div className="mt-1 text-xs text-blush-300">{error}</div> : hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </label>
  );
}
