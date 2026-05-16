/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\categorie\CategorieResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\categorie\CategorieResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.references.controller.categorie;

import java.util.ArrayList;
import java.util.Collections;

import fr.colline.monatis.references.controller.ReferenceResponseDto;
import fr.colline.monatis.references.controller.souscategorie.SousCategorieResponseDtoMapper;
import fr.colline.monatis.references.model.Categorie;
import fr.colline.monatis.references.model.SousCategorie;

public class CategorieResponseDtoMapper {

	public static ReferenceResponseDto mapperModelToBasicResponseDto(Categorie categorie) {
		
		CategorieBasicResponseDto dto = new CategorieBasicResponseDto();
		
		dto.id = categorie.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = categorie.getNom();
		dto.libelle = categorie.getLibelle();

		if ( categorie.getSousCategories() != null ) {
			dto.nomsSousCategories = new ArrayList<>();
			for ( SousCategorie sousCategorie : categorie.getSousCategories() ) {
				dto.nomsSousCategories.add(sousCategorie.getNom());
			}
			Collections.sort(dto.nomsSousCategories, (o1, o2) -> {
				return o1.compareTo(o2);
			});		
		}
		
		return dto;
	}

	public static ReferenceResponseDto mapperModelToSimpleResponseDto(Categorie categorie) {
		
		CategorieSimpleResponseDto dto = new CategorieSimpleResponseDto();
		
		dto.id = categorie.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = categorie.getNom();
		dto.libelle = categorie.getLibelle();

		if ( categorie.getSousCategories() != null ) {
			dto.sousCategories = new ArrayList<>();
			for ( SousCategorie sousCategorie : categorie.getSousCategories() ) {
				dto.sousCategories.add(SousCategorieResponseDtoMapper.mapperModelToBasicResponseDto(sousCategorie));
			}
			Collections.sort(dto.sousCategories, (o1, o2) -> {
				return o1.nom.compareTo(o2.nom);
			});		
		}

		return dto;
	}

	public static ReferenceResponseDto mapperModelToDetailedResponseDto(Categorie categorie) {
		
		CategorieDetailedResponseDto dto = new CategorieDetailedResponseDto();
		
		dto.id = categorie.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = categorie.getNom();
		dto.libelle = categorie.getLibelle();

		if ( categorie.getSousCategories() != null ) {
			dto.sousCategories = new ArrayList<>();
			for ( SousCategorie sousCategorie : categorie.getSousCategories() ) {
				dto.sousCategories.add(SousCategorieResponseDtoMapper.mapperModelToSimpleResponseDto(sousCategorie));
			}
			Collections.sort(dto.sousCategories, (o1, o2) -> {
				return o1.nom.compareTo(o2.nom);
			});		
		}
		
		return dto;
	}

}

