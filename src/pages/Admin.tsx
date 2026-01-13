import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Divider";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/useToast";
import { deleteAllData, initBasic, triggerSave } from "@/api/admin";
import { downloadCsv } from "@/api/csv";
import { Download, HardDrive } from "lucide-react";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const { notify } = useApiError();
  const { toast } = useToast();

  const saveM = useMutation({
    mutationFn: triggerSave,
    onSuccess: () => toast({ title: "Sauvegarde déclenchée", message: "Le backend a lancé la sauvegarde.", variant: "success" }),
    onError: (e) => notify(e, "Sauvegarde")
  });

  const initM = useMutation({
    mutationFn: initBasic,
    onSuccess: () => toast({ title: "Initialisation OK", message: "Données de base initialisées.", variant: "success" }),
    onError: (e) => notify(e, "Initialisation")
  });

  const deleteAllM = useMutation({
    mutationFn: deleteAllData,
    onSuccess: () => toast({ title: "Suppression terminée", message: "Toutes les données ont été supprimées.", variant: "success" }),
    onError: (e) => notify(e, "Suppression totale")
  });

  const csvM = useMutation({
    mutationFn: async ({ path, filename }: { path: string; filename: string }) => {
      const blob = await downloadCsv(path);
      downloadBlob(blob, filename);
    },
    onSuccess: () => toast({ title: "Export prêt", message: "Téléchargement lancé.", variant: "success" }),
    onError: (e) => notify(e, "Export CSV")
  });

  const exporting = csvM.isPending;

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Sauvegarde, initialisation, purge, et exports CSV (si disponibles)."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Sauvegarde</CardTitle>
              <CardDescription>Actions d'administration (catalogue v2).</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => saveM.mutate()} loading={saveM.isPending} type="button">
                <HardDrive className="h-4 w-4" /> Sauvegarder
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (window.confirm("Initialiser les données de base ? (références, etc.)")) initM.mutate();
                }}
                loading={initM.isPending}
                type="button"
              >
                Initialiser
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm("⚠️ Supprimer TOUTES les données Monatis ? Cette action est irréversible.")) deleteAllM.mutate();
                }}
                loading={deleteAllM.isPending}
                type="button"
              >
                Tout supprimer
              </Button>
            </div>
          </CardHeader>

          <div className="text-sm text-white/70">
            Endpoints:
            <div className="mt-1 space-y-1 font-mono text-xs text-white/80">
              <div>GET /monatis/admin/save</div>
              <div>GET /monatis/admin/init/basic</div>
              <div>GET /monatis/admin/delete/all</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Exports CSV</CardTitle>
              <CardDescription>Fichiers utiles pour debug/contrôle (si les endpoints CSV existent sur ton backend).</CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <Section
              title="Budgets"
              buttons={[
                { label: "Types", path: "/monatis/csv/budgets/types", filename: "budgets_types.csv" },
                { label: "Tables", path: "/monatis/csv/budgets/tables", filename: "budgets_tables.csv" },
                { label: "Erreurs", path: "/monatis/csv/budgets/erreurs", filename: "budgets_erreurs.csv" }
              ]}
              onDownload={(b) => csvM.mutate(b)}
              disabled={exporting}
            />

            <Divider />

            <Section
              title="Comptes"
              buttons={[
                { label: "Types", path: "/monatis/csv/comptes/types", filename: "comptes_types.csv" },
                { label: "Tables", path: "/monatis/csv/comptes/tables", filename: "comptes_tables.csv" },
                { label: "Erreurs", path: "/monatis/csv/comptes/erreurs", filename: "comptes_erreurs.csv" }
              ]}
              onDownload={(b) => csvM.mutate(b)}
              disabled={exporting}
            />

            <Divider />

            <Section
              title="Opérations"
              buttons={[
                { label: "Types", path: "/monatis/csv/operations/types", filename: "operations_types.csv" },
                { label: "Erreurs", path: "/monatis/csv/operations/erreurs", filename: "operations_erreurs.csv" }
              ]}
              onDownload={(b) => csvM.mutate(b)}
              disabled={exporting}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Section({
  title,
  buttons,
  onDownload,
  disabled
}: {
  title: string;
  buttons: { label: string; path: string; filename: string }[];
  onDownload: (b: { path: string; filename: string }) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <Button
            key={b.path}
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onDownload({ path: b.path, filename: b.filename })}
            type="button"
          >
            <Download className="h-4 w-4" /> {b.label}
          </Button>
        ))}
      </div>
      <div className="mt-2 text-xs text-white/55">
        {buttons.map(b => (
          <div key={b.path} className="font-mono">{b.path}</div>
        ))}
      </div>
    </div>
  );
}
