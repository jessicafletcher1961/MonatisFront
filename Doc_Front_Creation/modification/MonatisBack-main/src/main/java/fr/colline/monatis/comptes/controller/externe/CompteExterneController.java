// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java

// Modification : ajout des imports Page/PageRequest et DTOs de pagination compte.
// Pourquoi : exposer POST /monatis/comptes/externe/page pour l'ecran Comptes externes.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;

import fr.colline.monatis.comptes.controller.ComptePageRequestDto;
import fr.colline.monatis.comptes.controller.ComptePageResponseDto;
import fr.colline.monatis.comptes.controller.ComptePageResponseDtoMapper;

// Modification : ajout de constantes de pagination.
// Pourquoi : appliquer le meme cadre que l'historique operations, avec limite max a 200.

private final int TAILLE_PAGE_COMPTE_PAR_DEFAUT = 50;
private final int TAILLE_PAGE_COMPTE_MAX = 200;

// Modification : nouvel endpoint pagine.
// Pourquoi : rechercher et paginer les comptes externes directement en base.

@PostMapping("/page")
public ComptePageResponseDto paginerComptes(
		@RequestBody(required = false) ComptePageRequestDto requestDto) throws ServiceException, ControllerException {

	ComptePageRequestDto requete = requestDto == null ? new ComptePageRequestDto() : requestDto;
	final String recherche = verificateur.verifierLibelle(requete.recherche, FACULTATIF, null);

	Page<CompteExterne> page = compteExterneService.rechercherPage(
			recherche,
			PageRequest.of(
					numeroPageApiVersIndexPageSpring(requete.numeroPage),
					taillePage(requete.taillePage)));

	return ComptePageResponseDtoMapper.mapperPageToResponseDto(
			page,
			CompteExterneResponseDtoMapper::mapperModelToBasicResponseDto);
}

// Modification : helpers de conversion API -> Spring PageRequest.
// Pourquoi : les pages API commencent a 1, Spring commence a 0, et la taille est bornee.

private int numeroPageApiVersIndexPageSpring(Integer numeroPage) {
	if (numeroPage == null || numeroPage < 1) {
		return 0;
	}

	return numeroPage - 1;
}

private int taillePage(Integer taillePage) {
	if (taillePage == null) {
		return TAILLE_PAGE_COMPTE_PAR_DEFAUT;
	}

	if (taillePage < 1) {
		return 1;
	}

	return Math.min(taillePage, TAILLE_PAGE_COMPTE_MAX);
}
