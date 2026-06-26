import type { ImportRuleRole, StatementImportRule, TypeOperation } from '../../lib/monatis-api'

export type ImportRuleFilter = 'all' | 'ready' | 'unused' | 'partial' | 'scoped'
export type ImportRuleStatus = 'ready' | 'unused' | 'partial'
export type ImportRuleScope = 'global' | 'scoped'

export interface ImportRuleViewModel {
  rule: StatementImportRule
  title: string
  typeLabel: string
  roleLabel: string
  status: ImportRuleStatus
  scope: ImportRuleScope
  qualityScore: number
  qualityMax: number
  usageCount: number
  lastUsageDate: string | null
  externalAccountLabel: string
  contextAccountLabel: string
  categoryLabel: string
  beneficiaries: string[]
  searchText: string
}

export interface ImportRulesSummary {
  totalRules: number
  readyRules: number
  unusedRules: number
  partialRules: number
  scopedRules: number
  totalUsages: number
  latestUsageDate: string | null
  withExternalAccount: number
  withCategory: number
  withBeneficiary: number
  topTypes: Array<{
    code: string
    label: string
    count: number
    usages: number
  }>
}

export function createImportOperationTypeLookup(types: TypeOperation[]): Map<string, TypeOperation> {
  return new Map(types.map((type) => [type.code, type]))
}

export function importRuleTitle(rule?: StatementImportRule | null): string {
  return rule?.libelleExemple?.trim() || rule?.cleLibelleNormalisee || 'Regle import'
}

export function importRuleTypeLabel(rule: StatementImportRule, typesByCode: Map<string, TypeOperation>): string {
  return typesByCode.get(rule.codeTypeOperation)?.libelleCourt || rule.codeTypeOperation
}

export function importRuleRoleLabel(role: ImportRuleRole): string {
  if (role === 'DEPENSE') {
    return 'Compte externe source'
  }

  return 'Compte externe destination'
}

export function importRuleStatusLabel(status: ImportRuleStatus): string {
  if (status === 'ready') {
    return 'Prete'
  }
  if (status === 'unused') {
    return 'Sans usage'
  }
  return 'A completer'
}

export function importRuleStatusHint(model: ImportRuleViewModel): string {
  if (model.status === 'ready') {
    return 'La regle contient le type, la contrepartie et la classification utiles a la suggestion.'
  }
  if (model.status === 'unused') {
    return 'La regle existe mais n a pas encore ete reutilisee apres son apprentissage.'
  }
  return 'La regle ne renseigne pas encore assez de routage pour automatiser une ligne sans controle.'
}

export function importRuleStatusTone(status: ImportRuleStatus): 'default' | 'success' | 'warning' {
  if (status === 'ready') {
    return 'success'
  }
  if (status === 'partial') {
    return 'warning'
  }
  return 'default'
}

export function buildImportRuleViewModels(
  rules: StatementImportRule[],
  typesByCode: Map<string, TypeOperation>,
): ImportRuleViewModel[] {
  return rules.map((rule) => {
    const title = importRuleTitle(rule)
    const beneficiaries = rule.nomsBeneficiaires ?? []
    const typeLabel = importRuleTypeLabel(rule, typesByCode)
    const roleLabel = importRuleRoleLabel(rule.roleCompteExterne)
    const contextAccountLabel = compactLabel(rule.libelleCompteInterneContexte, rule.identifiantCompteInterneContexte)
    const externalAccountLabel = compactLabel(rule.libelleCompteExterne, rule.identifiantCompteExterne)
    const categoryLabel = compactLabel(rule.libelleSousCategorie, rule.nomSousCategorie)
    const usageCount = rule.nombreUtilisations ?? 0
    const qualityScore = [
      Boolean(rule.codeTypeOperation),
      Boolean(rule.roleCompteExterne),
      Boolean(rule.identifiantCompteExterne),
      Boolean(rule.nomSousCategorie || rule.libelleSousCategorie),
      beneficiaries.length > 0,
    ].filter(Boolean).length
    const status: ImportRuleStatus = usageCount <= 0 ? 'unused' : qualityScore >= 4 ? 'ready' : 'partial'
    const scope: ImportRuleScope = rule.identifiantCompteInterneContexte ? 'scoped' : 'global'

    return {
      rule,
      title,
      typeLabel,
      roleLabel,
      status,
      scope,
      qualityScore,
      qualityMax: 5,
      usageCount,
      lastUsageDate: rule.dateDerniereUtilisation,
      externalAccountLabel,
      contextAccountLabel,
      categoryLabel,
      beneficiaries,
      searchText: [
        title,
        rule.cleLibelleNormalisee,
        typeLabel,
        rule.codeTypeOperation,
        roleLabel,
        contextAccountLabel,
        externalAccountLabel,
        categoryLabel,
        beneficiaries,
        importRuleStatusLabel(status),
      ]
        .flat()
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    }
  })
}

export function filterImportRuleViewModels(
  models: ImportRuleViewModel[],
  search: string,
  filter: ImportRuleFilter,
): ImportRuleViewModel[] {
  const needle = search.trim().toLowerCase()

  return models.filter((model) => {
    if (needle && !model.searchText.includes(needle)) {
      return false
    }
    if (filter === 'ready') {
      return model.status === 'ready'
    }
    if (filter === 'unused') {
      return model.status === 'unused'
    }
    if (filter === 'partial') {
      return model.status === 'partial'
    }
    if (filter === 'scoped') {
      return model.scope === 'scoped'
    }
    return true
  })
}

export function summarizeImportRules(models: ImportRuleViewModel[]): ImportRulesSummary {
  const typeTotals = new Map<string, { code: string; label: string; count: number; usages: number }>()
  let latestUsageDate: string | null = null

  for (const model of models) {
    const current = typeTotals.get(model.rule.codeTypeOperation) ?? {
      code: model.rule.codeTypeOperation,
      label: model.typeLabel,
      count: 0,
      usages: 0,
    }
    current.count += 1
    current.usages += model.usageCount
    typeTotals.set(model.rule.codeTypeOperation, current)

    if (model.lastUsageDate && (!latestUsageDate || Date.parse(model.lastUsageDate) > Date.parse(latestUsageDate))) {
      latestUsageDate = model.lastUsageDate
    }
  }

  return {
    totalRules: models.length,
    readyRules: models.filter((model) => model.status === 'ready').length,
    unusedRules: models.filter((model) => model.status === 'unused').length,
    partialRules: models.filter((model) => model.status === 'partial').length,
    scopedRules: models.filter((model) => model.scope === 'scoped').length,
    totalUsages: models.reduce((total, model) => total + model.usageCount, 0),
    latestUsageDate,
    withExternalAccount: models.filter((model) => Boolean(model.rule.identifiantCompteExterne)).length,
    withCategory: models.filter((model) => Boolean(model.rule.nomSousCategorie || model.rule.libelleSousCategorie)).length,
    withBeneficiary: models.filter((model) => model.beneficiaries.length > 0).length,
    topTypes: Array.from(typeTotals.values())
      .sort((left, right) => right.count - left.count || right.usages - left.usages)
      .slice(0, 3),
  }
}

function compactLabel(label?: string | null, fallback?: string | null): string {
  const normalizedLabel = label?.trim()
  const normalizedFallback = fallback?.trim()
  if (normalizedLabel && normalizedFallback && normalizedLabel !== normalizedFallback) {
    return `${normalizedLabel} (${normalizedFallback})`
  }

  return normalizedLabel || normalizedFallback || 'Non renseigne'
}
