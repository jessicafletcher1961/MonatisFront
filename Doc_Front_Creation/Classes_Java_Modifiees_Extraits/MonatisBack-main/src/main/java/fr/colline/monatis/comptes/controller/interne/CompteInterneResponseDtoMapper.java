/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\interne\CompteInterneResponseDtoMapper.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\interne\CompteInterneResponseDtoMapper.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.comptes.controller.interne;

import java.util.ArrayList;
import java.util.Collections;

import fr.colline.monatis.comptes.controller.CompteResponseDto;
import fr.colline.monatis.comptes.model.CompteInterne;
import fr.colline.monatis.references.controller.banque.BanqueResponseDtoMapper;
import fr.colline.monatis.references.controller.titulaire.TitulaireResponseDtoMapper;
import fr.colline.monatis.references.model.Titulaire;
import fr.colline.monatis.typologies.controller.TypologieResponseDtoMapper;

public class CompteInterneResponseDtoMapper {

	public static CompteResponseDto mapperModelToBasicResponseDto(CompteInterne compteInterne) {

		CompteInterneBasicResponseDto dto = new CompteInterneBasicResponseDto();
		
		dto.id = compteInterne.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteInterne.getIdentifiant();
		dto.libelle = compteInterne.getLibelle();
		
		dto.dateCloture = compteInterne.getDateCloture();
		dto.codeTypeFonctionnement = compteInterne.getTypeFonctionnement().getCode();
		dto.dateSoldeInitial = compteInterne.getDateSoldeInitial();
		dto.montantSoldeInitialEnCentimes = compteInterne.getMontantSoldeInitialEnCentimes();
		if ( compteInterne.getBanque() != null ) {
			dto.nomBanque = compteInterne.getBanque().getNom();
		}
		if ( compteInterne.getTitulaires() != null ) {
			dto.nomsTitulaires = new ArrayList<>();
			for ( Titulaire titulaire : compteInterne.getTitulaires() ) {
				dto.nomsTitulaires.add(titulaire.getNom());
			}
			Collections.sort(dto.nomsTitulaires, (o1, o2) -> {
				return o1.compareTo(o2);
			});
		}
		
		return dto;
	}

	public static CompteResponseDto mapperModelToSimpleResponseDto(CompteInterne compteInterne) {

		CompteInterneSimpleResponseDto dto = new CompteInterneSimpleResponseDto();
		
		dto.id = compteInterne.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteInterne.getIdentifiant();
		dto.libelle = compteInterne.getLibelle();

		dto.dateCloture = compteInterne.getDateCloture();
		dto.typeFonctionnement = TypologieResponseDtoMapper.mapperModelToResponseDto(compteInterne.getTypeFonctionnement());
		dto.dateSoldeInitial = compteInterne.getDateSoldeInitial();
		dto.montantSoldeInitialEnCentimes = compteInterne.getMontantSoldeInitialEnCentimes();
		if ( compteInterne.getBanque() != null ) {
			dto.banque = BanqueResponseDtoMapper.mapperModelToBasicResponseDto(compteInterne.getBanque());
		}
		if ( compteInterne.getTitulaires() != null ) {
			dto.titulaires = new ArrayList<>();
			for ( Titulaire titulaire : compteInterne.getTitulaires() ) {
				dto.titulaires.add(TitulaireResponseDtoMapper.mapperModelToBasicResponseDto(titulaire));
			}
			Collections.sort(dto.titulaires, (o1, o2) -> {
				return o1.nom.compareTo(o2.nom);
			});
		}
		
		return dto;
	}

	public static CompteResponseDto mapperModelToDetailedResponseDto(CompteInterne compteInterne) {

		CompteInterneDetailedResponseDto dto = new CompteInterneDetailedResponseDto();
		
		dto.id = compteInterne.getId(); // MODIFIE: renseigne l'ID JPA stable dans la reponse API.
		dto.identifiant = compteInterne.getIdentifiant();
		dto.libelle = compteInterne.getLibelle();

		dto.dateCloture = compteInterne.getDateCloture();
		dto.typeFonctionnement = TypologieResponseDtoMapper.mapperModelToResponseDto(compteInterne.getTypeFonctionnement());
		dto.dateSoldeInitial = compteInterne.getDateSoldeInitial();
		dto.montantSoldeInitialEnCentimes = compteInterne.getMontantSoldeInitialEnCentimes();
		if ( compteInterne.getBanque() != null ) {
			dto.banque = BanqueResponseDtoMapper.mapperModelToSimpleResponseDto(compteInterne.getBanque());
		}
		if ( compteInterne.getTitulaires() != null ) {
			dto.titulaires = new ArrayList<>();
			for ( Titulaire titulaire : compteInterne.getTitulaires() ) {
				dto.titulaires.add(TitulaireResponseDtoMapper.mapperModelToSimpleResponseDto(titulaire));
			}
			Collections.sort(dto.titulaires, (o1, o2) -> {
				return o1.nom.compareTo(o2.nom);
			});
		}
		
		return dto;
	}
}

