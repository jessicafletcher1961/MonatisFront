// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/operations/repository/OperationLigneRepository.java

@Query(value = "select o from OperationLigne o"
		// Modification : la requete distingue explicitement deux cas.
		// - sousCategorieId null : lignes sans sous-categorie.
		// - sousCategorieId renseigne : lignes de cette sous-categorie.
		// Pourquoi : le rapport non categorise appelait deja cette methode avec null,
		// mais l'ancien test ':sousCategorieId = o.sousCategorie.id' ne pouvait pas
		// retourner proprement les lignes sans sous-categorie.
		+ " where ((:sousCategorieId is null and o.sousCategorie is null)"
		+ " or (:sousCategorieId is not null and o.sousCategorie.id = :sousCategorieId))"
		+ " and (:beneficiaireId is null or :beneficiaireId in (select b.id from o.beneficiaires b))"
		+ " and (:dateDebut is null or o.dateComptabilisation >= :dateDebut)"
		+ " and (:dateFin is null or o.dateComptabilisation <= :dateFin)"
		+ " order by o.dateComptabilisation desc")
public Stream<OperationLigne> findBySousCategorieIdAndFilters(
		Long sousCategorieId,
		Long beneficiaireId,
		LocalDate dateDebut,
		LocalDate dateFin);
