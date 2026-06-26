// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/comptes/service/CompteService.java

// Modification : ajout des imports Page/Pageable.
// Pourquoi : exposer une methode de service paginee commune aux comptes simples.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

// Modification : ajout de rechercherPage.
// Pourquoi : les controllers peuvent demander une page filtree sans recuperer tous les comptes.

public Page<T> rechercherPage(String recherche, Pageable pagination) throws ServiceException {

	Assert.notNull(pagination, () -> "La PAGINATION pour la recherche des comptes de type '" + getTClass().getSimpleName() + "' est obligatoire");

	try {
		return getRepository().rechercherPage(recherche, pagination);
	}
	catch (Throwable t) {
		throw new ServiceException (
				t,
				CompteTechniqueErreur.RECHERCHE_TOUS,
				getTClass().getSimpleName());
	}
}
