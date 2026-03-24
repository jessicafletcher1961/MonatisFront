import { useQueries } from '@tanstack/react-query'
import { ArrowRight, Database, PiggyBank, Plus, ReceiptText } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { Button, EmptyState, ErrorState, LoadingState, StatCard, Surface } from '../components/ui'
import { apiErrorMessage, monatisApi } from '../lib/monatis-api'
import { compactNumber } from '../lib/format'

const cards = [
  {
    title: 'Donnees',
    description: 'References et comptes dans un seul espace.',
    to: '/donnees',
    icon: Database,
  },
  {
    title: 'Operations',
    description: 'Creation, tri et edition.',
    to: '/flux',
    icon: ReceiptText,
  },
  {
    title: 'Analyse',
    description: 'Releves, syntheses et vues locales.',
    to: '/analyse',
    icon: PiggyBank,
  },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const [banques, titulaires, beneficiaires, categories, internalAccounts, operations] = useQueries({
    queries: [
      { queryKey: ['references', 'banque'], queryFn: () => monatisApi.listReferences('banque') },
      { queryKey: ['references', 'titulaire'], queryFn: () => monatisApi.listReferences('titulaire') },
      { queryKey: ['references', 'beneficiaire'], queryFn: () => monatisApi.listReferences('beneficiaire') },
      { queryKey: ['references', 'categorie'], queryFn: () => monatisApi.listReferences('categorie') },
      { queryKey: ['comptes', 'internes'], queryFn: () => monatisApi.listInternalAccounts() },
      { queryKey: ['operations'], queryFn: () => monatisApi.listOperations() },
    ],
  })

  const hasError = [banques, titulaires, beneficiaires, categories, internalAccounts, operations].find((query) => query.error)
  const isLoading = [banques, titulaires, beneficiaires, categories, internalAccounts, operations].some((query) => query.isLoading)

  return (
    <div className="page-stack">
      <div className="dashboard-launch-row">
        <Button onClick={() => navigate('/flux', { state: { openCreate: true } })}>
          <Plus size={16} />
          Nouvelle operation
        </Button>
      </div>

      {isLoading ? <LoadingState label="Chargement..." /> : null}
      {hasError ? <ErrorState message={apiErrorMessage(hasError.error)} /> : null}

      {!isLoading && !hasError ? (
        <>
          <div className="stat-grid">
            <StatCard
              title="References"
              value={compactNumber(
                (banques.data?.length ?? 0) +
                  (titulaires.data?.length ?? 0) +
                  (beneficiaires.data?.length ?? 0) +
                  (categories.data?.length ?? 0),
              )}
            />
            <StatCard
              title="Comptes"
              value={compactNumber(internalAccounts.data?.length ?? 0)}
            />
            <StatCard
              title="Operations"
              value={compactNumber(operations.data?.length ?? 0)}
            />
          </div>

          <div className="card-grid">
            {cards.map((card) => {
              const Icon = card.icon

              return (
                <Link key={card.title} to={card.to} className="module-card-link">
                  <Surface className="module-card">
                    <div className="module-card-icon">
                      <Icon size={18} />
                    </div>
                    <div className="module-card-copy">
                      <h3>{card.title}</h3>
                      <p>{card.description}</p>
                    </div>
                    <ArrowRight size={18} />
                  </Surface>
                </Link>
              )
            })}
          </div>
        </>
      ) : null}

      {!isLoading && !hasError && !(internalAccounts.data?.length || operations.data?.length) ? (
        <EmptyState
          title="Base vide"
          description="Ajoute quelques references, comptes ou operations pour lancer la lecture."
        />
      ) : null}
    </div>
  )
}
