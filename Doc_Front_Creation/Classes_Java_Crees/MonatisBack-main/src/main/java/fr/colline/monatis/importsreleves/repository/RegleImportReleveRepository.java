/*
 * Chemin original depuis la racine du projet: MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\repository\RegleImportReleveRepository.java
 * Chemin de cette copie documentaire depuis la racine du projet: MonatisFront-codex-monatis-front-ui-refresh\Doc_Front_Creation\Classes_Java_Crees\MonatisBack-main\src\main\java\fr\colline\monatis\importsreleves\repository\RegleImportReleveRepository.java
 */
package fr.colline.monatis.importsreleves.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import fr.colline.monatis.importsreleves.model.RegleImportReleve;
import fr.colline.monatis.importsreleves.model.RoleCompteExterneImport;

@Repository
public interface RegleImportReleveRepository extends JpaRepository<RegleImportReleve, Long> {

	Optional<RegleImportReleve> findByIdAndActiveTrue(Long id);

	List<RegleImportReleve> findByActiveTrueOrderByDateDerniereUtilisationDesc();

	List<RegleImportReleve> findByActiveTrueAndCleLibelleNormaliseeIn(Collection<String> clesLibellesNormalisees);

	Optional<RegleImportReleve> findByCompteInterneContexteIdAndRoleCompteExterneAndCleLibelleNormalisee(
			Long compteInterneContexteId,
			RoleCompteExterneImport roleCompteExterne,
			String cleLibelleNormalisee);

	Optional<RegleImportReleve> findByCompteInterneContexteIsNullAndRoleCompteExterneAndCleLibelleNormalisee(
			RoleCompteExterneImport roleCompteExterne,
			String cleLibelleNormalisee);
}

