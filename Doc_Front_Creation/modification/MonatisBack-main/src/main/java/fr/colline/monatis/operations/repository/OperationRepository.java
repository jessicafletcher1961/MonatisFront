// Path exacte depuis la racine du projet :
// MonatisBack-main/src/main/java/fr/colline/monatis/operations/repository/OperationRepository.java

// Modification : les requetes paginees du releve de compte joignent la ligne principale
// de l'operation (`numeroLigne = 0`) et utilisent sa date de comptabilisation.
// Pourquoi : dans l'onglet Analyse > Releve, la date affichee et l'ordre d'apparition
// doivent suivre la date comptable reelle, pas seulement la date de valeur de l'operation.
// Precision H2 : ne pas mettre `distinct` ici. H2 refuse `select distinct o` avec
// `order by coalesce(...)` lorsque l'expression de tri n'est pas dans la projection.
// La jointure cible uniquement `numeroLigne = 0`, qui correspond a la ligne principale.

@Query(
		value = "select o from Operation o"
				+ " left join o.lignes ligneComptable on ligneComptable.numeroLigne = 0"
				+ " where o.compteRecette.id = :compteId"
				+ " and (:dateDebut is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) >= :dateDebut)"
				+ " and (:dateFin is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) <= :dateFin)"
				+ " order by coalesce(ligneComptable.dateComptabilisation, o.dateValeur) desc, o.numero asc, o.id desc",
		countQuery = "select count(o) from Operation o"
				+ " left join o.lignes ligneComptable on ligneComptable.numeroLigne = 0"
				+ " where o.compteRecette.id = :compteId"
				+ " and (:dateDebut is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) >= :dateDebut)"
				+ " and (:dateFin is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) <= :dateFin)")
public Page<Operation> findRecettesByCompteIdAndDateRange(Long compteId, LocalDate dateDebut, LocalDate dateFin, Pageable pageable);

@Query(
		value = "select o from Operation o"
				+ " left join o.lignes ligneComptable on ligneComptable.numeroLigne = 0"
				+ " where o.compteDepense.id = :compteId"
				+ " and (:dateDebut is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) >= :dateDebut)"
				+ " and (:dateFin is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) <= :dateFin)"
				+ " order by coalesce(ligneComptable.dateComptabilisation, o.dateValeur) desc, o.numero asc, o.id desc",
		countQuery = "select count(o) from Operation o"
				+ " left join o.lignes ligneComptable on ligneComptable.numeroLigne = 0"
				+ " where o.compteDepense.id = :compteId"
				+ " and (:dateDebut is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) >= :dateDebut)"
				+ " and (:dateFin is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) <= :dateFin)")
public Page<Operation> findDepensesByCompteIdAndDateRange(Long compteId, LocalDate dateDebut, LocalDate dateFin, Pageable pageable);

// Modification : les sommes utilisees par le releve reprennent le meme critere de
// date comptable que les listes paginees.
// Pourquoi : les totaux doivent correspondre exactement a la periode visible du releve.

@Query(value = "select coalesce(sum(o.montantEnCentimes), 0) from Operation o"
		+ " left join o.lignes ligneComptable on ligneComptable.numeroLigne = 0"
		+ " where o.compteRecette.id = :compteId"
		+ " and (:dateDebut is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) >= :dateDebut)"
		+ " and (:dateFin is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) <= :dateFin)")
public Long sumMontantRecettesByCompteIdAndDateRange(Long compteId, LocalDate dateDebut, LocalDate dateFin);

@Query(value = "select coalesce(sum(o.montantEnCentimes), 0) from Operation o"
		+ " left join o.lignes ligneComptable on ligneComptable.numeroLigne = 0"
		+ " where o.compteDepense.id = :compteId"
		+ " and (:dateDebut is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) >= :dateDebut)"
		+ " and (:dateFin is null or coalesce(ligneComptable.dateComptabilisation, o.dateValeur) <= :dateFin)")
public Long sumMontantDepensesByCompteIdAndDateRange(Long compteId, LocalDate dateDebut, LocalDate dateFin);
