# MONATIS V1 - Questions ouvertes, remarques et manques

## Objet du document

Ce document liste tout ce qui manque ou doit etre tranche pour faire un front MONATIS V1 vraiment propre, stable et solide.

Le premier fichier donne une base exploitable pour demarrer.
Celui-ci sert a :

- cadrer les decisions produit / UX / API ;
- signaler les incoherences doc / code ;
- eviter de figer le front sur des hypotheses fragiles.

## Resume rapide

La V1 est faisable.

En revanche, pour faire un front propre sans dette inutile, il manque encore :

- un contrat API stable et documente ;
- des validations fonctionnelles figees ;
- des decisions UX explicites ;
- une clarification du parcours operations ;
- une position claire sur les rapports et leurs formats d'affichage.

## Priorites a traiter

### P0 - A clarifier avant implementation serieuse

1. Faut-il conserver des endpoints `GET` avec body, ou les convertir en `POST` / query params ?
2. Quelle est la vraie source de verite pour les champs obligatoires : le document V1 ou le code actuel ?
3. Comment le front doit-il gerer les operations quand une liste de comptes est masquee ou `null` ?
4. Quels ecrans exacts et quelle navigation veut-on en V1 ?
5. Quelle convention veut-on pour les montants entre saisie utilisateur, DTO et affichage ?

### P1 - A traiter pendant le cadrage front

1. Rendu attendu des rapports
2. Gestion des suppressions et contraintes d'integrite
3. Regles de renommage des references et comptes
4. Strategie de tri / recherche / filtres
5. Niveaux de details et composants a mutualiser

### P2 - A trancher pour une V1 confortable

1. Design system et ton visuel
2. Strategie de tests
3. Gestion des donnees de demo
4. Convention de traduction / locale

## 1. Questions API transverses

### 1.1 Endpoints `GET` avec body

Le back actuel expose plusieurs endpoints `GET` avec `@RequestBody`, ce qui est non standard et source de friction cote front web.

Endpoints concernes :

- `GET /monatis/evaluations/selection/toutes_par_compte`
- `GET /monatis/operations/selection/dernieres_par_compte`
- `GET /monatis/rapports/releve_compte`
- `GET /monatis/rapports/releve_compte/pdf`
- `GET /monatis/rapports/resumes_comptes_internes`
- `GET /monatis/rapports/depense_recette`
- `GET /monatis/rapports/remunerations_frais`
- `GET /monatis/rapports/bilan_patrimoine`
- `GET /monatis/rapports/plus_moins_value`

Questions :

- Peut-on les transformer en `POST` pour les recherches / rapports ?
- Si non, quelle convention front accepte-t-on exactement pour les appeler ?
- Veut-on garder la meme forme de payload si on change la methode HTTP ?

Remarque :

Pour un front React / Vite classique, c'est un point important a regler tot.

### 1.2 Absence de spec OpenAPI / Swagger

Le depot ne contient pas de Swagger / OpenAPI detecte.

Questions :

- Veut-on produire une spec OpenAPI avant le developpement front ?
- Ou assume-t-on que les DTO Java font office de contrat ?
- Qui arbitre quand la doc fonctionnelle et le code ne disent pas la meme chose ?

Recommandation :

- produire au minimum une spec HTTP concise par endpoint critique ;
- ou figer une collection Postman / Bruno / Insomnia.

### 1.3 Format d'erreur

Le back renvoie un `ErreurDto`, mais ce format n'apparait pas dans la doc V1 fonctionnelle.

Questions :

- Quels codes doivent etre geres de facon speciale cote front ?
- Souhaite-t-on afficher `libelle` tel quel a l'utilisateur ?
- Faut-il journaliser `code` et `typeDomaine` pour debug ?

Recommandation :

- standardiser l'affichage des erreurs metier dans un composant unique.

## 2. Incoherences doc / code

### 2.1 Champs annonces obligatoires dans la doc mais facultatifs en code

Observations cote code :

- compte interne :
  - `dateSoldeInitial` a une valeur par defaut `LocalDate.now()`
  - `montantSoldeInitialEnCentimes` a une valeur par defaut `0L`
- evaluation :
  - `dateSolde` a une valeur par defaut `LocalDate.now()`
- operation :
  - `dateValeur` a une valeur par defaut `LocalDate.now()`

Questions :

- Le front doit-il imposer ces champs comme obligatoires selon la doc ?
- Ou suivre le comportement reel du back et les pre-remplir automatiquement ?
- Veut-on aligner la doc sur le code ou le code sur la doc ?

Recommandation :

- figer une matrice "obligatoire / facultatif / valeur par defaut" avant de coder les formulaires.

### 2.2 Notion de suppression / vidage de champ

Le document `Interface - Banque` indique explicitement qu'on peut supprimer un `libelle` en envoyant une chaine vide ou blanche.

Questions :

- Cette regle vaut-elle pour toutes les references et tous les comptes ?
- Le front doit-il convertir une chaine vide en `null`, ou laisser la chaine vide partir au back ?

Recommandation :

- definir une convention unique pour tous les formulaires.

### 2.3 Differences de nommage et de granularite

Observations :

- certains DTO "basiques" renvoient des noms simples, d'autres des objets detail ;
- les montants CRUD sont en centimes ;
- les rapports sont en euros ;
- la doc parle parfois de "date de solde", parfois de "date de valeur", parfois de "date cible".

Questions :

- Veut-on normaliser un vocabulaire UI stable pour l'utilisateur ?
- Veut-on masquer les noms techniques des DTO et afficher des labels metier coherents ?

## 3. Questions sur la V1 fonctionnelle

### 3.1 Perimetre exact de la V1 cote front

Le document V1 est clair sur les themes, mais pas sur le niveau de finition attendu du front.

Questions :

- Souhaite-t-on un front complet utilisable par un utilisateur final ?
- Ou un front d'administration / saisie interne ?
- Les rapports doivent-ils etre "beaux" des la V1 ou seulement fonctionnels ?
- Le front doit-il gerer aussi les endpoints deja presents mais annonces comme version ulterieure ?

### 3.2 Structure des menus et routes

Le document V1 ne fixe pas l'architecture UI.

Questions :

- Quelle navigation veut-on ?
- Une page par domaine, ou une experience plus guidee ?
- Les formulaires doivent-ils s'ouvrir en page, en modal, ou en drawer ?
- Veut-on un accueil / tableau de bord, ou directement des sections CRUD ?

### 3.3 Recherche, tri, filtrage

La doc parle de listes, mais pas du comportement fin.

Questions :

- Quel tri par defaut sur chaque liste ?
- Veut-on une recherche textuelle sur `nom`, `identifiant`, `libelle` ?
- Les filtres sont-ils seulement cote client en V1 ?
- Faut-il persister les filtres dans l'URL ?

## 4. Questions par domaine

### 4.1 Banques, titulaires, beneficiaires

Questions :

- Peut-on renommer librement une banque ou un titulaire deja rattache a des comptes ?
- Que se passe-t-il si on tente de supprimer une reference encore utilisee ?
- Veut-on afficher les liens vers les comptes associes sous forme cliquable ?

Remarques :

- Les CRUD de references sont les meilleurs candidats pour demarrer le front
- Ils peuvent servir de base de composants reutilisables

### 4.2 Categories et sous-categories

Questions :

- Veut-on une page unique "categories + sous-categories" ou deux pages distinctes ?
- Lors d'un transfert de sous-categorie vers une autre categorie, quel comportement UX est souhaite ?
- Peut-on supprimer une categorie qui contient encore des sous-categories ?
- Peut-on supprimer une sous-categorie deja utilisee dans des operations ?

Remarques :

- Le document V1 mentionne "re-affichage a gerer" ; c'est un vrai sujet d'UX
- Une vue maitre / detail semble plus robuste qu'un simple tableau plat

### 4.3 Comptes externes

Questions :

- Ces comptes sont-ils toujours peu nombreux et gerables sans pagination ?
- Faut-il distinguer visuellement comptes externes et comptes internes dans les selects d'operations ?

### 4.4 Comptes internes

Questions :

- La date de cloture est-elle editable librement tant qu'aucune operation incoherente n'existe ?
- Faut-il interdire visuellement certaines modifications quand le compte a deja des operations / evaluations ?
- Peut-on laisser la banque vide et les titulaires vides en UX standard, ou faut-il orienter l'utilisateur a mieux renseigner ?

Remarques :

- Les comptes internes sont un pivot central du produit
- Le detail compte interne devrait probablement devenir une page forte du front

### 4.5 Evaluations

Questions :

- Veut-on gerer les evaluations uniquement depuis le detail d'un compte interne ?
- Faut-il aussi une page globale de consultation des evaluations ?
- La cle d'evaluation doit-elle etre visible / editable en standard ou plutot cachee ?

Remarques :

- Le document V1 lui-meme dit que la cle est "pas tres utile"
- Il serait raisonnable de la traiter comme champ avance

### 4.6 Operations

C'est la zone la plus sensible.

#### Question centrale : gestion du premier et du second compte

La doc V1 dit qu'en fonction du type d'operation on peut avoir :

- deux listes de comptes ;
- une seule liste ;
- et que la liste absente ne doit pas apparaitre.

Or le DTO de creation d'operation demande toujours :

- `identifiantCompteDepense`
- `identifiantCompteRecette`

Questions :

- Quand une liste n'apparait pas, qui fournit l'autre compte ?
- Est-ce automatiquement un compte technique ?
- Si oui, lequel et comment le front le decouvre-t-il ?
- Le front doit-il connaitre les comptes techniques, ou rester purement guide par les endpoints de compatibilite ?

#### Questions de parcours

- Veut-on un vrai wizard pas a pas ?
- Ou un formulaire unique qui se reconfigure dynamiquement ?
- Les "dernieres operations du compte" doivent-elles etre un simple panneau informatif ou une vraie zone de comparaison ?
- La creation d'une liste d'operations d'apres un relevé est-elle bien dans la V1 front, ou seulement une idee de parcours futur ?

#### Questions de details d'operation

- Le champ `pointee` doit-il etre visible en V1 ?
- Les lignes de detail doivent-elles etre modifiables uniquement en edition, ou aussi a la creation ?
- Si le montant principal change, les lignes doivent-elles se recalculer automatiquement ?
- Veut-on afficher la somme des lignes et la comparer au montant principal ?

#### Remarques

- C'est la partie ou une maquette ou un schema d'ecran serait le plus utile
- Sans arbitrage rapide, le front risque de coder trop d'hypotheses metier

## 5. Questions sur les rapports

### 5.1 Rendu attendu

La doc de rapport explique le contenu fonctionnel, mais pas le rendu final.

Questions :

- Veut-on des tableaux simples ?
- Des tableaux groupes avec accordions ?
- Des colonnes dynamiques par periode ?
- Un affichage horizontal scrollable, ou des cartes par periode ?

### 5.2 Exports

Observation :

- seul `releve_compte/pdf` est visible en V1 cote code

Questions :

- Souhaite-t-on un bouton export uniquement sur le releve de compte ?
- Ou un emplacement reserve pour les futurs exports sur les autres rapports ?

### 5.3 Performance et volume

Questions :

- Les rapports peuvent-ils renvoyer de gros volumes ?
- Faut-il prevoir une limitation de plage de dates dans le front ?
- Faut-il afficher des avertissements si l'utilisateur demande un rapport trop large ?

### 5.4 Filtres et valeurs par defaut

Questions :

- Quels filtres doivent etre visibles par defaut ?
- Les dates de fin doivent-elles etre automatiquement initialisees a aujourd'hui dans l'UI ?
- Le type de periode doit-il etre vide par defaut, ou preselectionne ?

## 6. Questions UX et design

### 6.1 Niveau de finition attendu

Questions :

- Cherche-t-on une interface purement utilitaire ou deja soignee visuellement ?
- Existe-t-il une charte, un logo, un nom final, une palette ?
- Quelle importance donner a la lisibilite "finance perso" par rapport a l'aspect "outil d'administration" ?

### 6.2 Conventions de formulaire

Questions :

- Afficher les aides sur les champs directement ou seulement via placeholders / info-bulles ?
- Validation au fil de l'eau ou seulement a la soumission ?
- Confirmation avant quitter une page modifiee ?

### 6.3 Listes et details

Questions :

- Veut-on generaliser une vue "liste + detail a droite" ?
- Ou rester sur des pages simples avec navigation detail / retour ?

## 7. Questions techniques cote front

Le dossier `MonatisFront-main` est actuellement vide.

Questions :

- Quel socle veut-on utiliser ?
- React + Vite semble probable vu le CORS, mais faut-il le confirmer ?
- Veut-on TypeScript ?
- Quel routeur ?
- Quelle librairie de requetes HTTP ?
- Quelle gestion d'etat ?
- Quelle strategie de formulaire ?
- Quelle librairie de composants tableau ?

Recommandation :

- partir sur TypeScript des le debut
- modeliser explicitement les DTO API
- isoler une couche `services` / `api`
- centraliser le mapping des erreurs et montants

## 8. Questions tests et qualite

Questions :

- Veut-on des tests unitaires front des le depart ?
- Veut-on des tests E2E sur les principaux parcours CRUD ?
- Y a-t-il un jeu de donnees stable pour dev / demo ?

Recommandation :

- couvrir a minima :
  - references
  - comptes internes
  - creation d'une operation
  - un rapport

## 9. Decisions recommandees avant de coder "proprement"

Voici les decisions qui auraient le meilleur retour sur investissement avant implementation :

1. Fixer les methodes HTTP des endpoints de recherche / rapport
2. Figer les validations fonctionnelles et valeurs par defaut
3. Clarifier le parcours "operations" avec une maquette simple
4. Figer les ecrans V1 et la navigation
5. Definir une convention unique pour montants, dates et erreurs
6. Choisir le socle front et les bibliotheques principales

## 10. Liste de questions a poser au PO / au back

### Questions globales

- Quelle est la source de verite entre doc et code quand ils divergent ?
- Quelles fonctionnalites doivent vraiment etre livrees dans le front V1 ?
- Le produit vise quel type d'utilisateur au depart ?

### Questions API

- Peut-on remplacer les `GET` avec body par des `POST` ?
- Un contrat API formalise est-il prevu ?
- Quelles erreurs metier importantes doivent etre specialement gerees dans le front ?

### Questions operations

- Quel compte est utilise quand une contrepartie ne doit pas etre selectionnee par l'utilisateur ?
- Les lignes de detail doivent-elles etre editables des la creation ?
- Le champ `pointee` fait-il partie de la V1 visible ?

### Questions rapports

- Quel rendu attend-on concretement pour chaque rapport ?
- Quels filtres sont obligatoires a afficher ?
- Quels exports sont requis en V1 ?

### Questions UX

- Modal ou page pour les CRUD ?
- Structure du menu ?
- Niveau de finition visuelle attendu ?

## Conclusion

Le front peut demarrer des maintenant, mais si l'objectif est "quelque chose de vraiment propre et solide", il faut traiter les sujets suivants en premier :

- contrat HTTP
- validations
- operations
- rapports
- architecture UI

Tant que ces points ne sont pas arbitres, le risque principal n'est pas technique : c'est de figer une UX ou des modeles front sur des hypotheses qui devront ensuite etre reecrites.
