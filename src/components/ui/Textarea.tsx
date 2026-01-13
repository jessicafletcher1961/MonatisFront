import * as React from "react";
import { cn } from "@/utils/cn";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Textarea({ className, label, hint, error, ...props }: Props) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-xs font-medium text-white/75">{label}</div> : null}
      <textarea
        className={cn(
          "min-h-[100px] w-full rounded-2xl border border-white/10 bg-[#0f081a] px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-ink-500/40 focus:ring-2 focus:ring-ink-500/20",
          error && "border-blush-500/40 focus:border-blush-500/60 focus:ring-blush-500/20",
          className
        )}
        {...props}
      />
      {error ? <div className="mt-1 text-xs text-blush-300">{error}</div> : hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </label>
  );
}
