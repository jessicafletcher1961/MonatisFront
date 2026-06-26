// Path exacte depuis la racine du projet :
// MonatisBack-main/src/test/java/fr/colline/monatis/operations/repository/OperationPaginationRepositoryTest.java

// Modification : ajout d'un test JPA pour les requetes paginees du releve de compte.
// Pourquoi : H2 doit executer les deux requetes `findRecettesByCompteIdAndDateRange`
// et `findDepensesByCompteIdAndDateRange` avec le tri par date comptable.
// Cela evite de reutiliser par erreur `select distinct o` avec `order by coalesce(...)`,
// combinaison refusee par H2 lorsque l'expression de tri n'est pas projetee.

@Test
void paginerReleveCompteInterneAvecTriParDateComptable() {

	Page<Operation> recettes = operationRepository.findRecettesByCompteIdAndDateRange(
			compteCourant.getId(),
			LocalDate.of(2025, 1, 1),
			LocalDate.of(2025, 1, 31),
			PageRequest.of(0, 10));
	Page<Operation> depenses = operationRepository.findDepensesByCompteIdAndDateRange(
			compteCourant.getId(),
			LocalDate.of(2025, 1, 1),
			LocalDate.of(2025, 1, 31),
			PageRequest.of(0, 10));

	assertThat(recettes.getTotalElements()).isEqualTo(1);
	assertThat(recettes.getContent())
			.extracting(Operation::getNumero)
			.containsExactly("OP002");
	assertThat(depenses.getTotalElements()).isEqualTo(2);
	assertThat(depenses.getContent())
			.extracting(Operation::getNumero)
			.containsExactly("OP003", "OP001");
}
