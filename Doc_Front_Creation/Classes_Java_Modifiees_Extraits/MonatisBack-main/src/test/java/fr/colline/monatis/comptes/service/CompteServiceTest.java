/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\test\java\fr\colline\monatis\comptes\service\CompteServiceTest.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\test\java\fr\colline\monatis\comptes\service\CompteServiceTest.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
package fr.colline.monatis.comptes.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow; // MODIFIE: assertion explicite que la methode ne leve pas d'exception.
import static org.junit.jupiter.api.Assertions.assertNotNull; // MODIFIE: verification de l'injection Spring.

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired; // MODIFIE: injection du service par Spring.
import org.springframework.boot.test.context.SpringBootTest; // MODIFIE: charge le contexte Spring de test.

import fr.colline.monatis.comptes.model.CompteInterne;

@SpringBootTest // MODIFIE: initialise le contexte avant l'autowiring.
public class CompteServiceTest {

	@Autowired private CompteInterneService compteInterneService; // MODIFIE: service injecte plutot qu'instancie manuellement.

	@Test
	public void testControlerEtPreparerPourSuppression() {

		assertNotNull(compteInterneService); // MODIFIE: securise le test contre une injection absente.

		CompteInterne compte = new CompteInterne();

		assertDoesNotThrow(() -> compteInterneService.controlerEtPreparerPourSuppression(compte)); // MODIFIE: comportement attendu exprime clairement.
	}
}

