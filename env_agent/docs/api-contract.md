# Contrats API

## Client central

Tous les appels back passent par `src/lib/monatis-api.ts`. Les pages ne construisent pas d'URL `/monatis/...` directement.

`API_BASE_URL` vaut `VITE_MONATIS_API_URL` ou `http://localhost:8082`.

## Références

Ressources :

- banques : `/monatis/references/banque`
- titulaires : `/monatis/references/titulaire`
- bénéficiaires : `/monatis/references/beneficiaire`
- catégories : `/monatis/references/categorie`
- sous-catégories : `/monatis/references/souscategorie`

Endpoints consommés :

- `GET /all`
- `GET /get/{nom}`
- `POST /new`
- `PUT /mod/{nom}`
- `DELETE /del/{nom}`

Le back actif n'expose pas `/page` pour les références. `listReferencesPage` charge `/all`, filtre et pagine côté front.

## Comptes

Comptes externes :

- `GET /monatis/comptes/externe/all`
- `GET /monatis/comptes/externe/get/{identifiant}`
- `POST /monatis/comptes/externe/new`
- `PUT /monatis/comptes/externe/mod/{identifiant}`
- `DELETE /monatis/comptes/externe/del/{identifiant}`

Comptes internes :

- `GET /monatis/comptes/interne/all`
- `GET /monatis/comptes/interne/get/{identifiant}`
- `GET /monatis/comptes/interne/fonctionnement/{code}`
- `GET /monatis/comptes/interne/typologie/fonctionnement`
- `POST /monatis/comptes/interne/new`
- `PUT /monatis/comptes/interne/mod/{identifiant}`
- `DELETE /monatis/comptes/interne/del/{identifiant}`

Comptes techniques :

- `GET /monatis/comptes/technique/all`
- `GET /monatis/comptes/technique/get/{identifiant}`
- `POST /monatis/comptes/technique/new`
- `PUT /monatis/comptes/technique/mod/{identifiant}`
- `DELETE /monatis/comptes/technique/del/{identifiant}`

Le back actif n'expose pas `/page` pour les comptes internes ou externes. Les méthodes `listInternalAccountsPage` et `listExternalAccountsPage` chargent `/all`, filtrent et paginent côté front.

## Typologies

`listTypologies` consomme les familles exposées par le back :

- fonctionnement : `GET /monatis/typologies/fonctionnement`
- compte : `GET /monatis/typologies/compte`
- opération : `GET /monatis/typologies/operation`
- période : `GET /monatis/typologies/periode`
- budget : `GET /monatis/typologies/budget`
- programmation : `GET /monatis/typologies/programmation`
- référence : `GET /monatis/typologies/reference`

`listTypeFonctionnements` reste disponible sur l'ancien endpoint spécialisé `/monatis/comptes/interne/typologie/fonctionnement` pour les écrans comptes internes existants.

Les familles standard renvoient `code` et `libelle`. La famille opération peut aussi renvoyer `libelleCourt`, `fluxTechnique` et `categorisable`; ces champs alimentent uniquement les badges et filtres de lecture de `/donnees?view=typologies`.

## Évaluations

Endpoints consommés :

- `GET /monatis/evaluations/all`
- `GET /monatis/evaluations/get/{cle}`
- `POST /monatis/evaluations/selection`
- `POST /monatis/evaluations/new`
- `PUT /monatis/evaluations/mod/{cle}`
- `DELETE /monatis/evaluations/del/{cle}`

## Opérations

Endpoints principaux :

- `GET /monatis/operations/all`
- `POST /monatis/operations/page`
- `POST /monatis/operations/suggestions`
- `POST /monatis/operations/doublons`
- `GET /monatis/operations/get/{numero}`
- `GET /monatis/operations/typologie/operation`
- `GET /monatis/operations/compatibilite/comptes/{codeTypeOperation}`
- `GET /monatis/operations/compatibilite/typesoperations/{identifiantCompte}`
- `GET /monatis/operations/compatibilite/comptes/depense/{codeTypeOperation}/{identifiantCompteRecette}`
- `GET /monatis/operations/compatibilite/comptes/recette/{codeTypeOperation}/{identifiantCompteDepense}`
- `POST /monatis/operations/new`
- `PUT /monatis/operations/mod/{numero}`
- `DELETE /monatis/operations/del/{numero}`
- `GET /monatis/operations/addcsv/{nomFichierCsv}`

Le DTO de pagination courant utilise notamment :

- `numeroPage`, `taillePage`
- `recherche`
- `dateValeurDepuisLe`, `dateValeurJusqueAu`
- `identifiantCompte1`, `identifiantCompte2`
- `montantEnCentimesPlancher`, `montantEnCentimesPlafond`
- `nomsSousCategories`, `nomsBeneficiaires`
- `codesTypeOperation`

Les filtres multi-plages de l'interface opérations sont affinés côté front après chargement paginé complet.

## Budgets

Ressources :

- bénéficiaires : `/monatis/budgets/beneficiaire`
- catégories : `/monatis/budgets/categorie`
- sous-catégories : `/monatis/budgets/souscategorie`

Endpoints consommés pour chaque ressource :

- `GET /all`
- `GET /get/{cle}`
- `POST /selection`
- `POST /new`
- `POST /next/{cle}`
- `PUT /mod/{cle}`
- `DELETE /del/{cle}`

Le back actif renvoie la liste globale des budgets depuis chaque `GET /all`, même lorsque la route cible une ressource précise. Le front filtre donc les DTO par forme de `reference` avant affichage :

- `reference.nomsSousCategories` présent : budget catégorie ;
- `reference.nomCategorie` présent : budget sous-catégorie ;
- aucun de ces champs : budget bénéficiaire.

Le DTO de création/modification envoie `cle`, `nomReference`, `codeTypePeriode`, `dateCible`, `codeTypeBudget`, `montantBudgetEnCentimes` et `libelle`. `nomReference` désigne une seule référence cible du budget : un bénéficiaire, une catégorie ou une sous-catégorie selon la route utilisée. Il n'existe pas de tableau de bénéficiaires dans le DTO budget. `cle` reste facultative en création. `dateCible` est recadrée par le back sur le début de période correspondant au type choisi.

L'avancement affiché dans `/donnees?view=budgets` n'appelle pas un endpoint de suivi dédié. Il est calculé côté front depuis `GET /monatis/operations/all`, en utilisant uniquement les lignes des opérations `RECETTE` et `DEPENSE`.

## Emprunts

Endpoints consommés :

- `GET /monatis/emprunts/all`
- `GET /monatis/emprunts/get/{cle}`
- `POST /monatis/emprunts/new`
- `PUT /monatis/emprunts/mod/{cle}`
- `DELETE /monatis/emprunts/del/{cle}`
- `GET /monatis/emprunts/get/{cle}/date/{dateEcheance}`
- `GET /monatis/emprunts/get/{cle}/numero/{numeroEcheance}`

Les échéances détaillées affichées dans le détail d'emprunt viennent du DTO retourné par `GET /get/{cle}`. Les recherches par date ou numéro appellent les endpoints spécialisés.

## Import de relevé

Règles :

- `GET /monatis/imports-releves/regles/all`
- `POST /monatis/imports-releves/regles/suggestions`
- `POST /monatis/imports-releves/regles/apprentissage`
- `DELETE /monatis/imports-releves/regles/{id}`

Doublons :

- `POST /monatis/imports-releves/doublons`

## CSV et administration

Téléchargements CSV exposés par `csvDownloadUrl` :

- `GET /monatis/csv/comptes/types`
- `GET /monatis/csv/comptes/erreurs`
- `GET /monatis/csv/comptes/tables`
- `GET /monatis/csv/operations/types`
- `GET /monatis/csv/operations/erreurs`
- `GET /monatis/csv/budgets/types`
- `GET /monatis/csv/budgets/erreurs`
- `GET /monatis/csv/budgets/tables`
- `GET /monatis/csv/type/operation`

Actions admin :

- `GET /monatis/admin/sauvegarde/show`
- `GET /monatis/admin/sauvegarde`
- `GET /monatis/admin/sauvegarde/{nomSauvegarde}`
- `GET /monatis/admin/restauration/{nomFichierZip}`
- `GET /monatis/admin/vidange`
- `GET /monatis/admin/execution/{nomFichierScript}`
- `GET /monatis/admin/export/{nomTable}/{nomFichierCsv}`
- `GET /monatis/admin/import/{nomFichierCsv}/{nomTable}`

Le panneau admin déclenche ces actions depuis l'interface. Les actions de restauration, import table, exécution de script et vidange demandent une confirmation côté front ; la vidange exige aussi la saisie `VIDANGER`.

## Rapports

`ReportsPage` ne consomme pas directement les endpoints back `/monatis/rapports/*`, dont plusieurs utilisent un body sur `GET`. Les vues rapport utilisent `src/lib/reporting.ts` et les données de base chargées par les endpoints `/all`.

Les rapports représentés côté front correspondent aux endpoints back suivants :

- `/monatis/rapports/releve_compte`
- `/monatis/rapports/resumes_comptes_internes`
- `/monatis/rapports/depense_recette`
- `/monatis/rapports/plus_moins_value`
- `/monatis/rapports/remunerations_frais`
- `/monatis/rapports/bilan_patrimoine`

Le détail d'emprunt dans `/donnees?view=emprunts` couvre l'échéancier via `/monatis/emprunts/get/{cle}` et les recherches d'échéance spécialisées, pas via `/monatis/rapports/echeancier`.
