// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportResponseDtoMapper.java

// Modification : les operations de releve exposent maintenant la date comptable
// principale en plus de la date de valeur.
// Pourquoi : le front doit afficher la meme date que celle utilisee pour filtrer
// et trier le releve cote back.

private static ReleveCompteOperationResponseDto mapperOperationRecette(Operation operation) {

	ReleveCompteOperationResponseDto dto = new ReleveCompteOperationResponseDto();

	dto.numero = operation.getNumero();
	dto.codeTypeOperation = operation.getTypeOperation().getCode();
	dto.dateValeur = operation.getDateValeur();
	dto.dateComptabilisation = dateComptabilisationPrincipale(operation); // Ajout : date comptable renvoyee au front.
	dto.montantEnEuros = (double) (operation.getMontantEnCentimes() / 100.00);
	dto.libelle = operation.getLibelle();
	dto.identifiantAutreCompte = operation.getCompteDepense().getIdentifiant();
	dto.libelleAutreCompte = operation.getCompteDepense().getLibelle();
	dto.codeTypeAutreCompte = operation.getCompteDepense().getTypeCompte().getCode();

	return dto;
}

private static ReleveCompteOperationResponseDto mapperOperationDepense(Operation operation) {

	ReleveCompteOperationResponseDto dto = new ReleveCompteOperationResponseDto();

	dto.numero = operation.getNumero();
	dto.codeTypeOperation = operation.getTypeOperation().getCode();
	dto.dateValeur = operation.getDateValeur();
	dto.dateComptabilisation = dateComptabilisationPrincipale(operation); // Ajout : date comptable renvoyee au front.
	dto.montantEnEuros = 0 - (double) (operation.getMontantEnCentimes() / 100.00);
	dto.libelle = operation.getLibelle();
	dto.identifiantAutreCompte = operation.getCompteRecette().getIdentifiant();
	dto.libelleAutreCompte = operation.getCompteRecette().getLibelle();
	dto.codeTypeAutreCompte = operation.getCompteRecette().getTypeCompte().getCode();

	return dto;
}

// Ajout : helper unique pour trouver la date comptable principale.
// Il prend la ligne numero 0, puis retombe sur la premiere ligne disponible,
// puis sur dateValeur si aucune date comptable exploitable n'existe.

private static LocalDate dateComptabilisationPrincipale(Operation operation) {

	return operation.getLignes()
			.stream()
			.filter((ligne) -> ligne.getNumeroLigne() == 0)
			.findFirst()
			.or(() -> operation.getLignes().stream().findFirst())
			.map(OperationLigne::getDateComptabilisation)
			.orElse(operation.getDateValeur());
}
