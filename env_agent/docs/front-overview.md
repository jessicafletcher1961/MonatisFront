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

## Identité visuelle

La barre haute affiche le logo MONATIS normalisé en WebP dans `src/assets/icons/monatis/brand/monatis-logo.webp`. Le clic sur la marque revient à l'aperçu.

La navigation haute reste compacte : marque, liens de section, bouton d'aide, bouton clair/sombre et menu mobile tiennent sur une seule barre réduite. Les routes n'affichent pas de titre de page redondant au-dessus du contenu ; les onglets, filtres et panneaux visibles portent le contexte réel de l'écran.

Le thème clair/sombre est piloté par les variables CSS de `src/index.css` et le choix est stocké dans `localStorage` sous `monatis-theme`. Les deux modes utilisent les mêmes rôles de couleur : accent principal, bleu, violet, corail, or, positif, alerte et danger. Les graphiques utilisent Recharts et les variables `--chart-1` à `--chart-12` pour garder des couleurs stables et lisibles dans les deux thèmes. Dans un même graphique, les couleurs sont attribuées de manière déterministe par libellé afin d'éviter que deux données différentes partagent la même teinte quand la palette le permet.

Les graphiques des synthèses `/analyse` et `/donnees` proposent un sélecteur local de forme quand plusieurs rendus sont pertinents : camembert, anneau, barres, colonnes, treemap, pont, courbe, aire, flux, heatmap, bulles, jauge d'exécution ou entonnoir. Ce sélecteur est présenté sous forme d'icônes compactes ; le mode aide décrit le rôle de chaque forme au survol. La préférence est conservée par emplacement dans `localStorage` avec la clé `monatis-chart:{chartId}`.

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
