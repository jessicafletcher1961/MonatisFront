/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\service\LibelleImportReleveNormalizer.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\service\LibelleImportReleveNormalizer.java
 */
package fr.colline.monatis.importsreleves.service;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

@Service
public class LibelleImportReleveNormalizer {

	private static final Set<String> MOTS_IGNORES = new HashSet<>(Arrays.asList(
			"ACHAT",
			"AU",
			"AUX",
			"AVEC",
			"CARTE",
			"CB",
			"CHEQUE",
			"D",
			"DE",
			"DES",
			"DEPENSE",
			"DU",
			"EN",
			"FACT",
			"FR",
			"LA",
			"LE",
			"LES",
			"N",
			"PAR",
			"PAIEMENT",
			"PRELEVEMENT",
			"PRLV",
			"RECU",
			"RECETTE",
			"REF",
			"REMISE",
			"SEPA",
			"SUR",
			"VIR",
			"VIREMENT"));

	public String normaliser(String libelle, String groupKey) {

		String valeur = groupKey != null && !groupKey.isBlank() ? groupKey : libelle;
		if (valeur == null || valeur.isBlank()) {
			return null;
		}

		String sansAccent = Normalizer.normalize(valeur, Normalizer.Form.NFD)
				.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");

		String token = sansAccent
				.toUpperCase()
				.replaceAll("\\b\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?\\b", " ")
				.replaceAll("\\b\\d{4,}\\b", " ")
				.replaceAll("[^A-Z0-9]+", " ");

		String nettoye = Arrays.stream(token.split("\\s+"))
				.filter((mot) -> !mot.isBlank())
				.filter((mot) -> mot.length() > 1)
				.filter((mot) -> !MOTS_IGNORES.contains(mot))
				.filter((mot) -> !mot.matches("^\\d+$"))
				.collect(Collectors.joining("-"))
				.toLowerCase();

		if (nettoye.isBlank()) {
			return null;
		}

		return nettoye.length() <= 140 ? nettoye : nettoye.substring(0, 140);
	}
}

