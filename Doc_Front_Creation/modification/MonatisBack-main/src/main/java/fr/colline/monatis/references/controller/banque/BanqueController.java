// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java

// Modification : ajout des imports Page/PageRequest et DTOs de pagination reference.
// Pourquoi : exposer POST /monatis/references/banque/page.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import fr.colline.monatis.references.controller.ReferencePageRequestDto;
import fr.colline.monatis.references.controller.ReferencePageResponseDto;
import fr.colline.monatis.references.controller.ReferencePageResponseDtoMapper;

// Modification : ajout de constantes de pagination.
// Pourquoi : conserver les memes bornes que l'historique operations.

private final int TAILLE_PAGE_REFERENCE_PAR_DEFAUT = 50;
private final int TAILLE_PAGE_REFERENCE_MAX = 200;

// Modification : endpoint page pour les banques.
// Pourquoi : la page References > Banques peut chercher et paginer sans charger toutes les banques.

@PostMapping("/page")
public ReferencePageResponseDto paginerReferences(
		@RequestBody(required = false) ReferencePageRequestDto requestDto) throws ServiceException, ControllerException {

	ReferencePageRequestDto requete = requestDto == null ? new ReferencePageRequestDto() : requestDto;
	final String recherche = verificateur.verifierLibelle(requete.recherche, FACULTATIF, null);

	Page<Banque> page = banqueService.rechercherPage(
			recherche,
			PageRequest.of(
					numeroPageApiVersIndexPageSpring(requete.numeroPage),
					taillePage(requete.taillePage)));

	return ReferencePageResponseDtoMapper.mapperPageToResponseDto(
			page,
			BanqueResponseDtoMapper::mapperModelToBasicResponseDto);
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
