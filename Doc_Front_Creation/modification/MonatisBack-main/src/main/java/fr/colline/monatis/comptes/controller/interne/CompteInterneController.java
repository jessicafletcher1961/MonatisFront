// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java

// Modification : ajout des imports Page/PageRequest et DTOs de pagination compte.
// Pourquoi : exposer POST /monatis/comptes/interne/page pour l'ecran Comptes internes.

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
// Pourquoi : filtrer et paginer en base par recherche, type de fonctionnement et titulaire.

@PostMapping("/page")
public ComptePageResponseDto paginerComptes(
		@RequestBody(required = false) ComptePageRequestDto requestDto) throws ServiceException, ControllerException {

	ComptePageRequestDto requete = requestDto == null ? new ComptePageRequestDto() : requestDto;
	final String recherche = verificateur.verifierLibelle(requete.recherche, FACULTATIF, null);
	final Set<TypeFonctionnement> typesFonctionnement = verifierTypesFonctionnement(requete.codesTypeFonctionnement);
	final Set<String> nomsTitulaires = verifierNomsTitulaires(requete.nomsTitulaires);

	Page<CompteInterne> page = compteInterneService.rechercherPage(
			recherche,
			typesFonctionnement,
			nomsTitulaires,
			PageRequest.of(
					numeroPageApiVersIndexPageSpring(requete.numeroPage),
					taillePage(requete.taillePage)));

	return ComptePageResponseDtoMapper.mapperPageToResponseDto(
			page,
			CompteInterneResponseDtoMapper::mapperModelToBasicResponseDto);
}

// Modification : validation des types de fonctionnement recus par le front.
// Pourquoi : ne passer au repository que des codes connus par la typologie back.

private Set<TypeFonctionnement> verifierTypesFonctionnement(List<String> codesTypeFonctionnement) throws ControllerException {
	Set<TypeFonctionnement> typesFonctionnement = new HashSet<>();

	if (codesTypeFonctionnement == null) {
		return typesFonctionnement;
	}

	for (String codeTypeFonctionnement : codesTypeFonctionnement) {
		TypeFonctionnement typeFonctionnement = verificateur.verifierTypeFonctionnement(codeTypeFonctionnement, FACULTATIF, null);
		if (typeFonctionnement != null) {
			typesFonctionnement.add(typeFonctionnement);
		}
	}

	return typesFonctionnement;
}

// Modification : validation des titulaires recus par le front.
// Pourquoi : filtrer sur des noms de titulaires existants et standardises.

private Set<String> verifierNomsTitulaires(List<String> nomsTitulaires) throws ControllerException, ServiceException {
	Set<String> nomsVerifies = new HashSet<>();

	if (nomsTitulaires == null) {
		return nomsVerifies;
	}

	for (String nomTitulaire : nomsTitulaires) {
		Titulaire titulaire = verificateur.verifierTitulaire(nomTitulaire, FACULTATIF);
		if (titulaire != null) {
			nomsVerifies.add(titulaire.getNom());
		}
	}

	return nomsVerifies;
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
