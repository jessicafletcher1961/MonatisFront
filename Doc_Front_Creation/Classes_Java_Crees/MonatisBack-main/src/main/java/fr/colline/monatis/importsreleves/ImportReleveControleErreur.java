/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\ImportReleveControleErreur.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\ImportReleveControleErreur.java
 */
package fr.colline.monatis.importsreleves;

import fr.colline.monatis.exceptions.MonatisErreur;
import fr.colline.monatis.exceptions.TypeDomaine;
import fr.colline.monatis.exceptions.TypeErreur;

public enum ImportReleveControleErreur implements MonatisErreur {

	ROLE_COMPTE_EXTERNE_OBLIGATOIRE(
			"Le role du compte externe est obligatoire"),

	ROLE_COMPTE_EXTERNE_INVALIDE(
			"Le role de compte externe '%s' est invalide"),

	LIBELLE_IMPORT_OBLIGATOIRE(
			"Le libelle d'import est obligatoire"),

	TYPE_OPERATION_OBLIGATOIRE(
			"Le type d'operation est obligatoire"),

	;

	private final TypeDomaine typeDomaine = TypeDomaine.IMPORT_RELEVE;
	private final TypeErreur typeErreur = TypeErreur.CONTROLE;

	private String pattern;

	@Override
	public String getCode() {
		String numero = String.format("%04d", this.ordinal());
		return typeDomaine.getCode().concat("-").concat(typeErreur.getCode()).concat("-").concat(numero);
	}

	@Override
	public String getPrefixe() {
		String numero = String.format("%04d", this.ordinal());
		return typeDomaine.getPrefixe().concat(".").concat(typeErreur.getPrefixe()).concat(".").concat(numero);
	}

	@Override
	public String getPattern() {
		return pattern;
	}

	@Override
	public TypeErreur getTypeErreur() {
		return typeErreur;
	}

	@Override
	public TypeDomaine getTypeDomaine() {
		return typeDomaine;
	}

	private ImportReleveControleErreur(String pattern) {
		this.pattern = pattern;
	}
}

