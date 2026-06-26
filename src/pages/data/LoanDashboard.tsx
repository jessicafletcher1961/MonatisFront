import { CalendarClock, Landmark, Percent, WalletCards } from 'lucide-react'

import { formatCurrencyFromCents } from '../../lib/format'
import type { LoanBasic } from '../../lib/monatis-api'
import { formatRate, loanConditions } from './loan-summary-utils'

export function LoanDashboard({ loans }: { loans: LoanBasic[] }) {
  const principalCents = loans.reduce((sum, loan) => sum + (loan.conditionEmpruntInitiale?.capitalEmprunteEnCentimes ?? 0), 0)
  const rates = loans.map((loan) => loan.conditionEmpruntInitiale?.tauxAnnuel).filter((rate): rate is number => typeof rate === 'number')
  const averageRate = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0
  const conditionCount = loans.reduce((sum, loan) => sum + loanConditions(loan).length, 0)
  const averageDuration = loans.length
    ? Math.round(loans.reduce((sum, loan) => sum + (loan.conditionEmpruntInitiale?.duree ?? 0), 0) / loans.length)
    : 0

  return (
    <div className="loan-dashboard" data-help="Synthèse emprunts : donne une lecture rapide du portefeuille avant d'ouvrir un détail.">
      <div className="loan-summary-item principal">
        <Landmark size={18} />
        <span>Capital initial</span>
        <strong>{formatCurrencyFromCents(principalCents)}</strong>
        <small>{loans.length} emprunt{loans.length > 1 ? 's' : ''}</small>
      </div>
      <div className="loan-summary-item payment">
        <WalletCards size={18} />
        <span>Conditions</span>
        <strong>{conditionCount}</strong>
        <small>initiales et révisions</small>
      </div>
      <div className="loan-summary-item rate">
        <Percent size={18} />
        <span>Taux moyen</span>
        <strong>{formatRate(averageRate)}</strong>
        <small>sur les conditions initiales</small>
      </div>
      <div className="loan-summary-item time">
        <CalendarClock size={18} />
        <span>Durée moyenne</span>
        <strong>{averageDuration}</strong>
        <small>échéances prévues</small>
      </div>
    </div>
  )
}

