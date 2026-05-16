/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveResponseDtoMapper.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.util.ArrayList;
import java.util.Collections;

import fr.colline.monatis.importsreleves.model.RegleImportReleve;
import fr.colline.monatis.references.model.Beneficiaire;

public class RegleImportReleveResponseDtoMapper {

	public static RegleImportReleveResponseDto mapperModelToResponseDto(RegleImportReleve regle) {

		RegleImportReleveResponseDto dto = new RegleImportReleveResponseDto();

		dto.id = regle.getId();
		dto.cleLibelleNormalisee = regle.getCleLibelleNormalisee();
		dto.libelleExemple = regle.getLibelleExemple();
		dto.roleCompteExterne = regle.getRoleCompteExterne() == null ? null : regle.getRoleCompteExterne().name();
		dto.codeTypeOperation = regle.getTypeOperation() == null ? null : regle.getTypeOperation().getCode();

		if (regle.getCompteInterneContexte() != null) {
			dto.compteInterneContexteId = regle.getCompteInterneContexte().getId();
			dto.identifiantCompteInterneContexte = regle.getCompteInterneContexte().getIdentifiant();
			dto.libelleCompteInterneContexte = regle.getCompteInterneContexte().getLibelle();
		}

		if (regle.getCompteExterne() != null) {
			dto.compteExterneId = regle.getCompteExterne().getId();
			dto.identifiantCompteExterne = regle.getCompteExterne().getIdentifiant();
			dto.libelleCompteExterne = regle.getCompteExterne().getLibelle();
		}

		if (regle.getSousCategorie() != null) {
			dto.sousCategorieId = regle.getSousCategorie().getId();
			dto.nomSousCategorie = regle.getSousCategorie().getNom();
			dto.libelleSousCategorie = regle.getSousCategorie().getLibelle();
		}

		dto.beneficiaireIds = new ArrayList<>();
		dto.nomsBeneficiaires = new ArrayList<>();
		if (regle.getBeneficiaires() != null) {
			for (Beneficiaire beneficiaire : regle.getBeneficiaires()) {
				dto.beneficiaireIds.add(beneficiaire.getId());
				dto.nomsBeneficiaires.add(beneficiaire.getNom());
			}
			Collections.sort(dto.beneficiaireIds);
			Collections.sort(dto.nomsBeneficiaires);
		}

		dto.nombreUtilisations = regle.getNombreUtilisations();
		dto.dateDerniereUtilisation = regle.getDateDerniereUtilisation();
		dto.active = regle.isActive();

		return dto;
	}
}

