/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveResponseDto.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

import fr.colline.monatis.MonatisResponseDto;

public class RegleImportReleveResponseDto implements Serializable, MonatisResponseDto {

	private static final long serialVersionUID = 5382310130695193351L;

	public Long id;
	public String cleLibelleNormalisee;
	public String libelleExemple;
	public String roleCompteExterne;
	public String codeTypeOperation;

	public Long compteInterneContexteId;
	public String identifiantCompteInterneContexte;
	public String libelleCompteInterneContexte;

	public Long compteExterneId;
	public String identifiantCompteExterne;
	public String libelleCompteExterne;

	public Long sousCategorieId;
	public String nomSousCategorie;
	public String libelleSousCategorie;

	public List<Long> beneficiaireIds;
	public List<String> nomsBeneficiaires;

	public Long nombreUtilisations;
	public LocalDateTime dateDerniereUtilisation;
	public Boolean active;
}

