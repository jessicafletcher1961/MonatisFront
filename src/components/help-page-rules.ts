import {
  accountLabels,
  accountView,
  dataLabels,
  dataView,
  labelFor,
  referenceLabels,
  referenceView,
  text,
  type PageHelpRules,
} from './help-content-utils'

export const pageRules: PageHelpRules[] = [
  {
    page: 'Tableau de bord',
    matches: (location) => location.pathname === '/',
    rules: [
      {
        selector: '.dashboard-launch-row',
        help: "Raccourci principal : ouvre directement la creation manuelle d'une operation.",
      },
      {
        selector: '.module-card-link',
        help: (element) => `Acces rapide "${text(element)}" : ouvre la section correspondante avec ses listes, formulaires et actions.`,
      },
      {
        selector: '.stat-grid',
        help: "Grille d'indicateurs : rassemble les volumes principaux charges depuis le back pour verifier rapidement l'etat de la base.",
      },
    ],
  },
  {
    page: 'Operations',
    matches: (location) => location.pathname === '/operations' && dataView(location) !== 'comptes',
    rules: [
      {
        selector: '.operation-history-row',
        help: "Operation de l'historique : ouvre le detail complet, avec resume, lignes comptables, comptes, montant, date et actions d'edition.",
      },
      {
        selector: '.operation-history-main',
        help: "Libelle et date : identifient rapidement l'operation avant ouverture du detail.",
      },
      {
        selector: '.operation-history-flow',
        help: "Flux de l'operation : indique le type d'operation et les comptes source/destination impliques.",
      },
      {
        selector: '.operation-history-amount',
        help: "Montant de l'operation : valeur totale avant repartition eventuelle en lignes comptables.",
      },
      {
        selector: '.operation-overview-grid',
        help: "Resume d'operation : regroupe type, comptes, montant, date, libelle et statut de pointage.",
      },
      {
        selector: '.operation-lines-section',
        help: "Lignes de l'operation : repartissent l'operation entre categories, sous-categories, beneficiaires, dates de comptabilisation et montants.",
      },
      {
        selector: '.line-editor-card',
        help: "Ligne comptable : ouvrez-la pour modifier son libelle, sa categorisation, son beneficiaire, sa date et son montant.",
      },
      {
        selector: '.line-editor-toggle',
        help: "Bandeau de ligne : ouvre ou replie la ligne comptable. Le titre par defaut reste Ligne 0, Ligne 1, etc. tant que l'utilisateur ne change pas le libelle.",
      },
      {
        selector: '.line-editor-delete-button',
        help: "Supprime uniquement cette ligne supplementaire. La ligne de base reste presente pour equilibrer l'operation.",
      },
      {
        selector: '.wizard-summary-card',
        help: "Resume de creation : rappelle une valeur deja choisie dans l'assistant ; les cartes editables permettent de revenir au choix correspondant.",
      },
      {
        selector: '.operation-create-validation, .operation-create-summary',
        help: 'Validation de creation : verifie les champs principaux et les lignes comptables avant enregistrement.',
      },
      {
        selector: '.statement-import-overlay-layer, .statement-import-create-overlay-layer, .statement-import-list-controls',
        help: "Import de releve : analyse un PDF, propose des operations, detecte les doublons et peut apprendre des regles d'import.",
      },
      {
        selector: '.statement-import-duplicate-preview-section',
        help: "Comparaison de doublon : montre l'operation du releve et l'operation deja presente pour decider quoi importer, garder ou ignorer.",
      },
      {
        selector: '.statement-import-selected-only-filter',
        help: "Filtre d'import : affiche seulement les operations cochees pour revoir la selection avant enregistrement.",
      },
    ],
  },
  {
    page: 'Comptes',
    matches: (location) => location.pathname === '/operations' && dataView(location) === 'comptes',
    rules: [
      {
        selector: '.compact-entity-row.account-row',
        help: (_element, context) =>
          accountView(context.location) === 'externes'
            ? "Compte externe : compte d'une banque externe utilise comme contrepartie ou source dans les operations."
            : 'Compte interne : compte suivi dans MONATIS, utilise dans les operations, rapports et evaluations.',
      },
      {
        selector: '.operation-history-reference',
        help: 'Reference du compte : banque, titulaire ou information de rattachement selon le type de compte.',
      },
      {
        selector: '.operation-history-amount',
        help: 'Solde ou montant de synthese associe au compte affiche.',
      },
      {
        selector: '.section-toggle, .section-toggle-button',
        help: "Section du compte : ouvre ou replie un groupe d'informations comme les rattachements, evaluations ou operations liees.",
      },
      {
        selector: '.mini-card.selectable, .mini-card',
        help: (_element, context) => {
          const label = labelFor(accountLabels, accountView(context.location), 'compte')
          return `Information liee au ${label} : affiche une evaluation, une operation recente ou une valeur associee au detail.`
        },
      },
    ],
  },
  {
    page: 'References',
    matches: (location) => location.pathname === '/references',
    rules: [
      {
        selector: '.compact-entity-row.reference-row, .list-row',
        help: (_element, context) => {
          const label = labelFor(referenceLabels, referenceView(context.location), 'reference')
          return `Reference ${label} : ouvre le detail pour consulter, modifier ou supprimer cette entree de referentiel.`
        },
      },
      {
        selector: '.workspace-switcher',
        help: 'Choix du referentiel : bascule entre banques, titulaires, beneficiaires, categories et sous-categories.',
      },
      {
        selector: '.search-action-row',
        help: 'Selection de rattachement : recherche une categorie existante ou cree rapidement la reference manquante.',
      },
      {
        selector: '.detail-card',
        help: 'Information de reference : montre les liens utiles, par exemple categorie parente ou comptes rattaches selon le type.',
      },
      {
        selector: '.operation-overview-card',
        help: (_element, context) => {
          const label = labelFor(referenceLabels, referenceView(context.location), 'reference')
          return `Champ de ${label} : modifie le nom, le libelle ou le rattachement selon le referentiel ouvert.`
        },
      },
    ],
  },
  {
    page: 'Donnees back',
    matches: (location) => location.pathname === '/donnees',
    rules: [
      {
        selector: '.workspace-switcher',
        help: 'Navigation donnees back : choisit le domaine admin a afficher, comme budgets, emprunts, evaluations, imports, typologies ou CSV/admin.',
      },
      {
        selector: '.budget-command-bar',
        help: 'Barre budget : choisit le type de reference budgetee et ouvre la creation du budget correspondant.',
      },
      {
        selector: '.budget-summary-item',
        help: 'Synthese budget : montre le realise, le prevu, le disponible et les alertes des budgets actifs.',
      },
      {
        selector: '.budget-row',
        help: 'Budget : ouvre son detail et affiche le type, la periode, la reference, le realise, le reste et le rythme attendu.',
      },
      {
        selector: '.budget-section-title',
        help: 'Groupe temporel : separe les budgets en cours, a venir et passes pour faciliter la lecture.',
      },
      {
        selector: '.budget-form-preview',
        help: 'Apercu du budget : resume le type, le montant, la reference et la periode qui sera creee par le back.',
      },
      {
        selector: '.budget-filter-row',
        help: 'Filtres budget : limite la liste par sens du budget et par statut temporel de la periode.',
      },
      {
        selector: '.budget-detail-hero',
        help: 'Resume du budget ouvert : met en avant le sens entree/sortie, le montant, la periode et la reference budgetee.',
      },
      {
        selector: '.budget-detail-follow-up',
        help: 'Suivi du budget ouvert : compare le realise aux operations de la periode et indique ce qui reste ou depasse.',
      },
      {
        selector: '.list-row',
        help: (_element, context) => {
          const view = dataView(context.location)
          if (view === 'emprunts') return 'Emprunt : ouvre son detail, ses conditions et ses echeances calculees.'
          if (view === 'techniques') return 'Compte technique : ouvre le compte utilise pour les flux techniques et les rapports.'
          if (view === 'evaluations') return 'Evaluation : ouvre la valorisation rattachee a un compte interne.'
          if (view === 'imports') return "Regle d'import : ouvre la regle active qui sert aux suggestions pendant l'import de releve."
          return `Element ${labelFor(dataLabels, view, 'donnees back')} : ouvre son detail ou ses actions disponibles.`
        },
      },
      {
        selector: '.loan-condition-editor',
        help: "Condition d'emprunt : definit les dates, taux, capital, assurance et echeances d'une partie du pret.",
      },
      {
        selector: '.data-panel',
        help: (_element, context) => {
          const view = dataView(context.location)
          if (view === 'emprunts') return 'Bloc emprunt : regroupe les informations de pret, ses conditions et les echeances calculees par le back.'
          if (view === 'admin') return 'Bloc admin : regroupe une action technique comme export CSV, sauvegarde, restauration, script ou vidange.'
          if (view === 'typologies') return 'Bloc typologie : affiche une famille de valeurs techniques exposees par le back.'
          return 'Bloc de configuration : regroupe les champs et actions du domaine donnees back actif.'
        },
      },
      {
        selector: '.loan-payments-section, .report-table-soft',
        help: 'Echeances d emprunt : affiche le calcul renvoye par le back et permet une recherche par numero ou date.',
      },
      {
        selector: '.admin-action-card, .csv-admin-card',
        help: 'Action admin : manipule des exports, imports, sauvegardes ou commandes techniques. A utiliser avec attention.',
      },
      {
        selector: '.mini-card',
        help: (_element, context) =>
          dataView(context.location) === 'typologies'
            ? 'Typologie : valeur de referentiel technique exposee par le back et utilisee dans les formulaires.'
            : 'Carte compacte : resume une valeur associee au detail courant.',
      },
    ],
  },
  {
    page: 'Analyse',
    matches: (location) => location.pathname === '/analyse',
    rules: [
      {
        selector: '.tab-button',
        help: "Onglet de rapport : change le type d'analyse affiche sans quitter la page Analyse.",
      },
      {
        selector: '.releve-filter-panel',
        help: 'Filtres du releve : choisit le compte et la periode utilises pour recalculer recettes, depenses et solde.',
      },
      {
        selector: '.releve-account-panel',
        help: 'Compte analyse : rappelle le compte, la periode et les informations de contexte du releve courant.',
      },
      {
        selector: '.releve-stat-grid .stat-card',
        help: 'Indicateur de releve : resume solde de debut, recettes, depenses ou solde de fin sur la periode choisie.',
      },
      {
        selector: '.report-switch-chip',
        help: 'Affichage du releve : choisit si les recettes, les depenses ou les deux colonnes sont visibles.',
      },
      {
        selector: '.report-line-card',
        help: "Ligne de rapport : represente une operation ou un agregat affiche dans l'analyse courante.",
      },
      {
        selector: '.report-section-toggle',
        help: "Section de rapport repliable : ouvre ou ferme un groupe de resultats pour garder l'analyse lisible.",
      },
      {
        selector: '.report-inline-summary',
        help: 'Synthese de periode : affiche les totaux calcules pour les periodes visibles.',
      },
      {
        selector: '.report-hover-wrap',
        help: 'Detail au survol : donne des informations complementaires sur la ligne ou la valeur du rapport.',
      },
      {
        selector: '.report-table-soft .report-cell-main, .cell-subline',
        help: 'Cellule de rapport : combine le montant principal avec des sous-valeurs comme taux, frais, operations ou ecarts selon le rapport.',
      },
    ],
  },
]
