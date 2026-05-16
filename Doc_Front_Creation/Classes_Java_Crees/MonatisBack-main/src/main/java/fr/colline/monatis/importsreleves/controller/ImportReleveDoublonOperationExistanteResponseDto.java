/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonOperationExistanteResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonOperationExistanteResponseDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;
import java.time.LocalDate;

public class ImportReleveDoublonOperationExistanteResponseDto implements Serializable {

	private static final long serialVersionUID = -2872369162888656138L;

	public String numero;
	public String libelle;
	public LocalDate dateValeur;
	public LocalDate dateComptabilisation;
	public Long montantEnCentimes;
	public String codeTypeOperation;
	public String identifiantCompteDepense;
	public String libelleCompteDepense;
	public String identifiantCompteRecette;
	public String libelleCompteRecette;
}

