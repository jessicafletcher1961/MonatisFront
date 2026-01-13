import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listComptesTechniques, createCompteTechnique, updateCompteTechnique, deleteCompteTechnique } from "@/api/comptes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { useApiError } from "@/hooks/useApiError";
import type { CompteTechniqueRequestDto } from "@/types/dto";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function ComptesTechniques() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { notify } = useApiError();

  const q = useQuery({ queryKey: ["comptes","techniques"], queryFn: listComptesTechniques });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState<CompteTechniqueRequestDto>({
    identifiant: "",
    libelle: ""
  });

  function openCreate() {
    setEditingId(null);
    setForm({ identifiant: "", libelle: "" });
    setOpen(true);
  }

  function openEdit(item: any) {
    setEditingId(item.identifiant);
    setForm({ identifiant: item.identifiant, libelle: item.libelle });
    setOpen(true);
  }

  const createM = useMutation({
    mutationFn: async () => createCompteTechnique(form),
    onSuccess: async () => {
      toast({ title: "Compte technique créé", message: "Le compte a été ajouté.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["comptes","techniques"] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Création compte technique")
  });

  const updateM = useMutation({
    mutationFn: async () => updateCompteTechnique(editingId!, form),
    onSuccess: async () => {
      toast({ title: "Compte technique modifié", message: "Mise à jour OK.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["comptes","techniques"] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Modification compte technique")
  });

  const deleteM = useMutation({
    mutationFn: async (identifiant: string) => deleteCompteTechnique(identifiant),
    onSuccess: async () => {
      toast({ title: "Compte supprimé", message: "Suppression OK.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["comptes","techniques"] });
      setDeleteId(null);
    },
    onError: (e) => notify(e, "Suppression compte technique")
  });

  return (
    <div>
      <PageHeader
        title="Comptes Techniques"
        subtitle="Comptes internes au système (réserves, amortissement, etc.)."
        right={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Nouveau</Button>}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Liste</CardTitle>
            <CardDescription>Identifiant + libellé.</CardDescription>
          </div>
        </CardHeader>

        {q.isLoading ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="text-sm text-white/60">Aucun compte technique.</div>
        ) : (
          <Table>
            <TableInner>
              <thead>
                <tr>
                  <Th>Identifiant</Th>
                  <Th>Libellé</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {(q.data ?? []).map(c => (
                  <tr key={c.identifiant} className="hover:bg-white/5">
                    <Td className="font-medium">{c.identifiant}</Td>
                    <Td>{c.libelle}</Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="rounded-xl p-2 hover:bg-white/10" onClick={() => openEdit(c)} aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button className="rounded-xl p-2 hover:bg-white/10" onClick={() => setDeleteId(c.identifiant)} aria-label="Supprimer">
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
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Supprimer un compte technique"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)} type="button">Annuler</Button>
            <Button variant="danger" loading={deleteM.isPending} onClick={() => deleteId && deleteM.mutate(deleteId)} type="button">Supprimer</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-white/80">
          <div>Règle : impossible de supprimer un compte s'il est utilisé par au moins une opération.</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            Identifiant : <span className="font-mono">{deleteId}</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Modifier un compte technique" : "Créer un compte technique"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">Annuler</Button>
            <Button
              loading={createM.isPending || updateM.isPending}
              onClick={() => (editingId ? updateM.mutate() : createM.mutate())}
              type="button"
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Identifiant" value={form.identifiant} onChange={(e) => setForm(s => ({ ...s, identifiant: e.target.value }))} />
          <Input label="Libellé" value={form.libelle} onChange={(e) => setForm(s => ({ ...s, libelle: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
