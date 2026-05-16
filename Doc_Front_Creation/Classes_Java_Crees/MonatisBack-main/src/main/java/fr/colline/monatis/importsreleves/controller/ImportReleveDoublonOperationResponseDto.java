/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonOperationResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonOperationResponseDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;
import java.util.List;

public class ImportReleveDoublonOperationResponseDto implements Serializable {

	private static final long serialVersionUID = 7146200333568375873L;

	public int index;
	public String operationImportId;
	public String statut;
	public Integer score;
	public List<String> raisons;
	public ImportReleveDoublonOperationExistanteResponseDto operationExistante;
}

