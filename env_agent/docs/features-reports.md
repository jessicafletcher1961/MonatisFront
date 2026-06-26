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

Le rapport plus / moins-value reproduit côté front la logique métier exposée par `/monatis/rapports/plus_moins_value` : solde initial, opérations pondérées sur la durée de période, plus/moins-value nette, taux net, solde final, frais techniques et taux de frais.

## Pagination du relevé

Le relevé calcule toutes les opérations recette et dépense du compte choisi, puis applique une pagination visuelle côté front pour les deux listes.
