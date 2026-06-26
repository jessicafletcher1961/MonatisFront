import type { AdminBackup, CsvExportKey } from '../../lib/monatis-api'

export type AdminRiskLevel = 'safe' | 'review' | 'danger'

export interface AdminCsvItem {
  key: CsvExportKey
  label: string
  description: string
}

export interface AdminCsvGroup {
  title: string
  description: string
  items: AdminCsvItem[]
}

export const adminCsvGroups: AdminCsvGroup[] = [
  {
    title: 'Comptes',
    description: 'Typologies, erreurs et tables de comptes.',
    items: [
      { key: 'comptes-types', label: 'Types', description: 'Types de compte et fonctionnements.' },
      { key: 'comptes-erreurs', label: 'Erreurs', description: 'Catalogue des erreurs comptes.' },
      { key: 'comptes-tables', label: 'Tables', description: 'Export des comptes internes, externes et techniques.' },
    ],
  },
  {
    title: 'Operations',
    description: 'Typologies et erreurs des operations.',
    items: [
      { key: 'operations-types', label: 'Types', description: 'Types operation exposes par le back.' },
      { key: 'operations-erreurs', label: 'Erreurs', description: 'Catalogue des erreurs operations.' },
      { key: 'type-operation', label: 'Type operation', description: 'Export dedie aux types operation.' },
    ],
  },
  {
    title: 'Budgets',
    description: 'Typologies, erreurs et tables de budgets.',
    items: [
      { key: 'budgets-types', label: 'Types', description: 'Types de periode utilises par les budgets.' },
      { key: 'budgets-erreurs', label: 'Erreurs', description: 'Catalogue des erreurs budgets.' },
      { key: 'budgets-tables', label: 'Tables', description: 'Export des budgets enregistres.' },
    ],
  },
]

export function countCsvExports(): number {
  return adminCsvGroups.reduce((total, group) => total + group.items.length, 0)
}

export function latestBackup(backups: AdminBackup[]): AdminBackup | null {
  if (!backups.length) {
    return null
  }

  return [...backups].sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')))[0] ?? null
}

export function adminRiskLabel(level: AdminRiskLevel): string {
  if (level === 'safe') {
    return 'Lecture'
  }
  if (level === 'review') {
    return 'Controle'
  }
  return 'Critique'
}

export function normalizeAdminName(value: string): string {
  return value.trim()
}
