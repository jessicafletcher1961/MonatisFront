import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Combobox } from "@/components/ui/Combobox";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/useToast";
import { listComptesInternes } from "@/api/comptes";
import { createEvaluation, deleteEvaluation, listEvaluations, updateEvaluation } from "@/api/evaluations";
import { safeFormatLocalDate, toLocalDateString } from "@/utils/dates";
import type { EvaluationCreationRequestDto, EvaluationModificationRequestDto } from "@/types/dto";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function Evaluations() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { notify } = useApiError();

  const q = useQuery({ queryKey: ["evaluations"], queryFn: listEvaluations });
  const comptes = useQuery({ queryKey: ["comptes", "internes"], queryFn: listComptesInternes });

  // UX: on affiche l'identifiant comme valeur principale, et le libellé en info secondaire.
  const compteOptions = (comptes.data ?? []).map(c => ({ value: c.identifiant, label: c.identifiant, meta: c.libelle || undefined }));

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const items = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter(e => {
      const txt = [
        e.cle,
        e.libelle,
        e.compteInterne?.identifiant,
        e.compteInterne?.libelle,
        e.compteTechnique?.identifiant,
        e.compteTechnique?.libelle
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return txt.includes(s);
    });
  }, [q.data, search]);

  const [open, setOpen] = useState(false);
  const [editingCle, setEditingCle] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<EvaluationCreationRequestDto>({
    cle: "",
    identifiantCompteInterne: "",
    dateSolde: toLocalDateString(new Date()),
    libelle: "",
    montantSoldeEnCentimes: 0
  });

  const [updateForm, setUpdateForm] = useState<EvaluationModificationRequestDto>({
    cle: "",
    identifiantCompteInterne: "",
    dateSolde: toLocalDateString(new Date()),
    montantSoldeEnCentimes: 0,
    libelle: ""
  });

  function openCreate() {
    setEditingCle(null);
    setCreateForm({
      cle: "",
      identifiantCompteInterne: "",
      dateSolde: toLocalDateString(new Date()),
      libelle: "",
      montantSoldeEnCentimes: 0
    });
    setOpen(true);
  }

  function openEdit(item: any) {
    setEditingCle(item.cle);
    setUpdateForm({
      cle: item.cle,
      identifiantCompteInterne: item.compteInterne?.identifiant ?? "",
      dateSolde: item.dateSolde ?? toLocalDateString(new Date()),
      montantSoldeEnCentimes: item.montantSoldeEnCentimes ?? 0,
      libelle: item.libelle ?? ""
    });
    setOpen(true);
  }

  const createM = useMutation({
    mutationFn: async () => createEvaluation(createForm),
    onSuccess: async () => {
      toast({ title: "Évaluation créée", message: "La valeur a été enregistrée.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["evaluations"] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Création évaluation")
  });

  const updateM = useMutation({
    mutationFn: async () => updateEvaluation(editingCle!, updateForm),
    onSuccess: async () => {
      toast({ title: "Évaluation modifiée", message: "Mise à jour OK.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["evaluations"] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Modification évaluation")
  });

  const delM = useMutation({
    mutationFn: async (cle: string) => deleteEvaluation(cle),
    onSuccess: async () => {
      toast({ title: "Supprimé", message: "Évaluation supprimée.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["evaluations"] });
    },
    onError: (e) => notify(e, "Suppression évaluation")
  });

  const isBusy = createM.isPending || updateM.isPending;

  return (
    <div>
      <PageHeader
        title="Évaluations"
        subtitle="Saisir des soldes (par compte interne) pour calculer automatiquement les opérations +/- solde."
        right={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Nouvelle</Button>}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Liste</CardTitle>
            <CardDescription>Recherche instantanée, modification en un clic.</CardDescription>
          </div>
          <div className="w-full max-w-md">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (clé, compte, libellé…)" />
          </div>
        </CardHeader>

        {q.isLoading ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-white/60">Aucune évaluation.</div>
        ) : (
          <Table>
            <TableInner>
              <thead>
                <tr>
                  <Th>Clé</Th>
                  <Th>Compte interne</Th>
                  <Th>Date solde</Th>
                  <Th>Libellé</Th>
                  <Th className="text-right">Montant (€)</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.cle} className="hover:bg-white/5">
                    <Td className="font-medium">{e.cle}</Td>
                    <Td>
                      <div className="text-sm font-medium">{e.compteInterne?.identifiant ?? "—"}</div>
                      <div className="text-xs text-white/55">{e.compteInterne?.libelle ?? "—"}</div>
                    </Td>
                    <Td>{safeFormatLocalDate(e.dateSolde)}</Td>
                    <Td className="text-sm">{e.libelle || "—"}</Td>
                    <Td className="text-right font-semibold">{(e.montantSoldeEnCentimes / 100).toFixed(2)}</Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="rounded-xl p-2 hover:bg-white/10" onClick={() => openEdit(e)} aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-xl p-2 hover:bg-white/10"
                          onClick={() => {
                            if (confirm(`Supprimer l'évaluation ${e.cle} ?`)) delM.mutate(e.cle);
                          }}
                          aria-label="Supprimer"
                        >
                          <Trash2 className="h-4 w-4 text-blush-200" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableInner>
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingCle ? `Modifier ${editingCle}` : "Créer une évaluation"}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">Annuler</Button>
            <Button
              loading={isBusy}
              onClick={() => (editingCle ? updateM.mutate() : createM.mutate())}
              disabled={editingCle ? !updateForm.identifiantCompteInterne || !updateForm.cle : !createForm.identifiantCompteInterne || !createForm.cle}
              type="button"
            >
              Enregistrer
            </Button>
          </>
        }
      >
        {!editingCle ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Clé (cle)"
              value={createForm.cle}
              onChange={(e) => setCreateForm(s => ({ ...s, cle: e.target.value }))}
              hint="Doit être unique. Exemple: EVAL-2026-01"
            />
            <Input
              label="Libellé"
              value={createForm.libelle}
              onChange={(e) => setCreateForm(s => ({ ...s, libelle: e.target.value }))}
              placeholder="Ex: Solde fin de mois"
            />

            <Combobox
              label="Compte interne (identifiantCompteInterne)"
              value={createForm.identifiantCompteInterne || null}
              onChange={(v) => setCreateForm(s => ({ ...s, identifiantCompteInterne: v }))}
              options={compteOptions}
              placeholder="Choisir…"
            />

            <Input
              label="Date solde (dateSolde)"
              type="date"
              value={createForm.dateSolde}
              onChange={(e) => setCreateForm(s => ({ ...s, dateSolde: e.target.value }))}
            />

            <div className="md:col-span-2">
              <MoneyInput
                label="Solde (montantSoldeEnCentimes)"
                valueCents={createForm.montantSoldeEnCentimes}
                onChangeCents={(c) => setCreateForm(s => ({ ...s, montantSoldeEnCentimes: c }))}
                hint="Enregistre le solde exact du compte à la date donnée."
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Clé (cle)"
              value={updateForm.cle}
              onChange={(e) => setUpdateForm(s => ({ ...s, cle: e.target.value }))}
              hint="Doit correspondre à la clé de l'évaluation."
            />
            <Input
              label="Libellé"
              value={updateForm.libelle}
              onChange={(e) => setUpdateForm(s => ({ ...s, libelle: e.target.value }))}
            />

            <Combobox
              label="Compte interne (identifiantCompteInterne)"
              value={updateForm.identifiantCompteInterne || null}
              onChange={(v) => setUpdateForm(s => ({ ...s, identifiantCompteInterne: v }))}
              options={compteOptions}
              placeholder="Choisir…"
            />

            <Input
              label="Date solde (dateSolde)"
              type="date"
              value={updateForm.dateSolde}
              onChange={(e) => setUpdateForm(s => ({ ...s, dateSolde: e.target.value }))}
            />

            <div className="md:col-span-2">
              <MoneyInput
                label="Solde (montantSoldeEnCentimes)"
                valueCents={updateForm.montantSoldeEnCentimes}
                onChangeCents={(c) => setUpdateForm(s => ({ ...s, montantSoldeEnCentimes: c }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
