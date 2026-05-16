/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonController.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\ImportReleveDoublonController.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import fr.colline.monatis.exceptions.ServiceException;
import fr.colline.monatis.importsreleves.service.ImportReleveDoublonService;
import fr.colline.monatis.importsreleves.service.ImportReleveDoublonService.CritereDoublon;
import fr.colline.monatis.importsreleves.service.ImportReleveDoublonService.ResultatDoublon;
import fr.colline.monatis.operations.model.Operation;
import fr.colline.monatis.operations.model.OperationLigne;
import jakarta.transaction.Transactional;

@RestController
@RequestMapping("/monatis/imports-releves/doublons")
@Transactional
public class ImportReleveDoublonController {

	@Autowired private ImportReleveDoublonService importReleveDoublonService;

	@PostMapping
	public ImportReleveDoublonResponseDto analyserDoublons(
			@RequestBody ImportReleveDoublonRequestDto dto) throws ServiceException {

		List<CritereDoublon> criteres = mapperRequestDto(dto);
		List<ResultatDoublon> resultats = importReleveDoublonService.rechercherDoublons(criteres);

		ImportReleveDoublonResponseDto responseDto = new ImportReleveDoublonResponseDto();
		responseDto.operations = resultats
				.stream()
				.map(this::mapperResultatToResponseDto)
				.toList();
		return responseDto;
	}

	private List<CritereDoublon> mapperRequestDto(ImportReleveDoublonRequestDto dto) {

		List<CritereDoublon> criteres = new ArrayList<>();
		if (dto == null || dto.operations == null) {
			return criteres;
		}

		int index = 0;
		for (ImportReleveDoublonOperationRequestDto operationDto : dto.operations) {
			CritereDoublon critere = new CritereDoublon();
			critere.index = index++;
			critere.operationImportId = operationDto.operationImportId;
			critere.libelle = operationDto.libelle;
			critere.dateValeur = operationDto.dateValeur;
			critere.dateComptabilisation = operationDto.dateComptabilisation;
			critere.montantEnCentimes = operationDto.montantEnCentimes;
			critere.codeTypeOperation = operationDto.codeTypeOperation;
			critere.identifiantCompteDepense = operationDto.identifiantCompteDepense;
			critere.identifiantCompteRecette = operationDto.identifiantCompteRecette;
			criteres.add(critere);
		}

		return criteres;
	}

	private ImportReleveDoublonOperationResponseDto mapperResultatToResponseDto(ResultatDoublon resultat) {

		ImportReleveDoublonOperationResponseDto dto = new ImportReleveDoublonOperationResponseDto();
		dto.index = resultat.critere.index;
		dto.operationImportId = resultat.critere.operationImportId;
		dto.statut = resultat.statut.name();
		dto.score = resultat.score;
		dto.raisons = resultat.raisons;
		dto.operationExistante = resultat.operationExistante == null
				? null
				: mapperOperationExistanteToResponseDto(resultat.operationExistante);
		return dto;
	}

	private ImportReleveDoublonOperationExistanteResponseDto mapperOperationExistanteToResponseDto(Operation operation) {

		ImportReleveDoublonOperationExistanteResponseDto dto = new ImportReleveDoublonOperationExistanteResponseDto();
		dto.numero = operation.getNumero();
		dto.libelle = operation.getLibelle();
		dto.dateValeur = operation.getDateValeur();
		dto.montantEnCentimes = operation.getMontantEnCentimes();
		dto.codeTypeOperation = operation.getTypeOperation() == null ? null : operation.getTypeOperation().getCode();
		dto.identifiantCompteDepense = operation.getCompteDepense().getIdentifiant();
		dto.libelleCompteDepense = operation.getCompteDepense().getLibelle();
		dto.identifiantCompteRecette = operation.getCompteRecette().getIdentifiant();
		dto.libelleCompteRecette = operation.getCompteRecette().getLibelle();
		dto.dateComptabilisation = operation.getLignes()
				.stream()
				.min(Comparator.comparing(OperationLigne::getNumeroLigne))
				.map(OperationLigne::getDateComptabilisation)
				.orElse(null);
		return dto;
	}
}

