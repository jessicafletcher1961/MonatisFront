/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveController.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\controller\RegleImportReleveController.java
 */
package fr.colline.monatis.importsreleves.controller;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import fr.colline.monatis.exceptions.ControllerException;
import fr.colline.monatis.exceptions.ServiceException;
import fr.colline.monatis.importsreleves.ImportReleveControleErreur;
import fr.colline.monatis.importsreleves.ImportReleveFonctionnelleErreur;
import fr.colline.monatis.importsreleves.model.RegleImportReleve;
import fr.colline.monatis.importsreleves.model.RoleCompteExterneImport;
import fr.colline.monatis.importsreleves.service.RegleImportReleveService;
import fr.colline.monatis.importsreleves.service.RegleImportReleveService.Apprentissage;
import fr.colline.monatis.importsreleves.service.RegleImportReleveService.CritereSuggestion;
import fr.colline.monatis.importsreleves.service.RegleImportReleveService.ResultatSuggestion;
import fr.colline.monatis.typologies.model.TypeOperation;
import jakarta.transaction.Transactional;

@RestController
@RequestMapping("/monatis/imports-releves/regles")
@Transactional
public class RegleImportReleveController {

	@Autowired private RegleImportReleveService regleImportReleveService;

	@GetMapping("/all")
	public List<RegleImportReleveResponseDto> getAllRegles() throws ServiceException {

		return regleImportReleveService.rechercherToutesActives()
				.stream()
				.map((regle) -> RegleImportReleveResponseDtoMapper.mapperModelToResponseDto(regle))
				.toList();
	}

	@PostMapping("/suggestions")
	public RegleImportReleveSuggestionResponseDto suggererRegles(
			@RequestBody RegleImportReleveSuggestionRequestDto dto) throws ControllerException, ServiceException {

		List<CritereSuggestion> criteres = mapperSuggestionRequestDto(dto);
		List<ResultatSuggestion> resultats = regleImportReleveService.rechercherSuggestions(criteres);

		RegleImportReleveSuggestionResponseDto responseDto = new RegleImportReleveSuggestionResponseDto();
		responseDto.operations = resultats
				.stream()
				.map((resultat) -> mapperResultatSuggestionToResponseDto(resultat))
				.toList();
		return responseDto;
	}

	@PostMapping("/apprentissage")
	public List<RegleImportReleveResponseDto> apprendreRegles(
			@RequestBody RegleImportReleveApprentissageRequestDto dto) throws ControllerException, ServiceException {

		List<Apprentissage> apprentissages = mapperApprentissageRequestDto(dto);
		return regleImportReleveService.apprendre(apprentissages)
				.stream()
				.map((regle) -> RegleImportReleveResponseDtoMapper.mapperModelToResponseDto(regle))
				.toList();
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(value = HttpStatus.NO_CONTENT)
	public void desactiverRegle(@PathVariable Long id) throws ServiceException {

		regleImportReleveService.desactiver(id);
	}

	private List<CritereSuggestion> mapperSuggestionRequestDto(RegleImportReleveSuggestionRequestDto dto) throws ControllerException {

		List<CritereSuggestion> criteres = new ArrayList<>();
		if (dto == null || dto.operations == null) {
			return criteres;
		}

		int index = 0;
		for (RegleImportReleveSuggestionOperationRequestDto operationDto : dto.operations) {
			CritereSuggestion critere = new CritereSuggestion();
			critere.index = index++;
			critere.operationImportId = operationDto.operationImportId;
			critere.libelle = verifierLibelleImport(operationDto.libelle, operationDto.groupKey);
			critere.groupKey = operationDto.groupKey;
			critere.roleCompteExterne = verifierRoleCompteExterne(operationDto.roleCompteExterne);
			critere.compteInterneContexteId = operationDto.compteInterneContexteId;
			critere.identifiantCompteInterneContexte = operationDto.identifiantCompteInterneContexte;
			criteres.add(critere);
		}

		return criteres;
	}

	private RegleImportReleveSuggestionOperationResponseDto mapperResultatSuggestionToResponseDto(ResultatSuggestion resultat) {

		RegleImportReleveSuggestionOperationResponseDto dto = new RegleImportReleveSuggestionOperationResponseDto();
		dto.index = resultat.critere.index;
		dto.operationImportId = resultat.critere.operationImportId;
		dto.cleLibelleNormalisee = resultat.cleLibelleNormalisee;
		dto.suggestionTrouvee = resultat.regle != null;
		dto.regle = resultat.regle == null ? null : RegleImportReleveResponseDtoMapper.mapperModelToResponseDto(resultat.regle);
		return dto;
	}

	private List<Apprentissage> mapperApprentissageRequestDto(RegleImportReleveApprentissageRequestDto dto) throws ControllerException, ServiceException {

		List<Apprentissage> apprentissages = new ArrayList<>();
		if (dto == null || dto.operations == null) {
			return apprentissages;
		}

		for (RegleImportReleveApprentissageItemRequestDto itemDto : dto.operations) {
			Apprentissage apprentissage = new Apprentissage();
			apprentissage.libelle = verifierLibelleImport(itemDto.libelle, itemDto.groupKey);
			apprentissage.groupKey = itemDto.groupKey;
			apprentissage.roleCompteExterne = verifierRoleCompteExterne(itemDto.roleCompteExterne);
			apprentissage.typeOperation = verifierTypeOperation(itemDto.codeTypeOperation);
			apprentissage.compteInterneContexteId = itemDto.compteInterneContexteId;
			apprentissage.identifiantCompteInterneContexte = itemDto.identifiantCompteInterneContexte;
			apprentissage.compteExterneId = itemDto.compteExterneId;
			apprentissage.identifiantCompteExterne = itemDto.identifiantCompteExterne;
			apprentissage.sousCategorieId = itemDto.sousCategorieId;
			apprentissage.nomSousCategorie = itemDto.nomSousCategorie;
			apprentissage.beneficiaireIds = itemDto.beneficiaireIds;
			apprentissage.nomsBeneficiaires = itemDto.nomsBeneficiaires;
			apprentissages.add(apprentissage);
		}

		return apprentissages;
	}

	private String verifierLibelleImport(String libelle, String groupKey) throws ControllerException {

		if ((libelle == null || libelle.isBlank()) && (groupKey == null || groupKey.isBlank())) {
			throw new ControllerException(ImportReleveControleErreur.LIBELLE_IMPORT_OBLIGATOIRE);
		}
		return libelle;
	}

	private RoleCompteExterneImport verifierRoleCompteExterne(String roleCompteExterne) throws ControllerException {

		if (roleCompteExterne == null || roleCompteExterne.isBlank()) {
			throw new ControllerException(ImportReleveControleErreur.ROLE_COMPTE_EXTERNE_OBLIGATOIRE);
		}

		RoleCompteExterneImport role = RoleCompteExterneImport.findByCode(roleCompteExterne);
		if (role == null) {
			throw new ControllerException(
					ImportReleveControleErreur.ROLE_COMPTE_EXTERNE_INVALIDE,
					roleCompteExterne);
		}

		return role;
	}

	private TypeOperation verifierTypeOperation(String codeTypeOperation) throws ControllerException, ServiceException {

		if (codeTypeOperation == null || codeTypeOperation.isBlank()) {
			throw new ControllerException(ImportReleveControleErreur.TYPE_OPERATION_OBLIGATOIRE);
		}

		TypeOperation typeOperation = TypeOperation.findByCode(codeTypeOperation);
		if (typeOperation == null) {
			throw new ServiceException(
					ImportReleveFonctionnelleErreur.TYPE_OPERATION_NON_TROUVE,
					codeTypeOperation);
		}

		return typeOperation;
	}
}

