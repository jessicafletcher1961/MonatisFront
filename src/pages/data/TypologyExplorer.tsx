import { Search, SlidersHorizontal, X } from 'lucide-react'

import { Badge, EmptyState, SectionHeader, Surface } from '../../components/ui'
import { cx } from '../../lib/cx'
import type { TypologyResource } from '../../lib/monatis-api'
import {
  filterTypologyItems,
  typologyFlagLabels,
  type TypologyFlagFilter,
  type TypologyGroupViewModel,
} from './typology-utils'

interface TypologyExplorerProps {
  groups: TypologyGroupViewModel[]
  selectedResource: TypologyResource
  search: string
  flagFilter: TypologyFlagFilter
  onSelectedResourceChange: (resource: TypologyResource) => void
  onSearchChange: (value: string) => void
  onFlagFilterChange: (filter: TypologyFlagFilter) => void
}

const flagFilters: Array<{ value: TypologyFlagFilter; label: string; help: string }> = [
  { value: 'all', label: 'Toutes', help: 'Affiche toutes les valeurs de la famille choisie.' },
  { value: 'technical', label: 'Flux techniques', help: 'Limite aux types operation marques comme flux techniques.' },
  { value: 'business', label: 'Flux metier', help: 'Limite aux types operation non techniques.' },
  { value: 'categorisable', label: 'Categorisables', help: 'Limite aux types operation rattachables a une categorie.' },
  { value: 'uncategorisable', label: 'Non categorisables', help: 'Limite aux types operation exclus de la categorisation.' },
]

export function TypologyExplorer({
  groups,
  selectedResource,
  search,
  flagFilter,
  onSelectedResourceChange,
  onSearchChange,
  onFlagFilterChange,
}: TypologyExplorerProps) {
  const filteredGroups = groups.map((group) => ({
    ...group,
    filteredItems: filterTypologyItems(group.items, search, flagFilter),
  }))
  const selectedGroup = filteredGroups.find((group) => group.resource === selectedResource) ?? filteredGroups[0]
  const visibleItems = selectedGroup?.filteredItems ?? []

  return (
    <Surface className="typology-explorer" data-help="Explorateur de typologies : recherche dans les codes et libelles puis inspecte une famille de valeurs.">
      <SectionHeader
        title="Catalogue des typologies"
        subtitle="Valeurs techniques chargees depuis le back. Cette page est volontairement en lecture seule."
        aside={<Badge>{visibleItems.length}/{selectedGroup?.items.length ?? 0}</Badge>}
      />

      <div className="typology-toolbar" data-help="Filtres de typologies : recherche par texte et limite les types operation par flags metier.">
        <label className="typology-search">
          <Search size={16} aria-hidden />
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher un code ou un libelle" />
          {search ? (
            <button type="button" className="typology-search-clear" onClick={() => onSearchChange('')} aria-label="Effacer la recherche" data-help="Vide la recherche de typologies.">
              <X size={14} aria-hidden />
            </button>
          ) : null}
        </label>
        <div className="typology-filter-group">
          <span>
            <SlidersHorizontal size={15} aria-hidden />
            Flags
          </span>
          <div className="typology-filter-buttons">
            {flagFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={cx('typology-filter-button', flagFilter === filter.value && 'active')}
                onClick={() => onFlagFilterChange(filter.value)}
                data-help={filter.help}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="typology-workspace">
        <div className="typology-family-list" data-help="Familles de typologies : choisissez le domaine a inspecter.">
          {filteredGroups.map((group) => (
            <button
              key={group.resource}
              type="button"
              className={cx('typology-family-card', group.resource === selectedGroup?.resource && 'active')}
              onClick={() => onSelectedResourceChange(group.resource)}
              data-help={`Ouvre les valeurs de typologie "${group.shortTitle}".`}
            >
              <span>{group.shortTitle}</span>
              <strong>{group.filteredItems.length}/{group.items.length}</strong>
              <small>{group.description}</small>
            </button>
          ))}
        </div>

        <div className="typology-values-panel" data-help="Liste des valeurs de la famille selectionnee avec code, libelle et flags exposes par le back.">
          {selectedGroup ? (
            <>
              <div className="typology-values-head">
                <div>
                  <span>{selectedGroup.title}</span>
                  <h3>{selectedGroup.usage}</h3>
                </div>
                <Badge>{visibleItems.length} valeur{visibleItems.length > 1 ? 's' : ''}</Badge>
              </div>
              {visibleItems.length ? (
                <div className="typology-value-list">
                  {visibleItems.map((item) => (
                    <article className="typology-value-row" key={`${selectedGroup.resource}-${item.code}`}>
                      <div className="typology-value-code">{item.code}</div>
                      <div className="typology-value-copy">
                        <strong>{item.libelle}</strong>
                        <span>{selectedGroup.shortTitle}</span>
                      </div>
                      <div className="typology-value-flags">
                        {typologyFlagLabels(item).map((flag) => (
                          <Badge key={`${item.code}-${flag.label}`} tone={flag.tone}>
                            {flag.label}
                          </Badge>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Aucune valeur visible" description="Aucune typologie ne correspond a la recherche ou au filtre actif." />
              )}
            </>
          ) : (
            <EmptyState title="Aucune famille" description="Le back n a renvoye aucune famille de typologies." />
          )}
        </div>
      </div>
    </Surface>
  )
}
