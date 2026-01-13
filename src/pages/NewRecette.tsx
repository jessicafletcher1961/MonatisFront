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
import { effectuerRecette } from "@/api/operations";
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

function generateNumero(prefix = "REC") {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function NewRecette() {
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
      return effectuerRecette(dto);
    },
    onSuccess: (data) => {
      toast({ title: "Recette enregistrée", message: `Opération ${data.numero} créée.`, variant: "success" });
      form.reset({
        ...form.getValues(),
        numeroOperation: generateNumero(),
        dateOperation: toLocalDateString(new Date()),
        libelleOperation: "",
        montantEnCentimes: 0
      });
    },
    onError: (e) => notify(e, "Création recette")
  });

  return (
    <div>
      <PageHeader
        title="Nouvelle Recette"
        subtitle="Une entrée d'argent, en quelques clics."
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
              <CardDescription>Aligné sur <code className="rounded bg-white/10 px-1">OperationCompleteRequestDto</code>.</CardDescription>
            </div>
          </CardHeader>

          <form
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit(
              () => {
                const v = form.getValues();
                if (!v.identifiantCompteDepense || !v.identifiantCompteRecette) {
                  toast({
                    title: "Compte manquant",
                    message: "Choisis un compte source et un compte destination.",
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
              placeholder="ex: Salaire"
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
              placeholder="Compte source…"
            />

            <Combobox
              label="Compte recette"
              value={form.watch("identifiantCompteRecette") || null}
              onChange={(v) => form.setValue("identifiantCompteRecette", v)}
              options={accounts.options}
              placeholder="Compte destination…"
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
              <CardTitle>Tip</CardTitle>
              <CardDescription>Fluidité</CardDescription>
            </div>
          </CardHeader>
          <p className="text-sm text-white/75">
            En cas d'erreur de référence manquante, va sur <b>Références</b> pour créer la catégorie/sous-catégorie/bénéficiaire nécessaire.
          </p>
        </Card>
      </div>
    </div>
  );
}
