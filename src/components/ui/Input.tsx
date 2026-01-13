import * as React from "react";
import { cn } from "@/utils/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  right?: React.ReactNode;
};

export const Input = React.forwardRef<HTMLInputElement, Props>(
  ({ className, label, hint, error, right, ...props }, ref) => {
    return (
      <label className="block">
        {label ? <div className="mb-1 text-xs font-medium text-white/75">{label}</div> : null}
        <div className={cn("relative", className)}>
          <input
            ref={ref}
            className={cn(
              "h-11 w-full rounded-2xl border border-white/10 bg-[#0f081a] px-3 text-sm text-white placeholder:text-white/40 outline-none transition focus:border-ink-500/40 focus:ring-2 focus:ring-ink-500/20",
              error && "border-blush-500/40 focus:border-blush-500/60 focus:ring-blush-500/20",
              right ? "pr-10" : ""
            )}
            {...props}
          />
          {right ? (
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70">{right}</div>
          ) : null}
        </div>
        {error ? (
          <div className="mt-1 text-xs text-blush-300">{error}</div>
        ) : hint ? (
          <div className="mt-1 text-xs text-white/55">{hint}</div>
        ) : null}
      </label>
    );
  }
);

Input.displayName = "Input";
