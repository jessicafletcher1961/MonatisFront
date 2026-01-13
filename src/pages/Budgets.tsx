import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BudgetKind, listBudgets, createBudget, updateBudget, nextBudget, deleteBudget } from "@/api/budgets";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { centsToEuros, eurosToCents } from "@/utils/money";
import { safeFormatLocalDate, toLocalDateString } from "@/utils/dates";
import { Modal } from "@/components/ui/Modal";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useReferenceOptions } from "@/hooks/useOptions";
import { useBudgetTypes } from "@/hooks/useTypes";
import type { BudgetRequestDto, BudgetsParReferenceResponseDto } from "@/types/dto";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/useToast";
import { CalendarPlus, Pencil, Repeat, Trash2 } from "lucide-react";

const tabs: { kind: BudgetKind; label: string }[] = [
  { kind: "categorie", label: "Catégories" },
  { kind: "souscategorie", label: "Sous-catégories" },
  { kind: "beneficiaire", label: "Bénéficiaires" }
];

export default function Budgets() {
  const qc = useQueryClient();
  const { notify } = useApiError();
  const { toast } = useToast();

  const [kind, setKind] = useState<BudgetKind>("categorie");
  const q = useQuery({ queryKey: ["budgets", kind], queryFn: () => listBudgets(kind) });

  const refKind = kind === "categorie" ? "categorie" : kind === "souscategorie" ? "souscategorie" : "beneficiaire";
  const refs = useReferenceOptions(refKind as any);
  const types = useBudgetTypes();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{ ref: string; type: string; date: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ refNom: string; type: string; date: string } | null>(null);

  const periodChoices = useMemo(() => {
    const fallback = [
      { code: "MONTH", libelle: "Mensuel" },
      { code: "YEAR", libelle: "Annuel" }
    ];
    const raw = (types.items.length ? types.items : fallback);
    // Règle v2 : création d'un budget TECHNIQUE interdite.
    return raw.filter(x => String(x.code).toUpperCase() !== "TECHNIQUE");
  }, [types.items]);

  const [form, setForm] = useState<BudgetRequestDto>({
    nomReference: "",
    codeTypePeriode: "",
    dateCible: toLocalDateString(new Date()),
    montantEnCentimes: 0
  });

  const createM = useMutation({
    mutationFn: async () => createBudget(kind, form),
    onSuccess: async () => {
      toast({ title: "Budget créé", message: "Budget enregistré.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["budgets", kind] });
      setModalOpen(false);
    },
    onError: (e) => notify(e, "Création budget")
  });

  const updateM = useMutation({
    mutationFn: async () => updateBudget(kind, form),
    onSuccess: async () => {
      toast({ title: "Budget modifié", message: "Budget mis à jour.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["budgets", kind] });
      setModalOpen(false);
      setEditTarget(null);
    },
    onError: (e) => notify(e, "Modification budget")
  });

  const nextM = useMutation({
    mutationFn: async (dto: BudgetRequestDto) => nextBudget(kind, dto),
    onSuccess: async () => {
      toast({ title: "Budget suivant", message: "Le budget suivant a été généré.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["budgets", kind] });
    },
    onError: (e) => notify(e, "Budget suivant")
  });

  const deleteM = useMutation({
    mutationFn: async (dto: BudgetRequestDto) => deleteBudget(kind, dto),
    onSuccess: async () => {
      toast({ title: "Budget supprimé", message: "Le budget (et les budgets postérieurs pour la même référence) ont été supprimés.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["budgets", kind] });
      setDeleteTarget(null);
    },
    onError: (e) => notify(e, "Suppression budget")
  });

  const flatRows = useMemo(() => {
    const groups = q.data ?? [];
    const rows: Array<{ refNom: string; refLib: string; b: any }> = [];
    for (const g of groups) {
      for (const b of g.budgets ?? []) rows.push({ refNom: g.reference.nom, refLib: g.reference.libelle || g.reference.nom, b });
    }
    return rows;
  }, [q.data]);

  function openCreate() {
    setEditTarget(null);
    setForm({
      nomReference: "",
      codeTypePeriode: periodChoices[0]?.code ?? "",
      dateCible: toLocalDateString(new Date()),
      montantEnCentimes: 0
    });
    setModalOpen(true);
  }

  function openEdit(row: { refNom: string; b: any }) {
    setEditTarget({ ref: row.refNom, type: row.b.typePeriode, date: row.b.dateDebut ?? row.b.dateFin ?? toLocalDateString(new Date()) });
    setForm({
      nomReference: row.refNom,
      codeTypePeriode: row.b.typePeriode,
      dateCible: row.b.dateDebut ?? toLocalDateString(new Date()),
      montantEnCentimes: Math.round((row.b.montantEnCentimes ?? 0))
    });
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Planifier par période (catégorie, sous-catégorie, bénéficiaire)."
        right={<Button onClick={openCreate}><CalendarPlus className="h-4 w-4" /> Nouveau budget</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(t => (
          <button
            key={t.kind}
            onClick={() => setKind(t.kind)}
            className={`rounded-2xl px-4 py-2 text-sm transition ${kind === t.kind ? "bg-white/10 ring-1 ring-ink-500/20" : "bg-white/5 hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Liste</CardTitle>
            <CardDescription>Budgets existants pour « {tabs.find(t => t.kind === kind)?.label} ».</CardDescription>
          </div>
        </CardHeader>

        {q.isLoading ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : flatRows.length === 0 ? (
          <div className="text-sm text-white/60">Aucun budget.</div>
        ) : (
          <Table>
            <TableInner>
              <thead>
                <tr>
                  <Th>Référence</Th>
                  <Th>Période</Th>
                  <Th>Début</Th>
                  <Th>Fin</Th>
                  <Th className="text-right">Montant</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <Td className="font-medium">{r.refLib}</Td>
                    <Td>{r.b.typePeriode}</Td>
                    <Td>{safeFormatLocalDate(r.b.dateDebut)}</Td>
                    <Td>{safeFormatLocalDate(r.b.dateFin)}</Td>
                    <Td className="text-right font-semibold">{centsToEuros(r.b.montantEnCentimes)} €</Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="rounded-xl p-2 hover:bg-white/10" onClick={() => openEdit({ refNom: r.refNom, b: r.b })} aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className={`rounded-xl p-2 hover:bg-white/10 ${String(r.b.typePeriode).toUpperCase() === "TECHNIQUE" ? "opacity-40" : ""}`}
                          onClick={() => {
                            if (String(r.b.typePeriode).toUpperCase() === "TECHNIQUE") {
                              toast({ title: "Reconduction interdite", message: "La reconduction d'un budget TECHNIQUE est interdite (règle backend).", variant: "error" });
                              return;
                            }
                            nextM.mutate({
                              nomReference: r.refNom,
                              codeTypePeriode: r.b.typePeriode,
                              dateCible: r.b.dateDebut ?? toLocalDateString(new Date()),
                              montantEnCentimes: r.b.montantEnCentimes
                            });
                          }}
                          aria-label="Générer suivant"
                        >
                          <Repeat className="h-4 w-4 text-ink-200" />
                        </button>
                        <button
                          className="rounded-xl p-2 hover:bg-white/10"
                          onClick={() => setDeleteTarget({
                            refNom: r.refNom,
                            type: r.b.typePeriode,
                            date: r.b.dateDebut ?? toLocalDateString(new Date())
                          })}
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
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer un budget"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} type="button">Annuler</Button>
            <Button
              variant="danger"
              loading={deleteM.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteM.mutate({
                  nomReference: deleteTarget.refNom,
                  codeTypePeriode: deleteTarget.type,
                  dateCible: deleteTarget.date,
                  montantEnCentimes: 0
                });
              }}
              type="button"
            >
              Supprimer
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-white/80">
          <div>Cette action supprime le budget ciblé <b>et tous les budgets postérieurs</b> pour la même référence (règle backend).</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            Référence : <span className="font-mono">{deleteTarget?.refNom}</span><br />
            Type : <span className="font-mono">{deleteTarget?.type}</span><br />
            Date cible : <span className="font-mono">{deleteTarget?.date}</span>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Modifier un budget" : "Nouveau budget"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} type="button">Annuler</Button>
            <Button
              loading={createM.isPending || updateM.isPending}
              onClick={() => {
                if (!form.nomReference) {
                  toast({ title: "Référence manquante", message: "Choisis une référence.", variant: "error" });
                  return;
                }
                if (!editTarget && String(form.codeTypePeriode).toUpperCase() === "TECHNIQUE") {
                  toast({ title: "Type interdit", message: "La création d'un budget TECHNIQUE est interdite.", variant: "error" });
                  return;
                }
                (editTarget ? updateM.mutate() : createM.mutate());
              }}
              type="button"
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Combobox
            label="Référence"
            value={form.nomReference || null}
            onChange={(v) => setForm(s => ({ ...s, nomReference: v }))}
            options={refs.options}
            placeholder="Choisir…"
          />

          <Combobox
            label="Type de période"
            value={form.codeTypePeriode || null}
            onChange={(v) => setForm(s => ({ ...s, codeTypePeriode: v }))}
            options={periodChoices.map(x => ({ value: x.code, label: `${x.code} — ${x.libelle}` }))}
            placeholder="Choisir…"
          />

          <Input
            label="Date cible"
            type="date"
            value={form.dateCible}
            onChange={(e) => setForm(s => ({ ...s, dateCible: e.target.value }))}
            hint="LocalDate (YYYY-MM-DD)"
          />

          <MoneyInput
            label="Montant"
            valueCents={form.montantEnCentimes}
            onChangeCents={(c) => setForm(s => ({ ...s, montantEnCentimes: c }))}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
          Astuce : si ton backend expose des endpoints CSV, tu peux exporter les types de périodes pour connaître les codes exacts.
        </div>
      </Modal>
    </div>
  );
}
