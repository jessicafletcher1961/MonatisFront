/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\exceptions\TypeDomaine.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\exceptions\TypeDomaine.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.exceptions;

public enum TypeDomaine {

	BUDGET ("BUD", "budget", "Budgets"),
	REFERENCE ("REF", "reference", "Références (générique)"),
	COMPTE("CPT", "compte", "Comptes (générique)"),
	EVALUATION("EVL", "evaluation", "Evaluations"),
	OPERATION("OPE", "operation", "Opérations"),
	IMPORT_RELEVE("IRL", "import-releve", "Imports de relevés"), // MODIFIE: ajout du domaine d'erreur dedie aux imports de releves.
	RAPPORT("RAP", "rapport", "Elaboration des rapports"),
	GENERIQUE("GEN", "generique", "Plusieurs domaines"),
	ADMIN("ADM", "admin", "Maintenance, sauvegardes et restaurations")
	
	;
	
	private String code;
	
	private String prefixe;
	
	private String libelle;
	
	public String getCode() {
		return code;
	}

	public String getPrefixe() {
		return prefixe;
	}

	public String getLibelle() {
		return libelle;
	}

	private TypeDomaine(String code, String prefixe, String libelle) {

		this.code = code;
		this.prefixe = prefixe;
		this.libelle = libelle;
	}
}

