import { useQueries } from '@tanstack/react-query'
import { useState } from 'react'

import { ErrorState, LoadingState } from '../../components/ui'
import { apiErrorMessage, type Typology, type TypologyResource, monatisApi } from '../../lib/monatis-api'
import { TypologyDashboard } from './TypologyDashboard'
import { TypologyExplorer } from './TypologyExplorer'
import {
  buildTypologyGroups,
  typologyGroups,
  type TypologyFlagFilter,
} from './typology-utils'

export function TypologiesPanel() {
  const [selectedResource, setSelectedResource] = useState<TypologyResource>('operation')
  const [search, setSearch] = useState('')
  const [flagFilter, setFlagFilter] = useState<TypologyFlagFilter>('all')

  const queries = useQueries({
    queries: typologyGroups.map((group) => ({
      queryKey: ['typologies', group.resource],
      queryFn: () => monatisApi.listTypologies(group.resource),
    })),
  })

  const activeError = queries.find((query) => query.error)?.error
  const isLoading = queries.some((query) => query.isLoading)
  const itemsByResource = typologyGroups.reduce<Partial<Record<TypologyResource, Typology[]>>>((result, group, index) => {
    result[group.resource] = queries[index]?.data ?? []
    return result
  }, {})
  const groups = buildTypologyGroups(itemsByResource)

  return (
    <div className="page-stack">
      {isLoading ? <LoadingState label="Chargement des typologies..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <TypologyDashboard groups={groups} />
      <TypologyExplorer
        groups={groups}
        selectedResource={selectedResource}
        search={search}
        flagFilter={flagFilter}
        onSelectedResourceChange={setSelectedResource}
        onSearchChange={setSearch}
        onFlagFilterChange={setFlagFilter}
      />
    </div>
  )
}
