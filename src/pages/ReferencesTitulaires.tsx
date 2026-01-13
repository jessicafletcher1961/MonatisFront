import { ReferenceCrud } from "@/components/ReferenceCrud";

export default function ReferencesTitulaires() {
  return (
    <ReferenceCrud
      kind="titulaire"
      title="Titulaires"
      subtitle="Personnes titulaires d'un compte (utilisé pour les comptes internes)."
    />
  );
}
