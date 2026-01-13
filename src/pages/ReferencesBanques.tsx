import { ReferenceCrud } from "@/components/ReferenceCrud";

export default function ReferencesBanques() {
  return (
    <ReferenceCrud
      kind="banque"
      title="Banques"
      subtitle="Référentiel des banques (utilisé pour les comptes internes). Clique une banque pour voir ses comptes associés."
    />
  );
}
