/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\souscategorie\SousCategorieResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\souscategorie\SousCategorieResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.references.controller.souscategorie;

import fr.colline.monatis.references.controller.ReferenceResponseDto;
import fr.colline.monatis.references.controller.categorie.CategorieResponseDtoMapper;
import fr.colline.monatis.references.model.SousCategorie;

public class SousCategorieResponseDtoMapper {

	public static ReferenceResponseDto mapperModelToBasicResponseDto(SousCategorie sousCategorie) {
		
		SousCategorieBasicResponseDto dto = new SousCategorieBasicResponseDto();
		
		dto.id = sousCategorie.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = sousCategorie.getNom();
		dto.libelle = sousCategorie.getLibelle();
		
		if ( sousCategorie.getCategorie() != null ) {
			dto.nomCategorie = sousCategorie.getCategorie().getNom();
		}
		
		return dto;
	}

	public static ReferenceResponseDto mapperModelToSimpleResponseDto(SousCategorie sousCategorie) {
		
		SousCategorieSimpleResponseDto dto = new SousCategorieSimpleResponseDto();
		
		dto.id = sousCategorie.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = sousCategorie.getNom();
		dto.libelle = sousCategorie.getLibelle();

		if ( sousCategorie.getCategorie() != null ) {
			dto.categorie = CategorieResponseDtoMapper.mapperModelToBasicResponseDto(sousCategorie.getCategorie());
		}

		return dto;
	}

	public static ReferenceResponseDto mapperModelToDetailedResponseDto(SousCategorie sousCategorie) {
		
		SousCategorieDetailedResponseDto dto = new SousCategorieDetailedResponseDto();
		
		dto.id = sousCategorie.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = sousCategorie.getNom();
		dto.libelle = sousCategorie.getLibelle();

		if ( sousCategorie.getCategorie() != null ) {
			dto.categorie = CategorieResponseDtoMapper.mapperModelToSimpleResponseDto(sousCategorie.getCategorie());
		}
		
		return dto;
	}
}

