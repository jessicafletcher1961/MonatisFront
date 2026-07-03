import { Archive, Banknote, Calculator, DatabaseZap, FileDown, Landmark, ListTree } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { SegmentedControl, Surface } from '../components/ui'
import { AdminPanel } from './data/AdminPanel'
import { BudgetsPanel } from './data/BudgetsPanel'
import { EvaluationsPanel } from './data/EvaluationsPanel'
import { ImportRulesPanel } from './data/ImportRulesPanel'
import { LoansPanel } from './data/LoansPanel'
import { TechnicalAccountsPanel } from './data/TechnicalAccountsPanel'
import { TypologiesPanel } from './data/TypologiesPanel'

type DataView = 'budgets' | 'emprunts' | 'techniques' | 'evaluations' | 'imports' | 'typologies' | 'admin'

const dataOptions = [
  { value: 'budgets', label: 'Budgets', icon: Banknote },
  { value: 'emprunts', label: 'Emprunts', icon: Landmark },
  { value: 'techniques', label: 'Comptes techniques', icon: DatabaseZap },
  { value: 'evaluations', label: 'Evaluations', icon: Calculator },
  { value: 'imports', label: 'Regles import', icon: ListTree },
  { value: 'typologies', label: 'Typologies', icon: Archive },
  { value: 'admin', label: 'CSV et admin', icon: FileDown },
]

function normalizeDataView(value: string | null): DataView {
  switch (value) {
    case 'emprunts':
    case 'techniques':
    case 'evaluations':
    case 'imports':
    case 'typologies':
    case 'admin':
      return value
    default:
      return 'budgets'
  }
}

export function DataPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = normalizeDataView(searchParams.get('view'))

  return (
    <div className="page-stack data-page-stack">
      <Surface className="workspace-switcher">
        <SegmentedControl
          items={dataOptions}
          value={view}
          onChange={(nextView) => {
            setSearchParams({ view: normalizeDataView(nextView) })
          }}
        />
      </Surface>

      <div className="workspace-stage data-workspace-stage">
        {view === 'budgets' ? <BudgetsPanel /> : null}
        {view === 'emprunts' ? <LoansPanel /> : null}
        {view === 'techniques' ? <TechnicalAccountsPanel /> : null}
        {view === 'evaluations' ? <EvaluationsPanel /> : null}
        {view === 'imports' ? <ImportRulesPanel /> : null}
        {view === 'typologies' ? <TypologiesPanel /> : null}
        {view === 'admin' ? <AdminPanel /> : null}
      </div>
    </div>
  )
}
