import { CalendarClock, Landmark, Percent, WalletCards } from 'lucide-react'

import { InsightBubbleChart, InsightHero, InsightMetric, InsightMetricGrid, InsightPanel } from '../../components/insight'
import { compactNumber, formatCurrencyFromCents } from '../../lib/format'
import type { LoanBasic } from '../../lib/monatis-api'
import { formatRate, loanConditions } from './loan-summary-utils'

export function LoanDashboard({ loans }: { loans: LoanBasic[] }) {
  const principalCents = loans.reduce((sum, loan) => sum + (loan.conditionEmpruntInitiale?.capitalEmprunteEnCentimes ?? 0), 0)
  const rates = loans.map((loan) => loan.conditionEmpruntInitiale?.tauxAnnuel).filter((rate): rate is number => typeof rate === 'number')
  const averageRate = rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0
  const conditionCount = loans.reduce((sum, loan) => sum + loanConditions(loan).length, 0)
  const revisedLoanCount = loans.filter((loan) => loanConditions(loan).length > 1).length
  const averageDuration = loans.length
    ? Math.round(loans.reduce((sum, loan) => sum + (loan.conditionEmpruntInitiale?.duree ?? 0), 0) / loans.length)
    : 0
  const largestLoans = [...loans]
    .sort((left, right) => (right.conditionEmpruntInitiale?.capitalEmprunteEnCentimes ?? 0) - (left.conditionEmpruntInitiale?.capitalEmprunteEnCentimes ?? 0))
    .slice(0, 5)

  return (
    <InsightPanel className="loan-dashboard" help="Synthese emprunts : donne une lecture rapide du portefeuille avant d'ouvrir un detail.">
      <InsightHero
        eyebrow="Emprunts"
        value={formatCurrencyFromCents(principalCents)}
        subtitle={`${loans.length} emprunt${loans.length > 1 ? 's' : ''} dans le portefeuille`}
        icon={Landmark}
        tone="neutral"
        tags={[
          { label: `${conditionCount} condition(s)` },
          { label: `Taux moyen ${formatRate(averageRate)}` },
        ]}
      />

      <InsightMetricGrid>
        <InsightMetric icon={Landmark} label="Revisions" value={revisedLoanCount} hint={`${loans.length - revisedLoanCount} emprunt(s) en condition initiale seule`} />
        <InsightMetric icon={WalletCards} label="Conditions" value={conditionCount} hint="initiales et revisions" />
        <InsightMetric icon={Percent} label="Taux moyen" value={formatRate(averageRate)} hint="sur les conditions initiales" />
        <InsightMetric icon={CalendarClock} label="Duree moyenne" value={averageDuration} hint="echeances prevues" />
      </InsightMetricGrid>

      <InsightBubbleChart
        chartId="data.loans.exposure"
        eyebrow="Exposition"
        title="Capital, taux et durée"
        subtitle="Position = taux et capital, taille = durée"
        help="Bulles emprunts : compare le capital emprunte, le taux annuel et la duree de chaque emprunt significatif."
        formatXTick={formatRate}
        formatYTick={(value) => `${compactNumber(value / 100)} €`}
        points={largestLoans.map((loan) => ({
          label: loan.libelle?.trim() || loan.cle,
          x: loan.conditionEmpruntInitiale?.tauxAnnuel ?? 0,
          y: loan.conditionEmpruntInitiale?.capitalEmprunteEnCentimes ?? 0,
          size: loan.conditionEmpruntInitiale?.duree ?? 1,
          displayX: formatRate(loan.conditionEmpruntInitiale?.tauxAnnuel ?? 0),
          displayY: formatCurrencyFromCents(loan.conditionEmpruntInitiale?.capitalEmprunteEnCentimes ?? 0),
          displaySize: `${loan.conditionEmpruntInitiale?.duree ?? 0} echeance(s)`,
          hint: loan.cle,
          tone: (loan.conditionEmpruntInitiale?.tauxAnnuel ?? 0) > averageRate ? 'warning' : 'success',
        }))}
      />
    </InsightPanel>
  )
}
