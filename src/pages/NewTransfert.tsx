import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Combobox } from "@/components/ui/Combobox";
import { Button } from "@/components/ui/Button";
import { useAllAccountsOptions } from "@/hooks/useOptions";
import { useForm } from "react-hook-form";
import { toLocalDateString } from "@/utils/dates";
import { effectuerTransfert } from "@/api/operations";
import type { OperationBaseRequestDto } from "@/types/dto";
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
};

function generateNumero(prefix = "TRF") {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default function NewTransfert() {
  const { toast } = useToast();
  const { notify } = useApiError();
  const accounts = useAllAccountsOptions();

  const form = useForm<FormState>({
    defaultValues: {
      numeroOperation: generateNumero(),
      identifiantCompteDepense: "",
      identifiantCompteRecette: "",
      dateOperation: toLocalDateString(new Date()),
      libelleOperation: "Transfert",
      montantEnCentimes: 0
    }
  });

  const m = useMutation({
    mutationFn: async () => {
      const v = form.getValues();
      const dto: OperationBaseRequestDto = {
        numeroOperation: v.numeroOperation,
        identifiantCompteDepense: v.identifiantCompteDepense,
        identifiantCompteRecette: v.identifiantCompteRecette,
        montantOperationEnCentimes: v.montantEnCentimes,
        dateOperation: v.dateOperation,
        libelleOperation: v.libelleOperation
      };
      return effectuerTransfert(dto);
    },
    onSuccess: (data) => {
      toast({ title: "Transfert enregistré", message: `Opération ${data.numero} créée.`, variant: "success" });
      form.reset({
        ...form.getValues(),
        numeroOperation: generateNumero(),
        dateOperation: toLocalDateString(new Date()),
        montantEnCentimes: 0
      });
    },
    onError: (e) => notify(e, "Création transfert")
  });

  const dep = form.watch("identifiantCompteDepense");
  const rec = form.watch("identifiantCompteRecette");
  const same = dep && rec && dep === rec;

  return (
    <div>
      <PageHeader
        title="Transfert"
        subtitle="Déplacer de l'argent d'un compte à un autre."
        right={
          <Button variant="secondary" onClick={() => form.setValue("numeroOperation", generateNumero())} type="button">
            <Sparkles className="h-4 w-4" /> Générer un numéro
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Détails</CardTitle>
              <CardDescription>Aligné sur <code className="rounded bg-white/10 px-1">OperationBaseRequestDto</code>.</CardDescription>
            </div>
          </CardHeader>

          <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={form.handleSubmit(() => m.mutate())}>
            <Input label="Numéro d'opération" {...form.register("numeroOperation", { required: true })} />
            <Input label="Date" type="date" {...form.register("dateOperation", { required: true })} />

            <Input label="Libellé" className="md:col-span-2" {...form.register("libelleOperation", { required: true })} />

            <MoneyInput
              label="Montant"
              valueCents={form.watch("montantEnCentimes")}
              onChangeCents={(c) => form.setValue("montantEnCentimes", c)}
            />

            <Combobox
              label="Compte source (dépense)"
              value={dep || null}
              onChange={(v) => form.setValue("identifiantCompteDepense", v)}
              options={accounts.options}
              placeholder="Choisir le compte source…"
            />

            <Combobox
              label="Compte destination (recette)"
              value={rec || null}
              onChange={(v) => form.setValue("identifiantCompteRecette", v)}
              options={accounts.options}
              placeholder="Choisir le compte destination…"
            />

            {same ? (
              <div className="md:col-span-2 rounded-2xl border border-blush-500/30 bg-blush-500/10 p-3 text-sm text-blush-200">
                Source et destination identiques : ce transfert n'aura aucun effet.
              </div>
            ) : null}

            <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() =>
                  form.reset({
                    numeroOperation: generateNumero(),
                    identifiantCompteDepense: "",
                    identifiantCompteRecette: "",
                    dateOperation: toLocalDateString(new Date()),
                    libelleOperation: "Transfert",
                    montantEnCentimes: 0
                  })
                } disabled={m.isPending}>
                Réinitialiser
              </Button>
              <Button type="submit" loading={m.isPending} disabled={same}>
                Enregistrer
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Raccourcis</CardTitle>
              <CardDescription>Autres types d'opérations</CardDescription>
            </div>
          </CardHeader>
          <div className="grid gap-2 text-sm">
            <div className="rounded-2xl bg-white/5 p-3 text-white/75">Achat, dépôt, retrait, vente : disponibles côté API — tu peux ajouter leurs pages en dupliquant ce formulaire (OperationBaseRequestDto).</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
