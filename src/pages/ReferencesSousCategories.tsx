import { useQuery } from "@tanstack/react-query";
import { listReferences } from "@/api/references";
import { ReferenceCrud } from "@/components/ReferenceCrud";

export default function ReferencesSousCategories() {
  const cats = useQuery({ queryKey: ["references", "categorie"], queryFn: () => listReferences("categorie") });

  return (
    <ReferenceCrud
      kind="souscategorie"
      title="Sous-Catégories"
      subtitle="Sous-catégories rattachées à une catégorie."
      categorieOptions={(cats.data ?? []).map(c => ({ value: c.nom, label: c.nom }))}
    />
  );
}
