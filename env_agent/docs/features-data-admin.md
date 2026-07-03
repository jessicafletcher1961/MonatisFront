# Données back et administration

`DataPage.tsx` expose les domaines du back qui ne sont pas couverts par les écrans historiques, comptes, références et rapports. La route est `/donnees`; le paramètre `view` choisit le panneau actif.

## Navigation

- `/donnees` ou `/donnees?view=budgets` : budgets.
- `/donnees?view=emprunts` : emprunts.
- `/donnees?view=techniques` : comptes techniques.
- `/donnees?view=evaluations` : évaluations.
- `/donnees?view=imports` : règles d'import de relevé.
- `/donnees?view=typologies` : typologies.
- `/donnees?view=admin` : CSV et administration.

Chaque panneau est isolé dans `src/pages/data/`. Les sous-composants des budgets et emprunts vivent aussi dans ce dossier pour éviter de concentrer les formulaires, calculs d'affichage et sections de détail dans un seul fichier.

Les synthèses de ces panneaux utilisent `src/components/insight.tsx`, comme les rapports. L'objectif est une lecture homogène mais non répétitive : valeur principale, quatre indicateurs maximum, puis une visualisation adaptée au domaine lorsque cela apporte une décision plus rapide. Les graphiques proposent plusieurs formes quand c'est utile et conservent la préférence utilisateur par emplacement. Les KPI ne répètent pas la valeur principale ; ils décrivent le périmètre, l'état, la qualité ou les volumes.

La mise en page de `/donnees` est volontairement plus verticale que les écrans de saisie rapides. `DataPage.tsx` ajoute le scope `data-workspace-stage`; `src/index.css` l'utilise pour espacer les panneaux, placer les filtres sur des lignes séparées quand le contenu est dense, et transformer les listes en lignes de décision lisibles sur plusieurs niveaux. Les actions restent visibles mais ne doivent pas forcer les métriques, badges et libellés à tenir sur une seule ligne.

## Budgets

`BudgetsPanel.tsx` couvre les budgets par bénéficiaire, par catégorie et par sous-catégorie. Il orchestre les requêtes et mutations ; `BudgetDashboard.tsx` porte la synthèse et l'explication du mode de rattachement ; `BudgetList.tsx` porte les filtres et lignes ; `BudgetForm.tsx` porte le formulaire commun de création et de modification ; `budget-panel-utils.ts` porte les libellés, filtres, statuts temporels et prévisualisations de période ; `budget-execution.ts` porte le filtrage par nature de référence et le calcul d'avancement à partir des opérations.

Un budget cible toujours une seule référence, transmise au back par `nomReference`. Les libellés de l'interface utilisent donc `Par bénéficiaire`, `Par catégorie`, `Par sous-catégorie`, puis `Bénéficiaire cible`, `Catégorie ciblée` ou `Sous-catégorie ciblée` dans le formulaire. L'écran ne présente pas ces modes comme une liste de bénéficiaires ou de catégories à définir dans le budget.

Le back retourne actuellement tous les budgets depuis chaque route `/monatis/budgets/{ressource}/all`. Le front filtre donc les résultats par forme de référence :

- bénéficiaire : référence sans `nomsSousCategories` et sans `nomCategorie` ;
- catégorie : référence avec `nomsSousCategories` ;
- sous-catégorie : référence avec `nomCategorie`.

L'écran affiche une synthèse des budgets actifs :

- entrées réalisées sur objectif d'entrées ;
- objectif de sorties et budgets actifs ;
- alertes de rythme ou dépassement sur les budgets actifs.

Le tableau de bord ajoute une jauge d'exécution des sorties : réalisé, cible, reste disponible ou dépassement. Cette visualisation peut aussi être affichée en barres détaillées ou en camembert selon la préférence locale. Le détail par budget reste dans la liste.

L'avancement est calculé côté front à partir de `/monatis/operations/all`. Seules les lignes d'opérations `RECETTE` et `DEPENSE` sont prises en compte, comme dans le rapport dépense/recette du back. Une ligne est rattachée :

- au bénéficiaire si son tableau `nomsBeneficiaires` contient le nom de la référence ;
- à la sous-catégorie si `nomSousCategorie` correspond ;
- à la catégorie si `nomSousCategorie` appartient aux `nomsSousCategories` de la catégorie.

La liste est optimisée pour la lecture répétée : chaque ligne montre le sens du budget, le titre, la référence, le statut de période, les dates, le montant prévu, le réalisé, le reste et une barre de progression. Le repère vertical dans la barre représente le rythme attendu par rapport à la date du jour dans la période. Les budgets sont regroupés en cours, à venir et passés. L'utilisateur peut :

- filtrer la liste par texte ;
- filtrer par entrées, sorties ou tous les budgets ;
- filtrer par période en cours, à venir, passée ou toutes périodes ;
- ouvrir le détail d'un budget ;
- créer un budget pour une référence ;
- modifier référence, période, type, date cible, clé technique, libellé et montant ;
- renouveler le prochain budget via l'endpoint `next/{cle}` ;
- supprimer le budget sélectionné.

La zone de filtres place les boutons `Tous`, `Entrées` et `Sorties` juste au-dessus du sélecteur de période. La barre de recherche et le sélecteur de période sont alignés sur la même ligne quand l'espace le permet. Elle ne contient pas de compteur global séparé ; les volumes visibles sont portés par les groupes `En cours`, `A venir` et `Passé`.

Le détail reprend le bandeau de navigation des autres cadres, ajoute un résumé du budget puis une zone de suivi avec réalisé, reste et rythme attendu. Les références concernées et les typologies `periode` et `budget` sont chargées depuis le back pour alimenter les sélecteurs. Le formulaire affiche une prévisualisation de la période qui sera réellement créée, car le back recadre `dateCible` selon `codeTypePeriode`.

## Emprunts

`LoansPanel.tsx` orchestre la liste, le détail, la création, la modification et la suppression d'emprunts. Un emprunt est associé à un compte interne, possède un libellé, une date de départ, une durée et une ou plusieurs conditions.

L'écran reprend une logique de suivi de prêt : `LoanDashboard.tsx` affiche la synthèse du portefeuille, les révisions, les conditions, le taux et la durée moyenne, puis une visualisation en bulles qui croise capital, taux et durée. Cette visualisation peut aussi être affichée en treemap ou en barres selon la préférence locale. `LoanList.tsx` affiche les emprunts sous forme de lignes de décision avec capital initial, taux, durée, compte et révisions. `LoanOverview.tsx` affiche dans le détail le capital remboursé, le restant dû théorique, la prochaine échéance, le coût intérêts + frais et la période d'échéancier. Les calculs de synthèse et de progression vivent dans `loan-summary-utils.ts`.

`LoanConditionEditor.tsx` édite les conditions d'emprunt : dates, taux, capital emprunté, assurance, période d'échéances, nombre d'échéances et montant fixe facultatif.

`LoanPaymentsSection.tsx` affiche les échéances calculées par le back dans le détail d'emprunt. Il met en avant le coût total de l'échéancier, permet une recherche par numéro ou par date et garde le tableau limité aux premières échéances pour préserver la lisibilité.

La liste `/monatis/emprunts/all` ne contient pas l'échéancier complet. Le suivi précis du capital remboursé et du restant dû est donc affiché uniquement après ouverture d'un emprunt, à partir de `/monatis/emprunts/get/{cle}` et des échéances détaillées renvoyées par le back.

## Comptes techniques

`TechnicalAccountsPanel.tsx` gère les comptes techniques utilisés comme contreparties des flux intrinsèques, corrections, frais, rémunérations et revalorisations. Ces comptes n'ont pas de solde propre exposé par le back ; le front calcule leur usage à partir des opérations.

- `TechnicalAccountsDashboard.tsx` consolide le nombre de comptes, les comptes utilisés, le solde net technique, les flux techniques reconnus, les flux non techniques à vérifier et une visualisation rémunérations / frais affichable en flux, barre empilée, barres ou camembert.
- `TechnicalAccountsList.tsx` affiche les comptes sous forme de lignes de suivi avec état `Utilisé`, `Dormant` ou `A vérifier`.
- Les filtres permettent de chercher dans l'identifiant, le libellé et les opérations rattachées, puis de limiter l'affichage aux comptes utilisés, dormants ou à vérifier.
- `TechnicalAccountOverview.tsx` affiche le détail d'usage : solde net technique, flux techniques, rémunérations, frais, flux récents et répartition par type d'opération.
- Un compte est marqué `A vérifier` lorsqu'il est utilisé par au moins une opération dont le type n'est pas déclaré comme `fluxTechnique` par la typologie des opérations.
- Le formulaire de création et de modification ne transmet que `identifiant` et `libelle`, conformément au DTO back.

Endpoints utilisés :

- `GET /monatis/comptes/technique/all`
- `GET /monatis/comptes/technique/get/{identifiant}`
- `POST /monatis/comptes/technique/new`
- `PUT /monatis/comptes/technique/mod/{identifiant}`
- `DELETE /monatis/comptes/technique/del/{identifiant}`
- `GET /monatis/operations/all` pour calculer les usages côté front
- `GET /monatis/operations/typologie/operation` pour distinguer les flux techniques réels

## Évaluations

`EvaluationsPanel.tsx` gère les points de valeur des comptes internes. Une évaluation sert de point d'ancrage aux calculs de solde et de patrimoine dans les rapports.

- `EvaluationDashboard.tsx` consolide les dernières évaluations par compte interne : valeur nette, actifs suivis, dettes évaluées, taux de couverture, comptes à actualiser et valeur par type de compte affichable en treemap, anneau ou barres.
- `EvaluationList.tsx` propose deux vues : dernier point par compte et historique complet. Elle filtre par recherche libre et par type de compte interne (`COURANT`, `FINANCIER`, `BIEN`).
- Chaque ligne affiche le compte, la valeur, la date et la variation par rapport au point précédent du même compte.
- `EvaluationOverview.tsx` affiche le détail d'un point : valeur, variation précédente, intervalle, écart avec le solde initial et historique récent du compte.
- La création et la modification enregistrent `identifiantCompteInterne`, `dateSolde`, `montantSoldeEnCentimes`, `libelle` et `cle`.
- Le back impose un point unique par compte interne et par date via l'index `(compte_interne_id, date_solde)`.

Endpoints utilisés :

- `GET /monatis/evaluations/all`
- `GET /monatis/evaluations/get/{cle}`
- `POST /monatis/evaluations/new`
- `PUT /monatis/evaluations/mod/{cle}`
- `DELETE /monatis/evaluations/del/{cle}`
- `POST /monatis/evaluations/selection` reste disponible dans le client API pour les écrans qui recherchent par compte, libellé, clé et date maximale.

## Règles d'import

`ImportRulesPanel.tsx` administre les règles actives apprises pendant l'import de relevés. Ces règles servent à reconnaître une ligne de relevé par clé normalisée et rôle du compte externe, puis à proposer le type d'opération, la contrepartie, la sous-catégorie et les bénéficiaires lors d'un prochain import similaire.

- `ImportRulesDashboard.tsx` synthétise le nombre de règles actives, les utilisations cumulées, les règles limitées à un compte interne, les règles sans usage ou incomplètes, puis une visualisation de qualité des règles affichable en entonnoir, anneau, barres ou treemap. Les types d'opération restent lisibles dans la liste et le détail.
- `ImportRulesList.tsx` affiche les règles sous forme de lignes lisibles avec clé normalisée, type appliqué, rôle du compte externe, compte externe, compte interne de contexte, catégorie, bénéficiaires, usages et état `Prête`, `Sans usage` ou `A compléter`.
- Les filtres permettent de chercher librement, puis de limiter l'affichage à toutes les règles, aux règles prêtes, incomplètes, jamais réutilisées ou contextuelles à un compte interne.
- `ImportRuleOverview.tsx` détaille le routage appris, la signature de reconnaissance et la complétude de la règle.
- Le bouton du détail désactive la règle active via `DELETE /monatis/imports-releves/regles/{id}`. Le back conserve l'historique mais la règle ne revient plus dans `/all`.
- La création, les suggestions et l'apprentissage des règles restent portés par l'overlay d'import de relevé, via les endpoints de suggestion et d'apprentissage.

Endpoints utilisés :

- `GET /monatis/imports-releves/regles/all`
- `DELETE /monatis/imports-releves/regles/{id}`
- `GET /monatis/operations/typologie/operation` pour afficher les libellés courts des types d'opération

## Typologies

`TypologiesPanel.tsx` affiche en lecture seule toutes les familles de typologies exposées par le back : fonctionnement, compte, opération, période, budget, programmation et référence. Le panneau orchestre uniquement le chargement et l'état de recherche ; les calculs et libellés vivent dans `typology-utils.ts`.

- `TypologyDashboard.tsx` synthétise le volume de valeurs exposées, le nombre de familles, les types d'opération, les flux techniques, la famille la plus dense et le volume par famille affichable en treemap, barres ou anneau.
- `TypologyExplorer.tsx` sert d'explorateur : recherche par code, libellé ou libellé court, sélection d'une famille, filtres par flags opération (`Flux techniques`, `Flux métier`, `Catégorisables`, `Non catégorisables`) et liste détaillée des valeurs.
- Les flags `libelleCourt`, `fluxTechnique` et `categorisable` ne sont présents que lorsque le back les renvoie, notamment sur les types d'opération.
- L'écran ne crée, modifie ni supprime aucune typologie. Ces valeurs sont des enums back, utilisées par les formulaires, les budgets, les emprunts, les imports et les rapports.

## CSV et administration

`AdminPanel.tsx` orchestre les outils bas niveau exposés par le back. L'écran est découpé pour distinguer les lectures sûres, les actions de transfert et les actions critiques.

- `AdminDashboard.tsx` affiche une synthèse : exports CSV disponibles, sauvegardes détectées, répertoire `echanges`, actions critiques, dernière action lancée dans la session et visualisation séparant consultation, transfert et actions sensibles, affichable en entonnoir, anneau ou barres.
- `AdminCsvExports.tsx` regroupe les téléchargements CSV directs pour comptes, opérations, budgets et types d'opération. Ces actions ouvrent les URLs `csvDownloadUrl` dans un nouvel onglet et ne modifient pas les données.
- `AdminBackupsPanel.tsx` permet de créer une sauvegarde dans `sauvegardes`, de voir les archives listées par le back et de préparer une restauration. La restauration demande confirmation avant appel.
- `AdminExchangePanel.tsx` couvre les actions du répertoire `echanges` : export d'une table vers CSV, import d'un CSV dans une table et création d'opérations depuis un CSV déjà présent côté back.
- `AdminDangerZone.tsx` isole l'exécution de script SQL et la vidange. L'exécution de script demande confirmation ; la vidange demande aussi de saisir `VIDANGER` avant de pouvoir déclencher l'appel.
- `AdminPortableBuilderPanel.tsx` affiche l'état du microservice `Micro_Service_make_exe`, vérifie la présence d'un JDK complet et permet de créer une image portable Windows. Le build se fait d'abord dans le dossier de travail du microservice ; l'utilisateur peut ensuite choisir un dossier d'export, copier l'image vers ce dossier ou télécharger un ZIP. La case `Inclure la base actuelle` copie le dossier `data` du back dans le portable seulement si le back local est arrêté. Cette section ne consomme pas le back métier et ne modifie pas ses sources.

Le back expose ces commandes en `GET`; le front ne change pas ce contrat et compense par des libellés explicites, un regroupement par niveau de risque et des confirmations côté interface.
