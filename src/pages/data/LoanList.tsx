import { Landmark, Plus, Search } from 'lucide-react'

import { Badge, Button, EmptyState } from '../../components/ui'
import { cx } from '../../lib/cx'
import { formatCurrencyFromCents } from '../../lib/format'
import type { LoanBasic } from '../../lib/monatis-api'
import { conditionDurationLabel, formatRate, loanAccountId, loanTitle, periodLabel } from './loan-summary-utils'

export function LoanList({
  loans,
  search,
  selectedKey,
  onSearchChange,
  onCreate,
  onSelect,
}: {
  loans: LoanBasic[]
  search: string
  selectedKey: string | null
  onSearchChange: (value: string) => void
  onCreate: () => void
  onSelect: (cle: string) => void
}) {
  return (
    <div className="loan-panel">
      <div className="loan-toolbar">
        <label className="search-field loan-search">
          <Search size={16} />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher par libellé, clé ou compte..." />
        </label>
        <Button tone="soft" onClick={onCreate}>
          <Plus size={16} />
          Nouvel emprunt
        </Button>
      </div>

      {!loans.length ? (
        <EmptyState title="Aucun emprunt" description="Ajoute un emprunt ou ajuste la recherche." />
      ) : (
        <div className="loan-list" data-help="Liste des emprunts : chaque ligne affiche le capital, le taux, la durée et le compte avant ouverture du détail.">
          {loans.map((loan) => {
            const condition = loan.conditionEmpruntInitiale
            const revisions = loan.revisions?.length ?? 0
            return (
              <button type="button" key={loan.cle} className={cx('loan-row', selectedKey === loan.cle && 'selected')} onClick={() => onSelect(loan.cle)}>
                <span className="loan-row-marker">
                  <Landmark size={17} />
                </span>
                <span className="loan-row-main">
                  <strong>{loanTitle(loan)}</strong>
                  <small>
                    {loan.cle} - {loanAccountId(loan) || 'Sans compte'}
                  </small>
                </span>
                <span className="loan-row-metric">
                  <strong>{formatCurrencyFromCents(condition?.capitalEmprunteEnCentimes)}</strong>
                  <small>capital initial</small>
                </span>
                <span className="loan-row-metric">
                  <strong>{formatRate(condition?.tauxAnnuel)}</strong>
                  <small>{periodLabel(condition)}</small>
                </span>
                <span className="loan-row-metric">
                  <strong>{conditionDurationLabel(condition)}</strong>
                  <small>durée prévue</small>
                </span>
                <Badge tone={revisions > 0 ? 'warning' : 'default'}>{revisions} révision{revisions > 1 ? 's' : ''}</Badge>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

