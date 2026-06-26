// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/comptes/service/CompteInterneService.java

// Modification : ajout des imports Set/Page/Pageable.
// Pourquoi : la pagination des comptes internes a des filtres supplementaires.

import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

// Modification : ajout d'une surcharge rechercherPage pour les comptes internes.
// Pourquoi : filtrer proprement par type de fonctionnement et titulaire directement en base.

public Page<CompteInterne> rechercherPage(
		String recherche,
		Set<TypeFonctionnement> typesFonctionnement,
		Set<String> nomsTitulaires,
		Pageable pagination) throws ServiceException {

	boolean typesVides = typesFonctionnement == null || typesFonctionnement.isEmpty();
	boolean titulairesVides = nomsTitulaires == null || nomsTitulaires.isEmpty();

	try {
		return compteInterneRepository.rechercherPage(
				recherche,
				typesVides,
				typesVides ? List.of(TypeFonctionnement.values()) : typesFonctionnement,
				titulairesVides,
				titulairesVides ? List.of("__AUCUN_TITULAIRE__") : nomsTitulaires,
				pagination);
	}
	catch (Throwable t) {
		throw new ServiceException(
				t,
				CompteTechniqueErreur.RECHERCHE_TOUS,
				getTClass().getSimpleName());
	}
}
