# MONATIS V1 - Base de travail front

## Objet du document

Ce document reprend la V1 fonctionnelle de MONATIS et la transforme en base de travail exploitable pour construire un front propre.

L'objectif n'est pas de remplacer une vraie spec API, mais de rassembler dans un seul endroit :

- ce que la V1 doit faire ;
- ce que le back expose deja ;
- les conventions transverses utiles au front ;
- une proposition de decoupage en ecrans et parcours ;
- les points de vigilance connus.

## Sources utilisees

- `src/main/resources/documentation/Version 1.0.odt`
- `src/main/resources/documentation/Interface - Banque.odt`
- `src/main/resources/documentation/Interface - Rapports.odt`
- les controllers et DTO du back dans `MonatisBack-main/src/main/java/...`

## Cadre technique observe dans le code

### Backend

- Application Spring Boot sur le port `8082`
- Base H2 fichier local par defaut
- Pas de mecanisme d'authentification visible dans le depot
- CORS autorise `http://localhost:5173`

### Conventions de donnees

- Les dates sont des `LocalDate`, donc au format ISO `YYYY-MM-DD`
- Les montants des formulaires CRUD sont majoritairement en centimes (`Long`)
- Les montants de rapports sont majoritairement renvoyes en euros (`Double` ou `double`)
- Les erreurs sont renvoyees sous une forme structuree

### Format d'erreur renvoye par le back

Le handler global renvoie un objet avec la structure suivante :

```json
{
  "typeErreur": "CONTROLE|FONCTIONNELLE|...",
  "typeDomaine": "libelle domaine",
  "code": "CODE_ERREUR",
  "libelle": "message lisible",
  "cause": {
    "typeErreur": "...",
    "typeDomaine": "...",
    "code": "...",
    "libelle": "..."
  }
}
```

En pratique :

- les erreurs de controle et fonctionnelles sortent en `400`
- les erreurs techniques sortent en `500`

## Perimetre V1

### Dans le perimetre

- Gestion des banques
- Gestion des titulaires
- Gestion des beneficiaires
- Gestion des categories
- Gestion des sous-categories
- Gestion des comptes externes
- Gestion des comptes internes
- Gestion des evaluations de comptes internes
- Gestion des operations
- Rapports :
  - releve de compte
  - resumes de comptes internes
  - etat depense / recette
  - etat remunerations / frais
  - etat bilan patrimoine

### Hors perimetre V1

Les elements suivants sont cites comme ulterieurs dans la doc et ne doivent pas etre consideres comme V1 stabilisee du front :

- exports/imports CSV utilisateur
- import de releves bancaires CSV
- operations recurrentes
- budgets termines
- historisation / archivage
- modifications de masse d'operations
- cessions et plus / moins values realisees finalisees
- pointage complet
- operations complexes precomposees
- generation generique PDF / CSV pour tous les rapports

## Vision front proposee

### Navigation de niveau 1

Pour un front simple et propre, la V1 peut etre structuree autour des rubriques suivantes :

1. `References`
2. `Comptes`
3. `Operations`
4. `Rapports`

### Ecrans minimums proposes

- `References / Banques`
- `References / Titulaires`
- `References / Beneficiaires`
- `References / Categories`
- `References / Sous-categories`
- `Comptes / Externes`
- `Comptes / Internes`
- `Comptes / Internes / Detail`
- `Comptes / Internes / Evaluations`
- `Operations / Liste`
- `Operations / Nouvelle operation`
- `Operations / Detail / Edition`
- `Rapports / Releve de compte`
- `Rapports / Resumes comptes internes`
- `Rapports / Depenses et recettes`
- `Rapports / Remunerations et frais`
- `Rapports / Bilan patrimoine`

## Modele fonctionnel resume

### References

- `Banque` : reference rattachee a des comptes internes
- `Titulaire` : reference rattachee a des comptes internes
- `Beneficiaire` : reference rattachee aux lignes d'operations de type depense / recette
- `Categorie` : contient 0 a n sous-categories
- `SousCategorie` : appartient obligatoirement a une categorie

### Comptes

- `CompteInterne` : compte du foyer
- `CompteExterne` : compte hors foyer
- `CompteTechnique` : existe dans le back mais n'est pas un sujet de gestion utilisateur V1 ; il sert de contrepartie technique

### Finance

- `Evaluation` : photo de valeur d'un compte interne a une date
- `Operation` : mouvement principal, avec lignes de detail

### Rapports

- Certains rapports sont hierarchiques et renvoient des tableaux imbriques
- Les rapports ne ressemblent pas a de simples listes CRUD ; le front devra prevoir des composants de tableau plus riches

## Typologies utiles au front

### Types de compte

- `INTERNE`
- `EXTERNE`
- `TECHNIQUE`

### Types de fonctionnement des comptes internes

- `COURANT`
- `FINANCIER`
- `BIEN`

Le back expose aussi un endpoint pour recuperer cette typologie.

### Types d'operation exposes par le back

Le back expose pour chaque type :

- `name`
- `code`
- `libelleCourt`
- `libelle`

Types observes dans le code :

- `TRANSFERT`
- `RECETTE`
- `DEPENSE`
- `DEPOT`
- `INVEST` pour investissement
- `RETRAIT`
- `LIQUID` pour liquidation
- `VENTE`
- `ACHAT`
- `COURANT+`
- `COURANT-`
- `FINANCIER+`
- `FINANCIER-`
- `BIEN+`
- `BIEN-`

### Types de periode utiles aux rapports

Le back manipule les codes suivants :

- `ANNEE`
- `SEMESTRE`
- `TRIMESTRE`
- `BIMESTRE`
- `MOIS`
- `TECHNIQUE`

Pour la V1 front, `TECHNIQUE` ne doit normalement pas etre propose comme choix utilisateur standard pour les rapports fonctionnels.

## Conventions UI recommandees

- Pas de pagination back visible sur les CRUD V1
- Pour la V1, charger les listes puis filtrer / chercher cote client est acceptable
- Prevoir des confirmations explicites avant suppression
- Prevoir les etats :
  - chargement
  - vide
  - erreur
  - succes
- Afficher les montants utilisateurs en euros formates, meme si l'API CRUD travaille en centimes
- Centraliser tres tot :
  - `formatDate`
  - `formatMoney`
  - `moneyEuroToCentimes`
  - `moneyCentimesToEuro`
  - `mapApiError`

## Domaine par domaine

### 1. Banques

#### Ce que la V1 doit permettre

- Afficher la liste des banques
- Creer une banque
- Modifier une banque
- Supprimer une banque

#### Donnees metier utiles

- `nom` : identifiant fonctionnel, obligatoire
- `libelle` : facultatif

#### Lien metier

- Une banque peut etre rattachee a plusieurs comptes internes

#### Endpoints

- `GET /monatis/references/banque/all`
- `GET /monatis/references/banque/get/{nom}`
- `POST /monatis/references/banque/new`
- `PUT /monatis/references/banque/mod/{nom}`
- `DELETE /monatis/references/banque/del/{nom}`

#### Contrats utiles au front

Request create / update :

```json
{
  "nom": "String",
  "libelle": "String"
}
```

Liste :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "identifiantsComptesInternes": ["String"]
}
```

Detail :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "comptesInternes": [
    {
      "identifiant": "String",
      "libelle": "String|null",
      "typeFonctionnement": {
        "code": "String",
        "libelle": "String"
      },
      "dateSoldeInitial": "YYYY-MM-DD",
      "montantSoldeInitialEnCentimes": 0,
      "banque": {
        "nom": "String",
        "libelle": "String|null"
      },
      "titulaires": [
        {
          "nom": "String",
          "libelle": "String|null"
        }
      ]
    }
  ]
}
```

#### Proposition front

- Ecran liste avec tableau
- Formulaire creation / edition en panneau lateral ou modal
- Dans le detail, afficher les comptes internes lies

### 2. Titulaires

#### Ce que la V1 doit permettre

- Afficher la liste des titulaires
- Creer un titulaire
- Modifier un titulaire
- Supprimer un titulaire

#### Donnees metier

- `nom`
- `libelle`

#### Lien metier

- Un titulaire peut etre associe a plusieurs comptes internes

#### Endpoints

- `GET /monatis/references/titulaire/all`
- `GET /monatis/references/titulaire/get/{nom}`
- `POST /monatis/references/titulaire/new`
- `PUT /monatis/references/titulaire/mod/{nom}`
- `DELETE /monatis/references/titulaire/del/{nom}`

#### Reponses observees

Liste :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "identifiantsComptesInternes": ["String"]
}
```

Detail / simple :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "comptesInternes": [
    {
      "identifiant": "String",
      "libelle": "String|null"
    }
  ]
}
```

#### Proposition front

- Meme UX que banques
- Multi-selection de titulaires dans le formulaire compte interne

### 3. Beneficiaires

#### Ce que la V1 doit permettre

- Afficher la liste des beneficiaires
- Creer un beneficiaire
- Modifier un beneficiaire
- Supprimer un beneficiaire

#### Donnees metier

- `nom`
- `libelle`

#### Endpoints

- `GET /monatis/references/beneficiaire/all`
- `GET /monatis/references/beneficiaire/get/{nom}`
- `POST /monatis/references/beneficiaire/new`
- `PUT /monatis/references/beneficiaire/mod/{nom}`
- `DELETE /monatis/references/beneficiaire/del/{nom}`

#### Reponses observees

Les DTO observes pour beneficiaire restent simples :

```json
{
  "nom": "String",
  "libelle": "String|null"
}
```

#### Proposition front

- Table CRUD simple
- Select multivaleur reutilisable dans la creation / modification d'operations

### 4. Categories

#### Ce que la V1 doit permettre

- Afficher la liste des categories
- Creer une categorie
- Modifier une categorie
- Afficher les sous-categories d'une categorie
- Supprimer une categorie

#### Donnees metier

- `nom`
- `libelle`

#### Relation

- Une categorie contient 0 a n sous-categories

#### Endpoints

- `GET /monatis/references/categorie/all`
- `GET /monatis/references/categorie/get/{nom}`
- `POST /monatis/references/categorie/new`
- `PUT /monatis/references/categorie/mod/{nom}`
- `DELETE /monatis/references/categorie/del/{nom}`

#### Reponses observees

Liste :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "nomsSousCategories": ["String"]
}
```

Detail / simple :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "sousCategories": [
    {
      "nom": "String",
      "libelle": "String|null"
    }
  ]
}
```

#### Proposition front

- Vue maitre / detail tres adaptee
- Ligne categorie expandable pour afficher ses sous-categories

### 5. Sous-categories

#### Ce que la V1 doit permettre

- Afficher la liste des sous-categories
- Creer une sous-categorie
- Modifier une sous-categorie
- Changer sa categorie de rattachement
- Supprimer une sous-categorie

#### Donnees metier

- `nom`
- `libelle`
- `nomCategorie` a l'ecriture

#### Endpoints

- `GET /monatis/references/souscategorie/all`
- `GET /monatis/references/souscategorie/get/{nom}`
- `POST /monatis/references/souscategorie/new`
- `PUT /monatis/references/souscategorie/mod/{nom}`
- `DELETE /monatis/references/souscategorie/del/{nom}`

#### Reponses observees

Liste :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "nomCategorie": "String"
}
```

Detail / simple :

```json
{
  "nom": "String",
  "libelle": "String|null",
  "categorie": {
    "nom": "String",
    "libelle": "String|null"
  }
}
```

#### Proposition front

- Table CRUD simple
- Select categorie obligatoire dans le formulaire

### 6. Comptes externes

#### Ce que la V1 doit permettre

- Afficher la liste des comptes externes
- Creer un compte externe
- Modifier un compte externe
- Supprimer un compte externe

#### Donnees metier

- `identifiant` obligatoire
- `libelle` facultatif

#### Endpoints

- `GET /monatis/comptes/externe/all`
- `GET /monatis/comptes/externe/get/{identifiant}`
- `POST /monatis/comptes/externe/new`
- `PUT /monatis/comptes/externe/mod/{identifiant}`
- `DELETE /monatis/comptes/externe/del/{identifiant}`

#### Reponses observees

Les DTO comptes externes observes n'ajoutent pas d'autres champs que :

```json
{
  "identifiant": "String",
  "libelle": "String|null"
}
```

#### Proposition front

- Table CRUD simple
- Reutilisation dans les parcours d'operations

### 7. Comptes internes

#### Ce que la V1 doit permettre

- Afficher tous les comptes internes
- Filtrer par type de fonctionnement
- Creer un compte interne
- Modifier un compte interne
- Definir une date de cloture
- Supprimer un compte interne
- Acceder a ses evaluations

#### Donnees d'ecriture

```json
{
  "identifiant": "String",
  "libelle": "String|null",
  "dateCloture": "YYYY-MM-DD|null",
  "codeTypeFonctionnement": "COURANT|FINANCIER|BIEN",
  "dateSoldeInitial": "YYYY-MM-DD",
  "montantSoldeInitialEnCentimes": 0,
  "nomBanque": "String|null",
  "nomsTitulaires": ["String"]
}
```

#### Donnees de lecture

Version basique :

```json
{
  "identifiant": "String",
  "libelle": "String|null",
  "dateCloture": "YYYY-MM-DD|null",
  "codeTypeFonctionnement": "String",
  "dateSoldeInitial": "YYYY-MM-DD",
  "montantSoldeInitialEnCentimes": 0,
  "nomBanque": "String|null",
  "nomsTitulaires": ["String"]
}
```

Version detail / simple :

```json
{
  "identifiant": "String",
  "libelle": "String|null",
  "dateCloture": "YYYY-MM-DD|null",
  "typeFonctionnement": {
    "code": "String",
    "libelle": "String"
  },
  "dateSoldeInitial": "YYYY-MM-DD",
  "montantSoldeInitialEnCentimes": 0,
  "banque": {
    "nom": "String",
    "libelle": "String|null"
  },
  "titulaires": [
    {
      "nom": "String",
      "libelle": "String|null"
    }
  ]
}
```

#### Endpoints

- `GET /monatis/comptes/interne/all`
- `GET /monatis/comptes/interne/get/{identifiant}`
- `POST /monatis/comptes/interne/new`
- `PUT /monatis/comptes/interne/mod/{identifiant}`
- `DELETE /monatis/comptes/interne/del/{identifiant}`
- `GET /monatis/comptes/interne/fonctionnement/{codeTypeFonctionnement}`
- `GET /monatis/comptes/interne/typologie/fonctionnement`

#### Proposition front

- Liste avec filtre par type de fonctionnement
- Formulaire riche :
  - identifiant
  - libelle
  - type
  - date solde initial
  - montant initial
  - banque
  - titulaires
  - date cloture
- Ecran detail avec bloc evaluations et bloc operations recentes

### 8. Evaluations

#### Ce que la V1 doit permettre

- Afficher toutes les evaluations
- Afficher les evaluations d'un compte interne donne
- Creer une evaluation
- Modifier une evaluation
- Supprimer une evaluation

#### Donnees d'ecriture

Creation :

```json
{
  "cle": "String|null",
  "identifiantCompteInterne": "String",
  "dateSolde": "YYYY-MM-DD|null",
  "libelle": "String|null",
  "montantSoldeEnCentimes": 0
}
```

Modification :

```json
{
  "cle": "String|null",
  "identifiantCompteInterne": "String|null",
  "dateSolde": "YYYY-MM-DD|null",
  "libelle": "String|null",
  "montantSoldeEnCentimes": 0
}
```

Selection par compte :

```json
{
  "identifiantCompteInterne": "String"
}
```

#### Donnees de lecture

Tronc commun :

```json
{
  "cle": "String",
  "dateSolde": "YYYY-MM-DD",
  "montantSoldeEnCentimes": 0,
  "libelle": "String|null"
}
```

Version basique :

```json
{
  "cle": "String",
  "dateSolde": "YYYY-MM-DD",
  "montantSoldeEnCentimes": 0,
  "libelle": "String|null",
  "identifiantCompteInterne": "String"
}
```

Version detail / simple :

```json
{
  "cle": "String",
  "dateSolde": "YYYY-MM-DD",
  "montantSoldeEnCentimes": 0,
  "libelle": "String|null",
  "compteInterne": {
    "identifiant": "String",
    "libelle": "String|null"
  }
}
```

#### Endpoints

- `GET /monatis/evaluations/all`
- `GET /monatis/evaluations/get/{cle}`
- `POST /monatis/evaluations/new`
- `PUT /monatis/evaluations/mod/{cle}`
- `DELETE /monatis/evaluations/del/{cle}`
- `GET /monatis/evaluations/selection/toutes_par_compte`

#### Proposition front

- Sous-tableau dans la page detail d'un compte interne
- Eventuellement page dediee si le volume devient important

### 9. Operations

#### Ce que la V1 doit permettre

- Afficher la liste des operations
- Afficher une operation
- Creer une operation isolee
- Modifier une operation
- Supprimer une operation
- Afficher les dernieres operations d'un compte
- Recuperer les types d'operations
- Calculer les compatibilites comptes / types pour guider le formulaire
- Saisir des lignes de detail lors de la modification

#### Donnees d'ecriture pour creation

```json
{
  "numero": "String|null",
  "libelle": "String|null",
  "codeTypeOperation": "String",
  "dateValeur": "YYYY-MM-DD|null",
  "montantEnCentimes": 0,
  "identifiantCompteDepense": "String",
  "identifiantCompteRecette": "String",
  "nomSousCategorie": "String|null",
  "nomsBeneficiaires": ["String"]
}
```

#### Donnees d'ecriture pour modification

```json
{
  "numero": "String|null",
  "libelle": "String|null",
  "codeTypeOperation": "String|null",
  "dateValeur": "YYYY-MM-DD|null",
  "montantEnCentimes": 0,
  "identifiantCompteDepense": "String|null",
  "identifiantCompteRecette": "String|null",
  "pointee": true,
  "lignes": [
    {
      "numeroLigne": 0,
      "libelle": "String|null",
      "dateComptabilisation": "YYYY-MM-DD|null",
      "montantEnCentimes": 0,
      "nomSousCategorie": "String|null",
      "nomsBeneficiaires": ["String"]
    }
  ]
}
```

#### Donnees de lecture

Tronc commun :

```json
{
  "numero": "String",
  "libelle": "String|null",
  "dateValeur": "YYYY-MM-DD",
  "montantEnCentimes": 0,
  "pointee": false
}
```

Version basique :

```json
{
  "numero": "String",
  "libelle": "String|null",
  "dateValeur": "YYYY-MM-DD",
  "montantEnCentimes": 0,
  "pointee": false,
  "codeTypeOperation": "String",
  "identifiantCompteDepense": "String",
  "identifiantCompteRecette": "String",
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "YYYY-MM-DD",
      "montantEnCentimes": 0,
      "libelle": "String|null",
      "nomSousCategorie": "String|null",
      "nomsBeneficiaires": ["String"]
    }
  ]
}
```

Version detail / simple :

```json
{
  "numero": "String",
  "libelle": "String|null",
  "dateValeur": "YYYY-MM-DD",
  "montantEnCentimes": 0,
  "pointee": false,
  "typeOperation": {
    "name": "String",
    "code": "String",
    "libelleCourt": "String",
    "libelle": "String"
  },
  "compteRecette": {
    "identifiant": "String",
    "libelle": "String|null"
  },
  "compteDepense": {
    "identifiant": "String",
    "libelle": "String|null"
  },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "YYYY-MM-DD",
      "montantEnCentimes": 0,
      "libelle": "String|null",
      "sousCategorie": {
        "nom": "String",
        "libelle": "String|null"
      },
      "beneficiaires": [
        {
          "nom": "String",
          "libelle": "String|null"
        }
      ]
    }
  ]
}
```

#### Endpoints CRUD et outils

- `GET /monatis/operations/all`
- `GET /monatis/operations/get/{numero}`
- `POST /monatis/operations/new`
- `PUT /monatis/operations/mod/{numero}`
- `DELETE /monatis/operations/del/{numero}`
- `GET /monatis/operations/typologie/operation`
- `GET /monatis/operations/selection/dernieres_par_compte`
- `GET /monatis/operations/compatibilite/comptes/{codeTypeOperationChoisi}`
- `GET /monatis/operations/compatibilite/typesoperations/{identifiantCompteChoisi}`
- `GET /monatis/operations/compatibilite/comptes/depense/{codeTypeOperationChoisi}/{identifiantCompteChoisiRecette}`
- `GET /monatis/operations/compatibilite/comptes/recette/{codeTypeOperationChoisi}/{identifiantCompteChoisiDepense}`

#### Compatibilites renvoyees

Le DTO de compatibilite peut contenir :

```json
{
  "comptesCompatiblesDepense": [{ "identifiant": "String" }],
  "comptesCompatiblesRecette": [{ "identifiant": "String" }],
  "typesOperationsCompatiblesDepense": [{ "code": "String" }],
  "typesOperationsCompatiblesRecette": [{ "code": "String" }]
}
```

Notes observees dans le code :

- une des listes peut etre `null`
- quand elle est `null`, la doc V1 dit que la drop-list correspondante ne doit pas apparaitre
- a la creation, le back cree automatiquement une premiere ligne de detail a partir des champs principaux

#### Proposition front

- Un ecran liste d'operations
- Un wizard ou formulaire guide pour la creation
- Un ecran detail / edition pour la modification et les lignes
- Un composant "dernieres operations du compte selectionne"

### 10. Rapports

## 10.1 Releve de compte

#### But

Afficher toutes les operations d'un compte entre deux dates incluses.

#### Request

```json
{
  "identifiantCompte": "String",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD|null"
}
```

#### Response

```json
{
  "enteteCompte": {},
  "dateDebutReleve": "YYYY-MM-DD",
  "dateFinReleve": "YYYY-MM-DD",
  "montantSoldeDebutReleveEnEuros": 0.0,
  "montantSoldeFinReleveEnEuros": 0.0,
  "montantTotalOperationsRecetteEnEuros": 0.0,
  "montantTotalOperationsDepenseEnEuros": 0.0,
  "montantEcartEnEuros": 0.0,
  "operationsRecette": [
    {
      "numero": "String",
      "codeTypeOperation": "String",
      "dateValeur": "YYYY-MM-DD",
      "libelle": "String|null",
      "montantEnEuros": 0.0,
      "identifiantAutreCompte": "String",
      "libelleAutreCompte": "String|null",
      "codeTypeAutreCompte": "String"
    }
  ],
  "operationsDepense": []
}
```

#### Endpoints

- `GET /monatis/rapports/releve_compte`
- `GET /monatis/rapports/releve_compte/pdf`

#### Proposition front

- Formulaire de filtre
- Affichage entete + resume chiffres + 2 listes recette / depense
- Bouton export PDF pour ce rapport uniquement

## 10.2 Resumes comptes internes

#### But

Afficher le solde d'un ou plusieurs comptes internes a une date cible, avec filtre eventuel sur le type de fonctionnement.

#### Request

```json
{
  "identifiantsComptesInternes": ["String"],
  "codeTypeFonctionnement": "String|null",
  "dateSolde": "YYYY-MM-DD|null"
}
```

#### Response

```json
{
  "compteInterne": {},
  "dateSolde": "YYYY-MM-DD",
  "montantSoldeEnEuros": 0.0
}
```

#### Endpoint

- `GET /monatis/rapports/resumes_comptes_internes`

#### Proposition front

- Table simple
- Filtres en haut de page

## 10.3 Etat depense / recette

#### But

Cumuls des operations de depense et de recette, detailles par categorie puis sous-categorie.

#### Request

```json
{
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD|null",
  "codeTypePeriode": "String|null",
  "nomsSousCategories": ["String"],
  "nomsCategories": ["String"],
  "nomBeneficiaire": "String|null"
}
```

#### Response de haut niveau

```json
{
  "dateDebutEtat": "YYYY-MM-DD",
  "dateFinEtat": "YYYY-MM-DD",
  "typePeriode": {
    "code": "String",
    "libelle": "String"
  },
  "sousCategories": [{ "nom": "String", "libelle": "String|null" }],
  "categories": [{ "nom": "String", "libelle": "String|null" }],
  "beneficiaire": { "nom": "String", "libelle": "String|null" },
  "lignesCategorie": [
    {
      "categorie": { "nom": "String", "libelle": "String|null" },
      "lignesSousCategorie": [
        {
          "sousCategorie": { "nom": "String", "libelle": "String|null" },
          "periodes": [
            {
              "dateDebutPeriode": "YYYY-MM-DD",
              "dateFinPeriode": "YYYY-MM-DD",
              "montantRecetteEnEuros": 0.0,
              "montantDepenseEnEuros": 0.0,
              "soldeDepenseRecetteEnEuros": 0.0
            }
          ]
        }
      ],
      "cumuls": []
    }
  ],
  "cumuls": []
}
```

#### Endpoint

- `GET /monatis/rapports/depense_recette`

#### Proposition front

- Tableau croise avec colonnes de periodes
- Groupement categorie > sous-categorie

## 10.4 Etat remunerations / frais

#### But

Cumuls des remunerations et frais des comptes internes, detailles par type de fonctionnement puis compte.

#### Request

```json
{
  "identifiantsComptesInternes": ["String"],
  "codesTypesFonctionnements": ["String"],
  "nomTitulaire": "String|null",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD|null",
  "codeTypePeriode": "String|null"
}
```

#### Response de haut niveau

```json
{
  "dateDebutEtat": "YYYY-MM-DD",
  "dateFinEtat": "YYYY-MM-DD",
  "typePeriode": {
    "code": "String",
    "libelle": "String"
  },
  "comptesInternes": [],
  "typesFonctionnements": [],
  "titulaire": {
    "nom": "String",
    "libelle": "String|null"
  },
  "lignesTypeFonctionnement": [
    {
      "typeFonctionnement": {
        "code": "String",
        "libelle": "String"
      },
      "lignesCompteInterne": [
        {
          "compteInterne": {},
          "periodes": [
            {
              "dateDebutPeriode": "YYYY-MM-DD",
              "dateFinPeriode": "YYYY-MM-DD",
              "montantRemunerationsEnEuros": 0.0,
              "montantFraisEnEuros": 0.0,
              "soldeRemunerationsFraisEnEuros": 0.0
            }
          ]
        }
      ],
      "cumulsPeriodes": []
    }
  ],
  "cumuls": []
}
```

#### Endpoint

- `GET /monatis/rapports/remunerations_frais`

#### Proposition front

- Tableau groupe par type de fonctionnement
- Sous-lignes par compte interne

## 10.5 Etat bilan patrimoine

#### But

Afficher les soldes des comptes internes, detailles par type de fonctionnement puis compte.

#### Request

```json
{
  "identifiantsComptesInternes": ["String"],
  "codesTypesFonctionnements": ["String"],
  "nomTitulaire": "String|null",
  "dateDebut": "YYYY-MM-DD",
  "dateFin": "YYYY-MM-DD|null",
  "codeTypePeriode": "String|null"
}
```

#### Response de haut niveau

```json
{
  "dateDebutEtat": "YYYY-MM-DD",
  "dateFinEtat": "YYYY-MM-DD",
  "typePeriode": {
    "code": "String",
    "libelle": "String"
  },
  "comptesInternes": [],
  "typesFonctionnements": [],
  "titulaire": {
    "nom": "String",
    "libelle": "String|null"
  },
  "lignesTypeFonctionnement": [
    {
      "typeFonctionnement": {
        "code": "String",
        "libelle": "String"
      },
      "lignesCompteInterne": [
        {
          "compteInterne": {},
          "montantSoldeInitialEnEuros": 0.0,
          "periodes": [
            {
              "dateDebutPeriode": "YYYY-MM-DD",
              "dateFinPeriode": "YYYY-MM-DD",
              "montantSoldeInitialEnEuros": 0.0,
              "montantSoldeFinalEnEuros": 0.0,
              "montantTotalRecetteEnEuros": 0.0,
              "montantTotalDepenseEnEuros": 0.0,
              "soldeTotalTechniqueEnEuros": 0.0,
              "montantEcartNonJustifieEnEuros": 0.0
            }
          ]
        }
      ],
      "montantSoldeInitialEnEuros": 0.0,
      "cumulsPeriodes": []
    }
  ],
  "montantSoldeInitialEnEuros": 0.0,
  "cumuls": []
}
```

#### Endpoint

- `GET /monatis/rapports/bilan_patrimoine`

#### Proposition front

- Tableau groupe
- Bon candidat pour un affichage "accordeon + colonnes de periodes"

## Points de vigilance deja connus

- Plusieurs endpoints de selection / rapport sont definis en `GET` avec body ; c'est non standard pour un front web
- Les conventions "champ obligatoire ou facultatif" ne sont pas toujours alignees entre la doc V1 et le code
- Les montants CRUD et rapports ne sont pas dans la meme unite
- Les listes de compatibilite d'operations peuvent etre `null`
- Le back expose des comptes techniques qui ont un impact metier sur les operations mais qui ne sont pas documentes en detail dans la V1 fonctionnelle

## Strategie de construction front recommandee

### Ordre de build recommande

1. References
2. Comptes externes
3. Comptes internes
4. Evaluations
5. Operations
6. Rapports

### Base technique recommande

- couche `api` centralisee
- mapping DTO <-> modeles UI
- utilitaires argent / dates
- composants de formulaires avec validation unique
- composants de tableaux reutilisables
- notifications unifiees succes / erreur

### Modeles front a prevoir des le debut

- `Reference`
- `Banque`
- `Titulaire`
- `Beneficiaire`
- `Categorie`
- `SousCategorie`
- `CompteExterne`
- `CompteInterne`
- `Evaluation`
- `Operation`
- `OperationLigne`
- `TypeOperation`
- `TypeFonctionnement`
- `TypePeriode`
- `ApiError`

## Conclusion

La V1 est faisable cote front avec le back actuel, a condition de :

- centraliser proprement les conversions de formats ;
- construire les formulaires de saisie autour des DTO reels ;
- traiter les rapports comme des ecrans a part, pas comme des CRUD ;
- garder une trace explicite des questions ouvertes avant de figer l'UX.
