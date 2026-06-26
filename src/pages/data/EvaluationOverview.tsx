import { CalendarDays, Clock3, Landmark, Scale, TrendingDown, TrendingUp } from 'lucide-react'

import { Badge } from '../../components/ui'
import { formatCurrencyFromCents, formatShortDate } from '../../lib/format'
import type { CompteInterneBasic, EvaluationBasic } from '../../lib/monatis-api'
import {
  accountDisplayLabel,
  accountTypeLabel,
  daysBetweenIso,
  evaluationAccountId,
  evaluationTitle,
  formatSignedPercent,
  percentChange,
  previousEvaluationFor,
  signedCurrencyFromCents,
  sortedEvaluations,
} from './evaluation-utils'

interface EvaluationOverviewProps {
  evaluation: EvaluationBasic
  evaluations: EvaluationBasic[]
  account: CompteInterneBasic | undefined
}

export function EvaluationOverview({ evaluation, evaluations, account }: EvaluationOverviewProps) {
  const accountId = evaluationAccountId(evaluation)
  const previous = previousEvaluationFor(evaluation, evaluations)
  const delta = previous ? evaluation.montantSoldeEnCentimes - previous.montantSoldeEnCentimes : null
  const deltaPercent = previous ? percentChange(evaluation.montantSoldeEnCentimes, previous.montantSoldeEnCentimes) : null
  const sincePreviousDays = previous ? daysBetweenIso(previous.dateSolde, evaluation.dateSolde) : null
  const initialDelta =
    account?.montantSoldeInitialEnCentimes === undefined
      ? null
      : evaluation.montantSoldeEnCentimes - account.montantSoldeInitialEnCentimes
  const history = sortedEvaluations(evaluations).filter((item) => evaluationAccountId(item) === accountId).slice(0, 6)
  const maxAbsAmount = Math.max(1, ...history.map((item) => Math.abs(item.montantSoldeEnCentimes)))

  return (
    <section className="evaluation-overview" data-help="Resume la valeur de ce compte a une date precise et son evolution par rapport aux evaluations precedentes.">
      <div className={`evaluation-detail-hero ${evaluation.montantSoldeEnCentimes < 0 ? 'negative' : 'positive'}`}>
        <div>
          <span>{accountDisplayLabel(account, accountId)}</span>
          <h2>{evaluationTitle(evaluation)}</h2>
          <p>{account?.nomBanque || accountId}</p>
        </div>
        <Badge tone={evaluation.montantSoldeEnCentimes < 0 ? 'warning' : 'success'}>
          {accountTypeLabel(account?.codeTypeFonctionnement)}
        </Badge>
      </div>

      <div className="evaluation-kpi-grid">
        <article className="evaluation-kpi-card evaluation-kpi-primary">
          <Scale size={20} aria-hidden />
          <span>Montant evalue</span>
          <strong>{formatCurrencyFromCents(evaluation.montantSoldeEnCentimes)}</strong>
          <small>{formatShortDate(evaluation.dateSolde)}</small>
        </article>
        <article className="evaluation-kpi-card">
          {delta !== null && delta >= 0 ? <TrendingUp size={20} aria-hidden /> : <TrendingDown size={20} aria-hidden />}
          <span>Variation precedente</span>
          <strong>{delta === null ? 'Premier point' : signedCurrencyFromCents(delta)}</strong>
          <small>{delta === null ? 'Aucune comparaison' : formatSignedPercent(deltaPercent)}</small>
        </article>
        <article className="evaluation-kpi-card">
          <Clock3 size={20} aria-hidden />
          <span>Intervalle</span>
          <strong>{sincePreviousDays === null ? 'n/a' : `${sincePreviousDays} j`}</strong>
          <small>{previous ? `Depuis ${formatShortDate(previous.dateSolde)}` : 'Pas de point avant'}</small>
        </article>
        <article className="evaluation-kpi-card">
          <CalendarDays size={20} aria-hidden />
          <span>Depuis solde initial</span>
          <strong>{initialDelta === null ? 'n/a' : signedCurrencyFromCents(initialDelta)}</strong>
          <small>{account?.dateSoldeInitial ? `Base ${formatShortDate(account.dateSoldeInitial)}` : 'Solde initial absent'}</small>
        </article>
      </div>

      <div className="evaluation-history-panel">
        <div className="evaluation-history-head">
          <div>
            <span>Historique du compte</span>
            <strong>{history.length} point{history.length > 1 ? 's' : ''}</strong>
          </div>
          <Landmark size={18} aria-hidden />
        </div>
        <div className="evaluation-history-list">
          {history.map((item) => {
            const width = Math.max(6, Math.round((Math.abs(item.montantSoldeEnCentimes) / maxAbsAmount) * 100))
            return (
              <div className="evaluation-history-row" key={item.cle}>
                <div>
                  <strong>{formatShortDate(item.dateSolde)}</strong>
                  <small>{evaluationTitle(item)}</small>
                </div>
                <div className="evaluation-history-meter" aria-hidden>
                  <span
                    className={item.montantSoldeEnCentimes < 0 ? 'negative' : 'positive'}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <strong>{formatCurrencyFromCents(item.montantSoldeEnCentimes)}</strong>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
