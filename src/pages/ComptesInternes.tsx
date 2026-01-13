import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listComptesInternes, createCompteInterne, updateCompteInterne, deleteCompteInterne } from "@/api/comptes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Combobox } from "@/components/ui/Combobox";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { useReferenceOptions } from "@/hooks/useOptions";
import { useToast } from "@/hooks/useToast";
import { useApiError } from "@/hooks/useApiError";
import { toLocalDateString } from "@/utils/dates";
import type { CompteInterneRequestDto } from "@/types/dto";
import { Pencil, Plus, Trash2 } from "lucide-react";

const fonctionnementSuggestions = [
  { value: "COURANT", label: "COURANT — Compte courant" },
  { value: "EPARGNE", label: "EPARGNE — Épargne" },
  { value: "INVEST", label: "INVEST — Investissement" }
];

export default function ComptesInternes() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { notify } = useApiError();

  const q = useQuery({ queryKey: ["comptes","internes"], queryFn: listComptesInternes });
  const banques = useReferenceOptions("banque");
  const titulaires = useReferenceOptions("titulaire");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<string>("IDENT_ASC");

  const [form, setForm] = useState<CompteInterneRequestDto>({
    identifiant: "",
    libelle: "",
    codeTypeFonctionnement: "COURANT",
    dateSoldeInitial: toLocalDateString(new Date()),
    montantSoldeInitialEnCentimes: 0,
    nomBanque: "",
    nomsTitulaires: []
  });

  function openCreate() {
    setEditingId(null);
    setForm({
      identifiant: "",
      libelle: "",
      codeTypeFonctionnement: "COURANT",
      dateSoldeInitial: toLocalDateString(new Date()),
      montantSoldeInitialEnCentimes: 0,
      nomBanque: "",
      nomsTitulaires: []
    });
    setOpen(true);
  }

  function openEdit(item: any) {
    setEditingId(item.identifiant);
    // v2: la liste renvoie les champs utiles (type/banque/titulaires/solde initial)
    // -> on pré-remplit, ce qui évite la frustration "je dois tout re-sélectionner".
    setForm({
      identifiant: item.identifiant,
      libelle: item.libelle ?? "",
      codeTypeFonctionnement: item.codeTypeFonctionnement ?? "COURANT",
      dateSoldeInitial: item.dateSoldeInitial ?? toLocalDateString(new Date()),
      montantSoldeInitialEnCentimes: item.montantSoldeInitialEnCentimes ?? 0,
      nomBanque: item.nomBanque ?? "",
      nomsTitulaires: item.nomsTitulaires ?? []
    });
    setOpen(true);
  }

  const filtered = useMemo(() => {
    const all = q.data ?? [];
    let items = all;
    if (typeFilter !== "ALL") items = items.filter(i => i.codeTypeFonctionnement === typeFilter);

    const sorted = [...items];
    if (sortKey === "IDENT_ASC") sorted.sort((a, b) => a.identifiant.localeCompare(b.identifiant));
    if (sortKey === "SOLDE_DESC") sorted.sort((a, b) => (b.montantSoldeInitialEnCentimes ?? 0) - (a.montantSoldeInitialEnCentimes ?? 0));
    if (sortKey === "SOLDE_ASC") sorted.sort((a, b) => (a.montantSoldeInitialEnCentimes ?? 0) - (b.montantSoldeInitialEnCentimes ?? 0));
    return sorted;
  }, [q.data, sortKey, typeFilter]);

  const counts = useMemo(() => {
    const all = q.data ?? [];
    const map: Record<string, number> = { ALL: all.length };
    for (const c of all) {
      const k = c.codeTypeFonctionnement || "—";
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [q.data]);

  function typeChip(label: string, value: string) {
    const active = typeFilter === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setTypeFilter(value)}
        className={
          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition " +
          (active
            ? "border-ink-400/60 bg-ink-500/15 text-white"
            : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
        }
      >
        <span>{label}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">{counts[value] ?? 0}</span>
      </button>
    );
  }

  const createM = useMutation({
    mutationFn: async () => createCompteInterne(form),
    onSuccess: async () => {
      toast({ title: "Compte interne créé", message: "Le compte a été ajouté.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["comptes","internes"] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Création compte interne")
  });

  const updateM = useMutation({
    mutationFn: async () => updateCompteInterne(editingId!, form),
    onSuccess: async () => {
      toast({ title: "Compte interne modifié", message: "Mise à jour OK.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["comptes","internes"] });
      setOpen(false);
    },
    onError: (e) => notify(e, "Modification compte interne")
  });

  const deleteM = useMutation({
    mutationFn: async (identifiant: string) => deleteCompteInterne(identifiant),
    onSuccess: async () => {
      toast({ title: "Compte supprimé", message: "Suppression OK.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["comptes","internes"] });
      setDeleteId(null);
    },
    onError: (e) => notify(e, "Suppression compte interne")
  });

  return (
    <div>
      <PageHeader
        title="Comptes Internes"
        subtitle="Tes comptes bancaires suivis (solde initial, banque, titulaires...)."
        right={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Nouveau</Button>}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Liste</CardTitle>
            <CardDescription>Tri par type de fonctionnement + accès au détail.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex flex-wrap gap-2">
              {typeChip("Tous", "ALL")}
              {typeChip("COURANT", "COURANT")}
              {typeChip("EPARGNE", "EPARGNE")}
              {typeChip("INVEST", "INVEST")}
            </div>

            <div className="min-w-[220px]">
              <Combobox
                label="Tri"
                value={sortKey}
                onChange={setSortKey}
                options={[
                  { value: "IDENT_ASC", label: "Identifiant (A → Z)" },
                  { value: "SOLDE_DESC", label: "Solde initial (↓)" },
                  { value: "SOLDE_ASC", label: "Solde initial (↑)" }
                ]}
              />
            </div>
          </div>
        </CardHeader>

        {q.isLoading ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="text-sm text-white/60">Aucun compte interne.</div>
        ) : (
          <Table>
            <TableInner>
              <thead>
                <tr>
                  <Th>Identifiant</Th>
                  <Th>Type</Th>
                  <Th>Banque</Th>
                  <Th className="text-right">Solde initial (€)</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.identifiant}
                    className="cursor-pointer hover:bg-white/5"
                    onClick={() => nav(`/comptes-internes/${encodeURIComponent(c.identifiant)}`)}
                  >
                    <Td>
                      <div className="font-medium text-white">{c.identifiant}</div>
                      <div className="text-xs text-white/55">{c.libelle || "—"}</div>
                    </Td>
                    <Td className="text-sm">{c.codeTypeFonctionnement || "—"}</Td>
                    <Td className="text-sm">{c.nomBanque || "—"}</Td>
                    <Td className="text-right font-semibold">{((c.montantSoldeInitialEnCentimes ?? 0) / 100).toFixed(2)}</Td>
                    <Td className="text-right" onClick={(e) => e.stopPropagation()}>
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
        title="Supprimer un compte interne"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)} type="button">Annuler</Button>
            <Button variant="danger" loading={deleteM.isPending} onClick={() => deleteId && deleteM.mutate(deleteId)} type="button">Supprimer</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-white/80">
          <div>Règles : impossible de supprimer un compte interne s'il est utilisé par au moins une opération (ou si le backend le bloque).</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            Identifiant : <span className="font-mono">{deleteId}</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Modifier un compte interne" : "Créer un compte interne"}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">Annuler</Button>
            <Button
              loading={createM.isPending || updateM.isPending}
              onClick={() => {
                if (!form.identifiant?.trim() || !form.libelle?.trim()) {
                  toast({ title: "Champs manquants", message: "Identifiant et libellé sont obligatoires.", variant: "error" });
                  return;
                }
                if (!form.nomBanque?.trim()) {
                  toast({ title: "Banque manquante", message: "Choisis une banque.", variant: "error" });
                  return;
                }
                if (!form.nomsTitulaires || form.nomsTitulaires.length === 0) {
                  toast({ title: "Titulaires manquants", message: "Ajoute au moins un titulaire.", variant: "error" });
                  return;
                }
                (editingId ? updateM.mutate() : createM.mutate());
              }}
              type="button"
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Identifiant" value={form.identifiant} onChange={(e) => setForm(s => ({ ...s, identifiant: e.target.value }))} hint="ex: CHQ-001" />
          <Input label="Libellé" value={form.libelle} onChange={(e) => setForm(s => ({ ...s, libelle: e.target.value }))} hint="ex: Compte Courant" />

          <Combobox
            label="Type de fonctionnement (codeTypeFonctionnement)"
            value={form.codeTypeFonctionnement || null}
            onChange={(v) => setForm(s => ({ ...s, codeTypeFonctionnement: v }))}
            options={fonctionnementSuggestions.map(x => ({ value: x.value, label: x.label }))}
            placeholder="Choisir…"
          />

          <Combobox
            label="Banque (nomBanque)"
            value={form.nomBanque || null}
            onChange={(v) => setForm(s => ({ ...s, nomBanque: v }))}
            options={banques.options}
            placeholder="Choisir une banque…"
          />

          <Input
            label="Date solde initial"
            type="date"
            value={form.dateSoldeInitial}
            onChange={(e) => setForm(s => ({ ...s, dateSoldeInitial: e.target.value }))}
          />

          <MoneyInput
            label="Solde initial"
            valueCents={form.montantSoldeInitialEnCentimes}
            onChangeCents={(c) => setForm(s => ({ ...s, montantSoldeInitialEnCentimes: c }))}
          />

          <div className="md:col-span-2">
            <MultiSelect
              label="Titulaires (nomsTitulaires)"
              values={form.nomsTitulaires}
              onChange={(vals) => setForm(s => ({ ...s, nomsTitulaires: vals }))}
              options={titulaires.options}
              placeholder="Ajouter des titulaires…"
              hint="Les titulaires doivent exister dans Références → Titulaires."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
