import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOperations, getOperation, deleteOperation, updateOperation } from "@/api/operations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Table, TableInner, Td, Th } from "@/components/ui/Table";
import { centsToEuros } from "@/utils/money";
import { safeFormatLocalDate } from "@/utils/dates";
import { Modal } from "@/components/ui/Modal";
import { useApiError } from "@/hooks/useApiError";
import { useToast } from "@/hooks/useToast";
import { Combobox } from "@/components/ui/Combobox";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { useAllAccountsOptions, useReferenceOptions } from "@/hooks/useOptions";
import { useOperationTypes } from "@/hooks/useTypes";
import type { OperationDetailedResponseDto, OperationModificationRequestDto, OperationLigneRequestDto } from "@/types/dto";
import { Trash2, Pencil, Eye, RefreshCw } from "lucide-react";

function matches(hay: string, needle: string) {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

export default function Operations() {
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { notify } = useApiError();
  const { toast } = useToast();

  const q = useQuery({ queryKey: ["operations"], queryFn: listOperations });
  const accounts = useAllAccountsOptions();
  const sousCats = useReferenceOptions("souscategorie");
  const benefs = useReferenceOptions("beneficiaire");
  const opTypes = useOperationTypes();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [details, setDetails] = useState<OperationDetailedResponseDto | null>(null);

  // Permet d'ouvrir directement une opération via /operations?open=NUM
  useEffect(() => {
    const open = searchParams.get("open");
    if (!open) return;
    openDetails(open, "view");
    // On nettoie l'URL pour éviter de rouvrir en boucle au refresh.
    nav("/operations", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, nav]);

  const filtered = useMemo(() => {
    const ops = q.data ?? [];
    if (!search.trim()) return ops;
    return ops.filter(op => {
      const hay = [
        op.numero,
        op.libelle,
        op.typeOperation?.libelle ?? op.typeOperation?.code ?? "",
        op.compteDepense?.identifiant ?? "",
        op.compteDepense?.libelle ?? "",
        op.compteRecette?.identifiant ?? "",
        op.compteRecette?.libelle ?? ""
      ].join(" | ");
      return matches(hay, search.trim());
    });
  }, [q.data, search]);

  const delM = useMutation({
    mutationFn: async (numero: string) => deleteOperation(numero),
    onSuccess: async () => {
      toast({ title: "Supprimé", message: "L'opération a été supprimée.", variant: "success" });
      await qc.invalidateQueries({ queryKey: ["operations"] });
      setSelected(null);
      setDetails(null);
    },
    onError: (e) => notify(e, "Suppression opération")
  });

  async function openDetails(numero: string, newMode: "view" | "edit") {
    setMode(newMode);
    setSelected(numero);
    try {
      const d = await getOperation(numero);
      setDetails(d);
    } catch (e) {
      notify(e, "Lecture opération");
    }
  }

  // Permet d'ouvrir une opération directement depuis d'autres pages (ex: détail compte)
  useEffect(() => {
    const open = searchParams.get("open");
    if (open) {
      openDetails(open, "view");
      nav("/operations", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, nav]);

  const saveM = useMutation({
    mutationFn: async (dto: OperationModificationRequestDto) => {
      if (!selected) throw new Error("Missing numero");
      return updateOperation(selected, dto);
    },
    onSuccess: async (d) => {
      toast({ title: "Mise à jour", message: `Opération ${d.numero} modifiée.`, variant: "success" });
      await qc.invalidateQueries({ queryKey: ["operations"] });
      setDetails(d);
      setMode("view");
    },
    onError: (e) => notify(e, "Modification opération")
  });

  return (
    <div>
      <PageHeader
        title="Journal des Opérations"
        subtitle="Recherche, détail, modification, suppression."
        right={
          <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ["operations"] })} type="button">
            <RefreshCw className="h-4 w-4" /> Rafraîchir
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Opérations</CardTitle>
            <CardDescription>Double-clique sur une ligne pour voir le détail.</CardDescription>
          </div>
          <div className="w-full max-w-md">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher (numéro, libellé, compte, type…)" />
          </div>
        </CardHeader>

        {q.isLoading ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-white/60">Aucune opération.</div>
        ) : (
          <Table>
            <TableInner>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Libellé</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Montant</Th>
                  <Th>Comptes</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice().sort((a,b) => (a.dateValeur < b.dateValeur ? 1 : -1)).map(op => (
                  <tr
                    key={op.numero}
                    className="cursor-pointer hover:bg-white/5"
                    onDoubleClick={() => openDetails(op.numero, "view")}
                  >
                    <Td>{safeFormatLocalDate(op.dateValeur)}</Td>
                    <Td>
                      <div className="font-medium">{op.libelle}</div>
                      <div className="text-xs text-white/50">{op.numero}</div>
                    </Td>
                    <Td>{op.typeOperation?.libelle ?? op.typeOperation?.code ?? "—"}</Td>
                    <Td className="text-right font-semibold">{centsToEuros(op.montantEnCentimes)} €</Td>
                    <Td className="text-xs text-white/70">
                      <div>{op.compteDepense?.identifiant ?? "—"} →</div>
                      <div>{op.compteRecette?.identifiant ?? "—"}</div>
                    </Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          className="rounded-xl p-2 hover:bg-white/10"
                          onClick={(e) => { e.stopPropagation(); openDetails(op.numero, "view"); }}
                          aria-label="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-xl p-2 hover:bg-white/10"
                          onClick={(e) => { e.stopPropagation(); openDetails(op.numero, "edit"); }}
                          aria-label="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-xl p-2 hover:bg-white/10"
                          onClick={(e) => { e.stopPropagation(); delM.mutate(op.numero); }}
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
        open={!!selected}
        onClose={() => { setSelected(null); setDetails(null); }}
        title={mode === "view" ? "Détail opération" : "Modifier opération"}
        wide
        footer={
          mode === "view" ? (
            <>
              <Button variant="secondary" onClick={() => setMode("edit")} type="button">
                <Pencil className="h-4 w-4" /> Modifier
              </Button>
              <Button variant="danger" onClick={() => selected && delM.mutate(selected)} type="button" loading={delM.isPending}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
              <Button variant="ghost" onClick={() => { setSelected(null); setDetails(null); }} type="button">Fermer</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setMode("view")} type="button">Annuler</Button>
              <Button
                loading={saveM.isPending}
                onClick={() => {
                  if (!details) return;
                  const dto = buildUpdateDto(details);
                  saveM.mutate(dto);
                }}
                type="button"
              >
                Enregistrer
              </Button>
            </>
          )
        }
      >
        {!details ? (
          <div className="text-sm text-white/60">Chargement…</div>
        ) : mode === "view" ? (
          <OperationDetailView d={details} />
        ) : (
          <OperationEdit
            d={details}
            onChange={(next) => setDetails(next)}
            accountOptions={accounts.options}
            sousCatOptions={sousCats.options}
            benefOptions={benefs.options}
            opTypeOptions={opTypes.items.map(x => ({ value: x.code, label: x.libelle || x.code }))}
          />
        )}
      </Modal>
    </div>
  );
}

function OperationDetailView({ d }: { d: OperationDetailedResponseDto }) {
  const formatCompte = (c?: any) => {
    if (!c) return "—";
    const ident = c.identifiant ?? "—";
    return c.libelle ? `${ident} · ${c.libelle}` : ident;
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Info label="Numéro" value={d.numero} />
        <Info label="Date valeur" value={safeFormatLocalDate(d.dateValeur)} />
        <Info label="Type" value={d.typeOperation?.libelle ?? d.typeOperation?.code ?? "—"} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Info label="Libellé" value={d.libelle} />
        <Info label="Montant" value={`${(d.montantEnCentimes/100).toFixed(2)} €`} />
        <Info label="Compte dépense" value={formatCompte(d.compteDepense)} />
        <Info label="Compte recette" value={formatCompte(d.compteRecette)} />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 text-sm font-semibold">Lignes</div>
        {d.lignes?.length ? (
          <div className="space-y-2">
            {d.lignes.map(l => (
              <div key={l.numeroLigne} className="rounded-2xl bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{l.libelle}</div>
                  <div className="text-sm font-semibold">{(l.montantEnCentimes/100).toFixed(2)} €</div>
                </div>
                <div className="mt-1 text-xs text-white/60">
                  {safeFormatLocalDate(l.dateComptabilisation)} • {l.sousCategorie?.libelle ?? l.sousCategorie?.nom ?? "—"} • {l.beneficiaires?.map(b => b.libelle || b.nom).join(", ") || "—"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/60">Aucune ligne.</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function buildUpdateDto(d: OperationDetailedResponseDto): OperationModificationRequestDto {
  const lignes: OperationLigneRequestDto[] = (d.lignes ?? []).map(l => ({
    numeroLigne: l.numeroLigne,
    libelle: l.libelle,
    dateComptabilisation: l.dateComptabilisation,
    montantEnCentimes: l.montantEnCentimes,
    nomSousCategorie: l.sousCategorie?.nom ?? "",
    nomsBeneficiaires: (l.beneficiaires ?? []).map(b => b.nom)
  }));

  return {
    codeTypeOperation: d.typeOperation?.code ?? "",
    numero: d.numero,
    libelle: d.libelle,
    dateValeur: d.dateValeur,
    montantEnCentimes: d.montantEnCentimes,
    identifiantCompteDepense: d.compteDepense?.identifiant ?? "",
    identifiantCompteRecette: d.compteRecette?.identifiant ?? "",
    lignes
  };
}

function OperationEdit({
  d,
  onChange,
  accountOptions,
  sousCatOptions,
  benefOptions,
  opTypeOptions
}: {
  d: OperationDetailedResponseDto;
  onChange: (next: OperationDetailedResponseDto) => void;
  accountOptions: { value: string; label: string; meta?: string }[];
  sousCatOptions: { value: string; label: string }[];
  benefOptions: { value: string; label: string }[];
  opTypeOptions: { value: string; label: string }[];
}) {
  // We edit directly by cloning, so "Enregistrer" uses the updated "details".
  const dto = buildUpdateDto(d);

  function patch(p: Partial<typeof dto>) {
    const next = { ...dto, ...p };
    onChange(applyDtoToDetails(d, next));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input label="Numéro" value={dto.numero} disabled />
        <Input label="Date valeur" type="date" value={dto.dateValeur} onChange={(e) => patch({ dateValeur: e.target.value })} />
        <Combobox
          label="Type"
          value={dto.codeTypeOperation || null}
          onChange={(v) => patch({ codeTypeOperation: v })}
          options={opTypeOptions.map(o => ({ value: o.value, label: o.label }))}
          placeholder="Choisir…"
        />
      </div>

      <Input label="Libellé" value={dto.libelle} onChange={(e) => patch({ libelle: e.target.value })} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MoneyInput
          label="Montant"
          valueCents={dto.montantEnCentimes}
          onChangeCents={(c) => patch({ montantEnCentimes: c })}
        />
        <Combobox
          label="Compte dépense"
          value={dto.identifiantCompteDepense || null}
          onChange={(v) => patch({ identifiantCompteDepense: v })}
          options={accountOptions}
          placeholder="Choisir…"
        />
        <Combobox
          label="Compte recette"
          value={dto.identifiantCompteRecette || null}
          onChange={(v) => patch({ identifiantCompteRecette: v })}
          options={accountOptions}
          placeholder="Choisir…"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Lignes</div>
            <div className="text-xs text-white/60">Tu peux ajuster sous-catégories, bénéficiaires et montants.</div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const nextLineNo = (dto.lignes?.reduce((m, l) => Math.max(m, l.numeroLigne), 0) ?? 0) + 1;
              patch({
                lignes: [
                  ...(dto.lignes ?? []),
                  {
                    numeroLigne: nextLineNo,
                    libelle: "Ligne",
                    dateComptabilisation: dto.dateValeur,
                    montantEnCentimes: 0,
                    nomSousCategorie: "",
                    nomsBeneficiaires: []
                  }
                ]
              });
            }}
          >
            + Ajouter
          </Button>
        </div>

        <div className="space-y-3">
          {(dto.lignes ?? []).map((l, idx) => (
            <div key={l.numeroLigne} className="rounded-2xl bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs text-white/60">Ligne #{l.numeroLigne}</div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9"
                  onClick={() => {
                    const next = (dto.lignes ?? []).filter(x => x.numeroLigne !== l.numeroLigne);
                    patch({ lignes: next });
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Retirer
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input
                  label="Libellé"
                  value={l.libelle}
                  onChange={(e) => {
                    const next = [...(dto.lignes ?? [])];
                    next[idx] = { ...next[idx], libelle: e.target.value };
                    patch({ lignes: next });
                  }}
                />
                <Input
                  label="Date comptabilisation"
                  type="date"
                  value={l.dateComptabilisation}
                  onChange={(e) => {
                    const next = [...(dto.lignes ?? [])];
                    next[idx] = { ...next[idx], dateComptabilisation: e.target.value };
                    patch({ lignes: next });
                  }}
                />

                <MoneyInput
                  label="Montant"
                  valueCents={l.montantEnCentimes}
                  onChangeCents={(c) => {
                    const next = [...(dto.lignes ?? [])];
                    next[idx] = { ...next[idx], montantEnCentimes: c };
                    patch({ lignes: next });
                  }}
                />

                <Combobox
                  label="Sous-catégorie"
                  value={l.nomSousCategorie || null}
                  onChange={(v) => {
                    const next = [...(dto.lignes ?? [])];
                    next[idx] = { ...next[idx], nomSousCategorie: v };
                    patch({ lignes: next });
                  }}
                  options={sousCatOptions}
                  placeholder="Choisir…"
                />

                <div className="md:col-span-2">
                  <MultiSelect
                    label="Bénéficiaires"
                    values={l.nomsBeneficiaires}
                    onChange={(vals) => {
                      const next = [...(dto.lignes ?? [])];
                      next[idx] = { ...next[idx], nomsBeneficiaires: vals };
                      patch({ lignes: next });
                    }}
                    options={benefOptions}
                    placeholder="Ajouter…"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-xs text-white/55">
          Note: le backend peut recalcule certains champs à partir des lignes (selon ta logique serveur).
        </div>
      </div>
    </div>
  );
}

function applyDtoToDetails(base: OperationDetailedResponseDto, dto: OperationModificationRequestDto): OperationDetailedResponseDto {
  return {
    ...base,
    libelle: dto.libelle,
    dateValeur: dto.dateValeur,
    montantEnCentimes: dto.montantEnCentimes,
    typeOperation: { code: dto.codeTypeOperation, libelle: base.typeOperation?.libelle ?? dto.codeTypeOperation },
    compteDepense: { ...base.compteDepense, identifiant: dto.identifiantCompteDepense, libelle: base.compteDepense?.libelle ?? dto.identifiantCompteDepense },
    compteRecette: { ...base.compteRecette, identifiant: dto.identifiantCompteRecette, libelle: base.compteRecette?.libelle ?? dto.identifiantCompteRecette },
    lignes: (dto.lignes ?? []).map(l => ({
      numeroLigne: l.numeroLigne,
      libelle: l.libelle,
      dateComptabilisation: l.dateComptabilisation,
      montantEnCentimes: l.montantEnCentimes,
      sousCategorie: { nom: l.nomSousCategorie, libelle: l.nomSousCategorie },
      beneficiaires: l.nomsBeneficiaires.map(n => ({ nom: n, libelle: n }))
    }))
  };
}
