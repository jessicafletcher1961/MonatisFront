# Rapports

`ReportsPage.tsx` affiche six rapports :

- relevé de compte ;
- résumés de comptes internes ;
- dépenses / recettes ;
- plus / moins-value ;
- rémunérations / frais ;
- bilan patrimoine.

## Sources de données

La page charge :

- comptes internes ;
- comptes externes ;
- comptes techniques ;
- opérations ;
- évaluations ;
- catégories ;
- sous-catégories ;
- bénéficiaires ;
- titulaires.

## Calculs

Les rapports sont calculés dans `src/lib/reporting.ts` :

- `buildAccountLookup`
- `buildReleveCompte`
- `buildResumesComptes`
- `buildDepenseRecetteReport`
- `buildPlusMoinsValueReport`
- `buildRemunerationsFraisReport`
- `buildBilanPatrimoineReport`

Les filtres de période, compte, type, titulaire, catégorie, sous-catégorie et bénéficiaire sont appliqués avant l'affichage final.

Dans les panneaux de filtre des rapports, un choix mono-sélection ferme immédiatement le panneau après le clic sur l'élément choisi. Les filtres multi-sélection restent ouverts pour permettre de cocher plusieurs valeurs avant validation manuelle.

Les tableaux de bord des rapports utilisent `src/components/insight.tsx`. Dans chaque onglet, le cadre de filtres est toujours affiché avant la synthèse et les résultats ; il ne contient pas d'entête textuelle, seulement les champs de filtre et l'action de réinitialisation. L'ordre visuel reste cohérent : date, période lorsqu'elle existe, titulaire ou bénéficiaire lorsqu'il existe, type ou catégorie, compte, puis réinitialisation. Les champs de filtre occupent une grille uniforme pour éviter qu'un champ date soit plus large ou plus haut que les autres.

Les héros de synthèse affichent à gauche le nom du rapport et la valeur principale. Les informations de contexte, comme compte, plage de dates ou découpage temporel, sont alignées à droite du même cadre. Les héros ne répètent pas les filtres sous forme de badges : les filtres restent uniquement dans le cadre de paramètres.

Chaque onglet présente ensuite des indicateurs ciblés, puis une ou deux visualisations choisies selon le rapport : pont de solde, courbe ou aire temporelle, flux, heatmap, treemap, camembert, anneau, barres ou colonnes. Les graphiques standards sont rendus par Recharts et chaque série reçoit une couleur stable par libellé ; dans un même graphique, deux séries ne partagent pas la même couleur tant que la palette disponible le permet, puis une couleur HSL déterministe non utilisée dans ce graphique est générée. Chaque graphique possède un `chartId` stable ; le choix de rendu effectué par l'utilisateur est conservé entre les sessions. Les types de graphique sont sélectionnés par une colonne d'icônes à gauche du cadre. Les explications des formes de graphique sont portées par le mode aide sur ces icônes, pas par des titres visibles dans le cadre. Les courbes temporelles sont affichées uniquement lorsque plusieurs périodes existent. Quand une série contient beaucoup de périodes, le graphique devient horizontalement défilable pour conserver les points et les libellés au lieu de tout comprimer dans la largeur visible ; la molette de souris fait défiler ce graphique vers la droite ou la gauche lorsque le curseur est au-dessus de la zone. Les axes temporels affichent un libellé court, par exemple `Jul 19`, tandis que le libellé complet reste disponible au survol. Les colonnes gardent un repère minimal pour les valeurs nulles ou très faibles afin que les anciennes périodes restent localisables. Les panneaux de détail financiers n'affichent pas de rail temporel lorsqu'il n'y a qu'une seule période. Les écrans évitent les doublons : une valeur déjà portée par le bandeau ou par un graphique n'est pas répétée dans une carte KPI. Les détails par type, compte, catégorie ou opération restent dans les panneaux spécialisés sous la synthèse.

Les panneaux de détail placés sous les synthèses utilisent une lecture verticale sur une seule colonne. Ils n'ajoutent pas de titre visible lorsque le contexte est déjà porté par l'onglet. Les groupes affichent d'abord leur valeur principale, puis quelques métriques utiles. Les périodes détaillées sont affichées au niveau du groupe ou de la catégorie, pas répétées sous chaque compte enfant. Les longues séries de périodes restent toutes accessibles dans un rail horizontal défilable ; lorsque le curseur a été placé dans le rectangle visible du rail, la molette verticale déplace le rail horizontalement sans recollage automatique sur une carte. Les listes de comptes ou de sous-catégories restent complètes dans une zone verticale défilable. Aucun compteur ne remplace les éléments moins significatifs : le tri garde les lignes importantes en premier, mais toutes les lignes restent consultables.

Le rapport plus / moins-value reproduit côté front la logique métier exposée par `/monatis/rapports/plus_moins_value` : solde initial, opérations pondérées sur la durée de période, plus/moins-value nette, taux net, solde final, frais techniques et taux de frais.

## Relevé de compte

Le relevé calcule toutes les opérations recette et dépense du compte interne choisi, puis applique une pagination visuelle côté front pour les deux listes.

`src/pages/reports/ReleveDashboard.tsx` affiche la synthèse du relevé : compte, période, nombre d'opérations, volume d'entrées et de sorties, contrôle d'écart, pont de rapprochement du solde de début au solde de fin et heatmap des jours avec mouvements lorsqu'il existe des opérations dans la période. Les helpers d'affichage propres à ce tableau de bord vivent dans `src/pages/reports/releve-dashboard-utils.ts`.

`src/pages/reports/ReleveMovementsPanel.tsx` affiche les mouvements. Les recettes et dépenses sont empilées verticalement pour éviter une lecture en deux colonnes trop dense, avec montants signés, type d'opération, date de comptabilisation, compte contrepartie et détail au survol. Les boutons `Recettes` et `Dépenses` permettent d'isoler un flux ou de revenir à la vue comparative. La pagination reste indépendante pour chaque flux.

## Résumé de comptes

Le résumé calcule le solde de chaque compte interne à une date donnée. Les filtres disponibles sont la date, le type de fonctionnement et une sélection optionnelle de comptes internes.

`src/pages/reports/ResumeDashboard.tsx` affiche la synthèse : total des comptes visibles, soldes positifs, soldes négatifs, moyenne par compte et treemap des soldes par type de fonctionnement, avec alternatives en barres ou anneau. Les regroupements et indicateurs d'affichage vivent dans `src/pages/reports/resume-report-utils.ts`.

`src/pages/reports/ResumeGroupsPanel.tsx` affiche les comptes par type sur une seule colonne. Chaque groupe met en avant son total puis liste tous les comptes triés par solde absolu dans une zone défilable lorsque le volume devient important.

## Dépenses / recettes

Le rapport dépenses / recettes calcule les opérations courantes de type recette ou dépense à partir des lignes d'opérations. Il applique la plage de dates, le découpage de période, le bénéficiaire, les catégories et les sous-catégories, puis regroupe les montants par catégorie, sous-catégorie et période.

`src/pages/reports/DepenseRecetteDashboard.tsx` affiche la lecture d'ensemble : solde net, nombre de lignes analysées, catégories et sous-catégories couvertes, flux entrées/sorties et tendance en aire du solde uniquement lorsque le découpage produit plusieurs périodes. Les helpers d'agrégation propres à ce rapport vivent dans `src/pages/reports/depense-recette-report-utils.ts`.

`src/pages/reports/DepenseRecetteCategoriesPanel.tsx` affiche les catégories sur une seule colonne. Chaque carte montre recettes, dépenses, solde et volume de lignes, puis expose toutes les périodes dans un rail horizontal et toutes les sous-catégories dans une liste complète triée par impact. Les lignes de sous-catégorie affichent seulement le flux utile lorsqu'il n'y a qu'une entrée ou qu'une sortie. Les détails d'opérations restent accessibles au survol ou au focus des périodes au niveau catégorie, afin de conserver une vue synthétique sans perdre la traçabilité des lignes.

## Plus / moins-value

Le rapport plus / moins-value calcule la performance nette des comptes internes éligibles. Pour chaque période, il prend le solde initial, ajoute les opérations courantes pondérées par leur durée de présence dans la période, compare avec le solde final issu des soldes et évaluations, puis expose la plus/moins-value nette, son taux, les frais techniques et leur taux.

`src/pages/reports/PlusMoinsDashboard.tsx` affiche la synthèse : performance nette, taux net, frais, périmètre, tendance de performance en aire lorsqu'il y a plusieurs périodes et pont initial / opérations pondérées / plus-moins-value / final. Les helpers d'agrégation d'affichage vivent dans `src/pages/reports/plus-moins-report-utils.ts`.

`src/pages/reports/PlusMoinsGroupsPanel.tsx` affiche les types de comptes et les comptes sur une seule colonne. Les comptes sont triés par impact de performance nette, toutes les périodes restent accessibles dans un rail horizontal au niveau type, et chaque période peut être inspectée au survol ou au focus pour voir solde initial, opérations pondérées, plus/moins-value, taux net, frais et solde final.

## Rémunérations / frais

Le rapport rémunérations / frais analyse les opérations financières dont le code contient `+` ou `-`. Les montants positifs alimentent les rémunérations, les montants négatifs les frais, et le net correspond aux rémunérations moins les frais. Le rapport est filtré par période, titulaire, type de fonctionnement et comptes internes.

`src/pages/reports/RemunerationsDashboard.tsx` affiche la synthèse : net financier, comptes concernés, types, périodes, flux produits/frais et tendance en aire du net uniquement lorsque plusieurs périodes existent. Les helpers d'agrégation d'affichage vivent dans `src/pages/reports/remunerations-report-utils.ts`.

`src/pages/reports/RemunerationsGroupsPanel.tsx` affiche les types de comptes et les comptes sur une seule colonne. Les comptes sont triés par net financier, toutes les périodes restent accessibles dans un rail horizontal au niveau type, et chaque période peut être inspectée au survol ou au focus pour voir rémunérations, frais et net.

## Bilan patrimoine

Le rapport bilan patrimoine suit le patrimoine sur une plage de dates, avec découpage par période, titulaire, type de fonctionnement et comptes internes. Le calcul part des soldes initiaux, ajoute les recettes, retranche les dépenses, tient compte des flux techniques et expose les écarts non justifiés.

Le back expose `/monatis/rapports/bilan_patrimoine`, mais `ReportsPage` ne l'appelle pas directement car cet endpoint est déclaré en `GET` avec body. Le front reconstruit donc le rapport à partir des données de base et doit rester aligné avec la formule métier du back : les recettes et dépenses excluent les opérations marquées `fluxTechnique`, les flux techniques sont isolés dans `soldeTotalTechniqueEnEuros`, et l'écart de contrôle vaut `solde final - (solde initial + recettes - dépenses + flux techniques)`. Un compte vaut `0` avant la veille de sa date de solde initial.

`src/pages/reports/BilanDashboard.tsx` affiche la synthèse lisible du patrimoine : solde final, comptes suivis, variation, flux net, écart de contrôle et pont initial / recettes / dépenses / flux techniques / final. Une tendance en aire du patrimoine final est affichée uniquement quand le découpage produit plusieurs périodes, afin d'éviter une carte redondante en vue globale. Les helpers d'agrégation d'affichage vivent dans `src/pages/reports/bilan-report-utils.ts`.

`src/pages/reports/BilanGroupsPanel.tsx` affiche les types de comptes et les comptes sur une seule colonne. Les comptes sont triés par solde final absolu, toutes les périodes restent accessibles dans un rail horizontal au niveau type, et chaque période peut être inspectée au survol ou au focus pour voir solde initial, recettes, dépenses, flux techniques, écart de contrôle et solde final. Dans une carte de groupe bilan, la molette pilote le rail temporel uniquement lorsque le curseur est dans le cadre horizontal des périodes. Chaque groupe reste en cumul par défaut. La coche `Comparaison` ajoute, dans le même rail temporel, une ligne par compte sélectionné sous chaque période ; cliquer sur un compte du groupe l'ajoute ou le retire de la comparaison, avec un repère coloré stable. Les métriques nulles de variation, flux technique ou écart ne sont pas affichées dans les lignes de comptes pour éviter de répéter des zéros.
