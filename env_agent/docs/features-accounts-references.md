# Comptes et références

## Comptes internes

`InternalAccountsPage.tsx` gère la liste, le détail, la création, la modification et la suppression des comptes internes.

La pagination affichée est calculée côté front depuis `/monatis/comptes/interne/all`, car le back actif n'expose pas `/page` pour cette ressource.

La page charge aussi :

- les types de fonctionnement ;
- les banques ;
- les titulaires ;
- les évaluations ;
- les opérations, pour les informations de synthèse.

## Comptes externes

`ExternalAccountsPage.tsx` gère les comptes externes. La pagination affichée est calculée côté front depuis `/monatis/comptes/externe/all`.

## Comptes techniques

Les comptes techniques sont utilisés dans les opérations et rapports. La création rapide passe par `QuickAccountOverlay`, puis l'application invalide les listes concernées.

Le CRUD complet des comptes techniques est disponible dans `/donnees?view=techniques` via `TechnicalAccountsPanel.tsx`.

## Références

`ReferencePage.tsx` couvre banques, titulaires, bénéficiaires, catégories et sous-catégories.

La pagination affichée est calculée côté front depuis `/all`. Les sous-catégories chargent aussi les catégories pour associer chaque sous-catégorie à sa catégorie par nom.

`QuickReferenceOverlay` permet de créer rapidement des références depuis les écrans qui en dépendent.

## Évaluations

Les évaluations sont chargées par les rapports et le tableau de bord. Le CRUD complet est disponible dans `/donnees?view=evaluations` via `EvaluationsPanel.tsx`.
