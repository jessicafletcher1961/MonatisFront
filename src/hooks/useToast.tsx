import React, { createContext, useContext, useMemo, useState } from "react";
import { cn } from "@/utils/cn";

type Toast = {
  id: string;
  title?: string;
  message: string;
  variant?: "default" | "success" | "error";
};

type ToastCtx = {
  toast: (t: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const api = useMemo<ToastCtx>(() => ({
    toast: (t) => {
      const id = Math.random().toString(16).slice(2);
      const toast: Toast = { id, variant: "default", ...t };
      setToasts((prev) => [toast, ...prev].slice(0, 5));
      window.setTimeout(() => setToasts((prev) => prev.filter(x => x.id !== id)), 4500);
    }
  }), []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              "rounded-2xl border border-white/10 bg-[#12081f]/90 p-4 shadow-glow backdrop-blur",
              t.variant === "success" && "border-ink-500/30",
              t.variant === "error" && "border-blush-500/30"
            )}
          >
            {t.title ? <div className="mb-1 text-sm font-semibold text-white">{t.title}</div> : null}
            <div className="text-sm text-white/80">{t.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
