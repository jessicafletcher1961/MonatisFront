/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\ImportReleveFonctionnelleErreur.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\ImportReleveFonctionnelleErreur.java
 */
package fr.colline.monatis.importsreleves;

import fr.colline.monatis.exceptions.MonatisErreur;
import fr.colline.monatis.exceptions.TypeDomaine;
import fr.colline.monatis.exceptions.TypeErreur;

public enum ImportReleveFonctionnelleErreur implements MonatisErreur {

	REGLE_NON_TROUVEE(
			"Aucune regle d'import de releve ne correspond a l'ID %s"),

	COMPTE_INTERNE_CONTEXTE_NON_TROUVE(
			"Aucun compte interne de contexte ne correspond a '%s'"),

	COMPTE_EXTERNE_NON_TROUVE(
			"Aucun compte externe ne correspond a '%s'"),

	SOUS_CATEGORIE_NON_TROUVEE(
			"Aucune sous-categorie ne correspond a '%s'"),

	BENEFICIAIRE_NON_TROUVE(
			"Aucun beneficiaire ne correspond a '%s'"),

	TYPE_OPERATION_NON_TROUVE(
			"Aucun type d'operation ne correspond au code '%s'"),

	;

	private final TypeDomaine typeDomaine = TypeDomaine.IMPORT_RELEVE;
	private final TypeErreur typeErreur = TypeErreur.FONCTIONNELLE;

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

	private ImportReleveFonctionnelleErreur(String pattern) {
		this.pattern = pattern;
	}
}

