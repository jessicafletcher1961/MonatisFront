/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveApprentissageItemRequestDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveApprentissageItemRequestDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;
import java.util.List;

public class RegleImportReleveApprentissageItemRequestDto implements Serializable {

	private static final long serialVersionUID = -4154300164459691606L;

	public String libelle;
	public String groupKey;
	public String roleCompteExterne;
	public String codeTypeOperation;

	public Long compteInterneContexteId;
	public String identifiantCompteInterneContexte;

	public Long compteExterneId;
	public String identifiantCompteExterne;

	public Long sousCategorieId;
	public String nomSousCategorie;

	public List<Long> beneficiaireIds;
	public List<String> nomsBeneficiaires;
}

