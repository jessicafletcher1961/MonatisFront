# Architecture

## Organisation `src/`

- `src/pages/` : pages routées et orchestration UI.
- `src/pages/data/` : panneaux spécialisés de `/donnees` pour budgets, emprunts, comptes techniques, évaluations, imports, typologies et administration.
- `src/components/` : composants réutilisables, overlays et outils de création rapide.
- `src/lib/` : clients API, formatage, reporting, helpers purs.
- `src/assets/` : ressources statiques utilisées par l'application.

## Règles de découpage

Les pages peuvent orchestrer les états locaux, les filtres et les mutations. Les règles réutilisables doivent être extraites :

- appels back dans `src/lib/monatis-api.ts` ;
- import PDF dans `src/lib/pdf-import-api.ts` ;
- calculs de rapports dans `src/lib/reporting.ts` ;
- formatage date/montant dans `src/lib/format.ts` ;
- classes conditionnelles dans `src/lib/cx.ts`.

Ne pas dupliquer une logique déjà présente dans `src/lib/`. Un nouveau comportement partagé doit être extrait avant d'être utilisé par plusieurs pages.

## Etat UI

Les pages utilisent `useState`, `useMemo`, `useEffect`, React Query et React Hook Form. Les formulaires de création/édition complexes valident leurs champs avec Zod.

Les overlays de détail utilisent une navigation précédent/suivant quand une liste courante existe. Les actions destructives restent visibles dans le pied du cadre. Le fond flouté reste toujours sous le cadre : le scroll vertical est porté par le contenu du cadre avec une barre fine collée au bord droit, jamais par le fond d'overlay.

Le mode aide global est porté par `src/components/help-mode.tsx` et monté dans `App.tsx`. Il utilise la délégation d'événements pour lire les attributs `data-help`, puis demande une description contextuelle à `src/components/help-content.ts`.

Les textes d'aide sont découpés pour éviter un composant monolithique :

- `help-content.ts` : règles globales communes et résolution finale ;
- `help-page-rules.ts` : descriptions spécialisées par route et sous-vue ;
- `help-content-utils.ts` : types et helpers partagés.

Les règles couvrent les composants communs : navigation, boutons, champs, listes, cartes, filtres, pagination, sélecteurs et overlays. Le bouton `?` de la barre haute active ou désactive ce mode ; un clic droit le quitte aussi.

`DataPage.tsx` ne contient que la navigation de domaine et la sélection du panneau. Les formulaires et mutations de chaque domaine restent dans `src/pages/data/`. Les emprunts sont découpés en panneau d'orchestration, synthèse portefeuille, liste, aperçu de détail, éditeur de condition, section d'échéances et helpers de conversion ou de synthèse.

Les budgets gardent leurs calculs d'affichage dans `src/pages/data/budget-panel-utils.ts` et leur rapprochement avec les opérations dans `src/pages/data/budget-execution.ts`. Les composants budget ne recalculent pas directement les montants réalisés, le reste ou le type réel de référence retourné par le back.
