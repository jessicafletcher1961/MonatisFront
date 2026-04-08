import { ChevronRight, PiggyBank, ReceiptText } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { SegmentedControl, Surface } from '../components/ui'
import { ExternalAccountsPage } from './ExternalAccountsPage'
import { InternalAccountsPage } from './InternalAccountsPage'
import { OperationsPage } from './OperationsPage'

type OperationsAccountsView = 'operations' | 'comptes'
type AccountView = 'internes' | 'externes'

const viewOptions = [
  { value: 'operations', label: 'Operations', icon: ReceiptText },
  { value: 'comptes', label: 'Comptes', icon: PiggyBank },
]

const accountOptions = [
  { value: 'internes', label: 'Internes', icon: PiggyBank },
  { value: 'externes', label: 'Externes', icon: ChevronRight },
]

function normalizeView(value: string | null): OperationsAccountsView {
  return value === 'comptes' ? 'comptes' : 'operations'
}

function normalizeAccountView(value: string | null): AccountView {
  return value === 'externes' ? 'externes' : 'internes'
}

export function OperationsAccountsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const view = normalizeView(searchParams.get('view'))
  const accountView = normalizeAccountView(searchParams.get('account'))

  const setView = (nextView: OperationsAccountsView) => {
    setSearchParams(
      nextView === 'operations'
        ? { view: 'operations' }
        : {
            view: 'comptes',
            account: accountView,
          },
    )
  }

  const setAccountView = (nextView: string) => {
    setSearchParams({
      view: 'comptes',
      account: normalizeAccountView(nextView),
    })
  }

  return (
    <div className="page-stack">
      <Surface className="workspace-switcher">
        <SegmentedControl items={viewOptions} value={view} onChange={(value) => setView(value as OperationsAccountsView)} />
        {view === 'comptes' ? <SegmentedControl items={accountOptions} value={accountView} onChange={setAccountView} /> : null}
      </Surface>

      {view === 'operations' ? <OperationsPage /> : null}
      {view === 'comptes' && accountView === 'internes' ? <InternalAccountsPage /> : null}
      {view === 'comptes' && accountView === 'externes' ? <ExternalAccountsPage /> : null}
    </div>
  )
}
