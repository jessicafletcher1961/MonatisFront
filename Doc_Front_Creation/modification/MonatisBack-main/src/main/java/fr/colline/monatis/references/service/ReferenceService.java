// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/references/service/ReferenceService.java

// Modification : ajout des imports Page/Pageable.
// Pourquoi : exposer une pagination serveur commune aux cinq types de references.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

// Modification : ajout de rechercherPage.
// Pourquoi : les controllers de references renvoient maintenant une page filtree,
// avec total, numero de page et bornes visibles.

public Page<T> rechercherPage(String recherche, Pageable pagination) throws ServiceException {

	Assert.notNull(pagination, () -> "La PAGINATION pour la recherche des références de type '" + getTClass().getSimpleName() + "' est obligatoire");

	try {
		return getRepository().rechercherPage(recherche, pagination);
	}
	catch (Throwable t) {
		throw new ServiceException (
				t,
				ReferenceTechniqueErreur.RECHERCHE_TOUS,
				getTClass().getSimpleName());
	}
}
