/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\operations\service\OperationService.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Modifiees_Extraits\MonatisBack-main\src\main\java\fr\colline\monatis\operations\service\OperationService.java
 * Extraits uniquement: parties modifiees, avec commentaires sur les changements.
 */
import org.springframework.data.domain.Page; // MODIFIE: type de retour de la pagination.
import org.springframework.data.domain.Pageable; // MODIFIE: parametres de page et tri.
import org.springframework.data.jpa.domain.Specification; // MODIFIE: filtres dynamiques JPA.

public Page<Operation> rechercherPage(Specification<Operation> specification, Pageable pageable) throws ServiceException { // MODIFIE: nouvelle entree service pour l'historique pagine.

    Assert.notNull(pageable, () -> "Les informations de pagination pour la recherche d'operations sont obligatoires");

    try {
        return operationRepository.findAll(specification, pageable); // MODIFIE: pagination et filtrage delegues a la base via Spring Data.
    }
    catch (Throwable t) {
        throw new ServiceException (
                t,
                OperationTechniqueErreur.RECHERCHE_TOUS);
    }
}
