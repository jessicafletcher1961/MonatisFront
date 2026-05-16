/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveSuggestionResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveSuggestionResponseDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;
import java.util.List;

import fr.colline.monatis.MonatisResponseDto;

public class RegleImportReleveSuggestionResponseDto implements Serializable, MonatisResponseDto {

	private static final long serialVersionUID = 5823166720386069062L;

	public List<RegleImportReleveSuggestionOperationResponseDto> operations;
}

