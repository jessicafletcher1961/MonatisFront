/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\service\ImportReleveDoublonService.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\service\ImportReleveDoublonService.java
 */
package fr.colline.monatis.importsreleves.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import fr.colline.monatis.exceptions.ServiceException;
import fr.colline.monatis.importsreleves.model.StatutDoublonImportReleve;
import fr.colline.monatis.operations.model.Operation;
import fr.colline.monatis.operations.model.OperationLigne;
import fr.colline.monatis.operations.service.OperationService;

@Service
public class ImportReleveDoublonService {

	private static final long MARGE_JOURS_DOUBLON_PROBABLE = 2L;

	@Autowired private OperationService operationService;
	@Autowired private LibelleImportReleveNormalizer libelleImportReleveNormalizer;

	public static class CritereDoublon {
		public int index;
		public String operationImportId;
		public String libelle;
		public LocalDate dateValeur;
		public LocalDate dateComptabilisation;
		public Long montantEnCentimes;
		public String codeTypeOperation;
		public String identifiantCompteDepense;
		public String identifiantCompteRecette;
	}

	public static class ResultatDoublon {
		public CritereDoublon critere;
		public StatutDoublonImportReleve statut;
		public int score;
		public List<String> raisons = new ArrayList<>();
		public Operation operationExistante;
	}

	private static class ScoreDoublon {
		public Operation operation;
		public int score;
		public boolean exact;
		public List<String> raisons = new ArrayList<>();
	}

	public List<ResultatDoublon> rechercherDoublons(List<CritereDoublon> criteres) throws ServiceException {

		if (criteres == null || criteres.isEmpty()) {
			return List.of();
		}

		List<Operation> operationsExistantes = chargerOperationsCibles(criteres);
		List<ResultatDoublon> resultats = new ArrayList<>();

		for (CritereDoublon critere : criteres) {
			resultats.add(rechercherDoublon(critere, operationsExistantes));
		}

		return resultats;
	}

	private List<Operation> chargerOperationsCibles(List<CritereDoublon> criteres) throws ServiceException {

		LocalDate dateDebut = criteres.stream()
				.map((critere) -> critere.dateValeur)
				.filter(Objects::nonNull)
				.min(Comparator.naturalOrder())
				.orElse(null);
		LocalDate dateFin = criteres.stream()
				.map((critere) -> critere.dateValeur)
				.filter(Objects::nonNull)
				.max(Comparator.naturalOrder())
				.orElse(null);

		if (dateDebut != null) {
			dateDebut = dateDebut.minusDays(MARGE_JOURS_DOUBLON_PROBABLE);
		}
		if (dateFin != null) {
			dateFin = dateFin.plusDays(MARGE_JOURS_DOUBLON_PROBABLE);
		}

		return operationService.rechercherOperationsVisiblesParDateValeurDesc(dateDebut, dateFin)
				.toList();
	}

	private ResultatDoublon rechercherDoublon(CritereDoublon critere, List<Operation> operationsExistantes) {

		ResultatDoublon resultat = new ResultatDoublon();
		resultat.critere = critere;
		resultat.statut = StatutDoublonImportReleve.NOUVELLE;
		resultat.score = 0;

		ScoreDoublon meilleurScore = operationsExistantes.stream()
				.map((operation) -> noter(critere, operation))
				.filter((score) -> score.score >= 60)
				.max(Comparator.comparing((ScoreDoublon score) -> score.score))
				.orElse(null);

		if (meilleurScore == null) {
			return resultat;
		}

		resultat.operationExistante = meilleurScore.operation;
		resultat.score = meilleurScore.score;
		resultat.raisons = meilleurScore.raisons;
		resultat.statut = meilleurScore.exact
				? StatutDoublonImportReleve.DOUBLON_EXACT
				: StatutDoublonImportReleve.DOUBLON_PROBABLE;

		return resultat;
	}

	private ScoreDoublon noter(CritereDoublon critere, Operation operation) {

		ScoreDoublon score = new ScoreDoublon();
		score.operation = operation;

		if (critere.dateValeur == null || critere.montantEnCentimes == null) {
			return score;
		}

		if (!critere.montantEnCentimes.equals(operation.getMontantEnCentimes())) {
			return score;
		}
		score.score += 25;
		score.raisons.add("Montant identique");

		long ecartJours = Math.abs(ChronoUnit.DAYS.between(critere.dateValeur, operation.getDateValeur()));
		if (ecartJours == 0L) {
			score.score += 25;
			score.raisons.add("Date valeur identique");
		}
		else if (ecartJours <= MARGE_JOURS_DOUBLON_PROBABLE) {
			score.score += 15;
			score.raisons.add("Date valeur proche");
		}
		else {
			return score;
		}

		if (!isLibelleEquivalent(critere, operation)) {
			return score;
		}
		score.score += 25;
		score.raisons.add("Libelle normalise identique");

		if (critere.codeTypeOperation != null && !critere.codeTypeOperation.isBlank()) {
			if (operation.getTypeOperation() == null
					|| !critere.codeTypeOperation.equals(operation.getTypeOperation().getCode())) {
				return new ScoreDoublon();
			}
			score.score += 10;
			score.raisons.add("Type d'operation identique");
		}
		else {
			score.raisons.add("Type d'operation non fourni");
		}

		if (!isCompteCompatible(critere.identifiantCompteDepense, operation.getCompteDepense().getIdentifiant())) {
			return new ScoreDoublon();
		}
		if (critere.identifiantCompteDepense != null && !critere.identifiantCompteDepense.isBlank()) {
			score.score += 5;
			score.raisons.add("Compte depense identique");
		}
		else {
			score.raisons.add("Compte depense non fourni");
		}

		if (!isCompteCompatible(critere.identifiantCompteRecette, operation.getCompteRecette().getIdentifiant())) {
			return new ScoreDoublon();
		}
		if (critere.identifiantCompteRecette != null && !critere.identifiantCompteRecette.isBlank()) {
			score.score += 5;
			score.raisons.add("Compte recette identique");
		}
		else {
			score.raisons.add("Compte recette non fourni");
		}

		if (critere.dateComptabilisation != null) {
			if (operation.getLignes().stream().anyMatch((ligne) -> critere.dateComptabilisation.equals(ligne.getDateComptabilisation()))) {
				score.score += 5;
				score.raisons.add("Date comptable identique");
			}
			else {
				score.raisons.add("Date comptable differente ou absente");
			}
		}

		score.exact = score.score >= 95
				&& score.raisons.contains("Date valeur identique")
				&& score.raisons.contains("Type d'operation identique")
				&& score.raisons.contains("Compte depense identique")
				&& score.raisons.contains("Compte recette identique")
				&& (critere.dateComptabilisation == null || score.raisons.contains("Date comptable identique"));

		return score;
	}

	private boolean isCompteCompatible(String identifiantAttendu, String identifiantExistant) {

		return identifiantAttendu == null
				|| identifiantAttendu.isBlank()
				|| identifiantAttendu.equals(identifiantExistant);
	}

	private boolean isLibelleEquivalent(CritereDoublon critere, Operation operation) {

		String libelleCritere = normaliserLibelle(critere.libelle);
		if (libelleCritere == null) {
			return false;
		}

		String libelleOperation = normaliserLibelle(operation.getLibelle());
		if (libelleCritere.equals(libelleOperation)) {
			return true;
		}

		return operation.getLignes().stream()
				.map(OperationLigne::getLibelle)
				.map(this::normaliserLibelle)
				.anyMatch(libelleCritere::equals);
	}

	private String normaliserLibelle(String libelle) {

		return libelleImportReleveNormalizer.normaliser(libelle, null);
	}
}

