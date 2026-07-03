import { ArrowDownLeft, ArrowUpRight, ReceiptText } from 'lucide-react'

import { HorizontalScrollArea } from '../../components/horizontal-scroll-area'
import { Badge, Surface } from '../../components/ui'
import { formatCurrency, formatDate } from '../../lib/format'
import { describePeriod, type DepenseRecetteCategoryView, type DepenseRecetteSubcategoryView, type DepenseRecetteView, type PeriodTotalView } from '../../lib/reporting'
import { depenseRecetteCategoryLabel, depenseRecetteSubcategoryLabel, sumPeriods } from './depense-recette-report-utils'
import { mostSignificantItems, periodCountLabel, recentItems } from './report-detail-utils'

function periodAmountLabel(period: PeriodTotalView): string {
  if (period.recette > 0 && period.depense > 0) {
    return `Recettes ${formatCurrency(period.recette)} - Depenses ${formatCurrency(period.depense)}`
  }

  if (period.recette > 0) {
    return `Recettes ${formatCurrency(period.recette)}`
  }

  return `Depenses ${formatCurrency(period.depense)}`
}

function PeriodDetails({ period, title }: { period: PeriodTotalView; title: string }) {
  if (!period.details.length) {
    return null
  }

  return (
    <div className="report-hover-card depense-recette-hover-card">
      <div className="report-hover-head">
        <strong>{title}</strong>
        <span>{describePeriod({ key: '', label: '', start: period.start, end: period.end })}</span>
      </div>
      <div className="report-hover-list">
        {period.details.map((item) => (
          <div key={`${item.numero}-${item.date}-${item.montantEnEuros}`} className="report-hover-item">
            <div>
              <strong>{item.libelle ?? item.numero}</strong>
              <span>
                {formatDate(item.date)}
                {item.beneficiaires.length ? ` · ${item.beneficiaires.join(', ')}` : ''}
              </span>
            </div>
            <span>{formatCurrency(item.montantEnEuros)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PeriodPill({ period, title }: { period: PeriodTotalView; title: string }) {
  return (
    <div className="report-hover-wrap depense-recette-period-pill" tabIndex={period.details.length ? 0 : -1}>
      <div className="depense-recette-period-pill-main">
        <span>{period.label}</span>
        <strong>{formatCurrency(period.solde)}</strong>
        <small>{periodAmountLabel(period)}</small>
      </div>
      <PeriodDetails period={period} title={title} />
    </div>
  )
}

function SubcategoryRow({ subcategory }: { subcategory: DepenseRecetteSubcategoryView }) {
  const total = sumPeriods(subcategory.periods)
  const label = depenseRecetteSubcategoryLabel(subcategory)
  const showRecette = total.recette > 0
  const showDepense = total.depense > 0
  const showBothFlows = showRecette && showDepense

  return (
    <div className="depense-recette-subcategory-row" data-help="Sous-categorie depenses recettes : compare son solde net et ses montants par periode.">
      <div className="depense-recette-subcategory-head">
        <div>
          <strong>{label}</strong>
          <span>{total.details.length} ligne(s)</span>
        </div>
        <Badge tone={total.solde >= 0 ? 'success' : 'warning'}>{formatCurrency(total.solde)}</Badge>
      </div>
      <div className="depense-recette-subcategory-meta">
        {showRecette || !showDepense ? (
          <span>
            <ArrowUpRight size={14} />
            {showBothFlows ? `Recettes ${formatCurrency(total.recette)}` : formatCurrency(total.recette)}
          </span>
        ) : null}
        {showDepense ? (
          <span>
            <ArrowDownLeft size={14} />
            {showBothFlows ? `Depenses ${formatCurrency(total.depense)}` : formatCurrency(total.depense)}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: DepenseRecetteCategoryView }) {
  const total = sumPeriods(category.totals)
  const label = depenseRecetteCategoryLabel(category)
  const visiblePeriods = recentItems(category.totals)
  const periodCount = periodCountLabel(category.totals)
  const visibleChildren = mostSignificantItems(category.children, (subcategory) => sumPeriods(subcategory.periods).solde || sumPeriods(subcategory.periods).recette || sumPeriods(subcategory.periods).depense)

  return (
    <article className="depense-recette-category-card">
      <div className="depense-recette-category-head">
        <div>
          <h3>{label}</h3>
          <span>
            {category.children.length} sous-categorie(s)
            {periodCount ? ` - ${periodCount}` : ''}
          </span>
        </div>
        <Badge tone={total.solde >= 0 ? 'success' : 'warning'}>{formatCurrency(total.solde)}</Badge>
      </div>
      <div className="depense-recette-category-metrics">
        <span>
          <ArrowUpRight size={14} />
          Recettes {formatCurrency(total.recette)}
        </span>
        <span>
          <ArrowDownLeft size={14} />
          Depenses {formatCurrency(total.depense)}
        </span>
        <span>
          <ReceiptText size={14} />
          {total.details.length} ligne(s)
        </span>
      </div>
      {category.totals.length > 1 ? (
        <HorizontalScrollArea className="depense-recette-period-pills category" aria-label={`Periodes ${label}`}>
          {visiblePeriods.map((period) => (
            <PeriodPill key={`${label}-${period.start}`} period={period} title={label} />
          ))}
        </HorizontalScrollArea>
      ) : null}
      <div className="depense-recette-subcategory-list">
        {visibleChildren.map((subcategory) => (
          <SubcategoryRow key={depenseRecetteSubcategoryLabel(subcategory)} subcategory={subcategory} />
        ))}
      </div>
    </article>
  )
}

export function DepenseRecetteCategoriesPanel({ report }: { report: DepenseRecetteView }) {
  return (
    <Surface className="data-panel report-panel depense-recette-categories-panel" data-help="Categories depenses recettes : chaque carte détaille recettes, depenses, solde et lignes d'operations par sous-categorie.">
      <div className="depense-recette-category-grid">
        {report.categories.map((category) => (
          <CategoryCard key={depenseRecetteCategoryLabel(category)} category={category} />
        ))}
      </div>
    </Surface>
  )
}
