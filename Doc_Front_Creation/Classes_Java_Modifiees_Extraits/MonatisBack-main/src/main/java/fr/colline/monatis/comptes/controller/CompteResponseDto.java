/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\CompteResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\comptes\controller\CompteResponseDto.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.comptes.controller;

import java.io.Serializable;

import fr.colline.monatis.MonatisResponseDto;

public abstract class CompteResponseDto implements Serializable, MonatisResponseDto {

	private static final long serialVersionUID = 6926376429549463963L;

	public Long id; // MODIFIE: expose l'ID JPA stable des comptes dans les reponses API.
	public String identifiant;
	public String libelle;
	
}

