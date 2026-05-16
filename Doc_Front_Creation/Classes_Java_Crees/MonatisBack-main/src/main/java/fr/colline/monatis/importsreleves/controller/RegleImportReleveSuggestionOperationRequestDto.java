/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveSuggestionOperationRequestDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveSuggestionOperationRequestDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;

public class RegleImportReleveSuggestionOperationRequestDto implements Serializable {

	private static final long serialVersionUID = 4276803184581697637L;

	public String operationImportId;
	public String libelle;
	public String groupKey;
	public String roleCompteExterne;
	public Long compteInterneContexteId;
	public String identifiantCompteInterneContexte;
}

