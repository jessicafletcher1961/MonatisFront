export interface HelpRule {
  selector: string
  help: string | ((element: HTMLElement, context: HelpContext) => string)
}

export interface PageHelpRules {
  page: string
  matches: (location: Location) => boolean
  rules: HelpRule[]
}

export interface HelpContext {
  location: Location
}

export const referenceLabels: Record<string, string> = {
  banque: 'banque',
  titulaire: 'titulaire',
  beneficiaire: 'beneficiaire',
  categorie: 'categorie',
  souscategorie: 'sous-categorie',
}

export const accountLabels: Record<string, string> = {
  internes: 'compte interne',
  externes: 'compte externe',
}

export const dataLabels: Record<string, string> = {
  budgets: 'budgets',
  emprunts: 'emprunts',
  techniques: 'comptes techniques',
  evaluations: 'evaluations',
  imports: "regles d'import",
  typologies: 'typologies',
  admin: 'CSV et administration',
}

export function text(element: HTMLElement): string {
  return element.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

export function dataView(location: Location): string {
  return new URLSearchParams(location.search).get('view') ?? 'budgets'
}

export function referenceView(location: Location): string {
  return new URLSearchParams(location.search).get('view') ?? 'banque'
}

export function accountView(location: Location): string {
  return new URLSearchParams(location.search).get('account') ?? 'internes'
}

export function labelFor(map: Record<string, string>, key: string, fallback: string): string {
  return map[key] ?? fallback
}
