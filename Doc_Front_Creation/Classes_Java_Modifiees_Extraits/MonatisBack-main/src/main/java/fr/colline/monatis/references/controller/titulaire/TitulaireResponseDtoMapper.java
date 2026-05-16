/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\titulaire\TitulaireResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\titulaire\TitulaireResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.references.controller.titulaire;

import java.util.ArrayList;
import java.util.Collections;

import fr.colline.monatis.comptes.controller.interne.CompteInterneResponseDtoMapper;
import fr.colline.monatis.comptes.model.CompteInterne;
import fr.colline.monatis.references.controller.ReferenceResponseDto;
import fr.colline.monatis.references.model.Titulaire;

public class TitulaireResponseDtoMapper {

	public static ReferenceResponseDto mapperModelToBasicResponseDto(Titulaire titulaire) {

		TitulaireBasicResponseDto dto = new TitulaireBasicResponseDto();
		
		dto.id = titulaire.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = titulaire.getNom();
		dto.libelle = titulaire.getLibelle();
		
		if ( titulaire.getComptesInternes() != null ) {
			dto.identifiantsComptesInternes = new ArrayList<>();
			for ( CompteInterne compteInterne : titulaire.getComptesInternes() ) {
				dto.identifiantsComptesInternes.add(compteInterne.getIdentifiant());
			}
			Collections.sort(dto.identifiantsComptesInternes, (o1, o2) -> {
				return o1.compareTo(o2);
			});
		}
		
		return dto;
	}

	public static ReferenceResponseDto mapperModelToSimpleResponseDto(Titulaire titulaire) {

		TitulaireSimpleResponseDto dto = new TitulaireSimpleResponseDto();
		
		dto.id = titulaire.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = titulaire.getNom();
		dto.libelle = titulaire.getLibelle();
		
		if ( titulaire.getComptesInternes() != null ) {
			dto.comptesInternes = new ArrayList<>();
			for ( CompteInterne compteInterne : titulaire.getComptesInternes() ) {
				dto.comptesInternes.add(CompteInterneResponseDtoMapper.mapperModelToBasicResponseDto(compteInterne));
			}
			Collections.sort(dto.comptesInternes, (o1, o2) -> {
				return o1.identifiant.compareTo(o2.identifiant);
			});		
		}
		
		return dto;
	}

	public static ReferenceResponseDto mapperModelToDetailedResponseDto(Titulaire titulaire) {

		TitulaireDetailedResponseDto dto = new TitulaireDetailedResponseDto();
		
		dto.id = titulaire.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.nom = titulaire.getNom();
		dto.libelle = titulaire.getLibelle();
		
		if ( titulaire.getComptesInternes() != null ) {
			dto.comptesInternes = new ArrayList<>();
			for ( CompteInterne compteInterne : titulaire.getComptesInternes() ) {
				dto.comptesInternes.add(CompteInterneResponseDtoMapper.mapperModelToSimpleResponseDto(compteInterne));
			}
			Collections.sort(dto.comptesInternes, (o1, o2) -> {
				return o1.identifiant.compareTo(o2.identifiant);
			});		
		}
		
		return dto;
	}

}

