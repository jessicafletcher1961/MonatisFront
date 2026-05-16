/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\ImportReleveTechniqueErreur.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\ImportReleveTechniqueErreur.java
 */
package fr.colline.monatis.importsreleves;

import fr.colline.monatis.exceptions.MonatisErreur;
import fr.colline.monatis.exceptions.TypeDomaine;
import fr.colline.monatis.exceptions.TypeErreur;

public enum ImportReleveTechniqueErreur implements MonatisErreur {

	RECHERCHE_PAR_ID(
			"Un probleme technique est survenu lors de la recherche de la regle d'import de releve d'ID %s"),

	RECHERCHE_TOUS(
			"Un probleme technique est survenu lors de la recherche de toutes les regles d'import de releve"),

	RECHERCHE_SUGGESTIONS(
			"Un probleme technique est survenu lors de la recherche des suggestions d'import de releve"),

	RECHERCHE_PAR_CLE(
			"Un probleme technique est survenu lors de la recherche de la regle d'import de releve de cle '%s'"),

	ENREGISTREMENT(
			"Un probleme technique est survenu lors de l'enregistrement de la regle d'import de releve de cle '%s'"),

	DESACTIVATION(
			"Un probleme technique est survenu lors de la desactivation de la regle d'import de releve d'ID %s"),

	;

	private final TypeDomaine typeDomaine = TypeDomaine.IMPORT_RELEVE;
	private final TypeErreur typeErreur = TypeErreur.TECHNIQUE;

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

	private ImportReleveTechniqueErreur(String pattern) {
		this.pattern = pattern;
	}
}

