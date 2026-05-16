/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\technique\CompteTechniqueResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\technique\CompteTechniqueResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.comptes.controller.technique;

import fr.colline.monatis.comptes.controller.CompteResponseDto;
import fr.colline.monatis.comptes.model.CompteTechnique;

public class CompteTechniqueResponseDtoMapper {

	public static CompteResponseDto mapperModelToBasicResponseDto(CompteTechnique compteTechnique) {

		CompteTechniqueBasicResponseDto dto = new CompteTechniqueBasicResponseDto();
		
		dto.id = compteTechnique.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteTechnique.getIdentifiant();
		dto.libelle = compteTechnique.getLibelle();
		
		return dto;
	}

	public static CompteResponseDto mapperModelToSimpleResponseDto(CompteTechnique compteTechnique) {

		CompteTechniqueSimpleResponseDto dto = new CompteTechniqueSimpleResponseDto();
		
		dto.id = compteTechnique.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteTechnique.getIdentifiant();
		dto.libelle = compteTechnique.getLibelle();

		return dto;
	}

	public static CompteResponseDto mapperModelToDetailedResponseDto(CompteTechnique compteTechnique) {

		CompteTechniqueDetailedResponseDto dto = new CompteTechniqueDetailedResponseDto();
		
		dto.id = compteTechnique.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteTechnique.getIdentifiant();
		dto.libelle = compteTechnique.getLibelle();

		return dto;
	}

}

