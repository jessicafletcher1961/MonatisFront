import { Building2, ChevronRight, CircleDollarSign, Network, PiggyBank, Rows3, Users2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { SegmentedControl, Surface } from '../components/ui'
import type { ReferenceResource } from '../lib/monatis-api'
import { ExternalAccountsPage } from './ExternalAccountsPage'
import { InternalAccountsPage } from './InternalAccountsPage'
import { ReferencePage, type ReferencePageConfig } from './ReferencePage'

type WorkspaceTheme = 'references' | 'comptes'
type ReferenceView = ReferenceResource
type AccountView = 'internes' | 'externes'

const referenceConfigs: Record<ReferenceView, ReferencePageConfig> = {
  banque: {
    resource: 'banque',
    eyebrow: 'References',
    title: 'Banques',
    subtitle: '',
    singular: 'banque',
    plural: 'Banques',
  },
  titulaire: {
    resource: 'titulaire',
    eyebrow: 'References',
    title: 'Titulaires',
    subtitle: '',
    singular: 'titulaire',
    plural: 'Titulaires',
  },
  beneficiaire: {
    resource: 'beneficiaire',
    eyebrow: 'References',
    title: 'Beneficiaires',
    subtitle: '',
    singular: 'beneficiaire',
    plural: 'Beneficiaires',
  },
  categorie: {
    resource: 'categorie',
    eyebrow: 'References',
    title: 'Categories',
    subtitle: '',
    singular: 'categorie',
    plural: 'Categories',
  },
  souscategorie: {
    resource: 'souscategorie',
    eyebrow: 'References',
    title: 'Sous-categories',
    subtitle: '',
    singular: 'sous-categorie',
    plural: 'Sous-categories',
  },
}

const themeOptions = [
  { value: 'references', label: 'References', icon: Rows3 },
  { value: 'comptes', label: 'Comptes', icon: PiggyBank },
]

const referenceOptions = [
  { value: 'banque', label: 'Banques', icon: Building2 },
  { value: 'titulaire', label: 'Titulaires', icon: Users2 },
  { value: 'beneficiaire', label: 'Beneficiaires', icon: CircleDollarSign },
  { value: 'categorie', label: 'Categories', icon: Rows3 },
  { value: 'souscategorie', label: 'Sous-categories', icon: Network },
]

const accountOptions = [
  { value: 'internes', label: 'Internes', icon: PiggyBank },
  { value: 'externes', label: 'Externes', icon: ChevronRight },
]

function normalizeTheme(value: string | null): WorkspaceTheme {
  return value === 'comptes' ? 'comptes' : 'references'
}

function normalizeReferenceView(value: string | null): ReferenceView {
  return value === 'titulaire' || value === 'beneficiaire' || value === 'categorie' || value === 'souscategorie' ? value : 'banque'
}

function normalizeAccountView(value: string | null): AccountView {
  return value === 'externes' ? 'externes' : 'internes'
}

export function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const theme = normalizeTheme(searchParams.get('theme'))
  const referenceView = normalizeReferenceView(searchParams.get('view'))
  const accountView = normalizeAccountView(searchParams.get('view'))

  const setTheme = (nextTheme: WorkspaceTheme) => {
    setSearchParams({
      theme: nextTheme,
      view: nextTheme === 'references' ? 'banque' : 'internes',
    })
  }

  const setReferenceView = (nextView: string) => {
    setSearchParams({
      theme: 'references',
      view: normalizeReferenceView(nextView),
    })
  }

  const setAccountView = (nextView: string) => {
    setSearchParams({
      theme: 'comptes',
      view: normalizeAccountView(nextView),
    })
  }

  return (
    <div className="page-stack">
      <Surface className="workspace-switcher">
        <SegmentedControl items={themeOptions} value={theme} onChange={(value) => setTheme(value as WorkspaceTheme)} />
        <SegmentedControl
          items={theme === 'references' ? referenceOptions : accountOptions}
          value={theme === 'references' ? referenceView : accountView}
          onChange={theme === 'references' ? setReferenceView : setAccountView}
        />
      </Surface>

      <div className="workspace-stage">
        {theme === 'references' ? <ReferencePage config={referenceConfigs[referenceView]} /> : null}
        {theme === 'comptes' && accountView === 'internes' ? <InternalAccountsPage /> : null}
        {theme === 'comptes' && accountView === 'externes' ? <ExternalAccountsPage /> : null}
      </div>
    </div>
  )
}
