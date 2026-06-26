# Opérations et import

## Historique

`OperationsPage.tsx` affiche les opérations paginées. Le mode simple utilise `POST /monatis/operations/page`.

Quand l'utilisateur active des filtres nécessitant une logique front, la page charge toutes les pages disponibles avec une taille interne de 200, puis filtre et trie côté front.

Les filtres courants couvrent :

- recherche texte ;
- types d'opération ;
- familles et identifiants de comptes ;
- bénéficiaires ;
- plages de dates ;
- plages de montants.

## Détail et lignes

Le détail d'une opération se charge par `GET /monatis/operations/get/{numero}`.

Les lignes affichent un titre de base `Ligne 0`, `Ligne 1`, etc. Le libellé d'une ligne est éditable par l'utilisateur et n'est pas forcé à reprendre le libellé de l'opération.

La ligne principale équilibre le montant restant de l'opération. Les lignes supplémentaires peuvent être supprimées depuis leur bandeau avec l'action `Supprimer`.

## Création

La création manuelle suit un assistant par étapes puis une page de validation. Les lignes sont visibles dans la validation, sous les champs principaux. Le numéro d'opération n'est pas saisi par l'utilisateur.

## Import de relevé

`StatementImportOverlay` pilote l'import :

- lecture PDF via `src/lib/pdf-import-api.ts` ;
- suggestions de règles via `/monatis/imports-releves/regles/suggestions` ;
- détection des doublons via `/monatis/imports-releves/doublons` ;
- création, mise à jour ou suppression d'opérations ;
- apprentissage des règles via `/monatis/imports-releves/regles/apprentissage`.

La gestion directe des règles actives est disponible dans `/donnees?view=imports`. La création d'opérations depuis un CSV déjà présent côté back est disponible dans `/donnees?view=admin`.
