import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cx } from '../lib/cx'
import { CATALOG_PAGE_SIZE_OPTIONS } from './pagination-constants'

interface CatalogPaginationControlsProps {
  ariaLabel: string
  totalCount: number
  firstVisible: number
  lastVisible: number
  currentPage: number
  totalPages: number
  pageSize: number
  position?: 'top' | 'bottom'
  pageSizeOptions?: number[]
  pageSizeLabel: string
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function CatalogPaginationControls({
  ariaLabel,
  totalCount,
  firstVisible,
  lastVisible,
  currentPage,
  totalPages,
  pageSize,
  position = 'top',
  pageSizeOptions = CATALOG_PAGE_SIZE_OPTIONS,
  pageSizeLabel,
  onPageChange,
  onPageSizeChange,
}: CatalogPaginationControlsProps) {
  const safeTotalPages = Math.max(totalPages, 1)
  const pageLabel = totalCount ? `${currentPage}/${safeTotalPages}` : '0/0'

  function changePageSize(value: string) {
    const nextSize = Number.parseInt(value, 10)

    if (!pageSizeOptions.includes(nextSize)) {
      return
    }

    onPageSizeChange(nextSize)
  }

  return (
    <div className={cx('catalog-list-controls', position === 'bottom' && 'bottom')} aria-label={ariaLabel}>
      <div className="catalog-list-count">
        <strong>{totalCount ? `${firstVisible}-${lastVisible}` : '0'}</strong>
        <span>{`sur ${totalCount}`}</span>
      </div>

      <label className="catalog-page-size">
        <span>Afficher</span>
        <select value={pageSize} onChange={(event) => changePageSize(event.target.value)} aria-label={pageSizeLabel}>
          {pageSizeOptions.map((size) => (
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
        <button type="button" disabled={!totalCount || currentPage >= safeTotalPages} onClick={() => onPageChange(Math.min(safeTotalPages, currentPage + 1))} aria-label="Page suivante">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
