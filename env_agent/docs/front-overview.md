# Vue d'ensemble du front

Le front MONATIS est une application React mono-page servie par Vite. Elle pilote la gestion des opérations, comptes, références, rapports et imports de relevés via le back MONATIS et un microservice PDF local.

## Routes principales

- `/` : tableau de bord synthétique.
- `/operations` : historique, filtres, création manuelle, détail et édition d'opérations.
- `/operations?view=comptes&account=internes` : comptes internes.
- `/operations?view=comptes&account=externes` : comptes externes.
- `/references?view=banque` : banques.
- `/references?view=titulaire` : titulaires.
- `/references?view=beneficiaire` : bénéficiaires.
- `/references?view=categorie` : catégories.
- `/references?view=souscategorie` : sous-catégories.
- `/donnees` : budgets.
- `/donnees?view=emprunts` : emprunts et échéances calculées.
- `/donnees?view=techniques` : comptes techniques.
- `/donnees?view=evaluations` : évaluations.
- `/donnees?view=imports` : règles d'import de relevé.
- `/donnees?view=typologies` : typologies exposées par le back.
- `/donnees?view=admin` : CSV, sauvegardes, restauration et actions admin.
- `/analyse` : relevé de compte, résumés, dépenses/recettes, plus/moins-value, rémunérations/frais et bilan patrimoine.

## Données affichées

Les écrans utilisent React Query pour charger et invalider les données. Les mutations passent par `src/lib/monatis-api.ts`, puis invalident les query keys concernées.

Les rapports sont calculés côté front à partir des opérations, comptes, références et évaluations chargés depuis les endpoints de base.

Le tableau de bord charge aussi les comptes techniques, emprunts et évaluations pour signaler la couverture du back enrichi.

## Mode aide

La barre de navigation contient un bouton `?` placé juste avant le bouton clair/sombre. Il active le mode aide global.

Quand le mode aide est actif :

- une indication fixe apparaît en haut et au centre de l'écran ;
- le survol d'un élément pertinent affiche une infobulle expliquant son rôle ;
- les aides explicites viennent d'attributs `data-help` quand l'élément en possède ;
- les descriptions contextuelles couvrent les routes principales page par page : tableau de bord, opérations, comptes, références, données back et analyse ;
- les règles spécialisées décrivent les zones métier comme les lignes comptables d'opération, les comptes internes/externes, les référentiels, les budgets, emprunts, typologies, actions admin et rapports ;
- les composants communs couvrent aussi les champs, boutons, sélecteurs, filtres, lignes de liste, cartes de synthèse, panneaux de détail, pagination et états de chargement ou d'erreur ;
- un clic droit ou un nouveau clic sur le bouton `?` quitte le mode aide.
