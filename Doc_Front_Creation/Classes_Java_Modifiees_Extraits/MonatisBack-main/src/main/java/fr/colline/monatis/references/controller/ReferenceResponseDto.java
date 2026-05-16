/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\ReferenceResponseDto.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\references\controller\ReferenceResponseDto.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.references.controller;

import java.io.Serializable;

import fr.colline.monatis.MonatisResponseDto;

public abstract class ReferenceResponseDto implements Serializable, MonatisResponseDto {

	private static final long serialVersionUID = 4129405708810085743L;

	public Long id; // MODIFIE: expose l'ID JPA stable des references dans les reponses API.
	public String nom;
	public String libelle;
	
}

