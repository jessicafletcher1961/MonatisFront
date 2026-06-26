import type { Typology, TypologyResource } from '../../lib/monatis-api'

export type TypologyFlagFilter = 'all' | 'technical' | 'business' | 'categorisable' | 'uncategorisable'

export interface TypologyGroupDefinition {
  resource: TypologyResource
  title: string
  shortTitle: string
  description: string
  usage: string
}

export interface TypologyGroupViewModel extends TypologyGroupDefinition {
  items: Typology[]
}

export interface TypologySummary {
  groupCount: number
  totalValues: number
  operationValues: number
  technicalValues: number
  categorisableValues: number
  nonCategorisableValues: number
  largestGroupTitle: string
  largestGroupCount: number
}

export const typologyGroups: TypologyGroupDefinition[] = [
  {
    resource: 'fonctionnement',
    title: 'Fonctionnements',
    shortTitle: 'Fonctionnement',
    description: 'Nature des comptes internes.',
    usage: 'Utilise pour segmenter les comptes internes, les rapports de patrimoine, les remunerations et frais.',
  },
  {
    resource: 'compte',
    title: 'Types de comptes',
    shortTitle: 'Comptes',
    description: 'Familles de comptes MONATIS.',
    usage: 'Distingue les comptes internes, externes et techniques dans les controles back.',
  },
  {
    resource: 'operation',
    title: 'Types operations',
    shortTitle: 'Operations',
    description: 'Routage comptable et flags metier.',
    usage: 'Pilote les compatibilites de comptes, les flux techniques et la categorisation des lignes.',
  },
  {
    resource: 'periode',
    title: 'Periodes',
    shortTitle: 'Periodes',
    description: 'Granularite temporelle.',
    usage: 'Utilise par les budgets, emprunts et rapports pour recadrer les dates et calculer les periodes.',
  },
  {
    resource: 'budget',
    title: 'Types budgets',
    shortTitle: 'Budgets',
    description: 'Sens de suivi budgetaire.',
    usage: 'Determine si un budget suit une entree attendue ou une sortie limitee.',
  },
  {
    resource: 'programmation',
    title: 'Programmations',
    shortTitle: 'Programmation',
    description: 'Frequences de planification.',
    usage: 'Expose les frequences disponibles pour les mecanismes planifies du back.',
  },
  {
    resource: 'reference',
    title: 'Types references',
    shortTitle: 'References',
    description: 'Familles de referentiels.',
    usage: 'Decrit les banques, titulaires, beneficiaires, categories et sous-categories manipules par les references.',
  },
]

export function buildTypologyGroups(itemsByResource: Partial<Record<TypologyResource, Typology[]>>): TypologyGroupViewModel[] {
  return typologyGroups.map((group) => ({
    ...group,
    items: [...(itemsByResource[group.resource] ?? [])].sort(compareTypologies),
  }))
}

export function filterTypologyItems(items: Typology[], search: string, flagFilter: TypologyFlagFilter): Typology[] {
  const needle = search.trim().toLowerCase()

  return items.filter((item) => {
    if (needle && !typologySearchText(item).includes(needle)) {
      return false
    }
    if (flagFilter === 'technical') {
      return item.fluxTechnique === true
    }
    if (flagFilter === 'business') {
      return item.fluxTechnique === false
    }
    if (flagFilter === 'categorisable') {
      return item.categorisable === true
    }
    if (flagFilter === 'uncategorisable') {
      return item.categorisable === false
    }
    return true
  })
}

export function summarizeTypologies(groups: TypologyGroupViewModel[]): TypologySummary {
  const operationValues = groups.find((group) => group.resource === 'operation')?.items ?? []
  const largestGroup = groups.reduce<TypologyGroupViewModel | null>((current, group) => {
    if (!current || group.items.length > current.items.length) {
      return group
    }
    return current
  }, null)

  return {
    groupCount: groups.length,
    totalValues: groups.reduce((sum, group) => sum + group.items.length, 0),
    operationValues: operationValues.length,
    technicalValues: operationValues.filter((item) => item.fluxTechnique).length,
    categorisableValues: operationValues.filter((item) => item.categorisable).length,
    nonCategorisableValues: operationValues.filter((item) => item.categorisable === false).length,
    largestGroupTitle: largestGroup?.shortTitle ?? 'Typologies',
    largestGroupCount: largestGroup?.items.length ?? 0,
  }
}

export function typologyFlagLabels(item: Typology): Array<{ label: string; tone: 'default' | 'success' | 'warning' }> {
  const labels: Array<{ label: string; tone: 'default' | 'success' | 'warning' }> = []
  if (item.libelleCourt) {
    labels.push({ label: item.libelleCourt, tone: 'default' })
  }
  if (item.fluxTechnique) {
    labels.push({ label: 'Flux technique', tone: 'warning' })
  }
  if (item.categorisable === true) {
    labels.push({ label: 'Categorisable', tone: 'success' })
  }
  if (item.categorisable === false) {
    labels.push({ label: 'Non categorisable', tone: 'default' })
  }
  return labels
}

function typologySearchText(item: Typology): string {
  return [
    item.code,
    item.libelle,
    item.libelleCourt,
    item.fluxTechnique === true ? 'flux technique technique' : '',
    item.fluxTechnique === false ? 'flux metier' : '',
    item.categorisable === true ? 'categorisable' : '',
    item.categorisable === false ? 'non categorisable' : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function compareTypologies(left: Typology, right: Typology): number {
  return left.code.localeCompare(right.code)
}
