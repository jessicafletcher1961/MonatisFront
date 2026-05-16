/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\externe\CompteExterneResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\externe\CompteExterneResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.comptes.controller.externe;

import fr.colline.monatis.comptes.controller.CompteResponseDto;
import fr.colline.monatis.comptes.model.CompteExterne;

public class CompteExterneResponseDtoMapper {

	public static CompteResponseDto mapperModelToBasicResponseDto(CompteExterne compteExterne) {

		CompteExterneBasicResponseDto dto = new CompteExterneBasicResponseDto();
		
		dto.id = compteExterne.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteExterne.getIdentifiant();
		dto.libelle = compteExterne.getLibelle();
				
		return dto;
	}

	public static CompteResponseDto mapperModelToSimpleResponseDto(CompteExterne compteExterne) {

		CompteExterneSimpleResponseDto dto = new CompteExterneSimpleResponseDto();
		
		dto.id = compteExterne.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteExterne.getIdentifiant();
		dto.libelle = compteExterne.getLibelle();

		return dto;
	}

	public static CompteResponseDto mapperModelToDetailedResponseDto(CompteExterne compteExterne) {

		CompteExterneDetailedResponseDto dto = new CompteExterneDetailedResponseDto();
		
		dto.id = compteExterne.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteExterne.getIdentifiant();
		dto.libelle = compteExterne.getLibelle();
		
		return dto;
	}
}

