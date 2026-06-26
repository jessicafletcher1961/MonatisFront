// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/references/repository/ReferenceRepository.java

// Modification : ajout des imports Page/Pageable/Query/Param.
// Pourquoi : les cinq pages de references utilisent maintenant la meme pagination serveur.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// Modification : ajout d'une requete paginee generique sur l'entite concrete.
// Pourquoi : banques, titulaires, beneficiaires, categories et sous-categories partagent
// le meme comportement : recherche sur nom/libelle, tri par nom et metadonnees de page.

@Query(value = """
		select r
		from #{#entityName} r
		where (
			:recherche is null
			or :recherche = ''
			or upper(r.nom) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(r.libelle, '')) like upper(concat('%', :recherche, '%'))
		)
		order by r.nom
		""",
		countQuery = """
		select count(r)
		from #{#entityName} r
		where (
			:recherche is null
			or :recherche = ''
			or upper(r.nom) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(r.libelle, '')) like upper(concat('%', :recherche, '%'))
		)
		""")
Page<T> rechercherPage(@Param("recherche") String recherche, Pageable pagination);
