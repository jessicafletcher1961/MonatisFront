# Instructions pour les agents de code

Ce dossier `env_agent/` est la source de vérité de l'état actuellement exécutable du front MONATIS. Avant toute modification, lire ce fichier puis les pages de `docs/` liées au domaine modifié.

## Portée obligatoire

- Les modifications de code sont autorisées uniquement dans `MonatisFront-codex-monatis-front-ui-refresh`.
- Le back peut être lu pour vérifier un contrat, mais ne doit pas être modifié depuis ce travail front.
- Toute modification d'API, d'écran, de formulaire, de navigation, de microservice local, de calcul métier côté front ou d'architecture doit mettre à jour `env_agent/docs/` dans le même travail.
- Les documents décrivent uniquement le runtime front courant. Supprimer ou remplacer toute information devenue fausse ; ne pas conserver de notes historiques, d'options abandonnées ou de promesses futures.
- Si le code et la documentation divergent, le code compilable et les contrats back réellement exposés priment, puis la documentation doit être réalignée.

## Maintenance du code

- Eviter les fichiers monolithiques. Un module dépassant environ 350 lignes doit être découpé dès que plusieurs responsabilités distinctes sont modifiées.
- Réutiliser les composants, helpers et clients existants quand ils couvrent le besoin. Ne pas dupliquer une logique de requête, de pagination, de formatage, de filtre ou de calcul rapport.
- Supprimer le code devenu inaccessible lorsqu'une implémentation en remplace une autre.
- Garder les contrats API concentrés dans `src/lib/monatis-api.ts`. Les pages ne construisent pas d'URL back directement.
- Garder les calculs de rapports dans `src/lib/reporting.ts`. Les pages de rapport orchestrent les filtres et l'affichage.
- Les gros écrans peuvent contenir de l'orchestration UI, mais les règles réutilisables doivent vivre dans `src/lib/` ou dans des composants spécialisés.

## Contrats API

- Vérifier les DTO et contrôleurs du back actif avant d'ajouter ou de modifier un appel API.
- Ne pas conserver d'appel à un endpoint absent du back actif.
- Les endpoints de pagination absents pour comptes et références sont simulés côté front à partir de `/all`.
- Les rapports affichés par `ReportsPage` sont calculés côté front à partir des données de base ; l'interface ne consomme pas les endpoints back de rapports avec body sur GET.

## Vérification avant réponse

- Exécuter `npm run build` après toute modification TypeScript, React, Vite ou CSS.
- Exécuter `npm run lint` lorsque la modification touche plusieurs modules ou ajoute de nouvelles règles de hooks/exports.
- Vérifier dans un navigateur les écrans modifiés quand l'interface, la navigation ou les formulaires changent.
- Vérifier qu'aucun document `env_agent/docs/` ne décrit une ancienne route, un ancien endpoint ou un comportement absent du runtime courant.

## Hiérarchie documentaire

- Vue d'ensemble : `docs/front-overview.md`
- Outillage et lancement : `docs/runtime-and-tooling.md`
- Architecture : `docs/architecture.md`
- Contrats API : `docs/api-contract.md`
- Opérations et import : `docs/features-operations.md`
- Comptes et références : `docs/features-accounts-references.md`
- Données back et administration : `docs/features-data-admin.md`
- Rapports : `docs/features-reports.md`
- Maintenance actuelle : `docs/maintenance.md`

Toute création, suppression ou fusion de page impose une mise à jour de `docs/README.md` et de cette liste.
