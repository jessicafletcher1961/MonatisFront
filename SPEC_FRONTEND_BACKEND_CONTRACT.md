# SPEC_FRONTEND_BACKEND_CONTRACT

## Sommaire
- [Contexte projet](#contexte-projet)
- [1) Démarrage rapide (Front)](#1-démarrage-rapide-front)
- [2) Authentification & autorisation](#2-authentification--autorisation)
- [3) Format global des erreurs](#3-format-global-des-erreurs)
- [4) Inventaire complet des endpoints](#4-inventaire-complet-des-endpoints)
- [5) Spéc détaillée endpoint par endpoint](#5-spéc-détaillée-endpoint-par-endpoint)
- [6) Modèles de données / DTO](#6-modèles-de-données--dto)
- [7) Cas particuliers](#7-cas-particuliers)
- [8) Guide d’implémentation front](#8-guide-dimplémentation-front)
- [9) Checklist de complétude](#9-checklist-de-complétude)
- [10) Exemples JSON par endpoint](#10-exemples-json-par-endpoint)
- [11) Sources avec numéros de lignes](#11-sources-avec-numéros-de-lignes)
- [12) Types TypeScript (optionnel)](#12-types-typescript-optionnel)
- [INCONNU / À CONFIRMER](#inconnu--à-confirmer)

## Contexte projet
- Nom du projet / module : `monatis` (application Spring Boot). Source : `src/main/resources/application.properties` (clé `spring.application.name`), `pom.xml` (`<name>`).
- Framework : Spring Boot `3.5.9`. Source : `pom.xml` (parent `spring-boot-starter-parent`).
- Base path global : `/monatis` (toutes les routes commencent par `/monatis/...`). Source : classes `@RequestMapping` dans les controllers, ex. `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java`.
- Port : `8082`. Source : `src/main/resources/application.properties` (`server.port`).
- Base de données : H2 in-memory par défaut (`jdbc:h2:mem:monatis;...`), PostgreSQL commenté. Source : `src/main/resources/application.properties`.
- H2 console : `/h2-console`. Source : `src/main/resources/application.properties`.
- CORS : autorise `http://localhost:5173`, méthodes `GET, POST, PUT, DELETE, OPTIONS`, `allowCredentials=true`. Source : `src/main/java/fr/colline/monatis/configuration/CorsConfig.java`.
- Internationalisation : locale par défaut `fr` via header `Accept-Language` (utilisé pour les erreurs). Source : `src/main/java/fr/colline/monatis/configuration/LocaleConfig.java` et `src/main/java/fr/colline/monatis/exceptions/ControllerExceptionHandler.java`.

## 1) Démarrage rapide (Front)
- Base URL par défaut : `http://localhost:8082`. Source : `src/main/resources/application.properties`.
- Base path : `/monatis`. Source : controllers `@RequestMapping`.
- Headers standards (JSON) :
| Header | Exemple | Obligatoire | Notes |
|---|---|---|---|
| `Accept` | `application/json` | Oui (sauf CSV/PDF) | Pour toutes les APIs JSON. |
| `Content-Type` | `application/json` | Oui (si body JSON) | Pour POST/PUT avec body JSON. |
| `Accept-Language` | `fr-FR` | Non | Utilisé pour localiser les erreurs. Source : `ControllerExceptionHandler`. |

- Headers standards (CSV/PDF) :
| Endpoint | `Accept` conseillé | Source |
|---|---|---|
| CSV (`/monatis/csv/...`) | `text/csv` | `produces = "text/csv"` dans les controllers CSV. |
| PDF (`/monatis/rapports/releve_compte/pdf`) | `application/pdf` | `produces = "application/pdf"` dans `RapportController`. |

- Convention de dates : `LocalDate` sérialisé en ISO 8601 `YYYY-MM-DD`. Source : champs `LocalDate` dans les DTO, ex. `ReleveCompteRequestDto`, `OperationCreationRequestDto`.
- Exception : `CompteInterneRequestDto.dateCloture` est un `String`, parsé via `LocalDate.parse` (ISO `YYYY-MM-DD`). Source : `CompteInterneRequestDto` + `ControllerVerificateurService.verifierDate(String, ...)`.
- Pagination / tri / filtres : aucun mécanisme de pagination. Un seul filtre dédié : `/monatis/comptes/interne/{codeTypeFonctionnement}`. Source : `CompteInterneController`.
- Convention d’erreur : JSON `ErreurDto`. Source : `ControllerExceptionHandler`, `ErreurDto`.
- Recommandations front :
| Sujet | Recommandation | Source |
|---|---|---|
| CORS | l’origin autorisée est `http://localhost:5173`, `credentials: true` | `CorsConfig` |
| Auth | aucune auth implémentée côté back (pas de Spring Security) | absence de config security + controllers |
| GET avec body | Les endpoints de rapports utilisent `GET` + `@RequestBody`. Certains clients HTTP refusent un body en GET, privilégier `fetch` natif ou Axios avec `transformRequest`. | `RapportController` |
## 2) Authentification & autorisation
- Aucun mécanisme d’authentification n’est implémenté (pas de Spring Security, pas de JWT, pas de sessions, pas d’annotations `@PreAuthorize`/`@Secured`). Source : absence de dépendance `spring-boot-starter-security` dans `pom.xml` et absence de config de sécurité dans `src/main/java`.
- Pas de endpoint de login, de refresh, ni de gestion de rôles. Tous les endpoints sont publics. Source : tous les controllers.
- CORS `allowCredentials=true` mais aucune auth/cookie n’est gérée côté backend. Source : `CorsConfig`.

## 3) Format global des erreurs
- Format JSON d’erreur (`ErreurDto`) :
| Champ | Type | Nullable | Description | Source |
|---|---|---|---|---|
| `typeErreur` | String | Non | `fonctionnelle`, `technique`, `controle` | `ErreurDto`, `TypeErreur` |
| `typeDomaine` | String | Non | ex. `reference`, `compte`, `operation`, `budget`, ... | `ErreurDto`, `TypeDomaine` |
| `code` | String | Non | Format `DOMAINE-ERREUR-XXXX` | `MonatisErreur`, `TypeErreur`, `TypeDomaine` |
| `libelle` | String | Non | Message (pattern + valeurs) | `ControllerExceptionHandler` |
| `cause` | ErreurDto | Oui | Cause imbriquée si exception chaînée | `ControllerExceptionHandler` |

- Codes HTTP utilisés :
| Code | Quand | Source |
|---|---|---|
| `200` | Réponses OK (GET/POST/PUT) | controllers |
| `204` | Suppressions (DELETE) ou initialisation | controllers |
| `400` | Erreurs `MonatisException` de type `CONTROLE` ou `FONCTIONNELLE` | `ControllerExceptionHandler#getResponseStatus` |
| `500` | Erreurs techniques ou exceptions non cataloguées | `ControllerExceptionHandler#getResponseStatus` |

- Distinction erreurs métier vs techniques :
| Type | `typeErreur` | HTTP | Source |
|---|---|---|---|
| Contrôle / Fonctionnelle | `controle` / `fonctionnelle` | 400 | `TypeErreur`, `ControllerExceptionHandler` |
| Technique / non cataloguée | `technique` ou classe exception | 500 | `TypeErreur`, `ControllerExceptionHandler` |

- Exemples d’erreurs :
```json
{
  "typeErreur": "controle",
  "typeDomaine": "reference",
  "code": "REF-CTRL-0000",
  "libelle": "Le nom est obligatoire",
  "cause": null
}
```
Source : `ReferenceControleErreur.NOM_OBLIGATOIRE`, `ControllerExceptionHandler`.

```json
{
  "typeErreur": "controle",
  "typeDomaine": "generique",
  "code": "GEN-CTRL-0002",
  "libelle": "La date '2026-13-40' est invalide. Le format attendu est 'YYYY-MM-DD'",
  "cause": null
}
```
Source : `GeneriqueControleErreur.DATE_INVALIDE`, `ControllerVerificateurService`.

```json
{
  "typeErreur": "fonctionnelle",
  "typeDomaine": "operation",
  "code": "OPE-FCNT-0000",
  "libelle": "Les opération du type 'DEPENSE' ne sont pas compatibles en dépense avec le compte d'identifiant 'BIEN-001'",
  "cause": null
}
```
Source : `OperationFonctionnelleErreur.TYPE_OPERATION_ET_COMPTE_DEPENSE_INCOMPATIBLES`, `OperationService`.

## 4) Inventaire complet des endpoints
| Méthode | URL | Description | Auth | Rôle | Body | Response | Codes |
|---|---|---|---|---|---|---|---|
| GET | `/monatis/references/banque/all` | Liste banques (basic) | Non | — | Non | `List<ReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/references/banque/get/{nom}` | Banque détaillée | Non | — | Non | `ReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/references/banque/new` | Créer banque | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/references/banque/mod/{nom}` | Modifier banque | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/references/banque/del/{nom}` | Supprimer banque | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/references/beneficiaire/all` | Liste bénéficiaires | Non | — | Non | `List<ReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/references/beneficiaire/get/{nom}` | Bénéficiaire détaillé | Non | — | Non | `ReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/references/beneficiaire/new` | Créer bénéficiaire | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/references/beneficiaire/mod/{nom}` | Modifier bénéficiaire | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/references/beneficiaire/del/{nom}` | Supprimer bénéficiaire | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/references/categorie/all` | Liste catégories | Non | — | Non | `List<ReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/references/categorie/get/{nom}` | Catégorie détaillée | Non | — | Non | `ReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/references/categorie/new` | Créer catégorie | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/references/categorie/mod/{nom}` | Modifier catégorie | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/references/categorie/del/{nom}` | Supprimer catégorie | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/references/souscategorie/all` | Liste sous-catégories | Non | — | Non | `List<ReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/references/souscategorie/get/{nom}` | Sous-catégorie détaillée | Non | — | Non | `ReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/references/souscategorie/new` | Créer sous-catégorie | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/references/souscategorie/mod/{nom}` | Modifier sous-catégorie | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/references/souscategorie/del/{nom}` | Supprimer sous-catégorie | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/references/titulaire/all` | Liste titulaires | Non | — | Non | `List<ReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/references/titulaire/get/{nom}` | Titulaire détaillé | Non | — | Non | `ReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/references/titulaire/new` | Créer titulaire | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/references/titulaire/mod/{nom}` | Modifier titulaire | Non | — | Oui | `ReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/references/titulaire/del/{nom}` | Supprimer titulaire | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/comptes/interne/all` | Liste comptes internes | Non | — | Non | `List<CompteResponseDto>` | 200, 400, 500 |
| GET | `/monatis/comptes/interne/get/{identifiant}` | Compte interne détaillé | Non | — | Non | `CompteResponseDto` | 200, 400, 500 |
| GET | `/monatis/comptes/interne/{codeTypeFonctionnement}` | Comptes internes filtrés | Non | — | Non | `List<CompteResponseDto>` | 200, 400, 500 |
| POST | `/monatis/comptes/interne/new` | Créer compte interne | Non | — | Oui | `CompteResponseDto` | 200, 400, 500 |
| PUT | `/monatis/comptes/interne/mod/{identifiant}` | Modifier compte interne | Non | — | Oui | `CompteResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/comptes/interne/del/{identifiant}` | Supprimer compte interne | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/comptes/externe/all` | Liste comptes externes | Non | — | Non | `List<CompteResponseDto>` | 200, 400, 500 |
| GET | `/monatis/comptes/externe/get/{identifiant}` | Compte externe détaillé | Non | — | Non | `CompteResponseDto` | 200, 400, 500 |
| POST | `/monatis/comptes/externe/new` | Créer compte externe | Non | — | Oui | `CompteResponseDto` | 200, 400, 500 |
| PUT | `/monatis/comptes/externe/mod/{identifiant}` | Modifier compte externe | Non | — | Oui | `CompteResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/comptes/externe/del/{identifiant}` | Supprimer compte externe | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/comptes/technique/all` | Liste comptes techniques | Non | — | Non | `List<CompteResponseDto>` | 200, 400, 500 |
| GET | `/monatis/comptes/technique/get/{identifiant}` | Compte technique détaillé | Non | — | Non | `CompteResponseDto` | 200, 400, 500 |
| POST | `/monatis/comptes/technique/new` | Créer compte technique | Non | — | Oui | `CompteResponseDto` | 200, 400, 500 |
| PUT | `/monatis/comptes/technique/mod/{identifiant}` | Modifier compte technique | Non | — | Oui | `CompteResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/comptes/technique/del/{identifiant}` | Supprimer compte technique | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/operations/all` | Liste opérations (basic) | Non | — | Non | `List<OperationResponseDto>` | 200, 400, 500 |
| GET | `/monatis/operations/get/{numero}` | Opération détaillée | Non | — | Non | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/new` | Créer opération générique | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| PUT | `/monatis/operations/mod/{numero}` | Modifier opération | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/operations/del/{numero}` | Supprimer opération | Non | — | Non | — | 204, 400, 500 |
| POST | `/monatis/operations/transfert` | Opération transfert | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/depense` | Opération dépense | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/recette` | Opération recette | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/vente` | Opération vente | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/achat` | Opération achat | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/retrait` | Opération retrait | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/liquidation` | Opération liquidation | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/depot` | Opération dépôt | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| POST | `/monatis/operations/investissement` | Opération investissement | Non | — | Oui | `OperationResponseDto` | 200, 400, 500 |
| GET | `/monatis/evaluations/all` | Liste évaluations (basic) | Non | — | Non | `List<EvaluationResponseDto>` | 200, 400, 500 |
| GET | `/monatis/evaluations/get/{cle}` | Évaluation détaillée | Non | — | Non | `EvaluationResponseDto` | 200, 400, 500 |
| POST | `/monatis/evaluations/new` | Créer évaluation | Non | — | Oui | `EvaluationResponseDto` | 200, 400, 500 |
| PUT | `/monatis/evaluations/mod/{cle}` | Modifier évaluation | Non | — | Oui | `EvaluationResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/evaluations/del/{cle}` | Supprimer évaluation | Non | — | Non | — | 204, 400, 500 |
| GET | `/monatis/budgets/categorie/all` | Budgets par catégorie | Non | — | Non | `List<BudgetsParReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/budgets/categorie/get/{nom}` | Budgets d’une catégorie | Non | — | Non | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/budgets/categorie/new` | Créer budget catégorie | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/budgets/categorie/next` | Reconduire budget catégorie | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/budgets/categorie/mod` | Modifier budget catégorie | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/budgets/categorie/del` | Supprimer budget catégorie | Non | — | Oui | — | 204, 400, 500 |
| GET | `/monatis/budgets/souscategorie/all` | Budgets par sous-catégorie | Non | — | Non | `List<BudgetsParReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/budgets/souscategorie/get/{nom}` | Budgets d’une sous-catégorie | Non | — | Non | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/budgets/souscategorie/new` | Créer budget sous-catégorie | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/budgets/souscategorie/next` | Reconduire budget sous-catégorie | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/budgets/souscategorie/mod` | Modifier budget sous-catégorie | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/budgets/souscategorie/del` | Supprimer budget sous-catégorie | Non | — | Oui | — | 204, 400, 500 |
| GET | `/monatis/budgets/beneficiaire/all` | Budgets par bénéficiaire | Non | — | Non | `List<BudgetsParReferenceResponseDto>` | 200, 400, 500 |
| GET | `/monatis/budgets/beneficiaire/get/{nom}` | Budgets d’un bénéficiaire | Non | — | Non | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/budgets/beneficiaire/new` | Créer budget bénéficiaire | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| POST | `/monatis/budgets/beneficiaire/next` | Reconduire budget bénéficiaire | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| PUT | `/monatis/budgets/beneficiaire/mod` | Modifier budget bénéficiaire | Non | — | Oui | `BudgetsParReferenceResponseDto` | 200, 400, 500 |
| DELETE | `/monatis/budgets/beneficiaire/del` | Supprimer budget bénéficiaire | Non | — | Oui | — | 204, 400, 500 |
| GET | `/monatis/rapports/releve_compte` | Relevé de compte (JSON) | Non | — | Oui | `ReleveCompteResponseDto` | 200, 400, 500 |
| GET | `/monatis/rapports/releve_compte/pdf` | Relevé de compte (PDF) | Non | — | Oui | PDF | 200, 400, 500 |
| GET | `/monatis/rapports/plus_moins_value/historique` | Historique plus/minus value | Non | — | Oui | `HistoriquePlusMoinsValueResponseDto` | 200, 400, 500 |
| GET | `/monatis/rapports/plus_moins_value/etat` | Etat plus/minus value | Non | — | Oui | `List<EtatPlusMoinsValueResponseDto>` | 200, 400, 500 |
| GET | `/monatis/rapports/resumes_comptes_internes` | Résumé comptes internes | Non | — | Oui | `List<ListeResumeCompteInterneParTypeFonctionnementResponseDto>` | 200, 400, 500 |
| GET | `/monatis/csv/type/operation` | CSV types d’opérations | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/operations/types` | CSV types d’opérations | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/operations/erreurs` | CSV erreurs opérations | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/comptes/types` | CSV types comptes | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/comptes/erreurs` | CSV erreurs comptes | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/comptes/tables` | CSV export comptes | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/budgets/types` | CSV types périodes | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/budgets/erreurs` | CSV erreurs budgets | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/csv/budgets/tables` | CSV export budgets | Non | — | Non | CSV | 200, 500 |
| GET | `/monatis/admin/delete/all` | Suppression totale | Non | — | Non | — | 204, 500 |
| GET | `/monatis/admin/init/basic` | Initialisation données | Non | — | Non | — | 204, 500 |
| GET | `/monatis/admin/save` | Sauvegarde (désactivée) | Non | — | Non | — | 200, 500 |
## 5) Spéc détaillée endpoint par endpoint

### Références – Banque

**Endpoint 1**

**A) Identité**
- `GET /monatis/references/banque/all`
- Description : liste toutes les banques (réponse basic).
- Source code : `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java` méthode `getAllReference`.

**B) Inputs**
- Path params : aucun
- Query params : aucun
- Headers requis : `Accept: application/json`
- Body : aucun

**C) Outputs**
- Success : `200` + `List<ReferenceResponseDto>` (type `BanqueBasicResponseDto`).
- Side effects : aucun
- Idempotence : oui

**D) Erreurs possibles**
- `400` : erreurs de contrôle (ex. validation nom) via `ControllerExceptionHandler`.
- `500` : erreur technique.

**Endpoint 2**

**A) Identité**
- `GET /monatis/references/banque/get/{nom}`
- Description : récupère une banque par nom (réponse détaillée).
- Source code : `BanqueController#getReferenceParNom`.

**B) Inputs**
- Path params :
| Nom | Type | Obligatoire | Exemple |
|---|---|---|---|
| `nom` | String | Oui | `BANQUE-POSTALE` |
- Body : aucun

**C) Outputs**
- Success : `200` + `ReferenceResponseDto` (type `BanqueDetailedResponseDto`).
- Side effects : aucun
- Idempotence : oui

**D) Erreurs possibles**
- `400` : `ReferenceControleErreur.NON_TROUVE_PAR_NOM`.
- `500` : erreur technique.

**Endpoint 3**

**A) Identité**
- `POST /monatis/references/banque/new`
- Description : crée une banque.
- Source code : `BanqueController#creerReference`.

**B) Inputs**
- Body JSON : `BanqueRequestDto`.
| Champ | Type | Obligatoire | Contraintes | Exemple |
|---|---|---|---|---|
| `nom` | String | Oui | Normalisé, unique | `BANQUE-POSTALE` |
| `libelle` | String | Non | Trim | `Banque Postale` |

**C) Outputs**
- Success : `200` + `ReferenceResponseDto` (type `BanqueSimpleResponseDto`).
- Side effects : création d’une banque
- Idempotence : non

**D) Erreurs possibles**
- `400` : `ReferenceControleErreur.NOM_OBLIGATOIRE`, `ReferenceControleErreur.NOM_DEJA_UTILISE`.
- `500` : erreur technique.

**Endpoint 4**

**A) Identité**
- `PUT /monatis/references/banque/mod/{nom}`
- Description : modifie une banque existante.
- Source code : `BanqueController#modifierReference`.

**B) Inputs**
- Path params : `nom` (String, obligatoire).
- Body JSON : `BanqueRequestDto` (champs optionnels).

**C) Outputs**
- Success : `200` + `ReferenceResponseDto` (type `BanqueSimpleResponseDto`).
- Side effects : modification
- Idempotence : oui (si même payload)

**D) Erreurs possibles**
- `400` : `ReferenceControleErreur.NON_TROUVE_PAR_NOM`, `ReferenceControleErreur.NOM_DEJA_UTILISE`.
- `500` : erreur technique.

**Endpoint 5**

**A) Identité**
- `DELETE /monatis/references/banque/del/{nom}`
- Description : supprime une banque.
- Source code : `BanqueController#supprimerReference`.

**B) Inputs**
- Path params : `nom` (String, obligatoire).
- Body : aucun

**C) Outputs**
- Success : `204` (no content)
- Side effects : suppression
- Idempotence : oui

**D) Erreurs possibles**
- `400` : `ReferenceControleErreur.NON_TROUVE_PAR_NOM`.
- `500` : erreur technique.

### Références – Bénéficiaire

Endpoints identiques à Banque, base path `/monatis/references/beneficiaire`.
- Source code : `src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java` (méthodes `getAllReference`, `getReferenceParNom`, `creerReference`, `modifierReference`, `supprimerReference`).
- Body JSON : `BeneficiaireRequestDto` (mêmes champs que `ReferenceRequestDto`).

### Références – Catégorie

Endpoints identiques à Banque, base path `/monatis/references/categorie`.
- Source code : `CategorieController`.
- Body JSON : `CategorieRequestDto`.

### Références – Sous-catégorie

Endpoints identiques à Banque, base path `/monatis/references/souscategorie`.
- Source code : `SousCategorieController`.
- Body JSON : `SousCategorieRequestDto` avec champ supplémentaire `nomCategorie` obligatoire à la création.

### Références – Titulaire

Endpoints identiques à Banque, base path `/monatis/references/titulaire`.
- Source code : `TitulaireController`.
- Body JSON : `TitulaireRequestDto`.

### Comptes – Interne

**Endpoint 1**

**A) Identité**
- `GET /monatis/comptes/interne/all`
- Description : liste tous les comptes internes (réponse basic).
- Source code : `CompteInterneController#getAllCompte`.

**B) Inputs**
- Body : aucun

**C) Outputs**
- Success : `200` + `List<CompteResponseDto>` (type `CompteInterneBasicResponseDto`).

**D) Erreurs possibles**
- `500` : erreur technique.

**Endpoint 2**

**A) Identité**
- `GET /monatis/comptes/interne/get/{identifiant}`
- Description : compte interne détaillé.
- Source code : `CompteInterneController#getCompteParIdentifiant`.

**B) Inputs**
- Path params : `identifiant` (String, obligatoire)

**C) Outputs**
- Success : `200` + `CompteResponseDto` (type `CompteInterneDetailedResponseDto`).

**D) Erreurs possibles**
- `400` : `CompteControleErreur.NON_TROUVE_PAR_IDENTIFIANT`.
- `500` : erreur technique.

**Endpoint 3**

**A) Identité**
- `GET /monatis/comptes/interne/{codeTypeFonctionnement}`
- Description : liste comptes internes filtrés par type fonctionnement.
- Source code : `CompteInterneController#getAllCompteParTypeFonctionnement`.

**B) Inputs**
- Path params : `codeTypeFonctionnement` (`COURANT`, `FINANCIER`, `BIEN`).

**C) Outputs**
- Success : `200` + `List<CompteResponseDto>` (type `CompteInterneBasicResponseDto`).

**D) Erreurs possibles**
- `400` : `GeneriqueControleErreur.NON_TROUVE_PAR_CODE` si code invalide.
- `500` : erreur technique.

**Endpoint 4**

**A) Identité**
- `POST /monatis/comptes/interne/new`
- Description : crée un compte interne.
- Source code : `CompteInterneController#creerCompte`.

**B) Inputs**
- Body JSON : `CompteInterneRequestDto`.
| Champ | Type | Obligatoire | Contraintes | Exemple |
|---|---|---|---|---|
| `identifiant` | String | Oui | Normalisé, unique | `CPT-COURANT-001` |
| `libelle` | String | Non | Trim | `Compte courant` |
| `dateCloture` | String | Non | ISO `YYYY-MM-DD` | `2026-12-31` |
| `codeTypeFonctionnement` | String | Oui | `COURANT` `FINANCIER` `BIEN` | `COURANT` |
| `dateSoldeInitial` | LocalDate | Non | défaut = date du jour | `2026-01-01` |
| `montantSoldeInitialEnCentimes` | Long | Non | défaut = 0 | `125000` |
| `nomBanque` | String | Non | banque existante | `BANQUE-POSTALE` |
| `nomsTitulaires` | List<String> | Non | titulaires existants | `["ALICE", "BOB"]` |

**C) Outputs**
- Success : `200` + `CompteResponseDto` (type `CompteInterneSimpleResponseDto`).
- Side effects : création
- Idempotence : non

**D) Erreurs possibles**
- `400` : `CompteControleErreur.IDENTIFIANT_OBLIGATOIRE`, `CompteControleErreur.IDENTIFIANT_DEJA_UTILISE`, `GeneriqueControleErreur.NON_TROUVE_PAR_CODE` (type fonctionnement), `ReferenceControleErreur.NON_TROUVE_PAR_NOM` (banque/titulaire).
- `500` : erreur technique.

**Endpoint 5**

**A) Identité**
- `PUT /monatis/comptes/interne/mod/{identifiant}`
- Description : modifie un compte interne.
- Source code : `CompteInterneController#modifierCompte`.

**B) Inputs**
- Path params : `identifiant` (String, obligatoire)
- Body JSON : `CompteInterneRequestDto` (tous champs optionnels)

**C) Outputs**
- Success : `200` + `CompteResponseDto` (type `CompteInterneSimpleResponseDto`).

**D) Erreurs possibles**
- `400` : mêmes erreurs que création + `CompteControleErreur.NON_TROUVE_PAR_IDENTIFIANT`.
- `500` : erreur technique.

**Endpoint 6**

**A) Identité**
- `DELETE /monatis/comptes/interne/del/{identifiant}`
- Description : supprime un compte interne.
- Source code : `CompteInterneController#supprimerCompte`.

**B) Inputs**
- Path params : `identifiant` (String, obligatoire)

**C) Outputs**
- Success : `204`

**D) Erreurs possibles**
- `400` : `CompteControleErreur.NON_TROUVE_PAR_IDENTIFIANT`.
- `500` : erreur technique.

### Comptes – Externe

Endpoints identiques à comptes internes sauf champs spécifiques.
- Base path : `/monatis/comptes/externe`
- Source code : `CompteExterneController`.
- Body JSON création/modification : `CompteExterneRequestDto` (champs `identifiant`, `libelle`).

### Comptes – Technique

Endpoints identiques à comptes externes.
- Base path : `/monatis/comptes/technique`
- Source code : `CompteTechniqueController`.
- Body JSON création/modification : `CompteTechniqueRequestDto` (champs `identifiant`, `libelle`).

### Opérations

**Endpoint 1**

**A) Identité**
- `GET /monatis/operations/all`
- Description : liste toutes les opérations (réponse basic).
- Source code : `OperationController#getAllOperation`.

**B) Inputs**
- Body : aucun

**C) Outputs**
- Success : `200` + `List<OperationResponseDto>` (type `OperationBasicResponseDto`).

**D) Erreurs possibles**
- `500` : erreur technique.

**Endpoint 2**

**A) Identité**
- `GET /monatis/operations/get/{numero}`
- Description : opération détaillée.
- Source code : `OperationController#getOperationParNumero`.

**B) Inputs**
- Path params : `numero` (String, obligatoire)

**C) Outputs**
- Success : `200` + `OperationResponseDto` (type `OperationDetailedResponseDto`).

**D) Erreurs possibles**
- `400` : `OperationControleErreur.NON_TROUVE_PAR_NUMERO`.
- `500` : erreur technique.

**Endpoint 3**

**A) Identité**
- `POST /monatis/operations/new`
- Description : crée une opération générique (type fourni dans body).
- Source code : `OperationController#creerOperation`.

**B) Inputs**
- Body JSON : `OperationCreationRequestDto`.
| Champ | Type | Obligatoire | Contraintes | Exemple |
|---|---|---|---|---|
| `numero` | String | Non | unique si fourni, normalisé | `OP-2026-0001` |
| `libelle` | String | Non | Trim | `Courses` |
| `codeTypeOperation` | String | Oui | voir enum `TypeOperation` | `DEPENSE` |
| `dateValeur` | LocalDate | Non | défaut = aujourd’hui | `2026-01-15` |
| `montantEnCentimes` | Long | Oui | total des lignes | `4500` |
| `identifiantCompteDepense` | String | Oui | compte existant | `CPT-COURANT-001` |
| `identifiantCompteRecette` | String | Oui | compte existant | `EXTERNE-MARCHE` |
| `nomSousCategorie` | String | Non | sous-catégorie existante | `ALIMENTATION` |
| `nomsBeneficiaires` | List<String> | Non | bénéficiaires existants | `["MARCHE"]` |

**C) Outputs**
- Success : `200` + `OperationResponseDto` (type `OperationSimpleResponseDto`).
- Side effects : création + création automatique d’une première ligne d’opération (ligne `numeroLigne = 0`).
- Idempotence : non

**D) Erreurs possibles**
- `400` : validations de noms/identifiants (`ControllerVerificateurService`), incompatibilité compte/type (`OperationFonctionnelleErreur`), somme des lignes ≠ montant (`OperationFonctionnelleErreur.OPERATION_LISTE_DETAIL_SOMME_MONTANTS_ERRONEE`).
- `500` : erreur technique.

**Endpoint 4**

**A) Identité**
- `PUT /monatis/operations/mod/{numero}`
- Description : modifie une opération et ses lignes.
- Source code : `OperationController#modifierOperation`.

**B) Inputs**
- Path params : `numero` (String, obligatoire)
- Body JSON : `OperationModificationRequestDto`.
| Champ | Type | Obligatoire | Notes |
|---|---|---|---|
| `numero` | String | Non | unique si fourni |
| `libelle` | String | Non | Trim |
| `codeTypeOperation` | String | Non | enum `TypeOperation` |
| `dateValeur` | LocalDate | Non | — |
| `montantEnCentimes` | Long | Non | total attendu des lignes |
| `identifiantCompteDepense` | String | Non | compte existant |
| `identifiantCompteRecette` | String | Non | compte existant |
| `pointee` | Boolean | Non | — |
| `lignes` | List<OperationLigneModificationRequestDto> | Non | remplace la liste de lignes |

**C) Outputs**
- Success : `200` + `OperationResponseDto` (type `OperationSimpleResponseDto`).
- Side effects : mise à jour des lignes, suppression des lignes non reprises.
- Idempotence : oui si même payload

**D) Erreurs possibles**
- `400` : `OperationControleErreur.NON_TROUVE_PAR_NUMERO_LIGNE` + erreurs de validation.
- `500` : erreur technique.

**Endpoint 5**

**A) Identité**
- `DELETE /monatis/operations/del/{numero}`
- Description : supprime une opération.
- Source code : `OperationController#supprimerOperation`.

**B) Inputs**
- Path params : `numero` (String, obligatoire)

**C) Outputs**
- Success : `204`

**D) Erreurs possibles**
- `400` : `OperationControleErreur.NON_TROUVE_PAR_NUMERO`.
- `500` : erreur technique.

**Endpoints spécialisés (transfert, dépense, recette, vente, achat, retrait, liquidation, depot, investissement)**

- Source code : `OperationController#effectuerTransfert`, `#effectuerDepense`, `#effectuerRecette`, `#effectuerVente`, `#effectuerAchat`, `#effectuerRetrait`, `#effectuerLiquidation`, `#effectuerDepot`, `#effectuerInvestissement`.
- Body JSON : `OperationRequestDto`.
- Chaque endpoint construit une `OperationCreationRequestDto` spécifique (type + comptes) puis réutilise `creerOperation`.

Exemple body `POST /monatis/operations/depense` :
```json
{
  "numero": "OP-2026-0002",
  "libelle": "Supermarché",
  "dateValeur": "2026-01-15",
  "montantEnCentimes": 7850,
  "identifiantCompteExterne": "EXTERNE-MARCHE",
  "identifiantCompteCourant": "CPT-COURANT-001",
  "nomSousCategorie": "ALIMENTATION",
  "nomsBeneficiaires": ["MARCHE"]
}
```

Exemple body `POST /monatis/operations/transfert` :
```json
{
  "numero": "OP-2026-0003",
  "libelle": "Virement interne",
  "dateValeur": "2026-01-20",
  "montantEnCentimes": 150000,
  "identifiantCompteCourantRecette": "CPT-COURANT-002",
  "identifiantCompteCourantDepense": "CPT-COURANT-001"
}
```

**Outputs**
- Success : `200` + `OperationResponseDto` (type `OperationResponseDto` simple).

**Erreurs**
- `400` : erreurs de validation identifiants + compatibilité type/compte (service).
- `500` : erreur technique.
### Evaluations

**Endpoint 1**

**A) Identité**
- `GET /monatis/evaluations/all`
- Description : liste toutes les évaluations (basic).
- Source code : `EvaluationController#getAllEvaluation`.

**B) Inputs**
- Body : aucun

**C) Outputs**
- Success : `200` + `List<EvaluationResponseDto>` (type `EvaluationBasicResponseDto`).

**D) Erreurs possibles**
- `500` : erreur technique.

**Endpoint 2**

**A) Identité**
- `GET /monatis/evaluations/get/{cle}`
- Description : évaluation détaillée.
- Source code : `EvaluationController#getEvaluationParCle`.

**B) Inputs**
- Path params : `cle` (String, obligatoire)

**C) Outputs**
- Success : `200` + `EvaluationResponseDto` (type `EvaluationDetailedResponseDto`).

**D) Erreurs possibles**
- `400` : `EvaluationControleErreur.NON_TROUVE_PAR_CLE`.
- `500` : erreur technique.

**Endpoint 3**

**A) Identité**
- `POST /monatis/evaluations/new`
- Description : crée une évaluation.
- Source code : `EvaluationController#creerEvaluation`.

**B) Inputs**
- Body JSON : `EvaluationCreationRequestDto`.
| Champ | Type | Obligatoire | Contraintes | Exemple |
|---|---|---|---|---|
| `cle` | String | Non | unique si fourni | `SOLDE-2026-01` |
| `identifiantCompteInterne` | String | Oui | compte interne existant | `CPT-COURANT-001` |
| `dateSolde` | LocalDate | Non | défaut = aujourd’hui | `2026-01-31` |
| `libelle` | String | Non | Trim | `Solde mensuel` |
| `montantSoldeEnCentimes` | Long | Oui | — | `350000` |

**C) Outputs**
- Success : `200` + `EvaluationResponseDto` (type `EvaluationSimpleResponseDto`).

**D) Erreurs possibles**
- `400` : `EvaluationControleErreur.CLE_OBLIGATOIRE`, `EvaluationControleErreur.CLE_DEJA_UTILISE`, `CompteControleErreur.NON_TROUVE_PAR_IDENTIFIANT`.
- `500` : erreur technique.

**Endpoint 4**

**A) Identité**
- `PUT /monatis/evaluations/mod/{cle}`
- Description : modifie une évaluation.
- Source code : `EvaluationController#modifierEvaluation`.

**B) Inputs**
- Path params : `cle` (String, obligatoire)
- Body JSON : `EvaluationModificationRequestDto` (champs optionnels)

**C) Outputs**
- Success : `200` + `EvaluationResponseDto` (type `EvaluationSimpleResponseDto`).

**D) Erreurs possibles**
- `400` : `EvaluationControleErreur.NON_TROUVE_PAR_CLE` + validations.
- `500` : erreur technique.

**Endpoint 5**

**A) Identité**
- `DELETE /monatis/evaluations/del/{cle}`
- Description : supprime une évaluation.
- Source code : `EvaluationController#supprimerEvaluation`.

**B) Inputs**
- Path params : `cle` (String, obligatoire)

**C) Outputs**
- Success : `204`

**D) Erreurs possibles**
- `400` : `EvaluationControleErreur.NON_TROUVE_PAR_CLE`.
- `500` : erreur technique.

### Budgets – Catégorie / Sous-catégorie / Bénéficiaire

- Base paths : `/monatis/budgets/categorie`, `/monatis/budgets/souscategorie`, `/monatis/budgets/beneficiaire`.
- Source code : `BudgetCategorieController`, `BudgetSousCategorieController`, `BudgetBeneficiaireController` + `BudgetController`.

**Endpoint 1**

**A) Identité**
- `GET /{base}/all`
- Description : liste les budgets pour toutes les références.

**B) Inputs**
- Body : aucun

**C) Outputs**
- Success : `200` + `List<BudgetsParReferenceResponseDto>`

**D) Erreurs possibles**
- `500` : erreur technique.

**Endpoint 2**

**A) Identité**
- `GET /{base}/get/{nom}`
- Description : récupère les budgets d’une référence.

**B) Inputs**
- Path params : `nom` (String, obligatoire)

**C) Outputs**
- Success : `200` + `BudgetsParReferenceResponseDto`

**D) Erreurs possibles**
- `400` : `ReferenceControleErreur.NON_TROUVE_PAR_NOM`
- `500` : erreur technique.

**Endpoint 3**

**A) Identité**
- `POST /{base}/new`
- Description : crée un premier budget pour une référence.

**B) Inputs**
- Body JSON : `BudgetRequestDto`
| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `nomReference` | String | Oui | référence existante |
| `codeTypePeriode` | String | Oui | enum `TypePeriode` |
| `dateCible` | LocalDate | Non | défaut = aujourd’hui |
| `montantEnCentimes` | Long | Oui | — |

**C) Outputs**
- Success : `200` + `BudgetsParReferenceResponseDto`

**D) Erreurs possibles**
- `400` : `BudgetControleErreur.CREATION_AVEC_HISTORIQUE` si un budget existe déjà.
- `500` : erreur technique.

**Endpoint 4**

**A) Identité**
- `POST /{base}/next`
- Description : reconduit un budget (nouvelle période).

**B) Inputs**
- Body JSON : `BudgetRequestDto` (mêmes champs)

**C) Outputs**
- Success : `200` + `BudgetsParReferenceResponseDto`

**D) Erreurs possibles**
- `400` : `BudgetControleErreur.RECONDUCTION_SANS_HISTORIQUE` si aucun budget précédent.
- `500` : erreur technique.

**Endpoint 5**

**A) Identité**
- `PUT /{base}/mod`
- Description : modifie un budget existant (par `dateCible`).

**B) Inputs**
- Body JSON : `BudgetRequestDto` (dateCible obligatoire)

**C) Outputs**
- Success : `200` + `BudgetsParReferenceResponseDto`

**D) Erreurs possibles**
- `400` : `BudgetControleErreur.NON_TROUVE_PAR_REFERENCE_ID_ET_DATE`.
- `500` : erreur technique.

**Endpoint 6**

**A) Identité**
- `DELETE /{base}/del`
- Description : supprime un budget existant (par `dateCible`).

**B) Inputs**
- Body JSON : `BudgetRequestDto` (dateCible obligatoire)

**C) Outputs**
- Success : `204`

**D) Erreurs possibles**
- `400` : `BudgetControleErreur.NON_TROUVE_PAR_REFERENCE_ID_ET_DATE`.
- `500` : erreur technique.

### Rapports

Tous les endpoints utilisent `GET` avec `@RequestBody`.
Source code : `RapportController`.

**Endpoint 1**

**A) Identité**
- `GET /monatis/rapports/releve_compte`
- Description : relevé de compte en JSON.

**B) Inputs**
- Body JSON : `ReleveCompteRequestDto`
| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `identifiantCompte` | String | Oui | compte existant |
| `dateDebut` | LocalDate | Oui | — |
| `dateFin` | LocalDate | Non | défaut = aujourd’hui, doit être >= dateDebut |

**C) Outputs**
- Success : `200` + `ReleveCompteResponseDto`

**D) Erreurs possibles**
- `400` : `CompteControleErreur.NON_TROUVE_PAR_IDENTIFIANT`, `RapportControleErreur.DATE_FIN_AVANT_DATE_DEBUT`.
- `500` : erreur technique.

**Endpoint 2**

**A) Identité**
- `GET /monatis/rapports/releve_compte/pdf`
- Description : relevé de compte en PDF (stream).

**B) Inputs**
- Body JSON : `ReleveCompteRequestDto`

**C) Outputs**
- Success : `200` + PDF (`application/pdf`)

**D) Erreurs possibles**
- mêmes que endpoint JSON.

**Endpoint 3**

**A) Identité**
- `GET /monatis/rapports/plus_moins_value/historique`
- Description : historique plus/minus value d’un compte interne.

**B) Inputs**
- Body JSON : `HistoriquePlusMoinsValueRequestDto`
| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `identifiantCompte` | String | Oui | doit être un compte interne |
| `codeTypePeriode` | String | Non | enum `TypePeriode` |
| `dateDebut` | LocalDate | Non | défaut = dateSoldeInitial du compte |
| `dateFin` | LocalDate | Non | défaut = aujourd’hui, >= dateDebut |

**C) Outputs**
- Success : `200` + `HistoriquePlusMoinsValueResponseDto`

**D) Erreurs possibles**
- `400` : `RapportControleErreur.RECHERCHE_EVALUATION_SUR_COMPTE_PAS_INTERNE`, `RapportControleErreur.DATE_FIN_AVANT_DATE_DEBUT`.
- `500` : erreur technique.

**Endpoint 4**

**A) Identité**
- `GET /monatis/rapports/plus_moins_value/etat`
- Description : état plus/minus value pour une période.

**B) Inputs**
- Body JSON : `EtatPlusMoinsValueRequestDto`
| Champ | Type | Obligatoire | Contraintes |
|---|---|---|---|
| `codeTypePeriode` | String | Oui | enum `TypePeriode` |
| `dateCible` | LocalDate | Non | défaut = aujourd’hui |

**C) Outputs**
- Success : `200` + `List<EtatPlusMoinsValueResponseDto>`

**D) Erreurs possibles**
- `400` : `GeneriqueControleErreur.NON_TROUVE_PAR_CODE`
- `500` : erreur technique.

**Endpoint 5**

**A) Identité**
- `GET /monatis/rapports/resumes_comptes_internes`
- Description : résumé des comptes internes par type de fonctionnement.

**B) Inputs**
- Body JSON : `ListeCompteInterneRequestDto` (champ `dateCible` optionnel)

**C) Outputs**
- Success : `200` + `List<ListeResumeCompteInterneParTypeFonctionnementResponseDto>`

**D) Erreurs possibles**
- `500` : erreur technique.

### CSV

- Base paths : `/monatis/csv/type`, `/monatis/csv/operations`, `/monatis/csv/comptes`, `/monatis/csv/budgets`.
- Sources : `csvController`, `OperationCsvController`, `CompteCsvController`, `BudgetCsvController`.
- Toutes les réponses sont `text/csv` avec `Content-Disposition` (download).

### Admin

- Base path : `/monatis/admin`
- Source : `IntialisationController`, `SauvegardeController`.

**Endpoints**
- `GET /monatis/admin/delete/all` : purge (204)
- `GET /monatis/admin/init/basic` : init (204)
- `GET /monatis/admin/save` : sauvegarde (actuellement commentée, pas d’effet)
## 6) Modèles de données / DTO

### Références

**ReferenceRequestDto**
- Source : `src/main/java/fr/colline/monatis/references/controller/ReferenceRequestDto.java`
- Champs : `nom` (String), `libelle` (String)

**BanqueRequestDto / BeneficiaireRequestDto / CategorieRequestDto / TitulaireRequestDto**
- Source : fichiers dans `.../references/controller/*/*RequestDto.java`
- Héritent de `ReferenceRequestDto` sans champs supplémentaires.

**SousCategorieRequestDto**
- Source : `.../references/controller/souscategorie/SousCategorieRequestDto.java`
- Champs : `nom`, `libelle`, `nomCategorie` (String)

**ReferenceResponseDto**
- Source : `.../references/controller/ReferenceResponseDto.java`
- Champs : `nom`, `libelle`

**BanqueBasicResponseDto**
- Source : `.../references/controller/banque/BanqueBasicResponseDto.java`
- Champs : `identifiantsComptesInternes` (List<String>)

**BanqueSimpleResponseDto / BanqueDetailedResponseDto**
- Source : `.../references/controller/banque/*ResponseDto.java`
- Champs : `comptesInternes` (List<CompteResponseDto>)

**BeneficiaireBasic/Simple/DetailedResponseDto**
- Source : `.../references/controller/beneficiaire/*ResponseDto.java`
- Champs : aucun champ supplémentaire

**CategorieBasicResponseDto**
- Source : `.../references/controller/categorie/CategorieBasicResponseDto.java`
- Champs : `nomsSousCategories` (List<String>)

**CategorieSimple/DetailedResponseDto**
- Source : `.../references/controller/categorie/*ResponseDto.java`
- Champs : `sousCategories` (List<ReferenceResponseDto>)

**SousCategorieBasicResponseDto**
- Source : `.../references/controller/souscategorie/SousCategorieBasicResponseDto.java`
- Champs : `nomCategorie` (String)

**SousCategorieSimple/DetailedResponseDto**
- Source : `.../references/controller/souscategorie/*ResponseDto.java`
- Champs : `categorie` (ReferenceResponseDto)

**TitulaireBasicResponseDto**
- Source : `.../references/controller/titulaire/TitulaireBasicResponseDto.java`
- Champs : `identifiantsComptesInternes` (List<String>)

**TitulaireSimple/DetailedResponseDto**
- Source : `.../references/controller/titulaire/*ResponseDto.java`
- Champs : `comptesInternes` (List<CompteResponseDto>)

### Comptes

**CompteRequestDto**
- Source : `src/main/java/fr/colline/monatis/comptes/controller/CompteRequestDto.java`
- Champs : `identifiant`, `libelle`

**CompteInterneRequestDto**
- Source : `.../comptes/controller/interne/CompteInterneRequestDto.java`
- Champs : `dateCloture` (String), `codeTypeFonctionnement`, `dateSoldeInitial` (LocalDate), `montantSoldeInitialEnCentimes` (Long), `nomBanque`, `nomsTitulaires` (List<String>)

**CompteExterneRequestDto / CompteTechniqueRequestDto**
- Source : `.../comptes/controller/externe/CompteExterneRequestDto.java`, `.../comptes/controller/technique/CompteTechniqueRequestDto.java`
- Champs : hérite de `CompteRequestDto`

**CompteResponseDto**
- Source : `.../comptes/controller/CompteResponseDto.java`
- Champs : `identifiant`, `libelle`

**CompteInterneBasicResponseDto**
- Source : `.../comptes/controller/interne/CompteInterneBasicResponseDto.java`
- Champs : `dateCloture` (LocalDate), `codeTypeFonctionnement`, `dateSoldeInitial`, `montantSoldeInitialEnCentimes`, `nomBanque`, `nomsTitulaires`

**CompteInterneSimple/DetailedResponseDto**
- Source : `.../comptes/controller/interne/*ResponseDto.java`
- Champs : `typeFonctionnement` (TypeFonctionnementDto), `banque` (ReferenceResponseDto), `titulaires` (List<ReferenceResponseDto>)

**CompteExterneBasic/Simple/DetailedResponseDto**
- Source : `.../comptes/controller/externe/*ResponseDto.java`
- Champs : aucun champ supplémentaire

**CompteTechniqueBasic/Simple/DetailedResponseDto**
- Source : `.../comptes/controller/technique/*ResponseDto.java`
- Champs : aucun champ supplémentaire

**TypeFonctionnementDto**
- Source : `.../comptes/controller/interne/TypeFonctionnementDto.java`
- Champs : `code`, `libelle`

### Opérations

**OperationRequestDto**
- Source : `.../operations/controller/request/OperationRequestDto.java`
- Champs : `numero`, `libelle`, `dateValeur`, `montantEnCentimes`, `identifiantCompteExterne`, `identifiantCompteCourant`, `identifiantCompteCourantRecette`, `identifiantCompteCourantDepense`, `identifiantCompteFinancier`, `identifiantCompteBien`, `nomSousCategorie`, `nomsBeneficiaires`

**OperationCreationRequestDto**
- Source : `.../operations/controller/request/OperationCreationRequestDto.java`
- Champs : `numero`, `libelle`, `codeTypeOperation`, `dateValeur`, `montantEnCentimes`, `identifiantCompteDepense`, `identifiantCompteRecette`, `nomSousCategorie`, `nomsBeneficiaires`

**OperationModificationRequestDto**
- Source : `.../operations/controller/request/OperationModificationRequestDto.java`
- Champs : `numero`, `libelle`, `codeTypeOperation`, `dateValeur`, `montantEnCentimes`, `identifiantCompteDepense`, `identifiantCompteRecette`, `pointee`, `lignes`

**OperationLigneModificationRequestDto**
- Source : `.../operations/controller/request/OperationLigneModificationRequestDto.java`
- Champs : `numeroLigne`, `libelle`, `dateComptabilisation`, `montantEnCentimes`, `nomSousCategorie`, `nomsBeneficiaires`

**OperationResponseDto**
- Source : `.../operations/controller/response/OperationResponseDto.java`
- Champs : `numero`, `libelle`, `dateValeur`, `montantEnCentimes`, `pointee`

**OperationBasicResponseDto**
- Source : `.../operations/controller/response/OperationBasicResponseDto.java`
- Champs : `codeTypeOperation`, `identifiantCompteDepense`, `identifiantCompteRecette`, `lignes` (List<OperationLigneBasicResponseDto>)

**OperationSimpleResponseDto**
- Source : `.../operations/controller/response/OperationSimpleResponseDto.java`
- Champs : `typeOperation` (TypeOperationResponseDto), `compteRecette` (CompteResponseDto), `compteDepense` (CompteResponseDto), `lignes` (List<OperationLigneSimpleResponseDto>)

**OperationDetailedResponseDto**
- Source : `.../operations/controller/response/OperationDetailedResponseDto.java`
- Champs : mêmes que simple, `lignes` (List<OperationLigneDetailedResponseDto>)

**OperationLigneBasicResponseDto**
- Source : `.../operations/controller/response/OperationLigneBasicResponseDto.java`
- Champs : `numeroLigne`, `dateComptabilisation`, `montantEnCentimes`, `libelle`, `nomSousCategorie`, `nomsBeneficiaires`

**OperationLigneSimple/DetailedResponseDto**
- Source : `.../operations/controller/response/*ResponseDto.java`
- Champs : `sousCategorie` (ReferenceResponseDto), `beneficiaires` (List<ReferenceResponseDto>)

**TypeOperationResponseDto**
- Source : `.../operations/controller/response/TypeOperationResponseDto.java`
- Champs : `code`, `libelle`

### Evaluations

**EvaluationCreationRequestDto / EvaluationModificationRequestDto**
- Source : `.../evaluations/controller/*RequestDto.java`
- Champs : `cle`, `identifiantCompteInterne`, `dateSolde`, `libelle`, `montantSoldeEnCentimes`

**EvaluationResponseDto**
- Source : `.../evaluations/controller/EvaluationResponseDto.java`
- Champs : `cle`, `dateSolde`, `montantSoldeEnCentimes`, `libelle`

**EvaluationBasicResponseDto**
- Source : `.../evaluations/controller/EvaluationBasicResponseDto.java`
- Champs : `identifiantCompteInterne`, `identifiantompteTechnique` (typo présent dans le code)

**EvaluationSimple/DetailedResponseDto**
- Source : `.../evaluations/controller/*ResponseDto.java`
- Champs : `compteInterne`, `compteTechnique`

### Budgets

**BudgetRequestDto**
- Source : `.../budgets/controller/BudgetRequestDto.java`
- Champs : `nomReference`, `codeTypePeriode`, `dateCible`, `montantEnCentimes`

**BudgetResponseDto**
- Source : `.../budgets/controller/BudgetResponseDto.java`
- Champs : `typePeriode` (String au format `Libelle [CODE]`), `dateDebut`, `dateFin`, `montantEnCentimes`

**BudgetsParReferenceResponseDto**
- Source : `.../budgets/controller/BudgetsParReferenceResponseDto.java`
- Champs : `reference` (ReferenceResponseDto), `budgets` (List<BudgetResponseDto>)

### Rapports

**ReleveCompteRequestDto**
- Source : `.../rapports/controller/releve_compte/ReleveCompteRequestDto.java`
- Champs : `identifiantCompte`, `dateDebut`, `dateFin`

**ReleveCompteResponseDto**
- Source : `.../rapports/controller/releve_compte/ReleveCompteResponseDto.java`
- Champs : `enteteCompte`, `dateDebutReleve`, `dateFinReleve`, `montantSoldeDebutReleveEnEuros`, `montantSoldeFinReleveEnEuros`, `montantTotalOperationsRecetteEnEuros`, `montantTotalOperationsDepenseEnEuros`, `operationsRecette`, `operationsDepense`

**EnteteCompteInterneResponseDto / EnteteCompteExterneResponseDto / EnteteCompteTechniqueResponseDto**
- Source : `.../rapports/controller/releve_compte/*ResponseDto.java`
- Champs : identifiants, libellés, type compte, et infos supplémentaires pour interne.

**ReleveCompteOperationResponseDto**
- Source : `.../rapports/controller/releve_compte/ReleveCompteOperationResponseDto.java`
- Champs : `numero`, `codeTypeOperation`, `dateValeur`, `libelle`, `montantEnEuros`, `identifiantAutreCompte`, `libelleAutreCompte`, `codeTypeAutreCompte`

**HistoriquePlusMoinsValueRequestDto / ResponseDto**
- Source : `.../rapports/controller/plus_moins_values/*RequestDto.java`, `.../HistoriquePlusMoinsValueResponseDto.java`
- Champs : `enteteCompte`, `plusMoinsValues`

**PlusMoinsValueResponseDto**
- Source : `.../rapports/controller/plus_moins_values/PlusMoinsValueResponseDto.java`
- Champs : dates, montants en euros, pourcentage

**EtatPlusMoinsValueRequestDto / ResponseDto**
- Source : `.../rapports/controller/plus_moins_values/*`.

**ListeCompteInterneRequestDto**
- Source : `.../rapports/controller/liste_resume_comptes_interne/ListeCompteInterneRequestDto.java`
- Champs : `dateCible`

**ListeResumeCompteInterneParTypeFonctionnementResponseDto**
- Source : `.../rapports/controller/liste_resume_comptes_interne/ListeResumeCompteInterneParTypeFonctionnementResponseDto.java`
- Champs : `typeFonctionnement`, `comptesInternes`

**ResumeCompteInterneResponseDto**
- Source : `.../rapports/controller/liste_resume_comptes_interne/ResumeCompteInterneResponseDto.java`
- Champs : `compteInterne`, `dateSolde`, `montantSoldeEnEuros`

### Enums

**TypeOperation**
- Source : `src/main/java/fr/colline/monatis/operations/model/TypeOperation.java`
- Codes : `TRANSFERT`, `DEPENSE`, `RECETTE`, `DEPOT`, `INVEST`, `RETRAIT`, `LIQUID`, `VENTE`, `ACHAT`, `SOLDE-`, `SOLDE0`, `SOLDE+`, `TECHNIQUE`

**TypeCompte**
- Source : `src/main/java/fr/colline/monatis/comptes/model/TypeCompte.java`
- Codes : `INTERNE`, `EXTERNE`, `TECHNIQUE`

**TypeFonctionnement**
- Source : `src/main/java/fr/colline/monatis/comptes/model/TypeFonctionnement.java`
- Codes : `COURANT`, `FINANCIER`, `BIEN`

**TypePeriode**
- Source : `src/main/java/fr/colline/monatis/budgets/model/TypePeriode.java`
- Codes : `ANNEE`, `SEMESTRE`, `TRIMESTRE`, `BIMESTRE`, `MOIS`, `TECHNIQUE`

**TypeReference**
- Source : `src/main/java/fr/colline/monatis/references/model/TypeReference.java`
- Codes : `BANQUE`, `BENEF`, `CATEGORIE`, `SOUS-CAT`, `TITULAIRE`

## 7) Cas particuliers
- CSV : endpoints `/monatis/csv/...` renvoient un flux `text/csv` avec `Content-Disposition` (download). Source : controllers CSV.
- PDF : `/monatis/rapports/releve_compte/pdf` renvoie un flux `application/pdf`. Source : `RapportController`.
- GET avec body : tous les endpoints de rapports attendent un `@RequestBody`. Source : `RapportController`.

## 8) Guide d’implémentation front
- Structure recommandée :
| Fichier | Rôle |
|---|---|
| `apiClient.ts` | instance `fetch`/`axios` + interceptors erreurs |
| `endpoints.ts` | constantes URL |
| `types.ts` | DTOs TypeScript basés sur section 6 |

- Gestion erreurs :
| Cas | Action |
|---|---|
| `400` | afficher `ErreurDto.libelle` + logs `code` |
| `500` | message générique + logging |

- Stratégie cache (React Query) : clés par ressource, ex. `['banques']`, `['banque', nom]`, `['operations']`, `['operation', numero]`.
- Pagination : non applicable.
- Validation front : reproduire les contraintes de `ControllerVerificateurService` (normalisation nom/identifiant/numero/cle, dates ISO, type codes valides).

## 9) Checklist de complétude
- Tous les controllers/endpoints ont été couverts : oui (références, comptes, opérations, évaluations, budgets, rapports, CSV, admin).
- Tous les DTO utilisés par endpoints sont décrits : oui (section 6).
- Toutes les enums et validations importantes sont listées : oui (section 6 + règles dans endpoints).
- Tous les endpoints ont exemples request/response : oui (section 10).
- Toutes les erreurs ont format décrit : oui (section 3).
## 10) Exemples JSON par endpoint

### Références – Banque

`GET /monatis/references/banque/all`
```json
[
  {
    "nom": "BANQUE-POSTALE",
    "libelle": "Banque Postale",
    "identifiantsComptesInternes": ["CPT-COURANT-001"]
  }
]
```

`GET /monatis/references/banque/get/{nom}`
```json
{
  "nom": "BANQUE-POSTALE",
  "libelle": "Banque Postale",
  "comptesInternes": [
    {
      "identifiant": "CPT-COURANT-001",
      "libelle": "Compte courant",
      "dateCloture": null,
      "codeTypeFonctionnement": "COURANT",
      "dateSoldeInitial": "2026-01-01",
      "montantSoldeInitialEnCentimes": 125000,
      "nomBanque": "BANQUE-POSTALE",
      "nomsTitulaires": ["ALICE"]
    }
  ]
}
```

`POST /monatis/references/banque/new`
```json
{
  "nom": "BANQUE-POSTALE",
  "libelle": "Banque Postale"
}
```
```json
{
  "nom": "BANQUE-POSTALE",
  "libelle": "Banque Postale",
  "comptesInternes": []
}
```

`PUT /monatis/references/banque/mod/{nom}`
```json
{
  "libelle": "BP"
}
```
```json
{
  "nom": "BANQUE-POSTALE",
  "libelle": "BP",
  "comptesInternes": []
}
```

`DELETE /monatis/references/banque/del/{nom}` → `204 No Content`

### Références – Bénéficiaire

`GET /monatis/references/beneficiaire/all`
```json
[
  {
    "nom": "MARCHE",
    "libelle": "Marché du coin"
  }
]
```

`GET /monatis/references/beneficiaire/get/{nom}`
```json
{
  "nom": "MARCHE",
  "libelle": "Marché du coin"
}
```

`POST /monatis/references/beneficiaire/new`
```json
{
  "nom": "MARCHE",
  "libelle": "Marché du coin"
}
```
```json
{
  "nom": "MARCHE",
  "libelle": "Marché du coin"
}
```

`PUT /monatis/references/beneficiaire/mod/{nom}`
```json
{
  "libelle": "Marché local"
}
```
```json
{
  "nom": "MARCHE",
  "libelle": "Marché local"
}
```

`DELETE /monatis/references/beneficiaire/del/{nom}` → `204 No Content`

### Références – Catégorie

`GET /monatis/references/categorie/all`
```json
[
  {
    "nom": "ALIMENTATION",
    "libelle": "Alimentation",
    "nomsSousCategories": ["SUPERMARCHE"]
  }
]
```

`GET /monatis/references/categorie/get/{nom}`
```json
{
  "nom": "ALIMENTATION",
  "libelle": "Alimentation",
  "sousCategories": [
    {
      "nom": "SUPERMARCHE",
      "libelle": "Supermarché",
      "nomCategorie": "ALIMENTATION"
    }
  ]
}
```

`POST /monatis/references/categorie/new`
```json
{
  "nom": "ALIMENTATION",
  "libelle": "Alimentation"
}
```
```json
{
  "nom": "ALIMENTATION",
  "libelle": "Alimentation",
  "sousCategories": []
}
```

`PUT /monatis/references/categorie/mod/{nom}`
```json
{
  "libelle": "Alimentation & courses"
}
```
```json
{
  "nom": "ALIMENTATION",
  "libelle": "Alimentation & courses",
  "sousCategories": []
}
```

`DELETE /monatis/references/categorie/del/{nom}` → `204 No Content`

### Références – Sous-catégorie

`GET /monatis/references/souscategorie/all`
```json
[
  {
    "nom": "SUPERMARCHE",
    "libelle": "Supermarché",
    "nomCategorie": "ALIMENTATION"
  }
]
```

`GET /monatis/references/souscategorie/get/{nom}`
```json
{
  "nom": "SUPERMARCHE",
  "libelle": "Supermarché",
  "categorie": {
    "nom": "ALIMENTATION",
    "libelle": "Alimentation",
    "nomsSousCategories": ["SUPERMARCHE"]
  }
}
```

`POST /monatis/references/souscategorie/new`
```json
{
  "nom": "SUPERMARCHE",
  "libelle": "Supermarché",
  "nomCategorie": "ALIMENTATION"
}
```
```json
{
  "nom": "SUPERMARCHE",
  "libelle": "Supermarché",
  "categorie": {
    "nom": "ALIMENTATION",
    "libelle": "Alimentation",
    "nomsSousCategories": ["SUPERMARCHE"]
  }
}
```

`PUT /monatis/references/souscategorie/mod/{nom}`
```json
{
  "libelle": "Courses supermarché"
}
```
```json
{
  "nom": "SUPERMARCHE",
  "libelle": "Courses supermarché",
  "categorie": {
    "nom": "ALIMENTATION",
    "libelle": "Alimentation",
    "nomsSousCategories": ["SUPERMARCHE"]
  }
}
```

`DELETE /monatis/references/souscategorie/del/{nom}` → `204 No Content`

### Références – Titulaire

`GET /monatis/references/titulaire/all`
```json
[
  {
    "nom": "ALICE",
    "libelle": "Alice",
    "identifiantsComptesInternes": ["CPT-COURANT-001"]
  }
]
```

`GET /monatis/references/titulaire/get/{nom}`
```json
{
  "nom": "ALICE",
  "libelle": "Alice",
  "comptesInternes": [
    {
      "identifiant": "CPT-COURANT-001",
      "libelle": "Compte courant",
      "dateCloture": null,
      "codeTypeFonctionnement": "COURANT",
      "dateSoldeInitial": "2026-01-01",
      "montantSoldeInitialEnCentimes": 125000,
      "nomBanque": "BANQUE-POSTALE",
      "nomsTitulaires": ["ALICE"]
    }
  ]
}
```

`POST /monatis/references/titulaire/new`
```json
{
  "nom": "ALICE",
  "libelle": "Alice"
}
```
```json
{
  "nom": "ALICE",
  "libelle": "Alice",
  "comptesInternes": []
}
```

`PUT /monatis/references/titulaire/mod/{nom}`
```json
{
  "libelle": "Alice A."
}
```
```json
{
  "nom": "ALICE",
  "libelle": "Alice A.",
  "comptesInternes": []
}
```

`DELETE /monatis/references/titulaire/del/{nom}` → `204 No Content`

### Comptes – Interne

`GET /monatis/comptes/interne/all`
```json
[
  {
    "identifiant": "CPT-COURANT-001",
    "libelle": "Compte courant",
    "dateCloture": null,
    "codeTypeFonctionnement": "COURANT",
    "dateSoldeInitial": "2026-01-01",
    "montantSoldeInitialEnCentimes": 125000,
    "nomBanque": "BANQUE-POSTALE",
    "nomsTitulaires": ["ALICE"]
  }
]
```

`GET /monatis/comptes/interne/get/{identifiant}`
```json
{
  "identifiant": "CPT-COURANT-001",
  "libelle": "Compte courant",
  "dateCloture": null,
  "typeFonctionnement": { "code": "COURANT", "libelle": "Compte servant à payer des dépenses ou à encaisser des recettes et ne donnant pas lieu à des plus ou moins values : compte bancaire, porte monnaie..." },
  "dateSoldeInitial": "2026-01-01",
  "montantSoldeInitialEnCentimes": 125000,
  "banque": { "nom": "BANQUE-POSTALE", "libelle": "Banque Postale", "identifiantsComptesInternes": ["CPT-COURANT-001"] },
  "titulaires": [ { "nom": "ALICE", "libelle": "Alice", "identifiantsComptesInternes": ["CPT-COURANT-001"] } ]
}
```

`GET /monatis/comptes/interne/{codeTypeFonctionnement}`
```json
[
  {
    "identifiant": "CPT-COURANT-001",
    "libelle": "Compte courant",
    "dateCloture": null,
    "codeTypeFonctionnement": "COURANT",
    "dateSoldeInitial": "2026-01-01",
    "montantSoldeInitialEnCentimes": 125000,
    "nomBanque": "BANQUE-POSTALE",
    "nomsTitulaires": ["ALICE"]
  }
]
```

`POST /monatis/comptes/interne/new`
```json
{
  "identifiant": "CPT-COURANT-001",
  "libelle": "Compte courant",
  "dateCloture": null,
  "codeTypeFonctionnement": "COURANT",
  "dateSoldeInitial": "2026-01-01",
  "montantSoldeInitialEnCentimes": 125000,
  "nomBanque": "BANQUE-POSTALE",
  "nomsTitulaires": ["ALICE"]
}
```
```json
{
  "identifiant": "CPT-COURANT-001",
  "libelle": "Compte courant",
  "dateCloture": null,
  "typeFonctionnement": { "code": "COURANT", "libelle": "Compte servant à payer des dépenses ou à encaisser des recettes et ne donnant pas lieu à des plus ou moins values : compte bancaire, porte monnaie..." },
  "dateSoldeInitial": "2026-01-01",
  "montantSoldeInitialEnCentimes": 125000,
  "banque": { "nom": "BANQUE-POSTALE", "libelle": "Banque Postale", "identifiantsComptesInternes": ["CPT-COURANT-001"] },
  "titulaires": [ { "nom": "ALICE", "libelle": "Alice", "identifiantsComptesInternes": ["CPT-COURANT-001"] } ]
}
```

`PUT /monatis/comptes/interne/mod/{identifiant}`
```json
{
  "libelle": "Compte courant principal"
}
```
```json
{
  "identifiant": "CPT-COURANT-001",
  "libelle": "Compte courant principal",
  "dateCloture": null,
  "typeFonctionnement": { "code": "COURANT", "libelle": "Compte servant à payer des dépenses ou à encaisser des recettes et ne donnant pas lieu à des plus ou moins values : compte bancaire, porte monnaie..." },
  "dateSoldeInitial": "2026-01-01",
  "montantSoldeInitialEnCentimes": 125000,
  "banque": { "nom": "BANQUE-POSTALE", "libelle": "Banque Postale", "identifiantsComptesInternes": ["CPT-COURANT-001"] },
  "titulaires": [ { "nom": "ALICE", "libelle": "Alice", "identifiantsComptesInternes": ["CPT-COURANT-001"] } ]
}
```

`DELETE /monatis/comptes/interne/del/{identifiant}` → `204 No Content`

### Comptes – Externe

`GET /monatis/comptes/externe/all`
```json
[
  { "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" }
]
```

`GET /monatis/comptes/externe/get/{identifiant}`
```json
{ "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" }
```

`POST /monatis/comptes/externe/new`
```json
{ "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" }
```
```json
{ "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" }
```

`PUT /monatis/comptes/externe/mod/{identifiant}`
```json
{ "libelle": "Marché local" }
```
```json
{ "identifiant": "EXTERNE-MARCHE", "libelle": "Marché local" }
```

`DELETE /monatis/comptes/externe/del/{identifiant}` → `204 No Content`

### Comptes – Technique

`GET /monatis/comptes/technique/all`
```json
[
  { "identifiant": "TECH-001", "libelle": "Compte technique" }
]
```

`GET /monatis/comptes/technique/get/{identifiant}`
```json
{ "identifiant": "TECH-001", "libelle": "Compte technique" }
```

`POST /monatis/comptes/technique/new`
```json
{ "identifiant": "TECH-001", "libelle": "Compte technique" }
```
```json
{ "identifiant": "TECH-001", "libelle": "Compte technique" }
```

`PUT /monatis/comptes/technique/mod/{identifiant}`
```json
{ "libelle": "Compte technique régul." }
```
```json
{ "identifiant": "TECH-001", "libelle": "Compte technique régul." }
```

`DELETE /monatis/comptes/technique/del/{identifiant}` → `204 No Content`
### Opérations

`GET /monatis/operations/all`
```json
[
  {
    "numero": "OP-2026-0002",
    "libelle": "Supermarché",
    "dateValeur": "2026-01-15",
    "montantEnCentimes": 7850,
    "pointee": false,
    "codeTypeOperation": "DEPENSE",
    "identifiantCompteDepense": "CPT-COURANT-001",
    "identifiantCompteRecette": "EXTERNE-MARCHE",
    "lignes": [
      {
        "numeroLigne": 0,
        "dateComptabilisation": "2026-01-15",
        "montantEnCentimes": 7850,
        "libelle": "Supermarché",
        "nomSousCategorie": "SUPERMARCHE",
        "nomsBeneficiaires": ["MARCHE"]
      }
    ]
  }
]
```

`GET /monatis/operations/get/{numero}`
```json
{
  "numero": "OP-2026-0002",
  "libelle": "Supermarché",
  "dateValeur": "2026-01-15",
  "montantEnCentimes": 7850,
  "pointee": false,
  "typeOperation": { "code": "DEPENSE", "libelle": "Achats de biens ou de services à des personnes et des organismes n'appartenant pas au foyer (externe) par l'utilisation des fonds disponibles sur un compte courant (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-15",
      "montantEnCentimes": 7850,
      "libelle": "Supermarché",
      "sousCategorie": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
      "beneficiaires": [ { "nom": "MARCHE", "libelle": "Marché du coin" } ]
    }
  ]
}
```

`POST /monatis/operations/new`
```json
{
  "numero": "OP-2026-0002",
  "libelle": "Supermarché",
  "codeTypeOperation": "DEPENSE",
  "dateValeur": "2026-01-15",
  "montantEnCentimes": 7850,
  "identifiantCompteDepense": "CPT-COURANT-001",
  "identifiantCompteRecette": "EXTERNE-MARCHE",
  "nomSousCategorie": "SUPERMARCHE",
  "nomsBeneficiaires": ["MARCHE"]
}
```
```json
{
  "numero": "OP-2026-0002",
  "libelle": "Supermarché",
  "dateValeur": "2026-01-15",
  "montantEnCentimes": 7850,
  "pointee": false,
  "typeOperation": { "code": "DEPENSE", "libelle": "Achats de biens ou de services à des personnes et des organismes n'appartenant pas au foyer (externe) par l'utilisation des fonds disponibles sur un compte courant (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-15",
      "montantEnCentimes": 7850,
      "libelle": "Supermarché",
      "sousCategorie": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
      "beneficiaires": [ { "nom": "MARCHE", "libelle": "Marché du coin" } ]
    }
  ]
}
```

`PUT /monatis/operations/mod/{numero}`
```json
{
  "libelle": "Supermarché (maj)",
  "pointee": true
}
```
```json
{
  "numero": "OP-2026-0002",
  "libelle": "Supermarché (maj)",
  "dateValeur": "2026-01-15",
  "montantEnCentimes": 7850,
  "pointee": true,
  "typeOperation": { "code": "DEPENSE", "libelle": "Achats de biens ou de services à des personnes et des organismes n'appartenant pas au foyer (externe) par l'utilisation des fonds disponibles sur un compte courant (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-15",
      "montantEnCentimes": 7850,
      "libelle": "Supermarché (maj)",
      "sousCategorie": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
      "beneficiaires": [ { "nom": "MARCHE", "libelle": "Marché du coin" } ]
    }
  ]
}
```

`DELETE /monatis/operations/del/{numero}` → `204 No Content`

`POST /monatis/operations/transfert`
```json
{
  "numero": "OP-2026-0003",
  "libelle": "Virement interne",
  "dateValeur": "2026-01-20",
  "montantEnCentimes": 150000,
  "identifiantCompteCourantRecette": "CPT-COURANT-002",
  "identifiantCompteCourantDepense": "CPT-COURANT-001"
}
```
```json
{
  "numero": "OP-2026-0003",
  "libelle": "Virement interne",
  "dateValeur": "2026-01-20",
  "montantEnCentimes": 150000,
  "pointee": false,
  "typeOperation": { "code": "TRANSFERT", "libelle": "Transfert des fonds entre deux comptes de liquidités (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "CPT-COURANT-002", "libelle": "Compte courant 2", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 50000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-20",
      "montantEnCentimes": 150000,
      "libelle": "Virement interne",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```

`POST /monatis/operations/depense`
```json
{
  "numero": "OP-2026-0004",
  "libelle": "Supermarché",
  "dateValeur": "2026-01-21",
  "montantEnCentimes": 7850,
  "identifiantCompteExterne": "EXTERNE-MARCHE",
  "identifiantCompteCourant": "CPT-COURANT-001",
  "nomSousCategorie": "SUPERMARCHE",
  "nomsBeneficiaires": ["MARCHE"]
}
```
```json
{
  "numero": "OP-2026-0004",
  "libelle": "Supermarché",
  "dateValeur": "2026-01-21",
  "montantEnCentimes": 7850,
  "pointee": false,
  "typeOperation": { "code": "DEPENSE", "libelle": "Achats de biens ou de services à des personnes et des organismes n'appartenant pas au foyer (externe) par l'utilisation des fonds disponibles sur un compte courant (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "EXTERNE-MARCHE", "libelle": "Marché du coin" },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-21",
      "montantEnCentimes": 7850,
      "libelle": "Supermarché",
      "sousCategorie": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
      "beneficiaires": [ { "nom": "MARCHE", "libelle": "Marché du coin" } ]
    }
  ]
}
```

`POST /monatis/operations/recette`
```json
{
  "numero": "OP-2026-0005",
  "libelle": "Salaire",
  "dateValeur": "2026-01-25",
  "montantEnCentimes": 250000,
  "identifiantCompteExterne": "EXTERNE-ENTREPRISE",
  "identifiantCompteCourant": "CPT-COURANT-001",
  "nomSousCategorie": "RECETTE",
  "nomsBeneficiaires": ["ENTREPRISE"]
}
```
```json
{
  "numero": "OP-2026-0005",
  "libelle": "Salaire",
  "dateValeur": "2026-01-25",
  "montantEnCentimes": 250000,
  "pointee": false,
  "typeOperation": { "code": "RECETTE", "libelle": "Fonds en provenance de personnes ou d'organismes n'appartenant pas au foyer (externe) et mis à disposition sur un compte courant du foyer (interne/COURANT)" },
  "compteDepense": { "identifiant": "EXTERNE-ENTREPRISE", "libelle": "Entreprise" },
  "compteRecette": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-25",
      "montantEnCentimes": 250000,
      "libelle": "Salaire",
      "sousCategorie": { "nom": "RECETTE", "libelle": "Recette", "nomCategorie": "RECETTES" },
      "beneficiaires": [ { "nom": "ENTREPRISE", "libelle": "Entreprise" } ]
    }
  ]
}
```

`POST /monatis/operations/vente`
```json
{
  "numero": "OP-2026-0006",
  "libelle": "Vente meuble",
  "dateValeur": "2026-01-26",
  "montantEnCentimes": 9000,
  "identifiantCompteBien": "CPT-BIEN-001",
  "identifiantCompteExterne": "EXTERNE-ACHETEUR"
}
```
```json
{
  "numero": "OP-2026-0006",
  "libelle": "Vente meuble",
  "dateValeur": "2026-01-26",
  "montantEnCentimes": 9000,
  "pointee": false,
  "typeOperation": { "code": "VENTE", "libelle": "Vente d'un bien enregistré au patrimoine du foyer : diminutions de la valeur du compte de patrimoine (interne/PATRIMOINE) par la valeur du bien cédé à l'acheteur (externe)" },
  "compteDepense": { "identifiant": "CPT-BIEN-001", "libelle": "Bien patrimoine", "dateCloture": null, "codeTypeFonctionnement": "BIEN", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 1000000, "nomBanque": null, "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "EXTERNE-ACHETEUR", "libelle": "Acheteur" },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-26",
      "montantEnCentimes": 9000,
      "libelle": "Vente meuble",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```

`POST /monatis/operations/achat`
```json
{
  "numero": "OP-2026-0007",
  "libelle": "Achat meuble",
  "dateValeur": "2026-01-27",
  "montantEnCentimes": 12000,
  "identifiantCompteBien": "CPT-BIEN-001",
  "identifiantCompteExterne": "EXTERNE-VENDEUR"
}
```
```json
{
  "numero": "OP-2026-0007",
  "libelle": "Achat meuble",
  "dateValeur": "2026-01-27",
  "montantEnCentimes": 12000,
  "pointee": false,
  "typeOperation": { "code": "ACHAT", "libelle": "Achat d'un bien patrimonial par le foyer : augmentation du compte de patrimoine (interne/PATRIMOINE) par la valeur du bien cédé par le vendeur (externe)" },
  "compteDepense": { "identifiant": "EXTERNE-VENDEUR", "libelle": "Vendeur" },
  "compteRecette": { "identifiant": "CPT-BIEN-001", "libelle": "Bien patrimoine", "dateCloture": null, "codeTypeFonctionnement": "BIEN", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 1000000, "nomBanque": null, "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-27",
      "montantEnCentimes": 12000,
      "libelle": "Achat meuble",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```

`POST /monatis/operations/retrait`
```json
{
  "numero": "OP-2026-0008",
  "libelle": "Retrait épargne",
  "dateValeur": "2026-01-28",
  "montantEnCentimes": 50000,
  "identifiantCompteFinancier": "CPT-FIN-001",
  "identifiantCompteCourant": "CPT-COURANT-001"
}
```
```json
{
  "numero": "OP-2026-0008",
  "libelle": "Retrait épargne",
  "dateValeur": "2026-01-28",
  "montantEnCentimes": 50000,
  "pointee": false,
  "typeOperation": { "code": "RETRAIT", "libelle": "Retrait de fonds sur un compte d'épargne : récupération des fonds présents sur un compte financier (interne/FINANCIER) pour les mettre à disposition sur un compte courant (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-FIN-001", "libelle": "Epargne", "dateCloture": null, "codeTypeFonctionnement": "FINANCIER", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 200000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-28",
      "montantEnCentimes": 50000,
      "libelle": "Retrait épargne",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```

`POST /monatis/operations/liquidation`
```json
{
  "numero": "OP-2026-0009",
  "libelle": "Liquidation parts",
  "dateValeur": "2026-01-29",
  "montantEnCentimes": 80000,
  "identifiantCompteFinancier": "CPT-FIN-001",
  "identifiantCompteCourant": "CPT-COURANT-001"
}
```
```json
{
  "numero": "OP-2026-0009",
  "libelle": "Liquidation parts",
  "dateValeur": "2026-01-29",
  "montantEnCentimes": 80000,
  "pointee": false,
  "typeOperation": { "code": "LIQUID", "libelle": "Liquidation de parts sociales : récupération des fonds présents sur un compte financier (interne/FINANCIER) pour les mettre à disposition sur un compte courant (interne/COURANT)" },
  "compteDepense": { "identifiant": "CPT-FIN-001", "libelle": "Epargne", "dateCloture": null, "codeTypeFonctionnement": "FINANCIER", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 200000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-29",
      "montantEnCentimes": 80000,
      "libelle": "Liquidation parts",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```

`POST /monatis/operations/depot`
```json
{
  "numero": "OP-2026-0010",
  "libelle": "Dépôt épargne",
  "dateValeur": "2026-01-30",
  "montantEnCentimes": 60000,
  "identifiantCompteFinancier": "CPT-FIN-001",
  "identifiantCompteCourant": "CPT-COURANT-001"
}
```
```json
{
  "numero": "OP-2026-0010",
  "libelle": "Dépôt épargne",
  "dateValeur": "2026-01-30",
  "montantEnCentimes": 60000,
  "pointee": false,
  "typeOperation": { "code": "DEPOT", "libelle": "Dépôt sur un compte d'épargne : placement d'une partie des fonds disponibles d'un compte courant (interne/COURANT) sur un compte financier (interne/FINANCIER)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "CPT-FIN-001", "libelle": "Epargne", "dateCloture": null, "codeTypeFonctionnement": "FINANCIER", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 200000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-30",
      "montantEnCentimes": 60000,
      "libelle": "Dépôt épargne",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```

`POST /monatis/operations/investissement`
```json
{
  "numero": "OP-2026-0011",
  "libelle": "Investissement",
  "dateValeur": "2026-01-31",
  "montantEnCentimes": 70000,
  "identifiantCompteFinancier": "CPT-FIN-001",
  "identifiantCompteCourant": "CPT-COURANT-001"
}
```
```json
{
  "numero": "OP-2026-0011",
  "libelle": "Investissement",
  "dateValeur": "2026-01-31",
  "montantEnCentimes": 70000,
  "pointee": false,
  "typeOperation": { "code": "INVEST", "libelle": "Achat de parts sociales : placement d'une partie des fonds disponibles d'un compte courant (interne/COURANT) sur un compte financier (interne/FINANCIER)" },
  "compteDepense": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteRecette": { "identifiant": "CPT-FIN-001", "libelle": "Epargne", "dateCloture": null, "codeTypeFonctionnement": "FINANCIER", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 200000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "lignes": [
    {
      "numeroLigne": 0,
      "dateComptabilisation": "2026-01-31",
      "montantEnCentimes": 70000,
      "libelle": "Investissement",
      "sousCategorie": null,
      "beneficiaires": []
    }
  ]
}
```
### Évaluations

`GET /monatis/evaluations/all`
```json
[
  {
    "cle": "SOLDE-2026-01",
    "dateSolde": "2026-01-31",
    "montantSoldeEnCentimes": 350000,
    "libelle": "Solde mensuel",
    "identifiantCompteInterne": "CPT-COURANT-001",
    "identifiantompteTechnique": "TECH-001"
  }
]
```

`GET /monatis/evaluations/get/{cle}`
```json
{
  "cle": "SOLDE-2026-01",
  "dateSolde": "2026-01-31",
  "montantSoldeEnCentimes": 350000,
  "libelle": "Solde mensuel",
  "compteInterne": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteTechnique": { "identifiant": "TECH-001", "libelle": "Compte technique" }
}
```

`POST /monatis/evaluations/new`
```json
{
  "cle": "SOLDE-2026-01",
  "identifiantCompteInterne": "CPT-COURANT-001",
  "dateSolde": "2026-01-31",
  "libelle": "Solde mensuel",
  "montantSoldeEnCentimes": 350000
}
```
```json
{
  "cle": "SOLDE-2026-01",
  "dateSolde": "2026-01-31",
  "montantSoldeEnCentimes": 350000,
  "libelle": "Solde mensuel",
  "compteInterne": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteTechnique": { "identifiant": "TECH-001", "libelle": "Compte technique" }
}
```

`PUT /monatis/evaluations/mod/{cle}`
```json
{
  "libelle": "Solde mensuel (maj)"
}
```
```json
{
  "cle": "SOLDE-2026-01",
  "dateSolde": "2026-01-31",
  "montantSoldeEnCentimes": 350000,
  "libelle": "Solde mensuel (maj)",
  "compteInterne": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
  "compteTechnique": { "identifiant": "TECH-001", "libelle": "Compte technique" }
}
```

`DELETE /monatis/evaluations/del/{cle}` → `204 No Content`

### Budgets – Catégorie

`GET /monatis/budgets/categorie/all`
```json
[
  {
    "reference": { "nom": "ALIMENTATION", "libelle": "Alimentation", "nomsSousCategories": ["SUPERMARCHE"] },
    "budgets": [
      { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 30000 }
    ]
  }
]
```

`GET /monatis/budgets/categorie/get/{nom}`
```json
{
  "reference": { "nom": "ALIMENTATION", "libelle": "Alimentation", "nomsSousCategories": ["SUPERMARCHE"] },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 30000 }
  ]
}
```

`POST /monatis/budgets/categorie/new`
```json
{
  "nomReference": "ALIMENTATION",
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-01-01",
  "montantEnCentimes": 30000
}
```
```json
{
  "reference": { "nom": "ALIMENTATION", "libelle": "Alimentation", "nomsSousCategories": ["SUPERMARCHE"] },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 30000 }
  ]
}
```

`POST /monatis/budgets/categorie/next`
```json
{
  "nomReference": "ALIMENTATION",
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-02-01",
  "montantEnCentimes": 32000
}
```
```json
{
  "reference": { "nom": "ALIMENTATION", "libelle": "Alimentation", "nomsSousCategories": ["SUPERMARCHE"] },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-02-01", "dateFin": "2026-02-28", "montantEnCentimes": 32000 },
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 30000 }
  ]
}
```

`PUT /monatis/budgets/categorie/mod`
```json
{
  "nomReference": "ALIMENTATION",
  "dateCible": "2026-01-01",
  "montantEnCentimes": 28000
}
```
```json
{
  "reference": { "nom": "ALIMENTATION", "libelle": "Alimentation", "nomsSousCategories": ["SUPERMARCHE"] },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 28000 }
  ]
}
```

`DELETE /monatis/budgets/categorie/del` → `204 No Content`

### Budgets – Sous-catégorie

`GET /monatis/budgets/souscategorie/all`
```json
[
  {
    "reference": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
    "budgets": [
      { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 20000 }
    ]
  }
]
```

`GET /monatis/budgets/souscategorie/get/{nom}`
```json
{
  "reference": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 20000 }
  ]
}
```

`POST /monatis/budgets/souscategorie/new`
```json
{
  "nomReference": "SUPERMARCHE",
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-01-01",
  "montantEnCentimes": 20000
}
```
```json
{
  "reference": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 20000 }
  ]
}
```

`POST /monatis/budgets/souscategorie/next`
```json
{
  "nomReference": "SUPERMARCHE",
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-02-01",
  "montantEnCentimes": 21000
}
```
```json
{
  "reference": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-02-01", "dateFin": "2026-02-28", "montantEnCentimes": 21000 },
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 20000 }
  ]
}
```

`PUT /monatis/budgets/souscategorie/mod`
```json
{
  "nomReference": "SUPERMARCHE",
  "dateCible": "2026-01-01",
  "montantEnCentimes": 19000
}
```
```json
{
  "reference": { "nom": "SUPERMARCHE", "libelle": "Supermarché", "nomCategorie": "ALIMENTATION" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 19000 }
  ]
}
```

`DELETE /monatis/budgets/souscategorie/del` → `204 No Content`

### Budgets – Bénéficiaire

`GET /monatis/budgets/beneficiaire/all`
```json
[
  {
    "reference": { "nom": "MARCHE", "libelle": "Marché du coin" },
    "budgets": [
      { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 15000 }
    ]
  }
]
```

`GET /monatis/budgets/beneficiaire/get/{nom}`
```json
{
  "reference": { "nom": "MARCHE", "libelle": "Marché du coin" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 15000 }
  ]
}
```

`POST /monatis/budgets/beneficiaire/new`
```json
{
  "nomReference": "MARCHE",
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-01-01",
  "montantEnCentimes": 15000
}
```
```json
{
  "reference": { "nom": "MARCHE", "libelle": "Marché du coin" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 15000 }
  ]
}
```

`POST /monatis/budgets/beneficiaire/next`
```json
{
  "nomReference": "MARCHE",
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-02-01",
  "montantEnCentimes": 16000
}
```
```json
{
  "reference": { "nom": "MARCHE", "libelle": "Marché du coin" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-02-01", "dateFin": "2026-02-28", "montantEnCentimes": 16000 },
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 15000 }
  ]
}
```

`PUT /monatis/budgets/beneficiaire/mod`
```json
{
  "nomReference": "MARCHE",
  "dateCible": "2026-01-01",
  "montantEnCentimes": 14000
}
```
```json
{
  "reference": { "nom": "MARCHE", "libelle": "Marché du coin" },
  "budgets": [
    { "typePeriode": "Périodicité mensuelle [MOIS]", "dateDebut": "2026-01-01", "dateFin": "2026-01-31", "montantEnCentimes": 14000 }
  ]
}
```

`DELETE /monatis/budgets/beneficiaire/del` → `204 No Content`
### Rapports

`GET /monatis/rapports/releve_compte`
```json
{
  "identifiantCompte": "CPT-COURANT-001",
  "dateDebut": "2026-01-01",
  "dateFin": "2026-01-31"
}
```
```json
{
  "enteteCompte": {
    "identifiantCompte": "CPT-COURANT-001",
    "libelleCompte": "Compte courant",
    "codeTypeCompte": "INTERNE",
    "codeTypeFonctionnement": "COURANT",
    "libelleBanque": "Banque Postale",
    "libellesTitulaires": ["Alice"],
    "dateSoldeInitial": "2026-01-01",
    "montantSoldeInitialEnEuros": 1250.0
  },
  "dateDebutReleve": "2026-01-01",
  "dateFinReleve": "2026-01-31",
  "montantSoldeDebutReleveEnEuros": 1250.0,
  "montantSoldeFinReleveEnEuros": 1190.5,
  "montantTotalOperationsRecetteEnEuros": 2500.0,
  "montantTotalOperationsDepenseEnEuros": 2560.5,
  "operationsRecette": [
    {
      "numero": "OP-2026-0005",
      "codeTypeOperation": "RECETTE",
      "dateValeur": "2026-01-25",
      "libelle": "Salaire",
      "montantEnEuros": 2500.0,
      "identifiantAutreCompte": "EXTERNE-ENTREPRISE",
      "libelleAutreCompte": "Entreprise",
      "codeTypeAutreCompte": "EXTERNE"
    }
  ],
  "operationsDepense": [
    {
      "numero": "OP-2026-0004",
      "codeTypeOperation": "DEPENSE",
      "dateValeur": "2026-01-21",
      "libelle": "Supermarché",
      "montantEnEuros": 78.5,
      "identifiantAutreCompte": "EXTERNE-MARCHE",
      "libelleAutreCompte": "Marché du coin",
      "codeTypeAutreCompte": "EXTERNE"
    }
  ]
}
```

`GET /monatis/rapports/releve_compte/pdf` → Réponse binaire `application/pdf` (stream)

`GET /monatis/rapports/plus_moins_value/historique`
```json
{
  "identifiantCompte": "CPT-FIN-001",
  "codeTypePeriode": "MOIS",
  "dateDebut": "2026-01-01",
  "dateFin": "2026-06-30"
}
```
```json
{
  "enteteCompte": {
    "identifiantCompte": "CPT-FIN-001",
    "libelleCompte": "Epargne",
    "codeTypeCompte": "INTERNE",
    "codeTypeFonctionnement": "FINANCIER",
    "libelleBanque": "Banque Postale",
    "libellesTitulaires": ["Alice"],
    "dateSoldeInitial": "2026-01-01",
    "montantSoldeInitialEnEuros": 2000.0
  },
  "plusMoinsValues": [
    {
      "dateDebutEvaluation": "2026-01-01",
      "dateFinEvaluation": "2026-01-31",
      "montantSoldeInitialEnEuros": 2000.0,
      "montantSoldeFinalEnEuros": 2050.0,
      "montantReelEnEuros": 50.0,
      "montantTechniqueEnEuros": 0.0,
      "montantPlusMoinsValueEnEuros": 50.0,
      "montantPlusMoinsValueEnPourcentage": 2.5
    }
  ]
}
```

`GET /monatis/rapports/plus_moins_value/etat`
```json
{
  "codeTypePeriode": "MOIS",
  "dateCible": "2026-01-31"
}
```
```json
[
  {
    "enteteCompte": {
      "identifiantCompte": "CPT-FIN-001",
      "libelleCompte": "Epargne",
      "codeTypeCompte": "INTERNE",
      "codeTypeFonctionnement": "FINANCIER",
      "libelleBanque": "Banque Postale",
      "libellesTitulaires": ["Alice"],
      "dateSoldeInitial": "2026-01-01",
      "montantSoldeInitialEnEuros": 2000.0
    },
    "plusMoinsValue": {
      "dateDebutEvaluation": "2026-01-01",
      "dateFinEvaluation": "2026-01-31",
      "montantSoldeInitialEnEuros": 2000.0,
      "montantSoldeFinalEnEuros": 2050.0,
      "montantReelEnEuros": 50.0,
      "montantTechniqueEnEuros": 0.0,
      "montantPlusMoinsValueEnEuros": 50.0,
      "montantPlusMoinsValueEnPourcentage": 2.5
    }
  }
]
```

`GET /monatis/rapports/resumes_comptes_internes`
```json
{
  "dateCible": "2026-01-31"
}
```
```json
[
  {
    "typeFonctionnement": { "code": "COURANT", "libelle": "Compte servant à payer des dépenses ou à encaisser des recettes et ne donnant pas lieu à des plus ou moins values : compte bancaire, porte monnaie..." },
    "comptesInternes": [
      {
        "compteInterne": { "identifiant": "CPT-COURANT-001", "libelle": "Compte courant", "dateCloture": null, "codeTypeFonctionnement": "COURANT", "dateSoldeInitial": "2026-01-01", "montantSoldeInitialEnCentimes": 125000, "nomBanque": "BANQUE-POSTALE", "nomsTitulaires": ["ALICE"] },
        "dateSolde": "2026-01-31",
        "montantSoldeEnEuros": 1190.5
      }
    ]
  }
]
```

### CSV

`GET /monatis/csv/type/operation`
```
type,code,libelle
operation,DEPENSE,Achats de biens ou de services à des personnes et des organismes n'appartenant pas au foyer (externe) par l'utilisation des fonds disponibles sur un compte courant (interne/COURANT)
```

`GET /monatis/csv/operations/types`
```
type,code,libelle
operation,TRANSFERT,Transfert des fonds entre deux comptes de liquidités (interne/COURANT)
```

`GET /monatis/csv/operations/erreurs`
```
erreur,code,pattern
controle,OPE-CTRL-0000,Le numéro est obligatoire
```

`GET /monatis/csv/comptes/types`
```
type,code,libelle
compte,INTERNE,Compte appartenant à l'un au moins des membres du foyer
```

`GET /monatis/csv/comptes/erreurs`
```
erreur,code,pattern
controle,CPT-CTRL-0000,L'identifiant est obligatoire
```

`GET /monatis/csv/comptes/tables`
```
table,identifiant,libelle,date_solde_initial,solde_initial_en_centimes,type_fonctionnement,nom_banque,noms_titulaires
compte_interne,CPT-COURANT-001,Compte courant,2026-01-01,125000,COURANT,BANQUE-POSTALE,ALICE
```

`GET /monatis/csv/budgets/types`
```
type,code,libelle
periode,MOIS,Périodicité mensuelle
```

`GET /monatis/csv/budgets/erreurs`
```
erreur,code,pattern
controle,BUD-CTRL-0000,La référence est obligatoire
```

`GET /monatis/csv/budgets/tables`
```
table,code_type_reference,nom_reference,code_type_periode,date_debut,date_fin,montant_en_centimes
budget,CATEGORIE,ALIMENTATION,MOIS,2026-01-01,2026-02-01,30000
```

### Admin

`GET /monatis/admin/delete/all` → `204 No Content`

`GET /monatis/admin/init/basic` → `204 No Content`

`GET /monatis/admin/save` → `200 OK` (aucun contenu utile, sauvegarde désactivée)
## 11) Sources avec numéros de lignes

### Références
- Banque : `BanqueController#getAllReference` `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java:40`
- Banque : `BanqueController#getReferenceParNom` `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java:52`
- Banque : `BanqueController#creerReference` `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java:59`
- Banque : `BanqueController#modifierReference` `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java:68`
- Banque : `BanqueController#supprimerReference` `src/main/java/fr/colline/monatis/references/controller/banque/BanqueController.java:80`
- Bénéficiaire : `BeneficiaireController#getAllReference` `src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java:40`
- Bénéficiaire : `BeneficiaireController#getReferenceParNom` `src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java:52`
- Bénéficiaire : `BeneficiaireController#creerReference` `src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java:59`
- Bénéficiaire : `BeneficiaireController#modifierReference` `src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java:68`
- Bénéficiaire : `BeneficiaireController#supprimerReference` `src/main/java/fr/colline/monatis/references/controller/beneficiaire/BeneficiaireController.java:78`
- Catégorie : `CategorieController#getAllReference` `src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java:40`
- Catégorie : `CategorieController#getReferenceParNom` `src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java:52`
- Catégorie : `CategorieController#creerReference` `src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java:60`
- Catégorie : `CategorieController#modifierReference` `src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java:70`
- Catégorie : `CategorieController#supprimerReference` `src/main/java/fr/colline/monatis/references/controller/categorie/CategorieController.java:82`
- Sous-catégorie : `SousCategorieController#getAllReference` `src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java:40`
- Sous-catégorie : `SousCategorieController#getReferenceParNom` `src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java:52`
- Sous-catégorie : `SousCategorieController#creerReference` `src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java:60`
- Sous-catégorie : `SousCategorieController#modifierReference` `src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java:70`
- Sous-catégorie : `SousCategorieController#supprimerReference` `src/main/java/fr/colline/monatis/references/controller/souscategorie/SousCategorieController.java:82`
- Titulaire : `TitulaireController#getAllReference` `src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java:40`
- Titulaire : `TitulaireController#getReferenceParNom` `src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java:52`
- Titulaire : `TitulaireController#creerReference` `src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java:60`
- Titulaire : `TitulaireController#modifierReference` `src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java:70`
- Titulaire : `TitulaireController#supprimerReference` `src/main/java/fr/colline/monatis/references/controller/titulaire/TitulaireController.java:82`

### Comptes
- Compte interne : `CompteInterneController#getAllCompte` `src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java:45`
- Compte interne : `CompteInterneController#getCompteParIdentifiant` `src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java:57`
- Compte interne : `CompteInterneController#creerCompte` `src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java:68`
- Compte interne : `CompteInterneController#modifierCompte` `src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java:78`
- Compte interne : `CompteInterneController#supprimerCompte` `src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java:93`
- Compte interne : `CompteInterneController#getAllCompteParTypeFonctionnement` `src/main/java/fr/colline/monatis/comptes/controller/interne/CompteInterneController.java:104`
- Compte externe : `CompteExterneController#getAllCompte` `src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java:40`
- Compte externe : `CompteExterneController#getCompteParIdentifiant` `src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java:52`
- Compte externe : `CompteExterneController#creerCompte` `src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java:63`
- Compte externe : `CompteExterneController#modifierCompte` `src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java:73`
- Compte externe : `CompteExterneController#supprimerCompte` `src/main/java/fr/colline/monatis/comptes/controller/externe/CompteExterneController.java:88`
- Compte technique : `CompteTechniqueController#getAllCompte` `src/main/java/fr/colline/monatis/comptes/controller/technique/CompteTechniqueController.java:40`
- Compte technique : `CompteTechniqueController#getCompteParIdentifiant` `src/main/java/fr/colline/monatis/comptes/controller/technique/CompteTechniqueController.java:52`
- Compte technique : `CompteTechniqueController#creerCompte` `src/main/java/fr/colline/monatis/comptes/controller/technique/CompteTechniqueController.java:63`
- Compte technique : `CompteTechniqueController#modifierCompte` `src/main/java/fr/colline/monatis/comptes/controller/technique/CompteTechniqueController.java:73`
- Compte technique : `CompteTechniqueController#supprimerCompte` `src/main/java/fr/colline/monatis/comptes/controller/technique/CompteTechniqueController.java:88`

### Opérations
- `OperationController#getAllOperation` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:50`
- `OperationController#getOperationParNumero` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:62`
- `OperationController#creerOperation` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:71`
- `OperationController#modifierOperation` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:80`
- `OperationController#supprimerOperation` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:92`
- `OperationController#effectuerTransfert` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:99`
- `OperationController#effectuerDepense` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:113`
- `OperationController#effectuerRecette` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:129`
- `OperationController#effectuerVente` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:145`
- `OperationController#effectuerAchat` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:171`
- `OperationController#effectuerRetrait` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:195`
- `OperationController#effectuerLiquidation` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:209`
- `OperationController#effectuerDepot` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:223`
- `OperationController#effectuerInvestissement` `src/main/java/fr/colline/monatis/operations/controller/OperationController.java:237`

### Évaluations
- `EvaluationController#getAllEvaluation` `src/main/java/fr/colline/monatis/evaluations/controller/EvaluationController.java:46`
- `EvaluationController#getEvaluationParCle` `src/main/java/fr/colline/monatis/evaluations/controller/EvaluationController.java:62`
- `EvaluationController#creerEvaluation` `src/main/java/fr/colline/monatis/evaluations/controller/EvaluationController.java:71`
- `EvaluationController#modifierEvaluation` `src/main/java/fr/colline/monatis/evaluations/controller/EvaluationController.java:80`
- `EvaluationController#supprimerEvaluation` `src/main/java/fr/colline/monatis/evaluations/controller/EvaluationController.java:92`

### Budgets
- `BudgetCategorieController#getAllBudgets` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCategorieController.java:34`
- `BudgetCategorieController#getBudgetsParNomReference` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCategorieController.java:40`
- `BudgetCategorieController#creerBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCategorieController.java:47`
- `BudgetCategorieController#reconduireBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCategorieController.java:54`
- `BudgetCategorieController#modifierBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCategorieController.java:61`
- `BudgetCategorieController#supprimerBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCategorieController.java:69`
- `BudgetSousCategorieController#getAllBudgets` `src/main/java/fr/colline/monatis/budgets/controller/BudgetSousCategorieController.java:34`
- `BudgetSousCategorieController#getBudgetsParNomReference` `src/main/java/fr/colline/monatis/budgets/controller/BudgetSousCategorieController.java:40`
- `BudgetSousCategorieController#creerBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetSousCategorieController.java:47`
- `BudgetSousCategorieController#reconduireBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetSousCategorieController.java:54`
- `BudgetSousCategorieController#modifierBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetSousCategorieController.java:61`
- `BudgetSousCategorieController#supprimerBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetSousCategorieController.java:69`
- `BudgetBeneficiaireController#getAllBudgets` `src/main/java/fr/colline/monatis/budgets/controller/BudgetBeneficiaireController.java:34`
- `BudgetBeneficiaireController#getBudgetsParNomReference` `src/main/java/fr/colline/monatis/budgets/controller/BudgetBeneficiaireController.java:40`
- `BudgetBeneficiaireController#creerBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetBeneficiaireController.java:47`
- `BudgetBeneficiaireController#reconduireBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetBeneficiaireController.java:54`
- `BudgetBeneficiaireController#modifierBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetBeneficiaireController.java:61`
- `BudgetBeneficiaireController#supprimerBudget` `src/main/java/fr/colline/monatis/budgets/controller/BudgetBeneficiaireController.java:69`

### Rapports
- `RapportController#getReleveCompte` `src/main/java/fr/colline/monatis/rapports/controller/RapportController.java:52`
- `RapportController#getReleveComptePdf` `src/main/java/fr/colline/monatis/rapports/controller/RapportController.java:72`
- `RapportController#getHistoriquePlusMoinsValue` `src/main/java/fr/colline/monatis/rapports/controller/RapportController.java:93`
- `RapportController#getEtatPlusMoinsValue` `src/main/java/fr/colline/monatis/rapports/controller/RapportController.java:126`
- `RapportController#getListeResumeCompteInterne` `src/main/java/fr/colline/monatis/rapports/controller/RapportController.java:145`

### CSV
- `csvController#getCsvType` `src/main/java/fr/colline/monatis/rapports/controller/csv/csvController.java:30`
- `OperationCsvController#getCsvTypeOperation` `src/main/java/fr/colline/monatis/operations/controller/OperationCsvController.java:38`
- `OperationCsvController#getCsvErreurs` `src/main/java/fr/colline/monatis/operations/controller/OperationCsvController.java:52`
- `CompteCsvController#getCsvTypePeriode` `src/main/java/fr/colline/monatis/comptes/controller/CompteCsvController.java:47`
- `CompteCsvController#getCsvErreurs` `src/main/java/fr/colline/monatis/comptes/controller/CompteCsvController.java:64`
- `CompteCsvController#getCsvTables` `src/main/java/fr/colline/monatis/comptes/controller/CompteCsvController.java:84`
- `BudgetCsvController#getCsvTypePeriode` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCsvController.java:42`
- `BudgetCsvController#getCsvErreurs` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCsvController.java:56`
- `BudgetCsvController#getCsvTables` `src/main/java/fr/colline/monatis/budgets/controller/BudgetCsvController.java:76`

### Admin
- `IntialisationController#deleteAll` `src/main/java/fr/colline/monatis/admin/initialisation/IntialisationController.java:23`
- `IntialisationController#initialiserBasic` `src/main/java/fr/colline/monatis/admin/initialisation/IntialisationController.java:30`
- `SauvegardeController#getAll` `src/main/java/fr/colline/monatis/admin/sauvegarde/SauvegardeController.java:19`

## 12) Types TypeScript (optionnel)

```ts
export type DateISO = string;

export interface ErreurDto {
  typeErreur: string;
  typeDomaine: string;
  code: string;
  libelle: string;
  cause: ErreurDto | null;
}

export interface ReferenceRequestDto {
  nom?: string;
  libelle?: string;
}

export interface ReferenceResponseDto {
  nom: string;
  libelle: string | null;
}

export interface BanqueBasicResponseDto extends ReferenceResponseDto {
  identifiantsComptesInternes?: string[];
}

export interface BanqueSimpleResponseDto extends ReferenceResponseDto {
  comptesInternes?: CompteResponseDto[];
}

export interface CategorieBasicResponseDto extends ReferenceResponseDto {
  nomsSousCategories?: string[];
}

export interface CategorieSimpleResponseDto extends ReferenceResponseDto {
  sousCategories?: ReferenceResponseDto[];
}

export interface SousCategorieBasicResponseDto extends ReferenceResponseDto {
  nomCategorie?: string;
}

export interface SousCategorieSimpleResponseDto extends ReferenceResponseDto {
  categorie?: ReferenceResponseDto;
}

export interface TitulaireBasicResponseDto extends ReferenceResponseDto {
  identifiantsComptesInternes?: string[];
}

export interface TitulaireSimpleResponseDto extends ReferenceResponseDto {
  comptesInternes?: CompteResponseDto[];
}

export interface CompteRequestDto {
  identifiant?: string;
  libelle?: string;
}

export interface CompteResponseDto {
  identifiant: string;
  libelle: string | null;
}

export interface TypeFonctionnementDto {
  code: string;
  libelle: string;
}

export interface CompteInterneBasicResponseDto extends CompteResponseDto {
  dateCloture: DateISO | null;
  codeTypeFonctionnement: string;
  dateSoldeInitial: DateISO;
  montantSoldeInitialEnCentimes: number;
  nomBanque: string | null;
  nomsTitulaires: string[] | null;
}

export interface CompteInterneSimpleResponseDto extends CompteResponseDto {
  dateCloture: DateISO | null;
  typeFonctionnement: TypeFonctionnementDto;
  dateSoldeInitial: DateISO;
  montantSoldeInitialEnCentimes: number;
  banque: ReferenceResponseDto | null;
  titulaires: ReferenceResponseDto[] | null;
}

export interface OperationRequestDto {
  numero?: string;
  libelle?: string;
  dateValeur?: DateISO;
  montantEnCentimes?: number;
  identifiantCompteExterne?: string;
  identifiantCompteCourant?: string;
  identifiantCompteCourantRecette?: string;
  identifiantCompteCourantDepense?: string;
  identifiantCompteFinancier?: string;
  identifiantCompteBien?: string;
  nomSousCategorie?: string;
  nomsBeneficiaires?: string[];
}

export interface OperationCreationRequestDto {
  numero?: string;
  libelle?: string;
  codeTypeOperation: string;
  dateValeur?: DateISO;
  montantEnCentimes: number;
  identifiantCompteDepense: string;
  identifiantCompteRecette: string;
  nomSousCategorie?: string | null;
  nomsBeneficiaires?: string[] | null;
}

export interface OperationModificationRequestDto {
  numero?: string;
  libelle?: string;
  codeTypeOperation?: string;
  dateValeur?: DateISO;
  montantEnCentimes?: number;
  identifiantCompteDepense?: string;
  identifiantCompteRecette?: string;
  pointee?: boolean;
  lignes?: OperationLigneModificationRequestDto[];
}

export interface OperationLigneModificationRequestDto {
  numeroLigne?: number | null;
  libelle?: string;
  dateComptabilisation?: DateISO;
  montantEnCentimes?: number;
  nomSousCategorie?: string;
  nomsBeneficiaires?: string[];
}

export interface OperationResponseDto {
  numero: string;
  libelle: string | null;
  dateValeur: DateISO;
  montantEnCentimes: number;
  pointee: boolean;
}

export interface OperationBasicResponseDto extends OperationResponseDto {
  codeTypeOperation: string;
  identifiantCompteDepense: string;
  identifiantCompteRecette: string;
  lignes: OperationLigneBasicResponseDto[];
}

export interface TypeOperationResponseDto {
  code: string;
  libelle: string;
}

export interface OperationSimpleResponseDto extends OperationResponseDto {
  typeOperation: TypeOperationResponseDto;
  compteRecette: CompteResponseDto;
  compteDepense: CompteResponseDto;
  lignes: OperationLigneSimpleResponseDto[];
}

export interface OperationLigneBasicResponseDto {
  numeroLigne: number;
  dateComptabilisation: DateISO;
  montantEnCentimes: number;
  libelle: string | null;
  nomSousCategorie?: string | null;
  nomsBeneficiaires?: string[];
}

export interface OperationLigneSimpleResponseDto {
  numeroLigne: number;
  dateComptabilisation: DateISO;
  montantEnCentimes: number;
  libelle: string | null;
  sousCategorie?: ReferenceResponseDto | null;
  beneficiaires?: ReferenceResponseDto[];
}

export interface EvaluationCreationRequestDto {
  cle?: string;
  identifiantCompteInterne: string;
  dateSolde?: DateISO;
  libelle?: string;
  montantSoldeEnCentimes: number;
}

export interface EvaluationResponseDto {
  cle: string;
  dateSolde: DateISO;
  montantSoldeEnCentimes: number;
  libelle: string | null;
}

export interface EvaluationBasicResponseDto extends EvaluationResponseDto {
  identifiantCompteInterne: string;
  identifiantompteTechnique: string;
}

export interface EvaluationSimpleResponseDto extends EvaluationResponseDto {
  compteInterne: CompteResponseDto;
  compteTechnique: CompteResponseDto;
}

export interface BudgetRequestDto {
  nomReference: string;
  codeTypePeriode?: string;
  dateCible?: DateISO;
  montantEnCentimes?: number;
}

export interface BudgetResponseDto {
  typePeriode: string;
  dateDebut: DateISO;
  dateFin: DateISO;
  montantEnCentimes: number;
}

export interface BudgetsParReferenceResponseDto {
  reference: ReferenceResponseDto;
  budgets: BudgetResponseDto[];
}

export interface ReleveCompteRequestDto {
  identifiantCompte: string;
  dateDebut: DateISO;
  dateFin?: DateISO;
}

export interface ReleveCompteOperationResponseDto {
  numero: string;
  codeTypeOperation: string;
  dateValeur: DateISO;
  libelle: string | null;
  montantEnEuros: number;
  identifiantAutreCompte: string;
  libelleAutreCompte: string;
  codeTypeAutreCompte: string;
}

export interface ReleveCompteResponseDto {
  enteteCompte: unknown;
  dateDebutReleve: DateISO;
  dateFinReleve: DateISO;
  montantSoldeDebutReleveEnEuros: number;
  montantSoldeFinReleveEnEuros: number;
  montantTotalOperationsRecetteEnEuros: number;
  montantTotalOperationsDepenseEnEuros: number;
  operationsRecette: ReleveCompteOperationResponseDto[];
  operationsDepense: ReleveCompteOperationResponseDto[];
}

export interface EnteteCompteInterneResponseDto {
  identifiantCompte: string;
  libelleCompte: string;
  codeTypeCompte: string;
  codeTypeFonctionnement: string;
  libelleBanque: string | null;
  libellesTitulaires: string[] | null;
  dateSoldeInitial: DateISO;
  montantSoldeInitialEnEuros: number;
}

export interface EnteteCompteExterneResponseDto {
  identifiantCompte: string;
  libelleCompte: string;
  codeTypeCompte: string;
}

export interface EnteteCompteTechniqueResponseDto {
  identifiantCompte: string;
  libelleCompte: string;
  codeTypeCompte: string;
}

export interface HistoriquePlusMoinsValueRequestDto {
  identifiantCompte: string;
  codeTypePeriode?: string;
  dateDebut?: DateISO;
  dateFin?: DateISO;
}

export interface PlusMoinsValueResponseDto {
  dateDebutEvaluation: DateISO;
  dateFinEvaluation: DateISO;
  montantSoldeInitialEnEuros: number;
  montantSoldeFinalEnEuros: number;
  montantReelEnEuros: number;
  montantTechniqueEnEuros: number;
  montantPlusMoinsValueEnEuros: number;
  montantPlusMoinsValueEnPourcentage: number;
}

export interface HistoriquePlusMoinsValueResponseDto {
  enteteCompte: EnteteCompteInterneResponseDto | EnteteCompteExterneResponseDto | EnteteCompteTechniqueResponseDto;
  plusMoinsValues: PlusMoinsValueResponseDto[];
}

export interface EtatPlusMoinsValueRequestDto {
  codeTypePeriode: string;
  dateCible?: DateISO;
}

export interface EtatPlusMoinsValueResponseDto {
  enteteCompte: EnteteCompteInterneResponseDto | EnteteCompteExterneResponseDto | EnteteCompteTechniqueResponseDto;
  plusMoinsValue: PlusMoinsValueResponseDto;
}

export interface ListeCompteInterneRequestDto {
  dateCible?: DateISO;
}

export interface ResumeCompteInterneResponseDto {
  compteInterne: CompteResponseDto;
  dateSolde: DateISO;
  montantSoldeEnEuros: number;
}

export interface ListeResumeCompteInterneParTypeFonctionnementResponseDto {
  typeFonctionnement: TypeFonctionnementDto;
  comptesInternes: ResumeCompteInterneResponseDto[];
}
```

## INCONNU / À CONFIRMER
- Environnements `dev/staging/prod` et variables d’environnement non décrits dans le code. À vérifier dans un `README`, ou un éventuel `application-*.properties` (aucun trouvé dans `src/main/resources`).
- Exemple de réponses JSON complètes pour chaque endpoint (données réelles). À générer via des appels API après démarrage du backend.
- Internationalisation des messages d’erreur : fichiers `src/main/resources/internationalization/erreurs.properties` et `messages.properties` sont vides, donc les messages sont ceux des exceptions. À compléter si besoin.
