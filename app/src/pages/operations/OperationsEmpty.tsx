import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";

export function OperationsEmpty() {
  return (
    <EmptyState
      title="Choisissez une opération"
      subtitle="Sélectionnez une opération pour afficher ses lignes et détails."
      action={
        <Link className="btn-glam" to="/operations/new">
          Créer une opération
        </Link>
      }
    />
  );
}
