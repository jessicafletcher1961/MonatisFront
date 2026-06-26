// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java

// Modification : ajout des imports Page/PageRequest et DTOs de pagination reference.
// Pourquoi : exposer POST /monatis/references/beneficiaire/page.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import fr.colline.monatis.references.controller.ReferencePageRequestDto;
import fr.colline.monatis.references.controller.ReferencePageResponseDto;
import fr.colline.monatis.references.controller.ReferencePageResponseDtoMapper;

private final int TAILLE_PAGE_REFERENCE_PAR_DEFAUT = 50;
private final int TAILLE_PAGE_REFERENCE_MAX = 200;

// Modification : endpoint page pour les beneficiaires.
// Pourquoi : la page References > Beneficiaires peut chercher et paginer sans charger tous les beneficiaires.

@PostMapping("/page")
public ReferencePageResponseDto paginerReferences(
		@RequestBody(required = false) ReferencePageRequestDto requestDto) throws ServiceException, ControllerException {

	ReferencePageRequestDto requete = requestDto == null ? new ReferencePageRequestDto() : requestDto;
	final String recherche = verificateur.verifierLibelle(requete.recherche, FACULTATIF, null);

	Page<Beneficiaire> page = beneficiaireService.rechercherPage(
			recherche,
			PageRequest.of(
					numeroPageApiVersIndexPageSpring(requete.numeroPage),
					taillePage(requete.taillePage)));

	return ReferencePageResponseDtoMapper.mapperPageToResponseDto(
			page,
			BeneficiaireResponseDtoMapper::mapperModelToBasicResponseDto);
}

private int numeroPageApiVersIndexPageSpring(Integer numeroPage) {
	if (numeroPage == null || numeroPage < 1) {
		return 0;
	}

	return numeroPage - 1;
}

private int taillePage(Integer taillePage) {
	if (taillePage == null) {
		return TAILLE_PAGE_REFERENCE_PAR_DEFAUT;
	}

	if (taillePage < 1) {
		return 1;
	}

	return Math.min(taillePage, TAILLE_PAGE_REFERENCE_MAX);
}
