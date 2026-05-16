/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveSuggestionOperationResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveSuggestionOperationResponseDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;

public class RegleImportReleveSuggestionOperationResponseDto implements Serializable {

	private static final long serialVersionUID = 3184646315845152688L;

	public int index;
	public String operationImportId;
	public String cleLibelleNormalisee;
	public Boolean suggestionTrouvee;
	public RegleImportReleveResponseDto regle;
}

