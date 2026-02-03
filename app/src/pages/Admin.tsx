import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { monatisApi } from "../api/monatis";
import { ErrorNotice } from "../components/ErrorNotice";
import { SectionHeader } from "../components/SectionHeader";

export function Admin() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  const initMutation = useMutation({
    mutationFn: monatisApi.adminInitBasic,
    onSuccess: () => setLastAction("Initialisation terminée."),
  });

  const deleteMutation = useMutation({
    mutationFn: monatisApi.adminDeleteAll,
    onSuccess: () => setLastAction("Suppression complète effectuée."),
  });

  const saveMutation = useMutation({
    mutationFn: monatisApi.adminSave,
    onSuccess: () => setLastAction("Sauvegarde demandée."),
  });

  return (
    <div className="space-y-6">
      <section className="glass-card space-y-4 p-6">
        <SectionHeader
          title="Admin"
          subtitle="Actions sensibles sur les données."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <button
            className="btn-glam"
            onClick={() => initMutation.mutate()}
            disabled={initMutation.isPending}
          >
            {initMutation.isPending ? "Initialisation..." : "Init données de base"}
          </button>
          <button
            className="nav-pill nav-pill-inactive"
            onClick={() => {
              if (!window.confirm("Supprimer toutes les données ?")) return;
              deleteMutation.mutate();
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? "Suppression..." : "Supprimer tout"}
          </button>
          <button
            className="nav-pill nav-pill-inactive"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>

        {lastAction ? (
          <p className="text-sm text-[color:var(--glam-muted)]">{lastAction}</p>
        ) : null}

        {initMutation.isError ? <ErrorNotice error={initMutation.error} /> : null}
        {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}
        {saveMutation.isError ? <ErrorNotice error={saveMutation.error} /> : null}
      </section>
    </div>
  );
}
