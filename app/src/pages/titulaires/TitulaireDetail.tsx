import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { monatisApi } from "../../api/monatis";
import { ErrorNotice } from "../../components/ErrorNotice";
import { EmptyState } from "../../components/EmptyState";
import { SectionHeader } from "../../components/SectionHeader";
import { useToast } from "../../components/useToast";
import { truncate } from "../../lib/format";

export function TitulaireDetail() {
  const { nom } = useParams();
  const decodedNom = nom ? decodeURIComponent(nom) : "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draftLibelle, setDraftLibelle] = useState("");

  const titulaireQuery = useQuery({
    queryKey: ["titulaires", decodedNom],
    queryFn: () => monatisApi.getTitulaire(decodedNom),
    enabled: Boolean(decodedNom),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { libelle?: string }) => monatisApi.updateTitulaire(decodedNom, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titulaires"] });
      queryClient.invalidateQueries({ queryKey: ["titulaires", decodedNom] });
      setIsEditing(false);
      push("Titulaire mis à jour.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteTitulaire(decodedNom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["titulaires"] });
      push("Titulaire supprimé.");
      navigate("/references/titulaires");
    },
  });

  const comptesFromDetail = useMemo(
    () => titulaireQuery.data?.comptesInternes ?? [],
    [titulaireQuery.data?.comptesInternes]
  );

  const compteIds = useMemo(() => {
    if (!titulaireQuery.data) return [];
    if (titulaireQuery.data.identifiantsComptesInternes?.length) {
      return titulaireQuery.data.identifiantsComptesInternes;
    }
    return comptesFromDetail.map((compte) => compte.identifiant);
  }, [titulaireQuery.data, comptesFromDetail]);

  const compteQueries = useQueries({
    queries: compteIds.map((id) => ({
      queryKey: ["comptes", "interne", id],
      queryFn: () => monatisApi.getCompteInterne(id),
      enabled: Boolean(id) && comptesFromDetail.length === 0,
    })),
  });

  const comptesFromQueries = compteQueries
    .map((query) => query.data)
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const comptes = comptesFromDetail.length ? comptesFromDetail : comptesFromQueries;

  if (!decodedNom) {
    return (
      <EmptyState
        title="Choisissez un titulaire"
        subtitle="Sélectionnez un titulaire à gauche pour afficher ses comptes associés."
      />
    );
  }

  return (
    <div className="glass-card space-y-6 p-6">
      <SectionHeader
        title={decodedNom}
        subtitle={titulaireQuery.data?.libelle ?? "Profil titulaire"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link className="nav-pill nav-pill-inactive" to="/references/titulaires">
              Retour
            </Link>
            {isEditing ? (
              <>
                <button
                  className="btn-glam"
                  onClick={() =>
                    updateMutation.mutate({ libelle: draftLibelle.trim() || undefined })
                  }
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  className="nav-pill nav-pill-inactive"
                  onClick={() => setIsEditing(false)}
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-glam"
                  onClick={() => {
                    setDraftLibelle(titulaireQuery.data?.libelle ?? "");
                    setIsEditing(true);
                  }}
                >
                  Modifier
                </button>
                <button
                  className="nav-pill nav-pill-inactive"
                  onClick={() => {
                    if (!window.confirm(`Supprimer le titulaire "${decodedNom}" ?`)) return;
                    deleteMutation.mutate();
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        }
      />

      {titulaireQuery.isError ? <ErrorNotice error={titulaireQuery.error} /> : null}
      {updateMutation.isError ? <ErrorNotice error={updateMutation.error} /> : null}
      {deleteMutation.isError ? <ErrorNotice error={deleteMutation.error} /> : null}

      {isEditing ? (
        <div className="glass-card space-y-3 px-5 py-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">
              Libellé
            </label>
            <input
              className="input-glam"
              placeholder="Libellé"
              value={draftLibelle}
              onChange={(event) => setDraftLibelle(event.target.value)}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="glass-card px-5 py-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--glam-muted)]">Associations</p>
          <p className="text-lg font-semibold">Comptes liés</p>
        </div>

        {titulaireQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Chargement du titulaire…</p>
        ) : null}

        {comptes.length === 0 && !titulaireQuery.isLoading ? (
          <p className="text-sm text-[color:var(--glam-muted)]">Aucun compte associé.</p>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {comptes.map((compte) => (
            <Link
              key={compte.identifiant}
              to={`/comptes/interne/${compte.identifiant}`}
              className="glass-card flex items-center justify-between gap-3 px-5 py-4 transition hover:translate-y-[-1px]"
            >
              <div>
                <p className="text-sm font-semibold">{truncate(compte.libelle ?? compte.identifiant, 26)}</p>
                <p className="text-xs text-[color:var(--glam-muted)]">{compte.identifiant}</p>
              </div>
              <span className="badge-glam">Détails</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
