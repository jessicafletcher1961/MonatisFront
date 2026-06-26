import { AlertTriangle, DatabaseZap, Plus, Search } from 'lucide-react'

import { Badge, Button, EmptyState } from '../../components/ui'
import { formatCurrencyFromCents, formatShortDate } from '../../lib/format'
import {
  technicalAccountTitle,
  type TechnicalAccountFilter,
  type TechnicalAccountSummary,
  technicalStatusHint,
  technicalStatusLabel,
  technicalStatusTone,
} from './technical-account-utils'

interface TechnicalAccountsListProps {
  summaries: TechnicalAccountSummary[]
  search: string
  filter: TechnicalAccountFilter
  selectedId: string | null
  onSearchChange: (value: string) => void
  onFilterChange: (filter: TechnicalAccountFilter) => void
  onCreate: () => void
  onSelect: (identifiant: string) => void
}

export function TechnicalAccountsList({
  summaries,
  search,
  filter,
  selectedId,
  onSearchChange,
  onFilterChange,
  onCreate,
  onSelect,
}: TechnicalAccountsListProps) {
  return (
    <section className="technical-panel">
      <div className="technical-toolbar">
        <label className="search-field technical-search" data-help="Recherche dans l'identifiant, le libelle et les operations rattachees au compte technique.">
          <Search size={18} aria-hidden />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher un compte technique ou un flux" />
        </label>
        <div className="technical-status-filter inline-segmented" data-help="Filtre les comptes techniques selon leur usage dans les operations.">
          <button type="button" className={`inline-segmented-option ${filter === 'all' ? 'active' : ''}`} onClick={() => onFilterChange('all')}>
            Tous
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'active' ? 'active' : ''}`} onClick={() => onFilterChange('active')}>
            Utilises
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'unused' ? 'active' : ''}`} onClick={() => onFilterChange('unused')}>
            Dormants
          </button>
          <button type="button" className={`inline-segmented-option ${filter === 'attention' ? 'active' : ''}`} onClick={() => onFilterChange('attention')}>
            A verifier
          </button>
        </div>
        <Button onClick={onCreate}>
          <Plus size={16} />
          Nouveau compte
        </Button>
      </div>

      <div className="technical-list">
        {summaries.length === 0 ? (
          <EmptyState title="Aucun compte technique" description="Ajoutez un compte ou ajustez les filtres." />
        ) : (
          summaries.map((summary) => (
            <button
              type="button"
              key={summary.account.identifiant}
              className={`technical-row ${selectedId === summary.account.identifiant ? 'selected' : ''}`}
              onClick={() => onSelect(summary.account.identifiant)}
              data-help="Ouvre le detail du compte technique, ses flux recents et son formulaire."
            >
              <span className="technical-row-icon">
                {summary.status === 'attention' ? <AlertTriangle size={19} aria-hidden /> : <DatabaseZap size={19} aria-hidden />}
              </span>
              <span className="technical-row-main">
                <strong>{technicalAccountTitle(summary.account)}</strong>
                <small>{summary.account.identifiant}</small>
              </span>
              <span className="technical-row-metric">
                <strong>{summary.usageCount} operation{summary.usageCount > 1 ? 's' : ''}</strong>
                <small>{summary.latestOperationDate ? `Derniere ${formatShortDate(summary.latestOperationDate)}` : 'Jamais utilise'}</small>
              </span>
              <span className="technical-row-metric">
                <strong>{formatCurrencyFromCents(summary.netCents)}</strong>
                <small>Solde net technique</small>
              </span>
              <span className="technical-row-metric">
                <strong>{technicalStatusHint(summary)}</strong>
                <small>{formatCurrencyFromCents(summary.chargesCents)} frais</small>
              </span>
              <Badge tone={technicalStatusTone(summary.status)}>{technicalStatusLabel(summary.status)}</Badge>
            </button>
          ))
        )}
      </div>
    </section>
  )
}
