import { Home, Landmark, Plus, Search, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'

import { Badge, Button, EmptyState } from '../../components/ui'
import { formatCurrencyFromCents, formatShortDate } from '../../lib/format'
import type { CompteInterneBasic, EvaluationBasic } from '../../lib/monatis-api'
import {
  accountDisplayLabel,
  accountTypeLabel,
  type EvaluationAccountTypeFilter,
  type EvaluationListMode,
  evaluationAccountId,
  evaluationTitle,
  formatSignedPercent,
  percentChange,
  previousEvaluationFor,
  signedCurrencyFromCents,
} from './evaluation-utils'

interface EvaluationListProps {
  evaluations: EvaluationBasic[]
  allEvaluations: EvaluationBasic[]
  accountsById: Map<string, CompteInterneBasic>
  search: string
  mode: EvaluationListMode
  typeFilter: EvaluationAccountTypeFilter
  selectedKey: string | null
  onSearchChange: (value: string) => void
  onModeChange: (mode: EvaluationListMode) => void
  onTypeFilterChange: (filter: EvaluationAccountTypeFilter) => void
  onCreate: () => void
  onSelect: (key: string) => void
}

function AccountIcon({ type }: { type: string | undefined }) {
  if (type === 'BIEN') {
    return <Home size={19} aria-hidden />
  }
  if (type === 'FINANCIER') {
    return <Landmark size={19} aria-hidden />
  }
  return <WalletCards size={19} aria-hidden />
}

export function EvaluationList({
  evaluations,
  allEvaluations,
  accountsById,
  search,
  mode,
  typeFilter,
  selectedKey,
  onSearchChange,
  onModeChange,
  onTypeFilterChange,
  onCreate,
  onSelect,
}: EvaluationListProps) {
  return (
    <section className="evaluation-panel">
      <div className="evaluation-toolbar">
        <label className="search-field evaluation-search" data-help="Recherche dans la cle, le libelle, le compte, la banque et les titulaires.">
          <Search size={18} aria-hidden />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher une evaluation ou un compte"
          />
        </label>
        <div className="evaluation-mode-filter inline-segmented" data-help="Dernieres valeurs affiche un seul point par compte ; historique affiche tous les points d'evaluation.">
          <button
            type="button"
            className={`inline-segmented-option ${mode === 'latest' ? 'active' : ''}`}
            onClick={() => onModeChange('latest')}
          >
            Dernieres valeurs
          </button>
          <button
            type="button"
            className={`inline-segmented-option ${mode === 'history' ? 'active' : ''}`}
            onClick={() => onModeChange('history')}
          >
            Historique complet
          </button>
        </div>
        <label className="evaluation-type-filter" data-help="Filtre les evaluations selon le type de compte interne concerne.">
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as EvaluationAccountTypeFilter)}>
            <option value="all">Tous les comptes</option>
            <option value="COURANT">Comptes courants</option>
            <option value="FINANCIER">Placements</option>
            <option value="BIEN">Biens</option>
          </select>
        </label>
        <Button onClick={onCreate}>
          <Plus size={16} />
          Nouvelle evaluation
        </Button>
      </div>

      <div className="evaluation-list">
        {evaluations.length === 0 ? (
          <EmptyState title="Aucune evaluation" description="Ajoutez un point de valeur pour suivre un compte dans le temps." />
        ) : (
          evaluations.map((evaluation) => {
            const accountId = evaluationAccountId(evaluation)
            const account = accountsById.get(accountId)
            const previous = previousEvaluationFor(evaluation, allEvaluations)
            const delta = previous ? evaluation.montantSoldeEnCentimes - previous.montantSoldeEnCentimes : null
            const deltaPercent = previous ? percentChange(evaluation.montantSoldeEnCentimes, previous.montantSoldeEnCentimes) : null
            return (
              <button
                type="button"
                key={evaluation.cle}
                className={`evaluation-row ${selectedKey === evaluation.cle ? 'selected' : ''}`}
                onClick={() => onSelect(evaluation.cle)}
                data-help="Ouvre le detail de cette evaluation, son compte et son evolution par rapport au point precedent."
              >
                <span className="evaluation-row-icon">
                  <AccountIcon type={account?.codeTypeFonctionnement} />
                </span>
                <span className="evaluation-row-main">
                  <strong>{evaluationTitle(evaluation)}</strong>
                  <small>{evaluation.cle}</small>
                </span>
                <span className="evaluation-row-account">
                  <strong>{accountDisplayLabel(account, accountId)}</strong>
                  <small>{account?.nomBanque || accountId}</small>
                </span>
                <span className="evaluation-row-value">
                  <strong>{formatCurrencyFromCents(evaluation.montantSoldeEnCentimes)}</strong>
                  <small>{formatShortDate(evaluation.dateSolde)}</small>
                </span>
                <span className={`evaluation-row-change ${delta && delta > 0 ? 'positive' : delta && delta < 0 ? 'negative' : ''}`}>
                  {delta === null ? (
                    <small>Premier point</small>
                  ) : (
                    <>
                      {delta > 0 ? <TrendingUp size={15} aria-hidden /> : <TrendingDown size={15} aria-hidden />}
                      <strong>{signedCurrencyFromCents(delta)}</strong>
                      <small>{formatSignedPercent(deltaPercent)}</small>
                    </>
                  )}
                </span>
                <Badge>{accountTypeLabel(account?.codeTypeFonctionnement)}</Badge>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}
