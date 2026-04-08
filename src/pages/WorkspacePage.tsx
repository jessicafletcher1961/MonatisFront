import { Building2, CircleDollarSign, Network, Rows3, Users2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { SegmentedControl, Surface } from '../components/ui'
import type { ReferenceResource } from '../lib/monatis-api'
import { ReferencePage, type ReferencePageConfig } from './ReferencePage'

type ReferenceView = ReferenceResource

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

const referenceOptions = [
  { value: 'banque', label: 'Banques', icon: Building2 },
  { value: 'titulaire', label: 'Titulaires', icon: Users2 },
  { value: 'beneficiaire', label: 'Beneficiaires', icon: CircleDollarSign },
  { value: 'categorie', label: 'Categories', icon: Rows3 },
  { value: 'souscategorie', label: 'Sous-categories', icon: Network },
]

function normalizeReferenceView(value: string | null): ReferenceView {
  return value === 'titulaire' || value === 'beneficiaire' || value === 'categorie' || value === 'souscategorie' ? value : 'banque'
}

export function WorkspacePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const referenceView = normalizeReferenceView(searchParams.get('view'))

  const setReferenceView = (nextView: string) => {
    setSearchParams({
      view: normalizeReferenceView(nextView),
    })
  }

  return (
    <div className="page-stack">
      <Surface className="workspace-switcher">
        <SegmentedControl items={referenceOptions} value={referenceView} onChange={setReferenceView} />
      </Surface>

      <div className="workspace-stage">
        <ReferencePage config={referenceConfigs[referenceView]} />
      </div>
    </div>
  )
}
