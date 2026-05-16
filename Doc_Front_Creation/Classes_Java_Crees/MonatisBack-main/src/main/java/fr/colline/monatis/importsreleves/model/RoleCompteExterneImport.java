/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\model\RoleCompteExterneImport.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\model\RoleCompteExterneImport.java
 */
package fr.colline.monatis.importsreleves.model;

public enum RoleCompteExterneImport {

	DEPENSE,
	RECETTE,
	;

	public static RoleCompteExterneImport findByCode(String code) {

		if (code != null && !code.isBlank()) {
			for (RoleCompteExterneImport value : RoleCompteExterneImport.values()) {
				if (value.name().equalsIgnoreCase(code)) {
					return value;
				}
			}
		}
		return null;
	}
}

