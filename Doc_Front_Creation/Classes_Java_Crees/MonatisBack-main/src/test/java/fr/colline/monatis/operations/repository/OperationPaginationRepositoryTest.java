/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\test\java\fr\colline\monatis\operations\repository\OperationPaginationRepositoryTest.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\test\java\fr\colline\monatis\operations\repository\OperationPaginationRepositoryTest.java
 */
package fr.colline.monatis.operations.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import fr.colline.monatis.comptes.model.CompteExterne;
import fr.colline.monatis.comptes.model.CompteInterne;
import fr.colline.monatis.operations.model.Operation;
import fr.colline.monatis.typologies.model.TypeFonctionnement;
import fr.colline.monatis.typologies.model.TypeOperation;

@DataJpaTest
class OperationPaginationRepositoryTest {

	@Autowired private OperationRepository operationRepository;
	@Autowired private TestEntityManager entityManager;

	private CompteInterne compteCourant;
	private CompteExterne boulangerie;
	private CompteExterne employeur;

	@BeforeEach
	void initialiser() {

		compteCourant = entityManager.persist(new CompteInterne(
				"COURANT",
				"Compte courant",
				null,
				TypeFonctionnement.COURANT,
				LocalDate.of(2020, 1, 1),
				0L,
				null));
		boulangerie = entityManager.persist(new CompteExterne("BOULANGERIE", "Aux pains des iles"));
		employeur = entityManager.persist(new CompteExterne("EMPLOYEUR", "Employeur"));

		persisterOperation("OP001", TypeOperation.DEPENSE, "CB AUX PAINS DES I FACT", LocalDate.of(2025, 1, 4), 1240L, boulangerie, compteCourant, false);
		persisterOperation("OP002", TypeOperation.RECETTE, "SALAIRE", LocalDate.of(2025, 1, 5), 220000L, compteCourant, employeur, true);
		persisterOperation("OP003", TypeOperation.DEPENSE, "CB AUX PAINS DES I FACT", LocalDate.of(2025, 1, 6), 950L, boulangerie, compteCourant, false);
		entityManager.flush();
	}

	@Test
	void paginerOperationsRetourneTotalEtPageDemandee() {

		Page<Operation> page = operationRepository.findAll(
				OperationSpecifications.filtrer(null, null, null, null, null, null, null, null, null),
				PageRequest.of(0, 2, triHistorique()));

		assertThat(page.getTotalElements()).isEqualTo(3);
		assertThat(page.getTotalPages()).isEqualTo(2);
		assertThat(page.getContent())
				.extracting(Operation::getNumero)
				.containsExactly("OP003", "OP002");
	}

	@Test
	void filtrerOperationsCombineRechercheTypeCompteEtPointee() {

		Page<Operation> page = operationRepository.findAll(
				OperationSpecifications.filtrer(
						"depense",
						Set.of(TypeOperation.DEPENSE),
						null,
						null,
						null,
						boulangerie.getId(),
						null,
						null,
						false),
				PageRequest.of(0, 10, triHistorique()));

		assertThat(page.getTotalElements()).isEqualTo(2);
		assertThat(page.getContent())
				.extracting(Operation::getNumero)
				.containsExactly("OP003", "OP001");
	}

	private Sort triHistorique() {

		return Sort.by(Sort.Direction.DESC, "dateValeur")
				.and(Sort.by(Sort.Direction.ASC, "numero"))
				.and(Sort.by(Sort.Direction.DESC, "id"));
	}

	private Operation persisterOperation(
			String numero,
			TypeOperation typeOperation,
			String libelle,
			LocalDate dateValeur,
			Long montantEnCentimes,
			CompteExterne compteRecette,
			CompteInterne compteDepense,
			Boolean pointee) {

		return entityManager.persist(new Operation(
				numero,
				typeOperation,
				libelle,
				dateValeur,
				montantEnCentimes,
				compteRecette,
				compteDepense,
				pointee));
	}

	private Operation persisterOperation(
			String numero,
			TypeOperation typeOperation,
			String libelle,
			LocalDate dateValeur,
			Long montantEnCentimes,
			CompteInterne compteRecette,
			CompteExterne compteDepense,
			Boolean pointee) {

		return entityManager.persist(new Operation(
				numero,
				typeOperation,
				libelle,
				dateValeur,
				montantEnCentimes,
				compteRecette,
				compteDepense,
				pointee));
	}
}

