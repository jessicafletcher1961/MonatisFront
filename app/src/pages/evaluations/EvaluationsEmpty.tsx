import { Link } from "react-router-dom";
import { EmptyState } from "../../components/EmptyState";

export function EvaluationsEmpty() {
  return (
    <EmptyState
      title="Choisissez une évaluation"
      subtitle="Sélectionnez une évaluation pour afficher son détail."
      action={
        <Link className="btn-glam" to="/evaluations">
          Créer une évaluation
        </Link>
      }
    />
  );
}
