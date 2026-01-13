import { Link } from "react-router-dom";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div>
      <PageHeader title="Page introuvable" subtitle="Cette route n'existe pas (ou plus)." />
      <Card className="p-6">
        <div className="text-sm text-white/75">
          Retourne au tableau de bord, ou utilise le menu pour naviguer.
        </div>
        <div className="mt-4">
          <Link to="/">
            <Button>Revenir à l'accueil</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
