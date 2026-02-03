import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";

export function ComptesEmpty() {
  return (
    <EmptyState
      title="Choisissez un compte"
      subtitle="Sélectionnez un compte pour afficher ses opérations et associations."
      action={
        <Link className="btn-glam" to="/comptes/manage">
          Créer un compte
        </Link>
      }
    />
  );
}
