// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/DepenseRecetteService.java

DepenseRecetteSousCategoriePeriode rechercherDepenseRecetteSousCategoriePeriode(
		SousCategorie sousCategorie,
		Beneficiaire beneficiaire,
		LocalDate dateDebutPeriode,
		LocalDate dateFinPeriode) throws ServiceException {

	// Modification : transformation du beneficiaire facultatif en id nullable.
	// Pourquoi : le controller autorise l'absence de filtre beneficiaire ; avant,
	// beneficiaire.getId() provoquait une erreur quand aucun beneficiaire n'etait choisi.
	Long beneficiaireId = beneficiaire == null ? null : beneficiaire.getId();

	List<OperationLigne> operationsLignes = operationService.rechercherOperationsLignesParSousCategorieIdEtCriteres(
			sousCategorie.getId(),
			beneficiaireId, // Modification : on passe null quand aucun beneficiaire n'est filtre.
			dateDebutPeriode,
			dateFinPeriode)
			.toList();

	// Le reste de la methode est inchange : calcul des depenses, recettes et solde.
}
