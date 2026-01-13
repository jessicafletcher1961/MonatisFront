import { ReferenceCrud } from "@/components/ReferenceCrud";

export default function ReferencesBeneficiaires() {
  return (
    <ReferenceCrud
      kind="beneficiaire"
      title="Bénéficiaires"
      subtitle="Qui reçoit / qui est concerné par la dépense."
    />
  );
}
