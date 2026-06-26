// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/comptes/repository/CompteInterneRepository.java

// Modification : ajout des imports Collection/Page/Pageable.
// Pourquoi : la liste des comptes internes doit etre paginee et filtrable cote base.

import java.util.Collection;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

// Modification : ajout d'une requete paginee dediee aux comptes internes.
// Pourquoi : l'ecran Comptes internes filtre par recherche, type de fonctionnement et titulaire
// sans charger tous les comptes en memoire cote front.

@Query(value = """
		select distinct c
		from CompteInterne c
		left join c.banque b
		left join c.titulaires t
		where (
			:recherche is null
			or :recherche = ''
			or upper(c.identifiant) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(c.libelle, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(b.nom, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(b.libelle, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(t.nom, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(t.libelle, '')) like upper(concat('%', :recherche, '%'))
		)
		and (:typesFonctionnementVides = true or c.typeFonctionnement in :typesFonctionnement)
		and (:nomsTitulairesVides = true or t.nom in :nomsTitulaires)
		order by c.identifiant
		""",
		countQuery = """
		select count(distinct c)
		from CompteInterne c
		left join c.banque b
		left join c.titulaires t
		where (
			:recherche is null
			or :recherche = ''
			or upper(c.identifiant) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(c.libelle, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(b.nom, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(b.libelle, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(t.nom, '')) like upper(concat('%', :recherche, '%'))
			or upper(coalesce(t.libelle, '')) like upper(concat('%', :recherche, '%'))
		)
		and (:typesFonctionnementVides = true or c.typeFonctionnement in :typesFonctionnement)
		and (:nomsTitulairesVides = true or t.nom in :nomsTitulaires)
		""")
public Page<CompteInterne> rechercherPage(
		@Param("recherche") String recherche,
		@Param("typesFonctionnementVides") boolean typesFonctionnementVides,
		@Param("typesFonctionnement") Collection<TypeFonctionnement> typesFonctionnement,
		@Param("nomsTitulairesVides") boolean nomsTitulairesVides,
		@Param("nomsTitulaires") Collection<String> nomsTitulaires,
		Pageable pagination);
