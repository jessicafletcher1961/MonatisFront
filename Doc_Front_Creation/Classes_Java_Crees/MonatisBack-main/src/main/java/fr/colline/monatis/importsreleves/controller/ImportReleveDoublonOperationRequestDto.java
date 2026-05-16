/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonOperationRequestDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonOperationRequestDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;
import java.time.LocalDate;

public class ImportReleveDoublonOperationRequestDto implements Serializable {

	private static final long serialVersionUID = -4901367963288821706L;

	public String operationImportId;
	public String libelle;
	public LocalDate dateValeur;
	public LocalDate dateComptabilisation;
	public Long montantEnCentimes;
	public String codeTypeOperation;
	public String identifiantCompteDepense;
	public String identifiantCompteRecette;
}

