import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Combobox } from "@/components/ui/Combobox";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Button } from "@/components/ui/Button";
import { useAllAccountsOptions, useReferenceOptions } from "@/hooks/useOptions";
import { useForm } from "react-hook-form";
import { toLocalDateString } from "@/utils/dates";
import { effectuerDepense } from "@/api/operations";
import type { OperationCompleteRequestDto } from "@/types/dto";
import { useToast } from "@/hooks/useToast";
import { useApiError } from "@/hooks/useApiError";
import { Sparkles } from "lucide-react";

type FormState = {
  numeroOperation: string;
  identifiantCompteDepense: string;
  identifiantCompteRecette: string;
  dateOperation: string;
  libelleOperation: string;
  montantEnCentimes: number;
  nomSousCategorie: string;
  nomsBeneficiaires: string[];
};

function generateNumero(prefix = "DEP") {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function NewDepense() {
  const { toast } = useToast();
  const { notify } = useApiError();
  const accounts = useAllAccountsOptions();
  const sousCats = useReferenceOptions("souscategorie");
  const benefs = useReferenceOptions("beneficiaire");

  const form = useForm<FormState>({
    defaultValues: {
      numeroOperation: generateNumero(),
      identifiantCompteDepense: "",
      identifiantCompteRecette: "",
      dateOperation: toLocalDateString(new Date()),
      libelleOperation: "",
      montantEnCentimes: 0,
      nomSousCategorie: "",
      nomsBeneficiaires: []
    }
  });

  const errors = form.formState.errors;

  const m = useMutation({
    mutationFn: async () => {
      const v = form.getValues();
      const dto: OperationCompleteRequestDto = {
        numeroOperation: v.numeroOperation,
        identifiantCompteDepense: v.identifiantCompteDepense,
        identifiantCompteRecette: v.identifiantCompteRecette,
        montantOperationEnCentimes: v.montantEnCentimes,
        dateOperation: v.dateOperation,
        libelleOperation: v.libelleOperation,
        nomSousCategorie: v.nomSousCategorie,
        nomsBeneficiaires: v.nomsBeneficiaires
      };
      return effectuerDepense(dto);
    },
    onSuccess: (data) => {
      toast({ title: "Dépense enregistrée", message: `Opération ${data.numero} créée.`, variant: "success" });
      form.reset({
        ...form.getValues(),
        numeroOperation: generateNumero(),
        dateOperation: toLocalDateString(new Date()),
        libelleOperation: "",
        montantEnCentimes: 0
      });
    },
    onError: (e) => notify(e, "Création dépense")
  });

  return (
    <div>
      <PageHeader
        title="Nouvelle Dépense"
        subtitle="Rapide, guidée, et agréable."
        right={
          <Button
            variant="secondary"
            onClick={() => form.setValue("numeroOperation", generateNumero())}
            type="button"
          >
            <Sparkles className="h-4 w-4" /> Générer un numéro
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Détails de l'opération</CardTitle>
              <CardDescription>Ces champs correspondent au <code className="rounded bg-white/10 px-1">OperationCompleteRequestDto</code>.</CardDescription>
            </div>
          </CardHeader>

          <form
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit(
              () => {
                const v = form.getValues();
                // Pré-validation UX (sinon l'utilisateur a l'impression que "ça ne fait rien")
                if (!v.identifiantCompteDepense || !v.identifiantCompteRecette) {
                  toast({
                    title: "Compte manquant",
                    message: "Choisis un compte dépense et un compte recette.",
                    variant: "error"
                  });
                  return;
                }
                if (!v.nomSousCategorie) {
                  toast({
                    title: "Sous-catégorie manquante",
                    message: "Choisis une sous-catégorie.",
                    variant: "error"
                  });
                  return;
                }
                m.mutate();
              },
              () => {
                toast({
                  title: "Champs manquants",
                  message: "Vérifie le numéro, la date et le libellé.",
                  variant: "error"
                });
              }
            )}
          >
            <Input
              label="Numéro d'opération"
              error={errors.numeroOperation?.message}
              {...form.register("numeroOperation", { required: "Obligatoire" })}
            />
            <Input
              label="Date"
              type="date"
              error={errors.dateOperation?.message}
              {...form.register("dateOperation", { required: "Obligatoire" })}
            />

            <Input
              label="Libellé"
              placeholder="ex: Courses Carrefour"
              className="md:col-span-2"
              error={errors.libelleOperation?.message}
              {...form.register("libelleOperation", { required: "Obligatoire" })}
            />

            <MoneyInput
              label="Montant"
              valueCents={form.watch("montantEnCentimes")}
              onChangeCents={(c) => form.setValue("montantEnCentimes", c)}
              hint="Le backend attend un montant en centimes."
            />

            <Combobox
              label="Sous-catégorie"
              value={form.watch("nomSousCategorie") || null}
              onChange={(v) => form.setValue("nomSousCategorie", v)}
              options={sousCats.options.map(o => ({ value: o.value, label: o.label }))}
              placeholder="Choisir une sous-catégorie…"
            />

            <div className="md:col-span-2">
              <MultiSelect
                label="Bénéficiaires"
                values={form.watch("nomsBeneficiaires")}
                onChange={(vals) => form.setValue("nomsBeneficiaires", vals)}
                options={benefs.options}
                placeholder="Ajouter un ou plusieurs bénéficiaires…"
              />
            </div>

            <Combobox
              label="Compte dépense"
              value={form.watch("identifiantCompteDepense") || null}
              onChange={(v) => form.setValue("identifiantCompteDepense", v)}
              options={accounts.options}
              placeholder="Choisir le compte qui paie…"
            />

            <Combobox
              label="Compte recette"
              value={form.watch("identifiantCompteRecette") || null}
              onChange={(v) => form.setValue("identifiantCompteRecette", v)}
              options={accounts.options}
              placeholder="Choisir le compte qui reçoit…"
              // In a dépense, compte recette pourrait être technique; on laisse libre.
            />

            <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  form.reset({
                    numeroOperation: generateNumero(),
                    identifiantCompteDepense: "",
                    identifiantCompteRecette: "",
                    dateOperation: toLocalDateString(new Date()),
                    libelleOperation: "",
                    montantEnCentimes: 0,
                    nomSousCategorie: "",
                    nomsBeneficiaires: []
                  })
                }
                disabled={m.isPending}
              >
                Réinitialiser
              </Button>
              <Button type="submit" loading={m.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Conseils</CardTitle>
              <CardDescription>Une saisie sans douleur.</CardDescription>
            </div>
          </CardHeader>
          <ul className="space-y-3 text-sm text-white/75">
            <li>• Clique dans les champs « compte », « sous-catégorie », « bénéficiaires » : tu as une recherche instantanée.</li>
            <li>• Tu peux coller un montant directement, on convertit en centimes pour l'API.</li>
            <li>• Si tu vois une erreur de type « Aucune référence… », pense à créer la référence (catégorie, titulaire, etc.) avant.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
