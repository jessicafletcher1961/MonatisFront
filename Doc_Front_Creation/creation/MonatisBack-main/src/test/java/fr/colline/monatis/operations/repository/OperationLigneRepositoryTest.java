package fr.colline.monatis.operations.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import fr.colline.monatis.comptes.model.CompteExterne;
import fr.colline.monatis.comptes.model.CompteInterne;
import fr.colline.monatis.operations.model.Operation;
import fr.colline.monatis.operations.model.OperationLigne;
import fr.colline.monatis.references.model.Beneficiaire;
import fr.colline.monatis.references.model.Categorie;
import fr.colline.monatis.references.model.SousCategorie;
import fr.colline.monatis.typologies.model.TypeFonctionnement;
import fr.colline.monatis.typologies.model.TypeOperation;

@DataJpaTest
class OperationLigneRepositoryTest {

	@Autowired private OperationLigneRepository operationLigneRepository;
	@Autowired private TestEntityManager entityManager;

	private CompteInterne compteCourant;
	private CompteExterne commerce;
	private SousCategorie alimentation;
	private Beneficiaire maman;

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
		commerce = entityManager.persist(new CompteExterne("COMMERCE", "Commerce"));
		Categorie vieCourante = entityManager.persist(new Categorie("VIE_COURANTE", "Vie courante"));
		alimentation = entityManager.persist(new SousCategorie("ALIMENTATION", "Alimentation", vieCourante));
		maman = entityManager.persist(new Beneficiaire("MAMAN", "Maman"));

		persisterOperation("OP001", "Operation categorisee", LocalDate.of(2025, 1, 5), alimentation, maman);
		persisterOperation("OP002", "Operation sans categorie", LocalDate.of(2025, 1, 6), null);
		entityManager.flush();
	}

	@Test
	void rechercherAvecSousCategorieNullRetourneUniquementLesLignesNonCategorisees() {

		assertThat(operationLigneRepository.findBySousCategorieIdAndFilters(
				null,
				null,
				LocalDate.of(2025, 1, 1),
				LocalDate.of(2025, 1, 31)).toList())
				.extracting((ligne) -> ligne.getOperation().getNumero())
				.containsExactly("OP002");
	}

	@Test
	void rechercherParSousCategorieEtBeneficiaireConserveLesFiltresExistants() {

		assertThat(operationLigneRepository.findBySousCategorieIdAndFilters(
				alimentation.getId(),
				maman.getId(),
				LocalDate.of(2025, 1, 1),
				LocalDate.of(2025, 1, 31)).toList())
				.extracting((ligne) -> ligne.getOperation().getNumero())
				.containsExactly("OP001");
	}

	private void persisterOperation(
			String numero,
			String libelle,
			LocalDate dateComptabilisation,
			SousCategorie sousCategorie,
			Beneficiaire... beneficiaires) {

		entityManager.persist(new Operation(
				numero,
				TypeOperation.DEPENSE,
				libelle,
				dateComptabilisation,
				1000L,
				commerce,
				compteCourant,
				false,
				new OperationLigne(0, libelle, dateComptabilisation, 1000L, sousCategorie, beneficiaires)));
	}
}
