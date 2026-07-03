import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'

import { Badge, EmptyState, Surface } from '../../components/ui'
import { cx } from '../../lib/cx'
import { formatCurrency, formatDate } from '../../lib/format'
import type { ReleveCompteView, ReleveRow } from '../../lib/reporting'

export type ReleveMode = 'both' | 'recettes' | 'depenses'

const RELEVE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

function visibleRelevePageRows(rows: ReleveRow[], currentPage: number, pageSize: number, totalCount: number | null): ReleveRow[] {
  if (rows.length <= pageSize && totalCount != null && totalCount > rows.length) {
    return rows
  }

  const start = Math.max(0, (currentPage - 1) * pageSize)
  return rows.slice(start, start + pageSize)
}

function operationAmountLabel(row: ReleveRow, direction: 'recette' | 'depense'): string {
  return `${direction === 'recette' ? '+' : '-'} ${formatCurrency(row.montantEnEuros)}`
}

function RelevePaginationControls({
  type,
  position,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  type: 'recette' | 'depense'
  position: 'top' | 'bottom'
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  onPageChange: Dispatch<SetStateAction<number>>
  onPageSizeChange: (pageSize: number) => void
}) {
  const firstVisible = totalCount ? (currentPage - 1) * pageSize + 1 : 0
  const lastVisible = totalCount ? Math.min(currentPage * pageSize, totalCount) : 0
  const pageLabel = totalCount ? `${currentPage}/${Math.max(totalPages, 1)}` : '0/0'

  return (
    <div className={cx('catalog-list-controls', 'report-pagination-controls', position === 'bottom' && 'bottom')} aria-label={`Pagination des ${type === 'recette' ? 'recettes' : 'depenses'} ${position === 'bottom' ? 'bas' : 'haut'}`}>
      <div className="catalog-list-count">
        <strong>{totalCount ? `${firstVisible}-${lastVisible}` : '0'}</strong>
        <span>{`sur ${totalCount}`}</span>
      </div>

      <label className="catalog-page-size">
        <span>Afficher</span>
        <select
          value={pageSize}
          onChange={(event) => {
            const nextSize = Number.parseInt(event.target.value, 10)

            if (RELEVE_PAGE_SIZE_OPTIONS.includes(nextSize)) {
              onPageSizeChange(nextSize)
            }
          }}
          aria-label="Nombre d'operations affichees dans le releve"
        >
          {RELEVE_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>

      <div className="catalog-page-buttons">
        <button type="button" disabled={!totalCount || currentPage <= 1} onClick={() => onPageChange(Math.max(1, currentPage - 1))} aria-label="Page precedente">
          <ChevronLeft size={15} />
        </button>
        <span>{pageLabel}</span>
        <button type="button" disabled={!totalCount || currentPage >= Math.max(totalPages, 1)} onClick={() => onPageChange(Math.min(Math.max(totalPages, 1), currentPage + 1))} aria-label="Page suivante">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

function ReleveMovementCard({ row, direction }: { row: ReleveRow; direction: 'recette' | 'depense' }) {
  const amount = operationAmountLabel(row, direction)
  const title = row.libelle ?? row.numero
  const accountLabel = row.libelleAutreCompte ? `${row.identifiantAutreCompte} · ${row.libelleAutreCompte}` : row.identifiantAutreCompte

  return (
    <div className="report-hover-wrap releve-movement-wrap" tabIndex={0} data-help="Operation du releve : montre la date, le type, le compte contrepartie et le montant signe selon le sens du mouvement.">
      <div className="report-line-card releve-movement-card">
        <div className="releve-movement-main">
          <strong>{title}</strong>
          <span>
            {formatDate(row.dateComptabilisation)} · {row.codeTypeOperation || 'Operation'}
          </span>
          <small>{accountLabel}</small>
        </div>
        <Badge tone={direction === 'recette' ? 'success' : 'default'}>{amount}</Badge>
      </div>
      <div className="report-hover-card">
        <div className="report-hover-head">
          <strong>{title}</strong>
          <span>
            {formatDate(row.dateComptabilisation)} · valeur {formatDate(row.dateValeur)}
          </span>
        </div>
        <div className="report-hover-list">
          <div className="report-hover-item">
            <div>
              <strong>{row.identifiantAutreCompte}</strong>
              <span>{row.libelleAutreCompte ?? row.codeTypeAutreCompte}</span>
            </div>
            <span>{amount}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReleveOperationColumn({
  title,
  direction,
  totalAmount,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  rows,
  onPageChange,
  onPageSizeChange,
}: {
  title: string
  direction: 'recette' | 'depense'
  totalAmount: number
  totalCount: number
  totalPages: number
  currentPage: number
  pageSize: number
  rows: ReleveRow[]
  onPageChange: Dispatch<SetStateAction<number>>
  onPageSizeChange: (pageSize: number) => void
}) {
  return (
    <div className="releve-flow-column" data-help={`${title} du releve : liste paginee des operations qui ${direction === 'recette' ? 'augmentent' : 'diminuent'} le solde du compte.`}>
      <div className="releve-flow-meta">
        <Badge tone={direction === 'recette' ? 'success' : 'default'}>{formatCurrency(totalAmount)}</Badge>
        <span>{totalCount} operation(s)</span>
      </div>
      {!rows.length ? (
        <EmptyState title={direction === 'recette' ? 'Aucune recette' : 'Aucune depense'} description="Aucun mouvement sur cette plage." />
      ) : (
        <>
          <RelevePaginationControls type={direction} position="top" totalCount={totalCount} totalPages={totalPages} currentPage={currentPage} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
          <div className="report-hover-list-grid dense">
            {rows.map((row) => (
              <ReleveMovementCard key={`releve-${direction}-${row.numero}`} row={row} direction={direction} />
            ))}
          </div>
          <RelevePaginationControls type={direction} position="bottom" totalCount={totalCount} totalPages={totalPages} currentPage={currentPage} pageSize={pageSize} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} />
        </>
      )}
    </div>
  )
}

export function ReleveMovementsPanel({
  releve,
  mode,
  pageSize,
  recettePage,
  depensePage,
  onModeChange,
  onPageSizeChange,
  onRecettePageChange,
  onDepensePageChange,
}: {
  releve: ReleveCompteView
  mode: ReleveMode
  pageSize: number
  recettePage: number
  depensePage: number
  onModeChange: Dispatch<SetStateAction<ReleveMode>>
  onPageSizeChange: (pageSize: number) => void
  onRecettePageChange: Dispatch<SetStateAction<number>>
  onDepensePageChange: Dispatch<SetStateAction<number>>
}) {
  const recetteTotalCount = releve.totalOperationsRecette ?? releve.operationsRecette.length
  const depenseTotalCount = releve.totalOperationsDepense ?? releve.operationsDepense.length
  const recetteTotalPages = releve.totalPagesOperationsRecette ?? (recetteTotalCount ? Math.ceil(recetteTotalCount / pageSize) : 0)
  const depenseTotalPages = releve.totalPagesOperationsDepense ?? (depenseTotalCount ? Math.ceil(depenseTotalCount / pageSize) : 0)
  const recetteRows = visibleRelevePageRows(releve.operationsRecette, recettePage, pageSize, releve.totalOperationsRecette)
  const depenseRows = visibleRelevePageRows(releve.operationsDepense, depensePage, pageSize, releve.totalOperationsDepense)

  return (
    <Surface className="data-panel report-panel releve-flow-panel" data-help="Mouvements du releve : compare les entrees et sorties de la periode, avec pagination independante pour chaque flux.">
      <div className="releve-flow-head">
        <div className="report-switch-row releve-switch-row">
          <button
            type="button"
            className={cx('report-switch-chip', 'releve-switch-chip', 'left', mode !== 'depenses' && 'active')}
            onClick={() => onModeChange((current) => (current === 'recettes' ? 'both' : 'recettes'))}
            data-help="Afficher les recettes du releve. Si elles sont deja seules, le clic revient a la comparaison recettes et depenses."
          >
            Recettes
          </button>
          <button
            type="button"
            className={cx('report-switch-chip', 'releve-switch-chip', 'right', mode !== 'recettes' && 'active')}
            onClick={() => onModeChange((current) => (current === 'depenses' ? 'both' : 'depenses'))}
            data-help="Afficher les depenses du releve. Si elles sont deja seules, le clic revient a la comparaison recettes et depenses."
          >
            Depenses
          </button>
        </div>
      </div>

      <div className={cx('report-split-grid releve-split-grid', mode !== 'both' && 'single', mode === 'both' && 'dual')}>
        {mode !== 'depenses' ? (
          <ReleveOperationColumn
            title="Recettes"
            direction="recette"
            totalAmount={releve.montantTotalOperationsRecetteEnEuros}
            totalCount={recetteTotalCount}
            totalPages={recetteTotalPages}
            currentPage={recettePage}
            pageSize={pageSize}
            rows={recetteRows}
            onPageChange={onRecettePageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}

        {mode !== 'recettes' ? (
          <ReleveOperationColumn
            title="Depenses"
            direction="depense"
            totalAmount={releve.montantTotalOperationsDepenseEnEuros}
            totalCount={depenseTotalCount}
            totalPages={depenseTotalPages}
            currentPage={depensePage}
            pageSize={pageSize}
            rows={depenseRows}
            onPageChange={onDepensePageChange}
            onPageSizeChange={onPageSizeChange}
          />
        ) : null}
      </div>
    </Surface>
  )
}
