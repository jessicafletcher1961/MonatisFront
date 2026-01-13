import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReferenceKind, createReference, deleteReference, listReferences, updateReference, createSousCategorie, updateSousCategorie } from "@/api/references";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";
import { useApiError } from "@/hooks/useApiError";
import { Combobox } from "@/components/ui/Combobox";
import { Trash2, Pencil, Plus } from "lucide-react";

type Props = {
  kind: ReferenceKind;
  title: string;
  subtitle: string;
  // For sous-categorie only
  categorieOptions?: { value: string; label: string }[];
};

export function ReferenceCrud({ kind, title, subtitle, categorieOptions }: Props) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { notify } = useApiError();

  const q = useQuery({ queryKey: ["references", kind], queryFn: () => listReferences(kind) });
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [nom, setNom] = useState("");
  const [libelle, setLibelle] = useState("");
  const [nomCategorie, setNomCategorie] = useState("");

  const filtered = useMemo(() => {
    const items = q.data ?? [];
    if (!search.trim()) return items;
    const s = search.toLowerCase();
    return items.filter(i => (i.nom + " " + (i.libelle ?? "")).toLowerCase().includes(s));
  }, [q.data, search]);

  function openCreate() {
    setEditing(null);
    setNom("");
    setLibelle("");
    setNomCategorie("");
    setOpen(true);
  }
  function openEdit(item: any) {
    setEditing(item.nom);
    setNom(item.nom);
    setLibelle(item.libelle ?? "");
    setNomCategorie("");
    setOpen(true);
  }

  const createM = useMutation({
    mutationFn: async () => {
      if (kind === "souscategorie") return createSousCategorie({ nom, libelle, nomCategorie });
      return createReference(kind, { nom, libelle });
    },
    onSuccess: async () => {
      toast({ title: "Créé", message: "Référence enregistrée.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["references", kind] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Création référence")
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("missing nom");
      if (kind === "souscategorie") return updateSousCategorie(editing, { nom, libelle, nomCategorie });
      return updateReference(kind, editing, { nom, libelle });
    },
    onSuccess: async () => {
      toast({ title: "Modifié", message: "Référence mise à jour.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["references", kind] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Modification référence")
  });

  const delM = useMutation({
    mutationFn: async (n: string) => deleteReference(kind, n),
    onSuccess: async () => {
      toast({ title: "Supprimé", message: "Référence supprimée.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["references", kind] });
    },
    onError: (e) => notify(e, "Suppression référence")
  });

  // v2 du catalogue: la suppression de banque est exposée (si aucune compte interne n'y est rattaché).
  const canDelete = true;

  const needCategorie = kind === "souscategorie";

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        right={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Nouveau</Button>}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Liste</CardTitle>
            <CardDescription>Nom + libellé.</CardDescription>
          </div>
          <div className="w-full max-w-md">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" />
          </div>
        </CardHeader>

        {q.isLoading ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-white/60">Aucune référence.</div>
        ) : (
          <Table>
            <TableInner>
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Libellé</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr
                    key={r.nom}
                    className={
                      "hover:bg-white/5 " +
                      (kind === "titulaire" || kind === "banque" ? "cursor-pointer" : "")
                    }
                    onClick={
                      kind === "titulaire"
                        ? () => nav(`/titulaires/${encodeURIComponent(r.nom)}`)
                        : kind === "banque"
                          ? () => nav(`/banques/${encodeURIComponent(r.nom)}`)
                          : undefined
                    }
                  >
                    <Td className="font-medium">{r.nom}</Td>
                    <Td>{r.libelle ?? "—"}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="rounded-xl p-2 hover:bg-white/10"
                          onClick={() => openEdit(r)}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {canDelete ? (
                          <button
                            className="rounded-xl p-2 hover:bg-white/10"
                            onClick={() => delM.mutate(r.nom)}
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4 text-blush-200" />
                          </button>
                        ) : null}
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
        title={editing ? "Modifier" : "Créer"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">Annuler</Button>
            <Button loading={createM.isPending || updateM.isPending} onClick={() => (editing ? updateM.mutate() : createM.mutate())} type="button">
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          <Input label="Libellé" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
          {needCategorie ? (
            <div className="md:col-span-2">
              <Combobox
                label="Catégorie (nomCategorie)"
                value={nomCategorie || null}
                onChange={setNomCategorie}
                options={categorieOptions ?? []}
                placeholder="Choisir la catégorie parente…"
              />
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
