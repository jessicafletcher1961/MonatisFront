import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";

export function TitulairesEmpty() {
  return (
    <EmptyState
      title="Choisissez un titulaire"
      subtitle="Sélectionnez un titulaire à gauche pour afficher ses comptes associés."
      action={
        <Link className="btn-glam" to="/references/titulaires">
          Créer un titulaire
        </Link>
      }
    />
  );
}
