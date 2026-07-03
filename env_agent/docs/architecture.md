# Architecture

## Organisation `src/`

- `src/pages/` : pages routées et orchestration UI.
- `src/pages/data/` : panneaux spécialisés de `/donnees` pour budgets, emprunts, comptes techniques, évaluations, imports, typologies et administration.
- `src/pages/reports/` : composants spécialisés des rapports lorsque l'affichage dépasse la simple orchestration de `ReportsPage.tsx`.
- `src/components/` : composants réutilisables, overlays et outils de création rapide.
- `src/lib/` : clients API, formatage, reporting, helpers purs.
- `src/assets/` : ressources statiques utilisées par l'application.

## Règles de découpage

Les pages peuvent orchestrer les états locaux, les filtres et les mutations. Les règles réutilisables doivent être extraites :

- appels back dans `src/lib/monatis-api.ts` ;
- import PDF dans `src/lib/pdf-import-api.ts` ;
- création portable locale dans `src/lib/portable-builder-api.ts` ;
- calculs de rapports dans `src/lib/reporting.ts` ;
- formatage date/montant dans `src/lib/format.ts` ;
- classes conditionnelles dans `src/lib/cx.ts`.

Ne pas dupliquer une logique déjà présente dans `src/lib/`. Un nouveau comportement partagé doit être extrait avant d'être utilisé par plusieurs pages.

## Etat UI

Les pages utilisent `useState`, `useMemo`, `useEffect`, React Query et React Hook Form. Les formulaires de création/édition complexes valident leurs champs avec Zod.

Les pages routées ne doivent pas ajouter d'en-tête global redondant. Les actions principales d'un écran de liste, comme importer un relevé ou créer une nouvelle opération/référence/compte, se placent dans la première ligne du panneau de contenu concerné via `catalog-primary-actions`.

Les overlays de détail utilisent une navigation précédent/suivant quand une liste courante existe. Les actions destructives restent visibles dans le pied du cadre. Le fond flouté reste toujours sous le cadre : le scroll vertical est porté par le contenu du cadre avec une barre fine collée au bord droit, jamais par le fond d'overlay.

Le mode aide global est porté par `src/components/help-mode.tsx` et monté dans `App.tsx`. Il utilise la délégation d'événements pour lire les attributs `data-help`, puis demande une description contextuelle à `src/components/help-content.ts`.

Les textes d'aide sont découpés pour éviter un composant monolithique :

- `help-content.ts` : règles globales communes et résolution finale ;
- `help-page-rules.ts` : descriptions spécialisées par route et sous-vue ;
- `help-content-utils.ts` : types et helpers partagés.

Les règles couvrent les composants communs : navigation, boutons, champs, listes, cartes, filtres, pagination, sélecteurs et overlays. Le bouton `?` de la barre haute active ou désactive ce mode ; un clic droit le quitte aussi.

`src/components/insight.tsx` porte la présentation partagée des tableaux de bord de `/analyse` et `/donnees` : héros de synthèse, grilles de KPI, ponts financiers, tendances en courbe ou aire, barres empilées, flux, heatmaps, bulles, jauges d'exécution, entonnoirs, treemaps, anneaux, camemberts, barres et colonnes. Les graphiques standards sont rendus avec Recharts ; les vues de synthèse propres comme les ponts, flux, heatmaps, jauges, entonnoirs et treemaps réutilisent la même palette déterministe. Chaque dashboard choisit un rendu par défaut selon la question posée par l'écran : évolution temporelle, passage d'un solde à un autre, exposition par bloc, consommation d'une limite, position risque/volume, rythme d'activité ou état de complétude. Quand plusieurs lectures sont utiles, le composant affiche une colonne d'icônes de type de graphique à gauche de la visualisation et conserve la préférence dans `localStorage` par `chartId`. Les titres et sous-titres de graphiques ne sont pas affichés dans le cadre ; ils servent au libellé accessible et au texte d'aide des icônes. Les KPI ne doivent pas répéter la valeur principale ou les segments du graphique ; ils expliquent plutôt le périmètre, la qualité des données, les volumes ou les alertes. Les nouveaux écrans de synthèse doivent réutiliser ces composants au lieu de recréer des cartes de KPI, des préférences de graphique ou des visualisations locales.

`DataPage.tsx` ne contient que la navigation de domaine et la sélection du panneau. Les formulaires et mutations de chaque domaine restent dans `src/pages/data/`. Les emprunts sont découpés en panneau d'orchestration, synthèse portefeuille, liste, aperçu de détail, éditeur de condition, section d'échéances et helpers de conversion ou de synthèse.

Les budgets gardent leurs calculs d'affichage dans `src/pages/data/budget-panel-utils.ts` et leur rapprochement avec les opérations dans `src/pages/data/budget-execution.ts`. Les composants budget ne recalculent pas directement les montants réalisés, le reste ou le type réel de référence retourné par le back.

Le relevé de compte garde ses calculs financiers dans `src/lib/reporting.ts`. Le tableau de bord visuel du relevé est extrait dans `src/pages/reports/ReleveDashboard.tsx`, et la liste paginée des mouvements dans `src/pages/reports/ReleveMovementsPanel.tsx`.

Le résumé de comptes garde aussi son calcul de solde dans `src/lib/reporting.ts`. Son tableau de bord est extrait dans `src/pages/reports/ResumeDashboard.tsx`, la liste par type dans `src/pages/reports/ResumeGroupsPanel.tsx`, et les regroupements d'affichage dans `src/pages/reports/resume-report-utils.ts`.

Le rapport dépenses / recettes garde ses regroupements métier dans `src/lib/reporting.ts`. Son tableau de bord est extrait dans `src/pages/reports/DepenseRecetteDashboard.tsx`, la lecture catégories et sous-catégories dans `src/pages/reports/DepenseRecetteCategoriesPanel.tsx`, et les agrégations d'affichage dans `src/pages/reports/depense-recette-report-utils.ts`.

Le rapport plus / moins-value garde son calcul de performance dans `src/lib/reporting.ts`. Son tableau de bord est extrait dans `src/pages/reports/PlusMoinsDashboard.tsx`, la lecture par type et par compte dans `src/pages/reports/PlusMoinsGroupsPanel.tsx`, et les agrégations d'affichage dans `src/pages/reports/plus-moins-report-utils.ts`.

Le rapport rémunérations / frais garde son calcul de produits, frais et net dans `src/lib/reporting.ts`. Son tableau de bord est extrait dans `src/pages/reports/RemunerationsDashboard.tsx`, la lecture par type et par compte dans `src/pages/reports/RemunerationsGroupsPanel.tsx`, et les agrégations d'affichage dans `src/pages/reports/remunerations-report-utils.ts`.

Le rapport bilan patrimoine garde son calcul de soldes, flux techniques et écarts dans `src/lib/reporting.ts`. Son tableau de bord est extrait dans `src/pages/reports/BilanDashboard.tsx`, la lecture par type et par compte dans `src/pages/reports/BilanGroupsPanel.tsx`, et les agrégations d'affichage dans `src/pages/reports/bilan-report-utils.ts`.

Les helpers de `src/pages/reports/` ne font que préparer des libellés, compteurs, pages visuelles et montants dérivés pour l'affichage.
