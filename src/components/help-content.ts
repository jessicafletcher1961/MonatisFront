import { pageRules } from './help-page-rules'
import { text, type HelpContext, type HelpRule } from './help-content-utils'

function fieldButtonLabel(element: HTMLElement): string {
  return element.querySelector('.operation-filter-button-label')?.textContent?.trim() || element.querySelector('span')?.textContent?.trim() || text(element) || 'Filtre'
}

function selectedValue(element: HTMLElement): string {
  return element.querySelector('strong')?.textContent?.trim() || text(element)
}

const globalRules: HelpRule[] = [
  {
    selector: '.workspace-switcher',
    help: 'Barre de changement de vue : elle modifie le sous-ecran affiche sans quitter la grande rubrique courante.',
  },
  {
    selector: '.catalog-panel',
    help: 'Panneau de liste : il regroupe les filtres, la recherche, la pagination et les resultats selectionnables.',
  },
  {
    selector: '.operation-filter-stack, .operation-search-pagination-row, .budget-toolbar',
    help: 'Zone de filtres : elle limite les donnees visibles sans supprimer ni modifier les elements en base.',
  },
  {
    selector: '.operation-filter-button, .picker-field',
    help: (element) => `Filtre "${fieldButtonLabel(element)}" : ouvre un choix detaille pour limiter les resultats affiches. Valeur actuelle : ${selectedValue(element)}.`,
  },
  {
    selector: '.filter-choice-card, .picker-option, .sub-category-option, .statement-import-choice',
    help: (element) => `Choix "${text(element)}" : applique cette valeur au filtre ou au champ en cours.`,
  },
  {
    selector: '.range-filter-row',
    help: 'Filtre de periode : definit une date de debut, une date de fin ou une annee de reference pour recalculer la vue.',
  },
  {
    selector: '.catalog-list-controls, .report-pagination-controls',
    help: "Pagination : controle le nombre d'elements affiches et le passage entre les pages de resultats.",
  },
  {
    selector: '.catalog-page-size',
    help: "Taille de page : choisit combien d'elements sont visibles a la fois dans cette liste.",
  },
  {
    selector: '.catalog-page-buttons',
    help: 'Boutons de pagination : reculent ou avancent dans la liste courante.',
  },
  {
    selector: '.operation-overview-card, .detail-card',
    help: "Carte de detail : affiche une information structurante de l'element ouvert.",
  },
  {
    selector: '.detail-footer-actions',
    help: 'Actions du detail : les validations ou actions secondaires restent a gauche, la suppression reste a droite.',
  },
  {
    selector: '.detail-delete-button',
    help: "Suppression : supprime l'element ouvert apres confirmation quand l'ecran le demande.",
  },
  {
    selector: '.table-wrapper, .report-table',
    help: "Tableau de donnees : compare les lignes et colonnes calculees ou chargees pour l'ecran courant.",
  },
  {
    selector: '.pill-list, .badge',
    help: "Etiquette d'information : resume un statut, une categorie ou une valeur courte associee a l'element.",
  },
  {
    selector: '.floating-panel-body',
    help: "Corps du cadre : contient le formulaire, les details ou les actions de l'element selectionne.",
  },
  {
    selector: '.floating-panel-nav-header',
    help: "Bandeau de navigation du cadre : indique la position de l'element dans la liste, son titre, et permet de passer au precedent, au suivant ou de fermer.",
  },
  {
    selector: '.module-card',
    help: (element) => `Module "${text(element)}" : ouvre la grande section correspondante de MONATIS.`,
  },
]

function ruleHelp(rule: HelpRule, element: HTMLElement, context: HelpContext): string {
  return typeof rule.help === 'function' ? rule.help(element, context) : rule.help
}

function matchRule(element: HTMLElement, rule: HelpRule, context: HelpContext): string | null {
  const matched = element.closest<HTMLElement>(rule.selector)
  return matched ? ruleHelp(rule, matched, context) : null
}

export function pageSpecificHelp(element: HTMLElement, location: Location = window.location): string | null {
  const context = { location }
  const page = pageRules.find((rules) => rules.matches(location))
  if (page) {
    for (const rule of page.rules) {
      const help = matchRule(element, rule, context)
      if (help) return help
    }
  }

  for (const rule of globalRules) {
    const help = matchRule(element, rule, context)
    if (help) return help
  }

  return null
}
