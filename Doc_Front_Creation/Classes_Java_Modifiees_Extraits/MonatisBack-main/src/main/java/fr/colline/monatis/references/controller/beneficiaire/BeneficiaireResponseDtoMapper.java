/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\beneficiaire\BeneficiaireResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\beneficiaire\BeneficiaireResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.references.controller.beneficiaire;

import fr.colline.monatis.references.controller.ReferenceResponseDto;
import fr.colline.monatis.references.model.Beneficiaire;

public class BeneficiaireResponseDtoMapper {

	public static ReferenceResponseDto mapperModelToBasicResponseDto(Beneficiaire beneficiaire) {
		
		BeneficiaireBasicResponseDto dto = new BeneficiaireBasicResponseDto();
		
		dto.id = beneficiaire.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = beneficiaire.getNom();
		dto.libelle = beneficiaire.getLibelle();

		return dto;
	}

	public static ReferenceResponseDto mapperModelToSimpleResponseDto(Beneficiaire beneficiaire) {
		
		BeneficiaireSimpleResponseDto dto = new BeneficiaireSimpleResponseDto();
		
		dto.id = beneficiaire.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = beneficiaire.getNom();
		dto.libelle = beneficiaire.getLibelle();

		return dto;
	}

	public static ReferenceResponseDto mapperModelToDetailedResponseDto(Beneficiaire beneficiaire) {
		
		BeneficiaireDetailedResponseDto dto = new BeneficiaireDetailedResponseDto();
		
		dto.id = beneficiaire.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = beneficiaire.getNom();
		dto.libelle = beneficiaire.getLibelle();
		
		return dto;
	}

}

