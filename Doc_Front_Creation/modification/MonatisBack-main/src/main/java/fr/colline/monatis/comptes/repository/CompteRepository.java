// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/comptes/repository/CompteRepository.java

// Modification : ajout des imports Page/Pageable.
// Pourquoi : les comptes externes utilisent maintenant une pagination serveur standard.

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

// Modification : ajout d'une requete generique paginee sur les comptes.
// Pourquoi : les ecrans de liste ne doivent plus charger tous les comptes externes
// avant d'appliquer la recherche cote front.

@Query(value = """
		select c
		from #{#entityName} c
		where (
			:recherche is null
			or :recherche = ''
			or upper(c.identifiant) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(c.libelle, '')) like upper(concat('%', :recherche, '%'))
		)
		order by c.identifiant
		""",
		countQuery = """
		select count(c)
		from #{#entityName} c
		where (
			:recherche is null
			or :recherche = ''
			or upper(c.identifiant) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(c.libelle, '')) like upper(concat('%', :recherche, '%'))
		)
		""")
public Page<T> rechercherPage(@Param("recherche") String recherche, Pageable pagination);
