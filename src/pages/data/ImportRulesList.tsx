import { AlertTriangle, Search, Sparkles } from 'lucide-react'

import { Badge, EmptyState } from '../../components/ui'
import { formatDate } from '../../lib/format'
import {
  importRuleStatusLabel,
  importRuleStatusTone,
  type ImportRuleFilter,
  type ImportRuleViewModel,
} from './import-rule-utils'

interface ImportRulesListProps {
  rules: ImportRuleViewModel[]
  search: string
  filter: ImportRuleFilter
  selectedId: number | null
  onSearchChange: (value: string) => void
  onFilterChange: (filter: ImportRuleFilter) => void
  onSelect: (id: number) => void
}

export function ImportRulesList({
  rules,
  search,
  filter,
  selectedId,
  onSearchChange,
  onFilterChange,
  onSelect,
}: ImportRulesListProps) {
  return (
    <section className="import-rules-panel">
      <div className="import-rules-toolbar">
        <label className="search-field import-rules-search" data-help="Recherche dans le libelle, la cle normalisee, le type, le compte, la categorie et les beneficiaires de la regle.">
          <Search size={18} aria-hidden />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher une regle d'import" />
        </label>
        <div className="import-rules-status-filter inline-segmented" data-help="Filtre les regles selon leur qualite et leur perimetre d'application.">
          <button type="button" className={`inline-segmented-option ${filter === 'all' ? 'active' : ''}`} onClick={() => onFilterChange('all')}>
            Toutes
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'ready' ? 'active' : ''}`} onClick={() => onFilterChange('ready')}>
            Pretes
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'partial' ? 'active' : ''}`} onClick={() => onFilterChange('partial')}>
            A completer
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'unused' ? 'active' : ''}`} onClick={() => onFilterChange('unused')}>
            Sans usage
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'scoped' ? 'active' : ''}`} onClick={() => onFilterChange('scoped')}>
            Par compte
          </button>
        </div>
      </div>

      <div className="import-rules-list">
        {rules.length === 0 ? (
          <EmptyState title="Aucune regle active" description="Les regles apparaissent apres apprentissage depuis l'import de releve." />
        ) : (
          rules.map((model) => (
            <button
              type="button"
              key={model.rule.id}
              className={`import-rule-row ${selectedId === model.rule.id ? 'selected' : ''}`}
              onClick={() => onSelect(model.rule.id)}
              data-help="Ouvre le detail de la regle, son routage appris et son bouton de desactivation."
            >
              <span className="import-rule-row-icon">
                {model.status === 'partial' ? <AlertTriangle size={19} aria-hidden /> : <Sparkles size={19} aria-hidden />}
              </span>
              <span className="import-rule-row-main">
                <strong>{model.title}</strong>
                <small>{model.rule.cleLibelleNormalisee}</small>
              </span>
              <span className="import-rule-row-metric">
                <strong>{model.typeLabel}</strong>
                <small>{model.roleLabel}</small>
              </span>
              <span className="import-rule-row-metric">
                <strong>{model.externalAccountLabel}</strong>
                <small>{model.scope === 'scoped' ? model.contextAccountLabel : 'Tous comptes internes'}</small>
              </span>
              <span className="import-rule-row-metric">
                <strong>{model.categoryLabel}</strong>
                <small>{model.beneficiaries.length ? model.beneficiaries.join(', ') : 'Aucun beneficiaire'}</small>
              </span>
              <span className="import-rule-row-metric">
                <strong>{model.usageCount} usage{model.usageCount > 1 ? 's' : ''}</strong>
                <small>{model.lastUsageDate ? formatDate(model.lastUsageDate) : 'Jamais reutilisee'}</small>
              </span>
              <Badge tone={importRuleStatusTone(model.status)}>{importRuleStatusLabel(model.status)}</Badge>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
