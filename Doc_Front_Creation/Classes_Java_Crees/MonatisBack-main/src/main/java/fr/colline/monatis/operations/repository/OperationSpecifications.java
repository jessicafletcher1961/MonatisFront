/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\operations\repository\OperationSpecifications.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\operations\repository\OperationSpecifications.java
 */
package fr.colline.monatis.operations.repository;

import java.text.Normalizer;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Set;

import org.springframework.data.jpa.domain.Specification;

import fr.colline.monatis.operations.model.Operation;
import fr.colline.monatis.typologies.model.TypeOperation;
import jakarta.persistence.criteria.Predicate;

public class OperationSpecifications {

	public static Specification<Operation> filtrer(
			String recherche,
			Set<TypeOperation> typesOperation,
			LocalDate dateDebut,
			LocalDate dateFin,
			Long montantEnCentimes,
			Long compteRecetteOuDepenseId,
			Long compteRecetteId,
			Long compteDepenseId,
			Boolean pointee) {

		Specification<Operation> specification = (root, query, builder) -> builder.conjunction();
		specification = ajouterSpecification(specification, contientRecherche(recherche));
		specification = ajouterSpecification(specification, typesOperation(typesOperation));
		specification = ajouterSpecification(specification, dateValeurEntre(dateDebut, dateFin));
		specification = ajouterSpecification(specification, montantExact(montantEnCentimes));
		specification = ajouterSpecification(specification, compteRecetteOuDepense(compteRecetteOuDepenseId));
		specification = ajouterSpecification(specification, compteRecette(compteRecetteId));
		specification = ajouterSpecification(specification, compteDepense(compteDepenseId));
		specification = ajouterSpecification(specification, pointee(pointee));
		return specification;
	}

	private static Specification<Operation> ajouterSpecification(
			Specification<Operation> specification,
			Specification<Operation> specificationAAjouter) {

		return specificationAAjouter == null ? specification : specification.and(specificationAAjouter);
	}

	private static Specification<Operation> contientRecherche(String recherche) {

		if (recherche == null || recherche.isBlank()) {
			return null;
		}

		return (root, query, builder) -> {
			String pattern = "%" + recherche.trim().toUpperCase() + "%";
			ArrayList<Predicate> predicates = new ArrayList<>();

			predicates.add(builder.like(builder.upper(root.get("numero")), pattern));
			predicates.add(builder.like(builder.upper(root.get("libelle")), pattern));
			predicates.add(builder.like(builder.upper(root.get("compteDepense").get("identifiant")), pattern));
			predicates.add(builder.like(builder.upper(root.get("compteDepense").get("libelle")), pattern));
			predicates.add(builder.like(builder.upper(root.get("compteRecette").get("identifiant")), pattern));
			predicates.add(builder.like(builder.upper(root.get("compteRecette").get("libelle")), pattern));

			Set<TypeOperation> typesTrouves = typesCorrespondantARecherche(recherche);
			if (!typesTrouves.isEmpty()) {
				predicates.add(root.get("typeOperation").in(typesTrouves));
			}

			return builder.or(predicates.toArray(Predicate[]::new));
		};
	}

	private static Specification<Operation> typesOperation(Set<TypeOperation> typesOperation) {

		if (typesOperation == null || typesOperation.isEmpty()) {
			return null;
		}

		return (root, query, builder) -> root.get("typeOperation").in(typesOperation);
	}

	private static Specification<Operation> dateValeurEntre(LocalDate dateDebut, LocalDate dateFin) {

		return (root, query, builder) -> {
			ArrayList<Predicate> predicates = new ArrayList<>();

			if (dateDebut != null) {
				predicates.add(builder.greaterThanOrEqualTo(root.get("dateValeur"), dateDebut));
			}

			if (dateFin != null) {
				predicates.add(builder.lessThanOrEqualTo(root.get("dateValeur"), dateFin));
			}

			if (predicates.isEmpty()) {
				return builder.conjunction();
			}

			return builder.and(predicates.toArray(Predicate[]::new));
		};
	}

	private static Specification<Operation> montantExact(Long montantEnCentimes) {

		if (montantEnCentimes == null) {
			return null;
		}

		return (root, query, builder) -> builder.equal(root.get("montantEnCentimes"), montantEnCentimes);
	}

	private static Specification<Operation> compteRecetteOuDepense(Long compteId) {

		if (compteId == null) {
			return null;
		}

		return (root, query, builder) -> builder.or(
				builder.equal(root.get("compteDepense").get("id"), compteId),
				builder.equal(root.get("compteRecette").get("id"), compteId));
	}

	private static Specification<Operation> compteRecette(Long compteId) {

		if (compteId == null) {
			return null;
		}

		return (root, query, builder) -> builder.equal(root.get("compteRecette").get("id"), compteId);
	}

	private static Specification<Operation> compteDepense(Long compteId) {

		if (compteId == null) {
			return null;
		}

		return (root, query, builder) -> builder.equal(root.get("compteDepense").get("id"), compteId);
	}

	private static Specification<Operation> pointee(Boolean pointee) {

		if (pointee == null) {
			return null;
		}

		return (root, query, builder) -> builder.equal(root.get("pointee"), pointee);
	}

	private static Set<TypeOperation> typesCorrespondantARecherche(String recherche) {

		String rechercheNormalisee = normaliser(recherche);
		ArrayList<TypeOperation> resultats = new ArrayList<>();

		for (TypeOperation typeOperation : TypeOperation.values()) {
			if (normaliser(typeOperation.getCode()).contains(rechercheNormalisee)
					|| normaliser(typeOperation.getLibelleCourt()).contains(rechercheNormalisee)
					|| normaliser(typeOperation.getLibelle()).contains(rechercheNormalisee)) {
				resultats.add(typeOperation);
			}
		}

		return Set.copyOf(resultats);
	}

	private static String normaliser(String valeur) {

		if (valeur == null) {
			return "";
		}

		return Normalizer.normalize(valeur, Normalizer.Form.NFD)
				.replaceAll("\\p{M}", "")
				.toUpperCase()
				.trim();
	}

	private OperationSpecifications() {}
}

