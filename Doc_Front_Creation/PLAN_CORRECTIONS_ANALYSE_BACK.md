# Corrections back pour fiabiliser les onglets d'analyse

## Etat apres implementation

Ce document a ete deplace dans `MonatisFront-codex-monatis-front-ui-refresh/Doc_Front_Creation` apres implementation.

Les corrections back effectivement appliquees sont :

- `RapportController.java` accepte maintenant `GET` et `POST` sur les endpoints de rapports utilises par le front ;
- `DepenseRecetteService.java` gere correctement l'absence de beneficiaire dans le rapport Depenses/Recettes ;
- `OperationLigneRepository.java` gere explicitement la recherche des lignes sans sous-categorie ;
- `OperationLigneRepositoryTest.java` a ete cree pour verifier les lignes non categorisees et le filtre sous-categorie + beneficiaire.
- Le rapport `releve_compte` accepte maintenant une pagination serveur separee pour les operations en recette et en depense, afin que le front ne charge plus toutes les operations d'un releve en une seule reponse.
- Les totaux du releve restent calcules sur toute la periode cote back, meme lorsque seules les operations de la page courante sont renvoyees.
- Le rapport `releve_compte` filtre et trie maintenant les operations paginees avec la date de comptabilisation de la ligne principale (`numeroLigne = 0`) quand elle existe, puis retombe sur `dateValeur` si aucune ligne exploitable n'est disponible.
- Les requetes paginees du `releve_compte` sont compatibles H2 : elles n'utilisent pas `distinct` avec `order by coalesce(...)`, car H2 refuse cette combinaison si l'expression de tri n'est pas dans la projection.
- Les operations du DTO `ReleveCompteOperationResponseDto` exposent maintenant `dateComptabilisation`, afin que le front affiche la meme date que celle utilisee par le back pour le classement du releve.
- Les comptes internes exposent maintenant `POST /monatis/comptes/interne/page`, avec recherche, filtre par type de fonctionnement, filtre par titulaire et pagination serveur.
- Les comptes externes exposent maintenant `POST /monatis/comptes/externe/page`, avec recherche et pagination serveur.
- Les cinq references principales exposent maintenant un endpoint `/page` : banques, titulaires, beneficiaires, categories et sous-categories.
- Les reponses paginees des comptes et des references renvoient les memes metadonnees que l'historique operations : page courante, taille, total, total pages, premier et dernier element visibles.

Les fichiers back crees en entier sont copies dans :

`MonatisFront-codex-monatis-front-ui-refresh/Doc_Front_Creation/creation`

Les extraits commentes des fichiers back modifies sont copies dans :

`MonatisFront-codex-monatis-front-ui-refresh/Doc_Front_Creation/modification`

Verification effectuee :

- `MonatisBack-main/mvnw.cmd test` : OK, 9 tests passes.

Les tests de service listes plus bas restent des tests supplementaires possibles si l'on veut verrouiller encore plus finement chaque rapport, mais ils ne sont pas indispensables pour les corrections appliquees ici.

## Objectif

L'objectif est de faire du back la source officielle des calculs des onglets d'analyse.

Aujourd'hui, le front recalcule une partie importante des rapports a partir des donnees brutes (`operations/all`, comptes, evaluations, references). Cela cree un risque de divergence avec les services Java deja presents dans le back, notamment sur :

- les soldes avant ou apres la periode de vie d'un compte ;
- les comptes clotures ;
- les dates de valeur et dates de comptabilisation ;
- les flux techniques ;
- les periodes mensuelles, trimestrielles, annuelles, etc. ;
- les lignes non categorisees ;
- les beneficiaires facultatifs.

La correction propre consiste donc a exposer proprement les rapports du back au front, puis a rendre les services de rapports robustes sur les cas limites.

## Resume des fichiers back concernes

### Fichiers modifies

- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportResponseDtoMapper.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/releve_compte/ReleveCompteRequestDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/releve_compte/ReleveCompteOperationResponseDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/releve_compte/ReleveCompteResponseDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/model/ReleveOperationCompte.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/RapportService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/operations/repository/OperationRepository.java`
- `MonatisBack-main/src/test/java/fr/colline/monatis/operations/repository/OperationPaginationRepositoryTest.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/operations/service/OperationService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/DepenseRecetteService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/operations/repository/OperationLigneRepository.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/repository/CompteRepository.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/repository/CompteInterneRepository.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/service/CompteService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/service/CompteInterneService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/repository/ReferenceRepository.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/service/ReferenceService.java`

### Fichier cree

- `MonatisBack-main/src/test/java/fr/colline/monatis/operations/repository/OperationLigneRepositoryTest.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/ComptePageRequestDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/ComptePageResponseDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/ComptePageResponseDtoMapper.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/ReferencePageRequestDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/ReferencePageResponseDto.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/ReferencePageResponseDtoMapper.java`

### Fichiers verifies sans modification

- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/SoldeService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/BilanPatrimoineService.java`
- `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/RemunerationsFraisService.java`
- Les DTOs sous `MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/...`

### Tests supplementaires possibles

- `MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/SoldeServiceTest.java`
- `MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/DepenseRecetteServiceTest.java`
- `MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/BilanPatrimoineServiceTest.java`
- `MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/RemunerationsFraisServiceTest.java`
- `MonatisBack-main/src/test/java/fr/colline/monatis/rapports/controller/RapportControllerTest.java`

## Modifications detaillees

## 0 bis. Pagination serveur comptes et references

Chemins crees :

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/ComptePageRequestDto.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/ComptePageResponseDto.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/ComptePageResponseDtoMapper.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/ReferencePageRequestDto.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/ReferencePageResponseDto.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/ReferencePageResponseDtoMapper.java`

Chemins modifies :

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/repository/CompteRepository.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/repository/CompteInterneRepository.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/service/CompteService.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/comptes/service/CompteInterneService.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/repository/ReferenceRepository.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/references/service/ReferenceService.java`

### Probleme

Les pages de comptes internes, comptes externes et references pouvaient afficher une pagination visuelle cote front, mais les listes etaient encore chargees en entier via `/all`.

Sur une base importante, cela pose deux problemes :

- le front doit recevoir trop de donnees avant meme de pouvoir afficher la premiere page ;
- la recherche et les filtres coutent de plus en plus cher cote navigateur.

### Correction appliquee

- Ajout de DTOs de requete/reponse paginee pour les comptes.
- Ajout de DTOs de requete/reponse paginee pour les references.
- Ajout de mappers de page pour calculer `numeroPage`, `taillePage`, `totalComptes` ou `totalReferences`, `totalPages`, `premierElement` et `dernierElement`.
- Ajout de `CompteRepository.rechercherPage(...)` pour les comptes simples, utilise par les comptes externes.
- Ajout de `CompteInterneRepository.rechercherPage(...)` pour les comptes internes, avec recherche sur identifiant, libelle, banque et titulaires.
- Ajout de filtres serveur sur les comptes internes : `codesTypeFonctionnement` et `nomsTitulaires`.
- Ajout de `ReferenceRepository.rechercherPage(...)`, generique pour les cinq references.
- Ajout des endpoints :
  - `POST /monatis/comptes/interne/page`
  - `POST /monatis/comptes/externe/page`
  - `POST /monatis/references/banque/page`
  - `POST /monatis/references/titulaire/page`
  - `POST /monatis/references/beneficiaire/page`
  - `POST /monatis/references/categorie/page`
  - `POST /monatis/references/souscategorie/page`

### Compatibilite

Les endpoints `/all` ne sont pas supprimes.

Ils restent necessaires pour les menus de selection, les creations rapides et certains traitements qui ont besoin de la liste complete.

Les nouveaux endpoints `/page` sont destines aux ecrans de liste visibles par l'utilisateur.

### Documentation miroir

Les nouvelles classes exactes sont copiees dans :

`MonatisFront-codex-monatis-front-ui-refresh/Doc_Front_Creation/creation`

Les extraits commentes des classes modifiees sont copies dans :

`MonatisFront-codex-monatis-front-ui-refresh/Doc_Front_Creation/modification`

## 0. Pagination serveur du rapport `releve_compte`

Chemins :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/releve_compte/ReleveCompteRequestDto.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/releve_compte/ReleveCompteResponseDto.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/model/ReleveOperationCompte.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportController.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportResponseDtoMapper.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/RapportService.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/operations/repository/OperationRepository.java`

`MonatisBack-main/src/main/java/fr/colline/monatis/operations/service/OperationService.java`

`MonatisBack-main/src/test/java/fr/colline/monatis/operations/repository/OperationPaginationRepositoryTest.java`

### Probleme

Le front pouvait recevoir toutes les operations d'un releve en une seule reponse. Sur un grand historique, cela pouvait ralentir l'onglet Analyse et rendre la page lourde a afficher.

### Correction appliquee

- `ReleveCompteRequestDto` accepte `numeroPageOperationsRecette`, `taillePageOperationsRecette`, `numeroPageOperationsDepense` et `taillePageOperationsDepense`.
- `RapportController` transforme ces champs en `PageRequest` Spring, avec une limite maximale de 200 operations par page.
- `OperationRepository` expose des requetes paginees distinctes pour les operations en recette et en depense du compte, ainsi que des requetes de somme pour garder les totaux exacts.
- Les requetes paginees de `OperationRepository` ne mettent pas `distinct` sur la projection principale : la jointure cible deja la ligne principale `numeroLigne = 0`, et H2 refuse `select distinct o` avec `order by coalesce(...)` si cette expression de tri n'est pas projetee.
- `OperationService` applique les bornes de vie du compte avant les requetes paginees et les sommes.
- `RapportService` renvoie uniquement les operations de la page demandee, mais calcule toujours les montants totaux du releve sur toute la periode.
- `ReleveCompteResponseDto` renvoie les metadonnees de pagination permettant au front d'afficher `1-50`, `sur X`, `Afficher`, `1/N`.
- `OperationPaginationRepositoryTest` execute les requetes paginees recette et depense du releve afin de verrouiller la compatibilite H2 du tri par date comptable.

### Compatibilite

Si les champs de pagination ne sont pas fournis, l'ancien comportement reste disponible : le back renvoie toutes les operations du releve. Cela conserve notamment le fonctionnement de l'export PDF.

## 1. `RapportController.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportController.java`

### Probleme actuel

Les endpoints de rapports existent deja sous `/monatis/rapports`, mais ils sont exposes en `GET` avec un `@RequestBody`.

Exemples :

- `GET /monatis/rapports/releve_compte`
- `GET /monatis/rapports/resumes_comptes_internes`
- `GET /monatis/rapports/depense_recette`
- `GET /monatis/rapports/remunerations_frais`
- `GET /monatis/rapports/bilan_patrimoine`

Un `GET` avec body est fragile cote navigateur et cote clients HTTP. Certains outils ignorent le body, certains proxys le traitent mal, et ce n'est pas ideal pour le front.

### Changement realise

Les endpoints de rapports acceptent maintenant `POST`, en plus des anciens `GET`.

Endpoints utilisables en `POST` :

- `POST /monatis/rapports/releve_compte`
- `POST /monatis/rapports/resumes_comptes_internes`
- `POST /monatis/rapports/depense_recette`
- `POST /monatis/rapports/remunerations_frais`
- `POST /monatis/rapports/bilan_patrimoine`
- `POST /monatis/rapports/releve_non_categorise`
- `POST /monatis/rapports/releve_sous_categorie`
- `POST /monatis/rapports/plus_moins_value`

### Maniere retenue

Pour eviter toute duplication, les annotations `@GetMapping` ont ete remplacees par :

```java
@RequestMapping(value = "/...", method = { RequestMethod.GET, RequestMethod.POST })
```

Cette solution conserve les anciennes routes `GET`, ajoute `POST`, et ne duplique aucun corps de methode.

Modification appliquee :

```java
@RequestMapping(value = "/depense_recette", method = { RequestMethod.GET, RequestMethod.POST })
```

### Suppression a faire

Aucune suppression obligatoire.

Les endpoints `GET` peuvent rester pour ne pas casser d'anciens usages.

## 2. `DepenseRecetteService.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/DepenseRecetteService.java`

### Probleme actuel

Le beneficiaire est facultatif dans le controller, mais le service utilise ensuite `beneficiaire.getId()`.

Cela peut provoquer une erreur si aucun beneficiaire n'est selectionne.

Zone concernee :

```java
operationService.rechercherOperationsLignesParSousCategorieIdEtCriteres(
    sousCategorie.getId(),
    beneficiaire.getId(),
    dateDebutPeriode,
    dateFinPeriode)
```

### Changement a faire

Remplacer l'acces direct a `beneficiaire.getId()` par une valeur nullable.

Comportement attendu :

- si un beneficiaire est selectionne, filtrer sur ce beneficiaire ;
- si aucun beneficiaire n'est selectionne, ne pas filtrer par beneficiaire.

Forme attendue :

```java
Long beneficiaireId = beneficiaire == null ? null : beneficiaire.getId();
```

Puis passer `beneficiaireId` au repository.

### Pourquoi c'est necessaire

Sans cela, le rapport Depenses/Recettes peut echouer ou etre inutilisable des que l'utilisateur ne filtre pas par beneficiaire.

### Suppression a faire

Aucune suppression.

## 3. `OperationLigneRepository.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/operations/repository/OperationLigneRepository.java`

### Probleme actuel

La requete `findBySousCategorieIdAndFilters` commence par :

```java
where (:sousCategorieId = o.sousCategorie.id)
```

Cette condition ne gere pas clairement les lignes sans sous-categorie.

Pourtant, le back a deja un rapport `releve_non_categorise` qui appelle cette methode avec `sousCategorieId = null`.

### Changement a faire

Modifier la condition pour gerer explicitement deux cas :

- `sousCategorieId` renseigne : chercher les lignes de cette sous-categorie ;
- `sousCategorieId` null : chercher les lignes sans sous-categorie.

Condition attendue :

```java
where (
    (:sousCategorieId is null and o.sousCategorie is null)
    or (:sousCategorieId is not null and o.sousCategorie.id = :sousCategorieId)
)
```

Le filtre beneficiaire doit rester facultatif :

```java
and (:beneficiaireId is null or :beneficiaireId in (select b.id from o.beneficiaires b))
```

Les dates doivent continuer a utiliser `dateComptabilisation`, ce qui est coherent pour les lignes categorisees.

### Pourquoi c'est necessaire

Cela fiabilise :

- le releve non categorise ;
- les controles de lignes sans sous-categorie ;
- les futurs affichages d'analyse qui voudraient montrer proprement les operations non classees.

### Suppression a faire

Aucune suppression.

## 4. `RapportService.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/RapportService.java`

### Probleme possible

Le service contient deja les methodes centrales utilisees par le controller.

Il faut verifier que les rapports suivants retournent exactement les donnees dont le front a besoin :

- `rechercherReleveOperationCompte`
- `rechercherResumeCompteInterne`
- `rechercherEtatDepenseRecette`
- `rechercherEtatRemunerationsFrais`
- `rechercherEtatBilanPatrimoine`
- `rechercherReleveOperationNonCategorise`

### Changement a faire

Pas de modification lourde prevue.

Les modifications possibles sont :

- s'assurer que les methodes appellent bien les services corriges ;
- verifier que `rechercherReleveOperationNonCategorise` fonctionne apres correction du repository ;
- ajouter une logique explicite si l'on decide que le rapport Depenses/Recettes doit inclure une ligne "Sans categorie" dans le meme etat.

### Decision importante a prendre

Deux options sont possibles pour les lignes non categorisees :

1. Les garder dans un rapport separe via `releve_non_categorise`.
2. Les integrer dans `depense_recette` comme une categorie virtuelle "Sans categorie".

La solution la plus propre cote back est probablement de conserver un rapport separe, puis de laisser le front afficher cette information dans une section dediee.

Si l'utilisateur veut absolument que le total Depenses/Recettes inclue les non-categorisees, il faudra alors faire une modification plus structurelle du modele de rapport Depenses/Recettes.

### Suppression a faire

Aucune suppression.

## 5. `SoldeService.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/SoldeService.java`

### Etat actuel

La logique back semble plus correcte que celle du front.

Le service gere deja :

- solde a `0` avant la veille de la date de solde initial ;
- solde initial exactement la veille de la date de solde initial ;
- evaluations intermediaires ;
- operations entre la date de reference et la date cible.

### Changement a faire

Aucune modification prevue a ce stade.

### Verification a faire

Ajouter des tests pour verrouiller les cas suivants :

- date cible avant `dateSoldeInitial - 1 jour` ;
- date cible egale a `dateSoldeInitial - 1 jour` ;
- date cible egale a `dateSoldeInitial` ;
- presence d'une evaluation avant la date cible ;
- operations apres une evaluation ;
- compte cloture.

### Suppression a faire

Aucune suppression.

## 6. `BilanPatrimoineService.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/BilanPatrimoineService.java`

### Etat actuel

La logique back est plus saine que celle du front sur les flux techniques.

Le service :

- exclut les flux techniques des recettes ;
- exclut les flux techniques des depenses ;
- calcule les flux techniques dans `soldeTotalTechnique` ;
- calcule l'ecart non justifie en tenant compte du solde technique.

### Changement a faire

Aucune modification fonctionnelle certaine a ce stade.

Il faut surtout ajouter des tests pour verifier que :

- une operation technique en recette augmente seulement `soldeTotalTechnique` ;
- une operation technique en depense diminue seulement `soldeTotalTechnique` ;
- une operation technique n'est pas comptee dans `montantTotalRecette` ou `montantTotalDepense` ;
- l'ecart non justifie tient compte des flux techniques.

### Modification conditionnelle

Si l'on decide que les periodes affichees dans le front doivent etre strictement limitees aux dates demandees, alors il faudra modifier la logique de periode.

Actuellement, le back recadre au debut naturel de la periode :

- debut du mois ;
- debut du trimestre ;
- debut du semestre ;
- debut de l'annee.

Ce comportement est coherent pour des rapports comptables classiques, mais il peut differer de ce que le front affichait avant.

### Suppression a faire

Aucune suppression.

## 7. `RemunerationsFraisService.java`

Chemin :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/service/RemunerationsFraisService.java`

### Etat actuel

La logique back est meilleure que celle du front.

Le service utilise :

```java
o.getTypeOperation().isFluxTechnique()
```

C'est plus robuste que le front, qui detecte les frais/remunerations via la presence de `+` ou `-` dans le code de type operation.

### Changement a faire

Aucune modification fonctionnelle certaine.

### Verification a faire

Ajouter des tests pour verifier :

- les remunerations quand le compte interne est en recette ;
- les frais quand le compte interne est en depense ;
- l'exclusion des operations non techniques ;
- le filtrage par type de fonctionnement ;
- le filtrage par titulaire ;
- le decoupage par periode.

### Suppression a faire

Aucune suppression.

## 8. `RapportResponseDtoMapper.java` et DTOs de rapports

Chemins :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/RapportResponseDtoMapper.java`

Et tous les DTOs sous :

`MonatisBack-main/src/main/java/fr/colline/monatis/rapports/controller/...`

### Probleme possible

Le front aura besoin de reconstituer les ecrans d'analyse a partir des DTOs de rapport.

Il faut verifier que les DTOs contiennent bien toutes les informations necessaires pour l'affichage :

- identifiant du compte ;
- libelle du compte ;
- type de fonctionnement ;
- banque ;
- titulaires ;
- dates de periode ;
- soldes debut et fin ;
- recettes ;
- depenses ;
- solde technique ;
- ecart non justifie ;
- lignes detaillees si l'interface affiche les details au survol ou dans un panneau.

### Changement a faire

Modifier uniquement si une information manque.

Exemples d'ajouts possibles :

- ajouter le libelle court du type d'operation dans les lignes de releve ;
- ajouter les beneficiaires dans certaines lignes de details ;
- ajouter la sous-categorie ou categorie si une vue detaillee en a besoin ;
- ajouter une date de comptabilisation lorsque le rapport concerne des lignes d'operation.

### Suppression a faire

Aucune suppression prevue.

## 9. Tests a ajouter

Les tests sont importants, car le but est de rendre les calculs stables et non dependants d'une interpretation cote front.

## 9.1 `SoldeServiceTest.java`

Chemin a creer :

`MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/SoldeServiceTest.java`

### Cas a tester

- compte interne avec solde initial de 1000 euros ;
- solde demande avant la veille de la date initiale : resultat `0` ;
- solde demande la veille de la date initiale : resultat solde initial ;
- solde demande apres une recette ;
- solde demande apres une depense ;
- solde demande apres une evaluation ;
- operations avant evaluation ignorees ;
- operations apres evaluation prises en compte.

## 9.2 `DepenseRecetteServiceTest.java`

Chemin a creer :

`MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/DepenseRecetteServiceTest.java`

### Cas a tester

- rapport sans beneficiaire ;
- rapport avec beneficiaire ;
- ligne de depense categorisee ;
- ligne de recette categorisee ;
- sous-categorie filtree ;
- categorie filtree ;
- operation non categorisable ignoree ;
- date de comptabilisation utilisee pour filtrer la ligne.

## 9.3 `OperationLigneRepositoryTest.java`

Chemin a creer :

`MonatisBack-main/src/test/java/fr/colline/monatis/operations/repository/OperationLigneRepositoryTest.java`

### Cas a tester

- recherche par sous-categorie precise ;
- recherche avec `sousCategorieId = null` pour retourner uniquement les lignes non categorisees ;
- recherche avec beneficiaire ;
- recherche sans beneficiaire ;
- bornes de dates inclusives sur `dateComptabilisation`.

## 9.4 `BilanPatrimoineServiceTest.java`

Chemin a creer :

`MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/BilanPatrimoineServiceTest.java`

### Cas a tester

- recette non technique ;
- depense non technique ;
- remuneration technique ;
- frais technique ;
- calcul de solde initial ;
- calcul de solde final ;
- calcul d'ecart non justifie ;
- compte ouvert apres le debut de la periode ;
- compte cloture avant la fin de la periode.

## 9.5 `RemunerationsFraisServiceTest.java`

Chemin a creer :

`MonatisBack-main/src/test/java/fr/colline/monatis/rapports/service/RemunerationsFraisServiceTest.java`

### Cas a tester

- flux technique en recette ;
- flux technique en depense ;
- operation non technique ignoree ;
- regroupement par type de fonctionnement ;
- filtrage par compte ;
- filtrage par titulaire.

## 9.6 `RapportControllerTest.java`

Chemin a creer :

`MonatisBack-main/src/test/java/fr/colline/monatis/rapports/controller/RapportControllerTest.java`

### Cas a tester

- chaque endpoint `POST` retourne une reponse correcte ;
- les dates invalides retournent une erreur controlee ;
- les identifiants de comptes invalides retournent une erreur controlee ;
- les endpoints `GET` existants restent disponibles si on les conserve ;
- les DTOs de sortie contiennent les champs necessaires au front.

## Suppressions prevues dans le back

Aucune suppression obligatoire n'est prevue dans le back.

Il ne faut pas supprimer les endpoints `GET` existants tant que l'on n'est pas certain qu'aucune partie de l'application ou aucun outil externe ne les utilise.

Il ne faut pas supprimer les services de rapports existants. Ils doivent au contraire devenir la source officielle pour le front.

## Ajouts realises dans le back

### Ajouts certains realises

- endpoints `POST` dans `RapportController.java` ;
- test d'integration repository `OperationLigneRepositoryTest.java`.

### Ajouts possibles

- champs supplementaires dans certains DTOs de rapport si le front manque d'informations ;
- methode repository separee pour les lignes non categorisees, si l'on prefere eviter une requete unique trop polyvalente ;
- rapport ou section dediee aux lignes non categorisees si l'analyse doit les afficher avec les autres chiffres.

## Points a ne pas faire

- Ne pas recopier dans le front la logique metier du back.
- Ne pas corriger uniquement les symptomes visibles dans `reporting.ts`.
- Ne pas supprimer les anciens endpoints `GET` sans verification.
- Ne pas melanger `dateValeur` et `dateComptabilisation` sans decision metier claire.
- Ne pas compter les flux techniques a la fois dans les recettes/depenses et dans le solde technique.

## Ordre d'intervention realise

1. Ajouter les endpoints `POST` dans `RapportController.java`.
2. Corriger `DepenseRecetteService.java` pour le beneficiaire facultatif.
3. Corriger `OperationLigneRepository.java` pour les lignes non categorisees.
4. Ajouter `OperationLigneRepositoryTest.java`.
5. Verifier les DTOs de sortie des rapports.
6. Brancher ensuite le front sur ces endpoints.

## Resultat attendu

Apres ces corrections, l'onglet Analyse devra s'appuyer sur les calculs officiels du back.

Les resultats devraient alors etre coherents sur :

- le releve de compte ;
- les resumes de comptes ;
- les depenses et recettes ;
- les remunerations et frais ;
- le bilan patrimoine ;
- les comptes avant ouverture ;
- les comptes clotures ;
- les periodes ;
- les evaluations ;
- les flux techniques ;
- les lignes sans sous-categorie.
