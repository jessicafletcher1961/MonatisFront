import * as React from "react";
import { cn } from "@/utils/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({ className, variant = "primary", size = "md", loading, disabled, children, ...props }: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition focus:outline-none focus:ring-2 focus:ring-ink-500/40 disabled:opacity-60 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-br from-ink-500 to-blush-500 shadow-glow hover:brightness-110 active:brightness-95",
    secondary:
      "bg-white/10 border border-white/10 hover:bg-white/15 active:bg-white/10",
    ghost:
      "bg-transparent hover:bg-white/10 active:bg-white/5",
    danger:
      "bg-gradient-to-br from-blush-600 to-blush-500 hover:brightness-110 active:brightness-95"
  };
  const sizes: Record<string, string> = {
    sm: "h-9 px-3 text-sm",
    md: "h-11 px-4 text-sm",
    lg: "h-12 px-5 text-base"
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
          <span>Chargement…</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
