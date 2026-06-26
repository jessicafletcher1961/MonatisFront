import { useMutation } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'

import { Button, EmptyState, ErrorState, FormField, Surface } from '../../components/ui'
import { apiErrorMessage, type LoanCondition, type LoanPayment, monatisApi } from '../../lib/monatis-api'
import { formatCurrencyFromCents, formatShortDate, todayIso } from '../../lib/format'
import { buildLoanScheduleSummary } from './loan-summary-utils'

export function LoanPaymentsSection({
  selectedKey,
  conditions,
}: {
  selectedKey: string | null
  conditions: LoanCondition[]
}) {
  const [paymentDate, setPaymentDate] = useState(todayIso())
  const [paymentNumber, setPaymentNumber] = useState('1')
  const [paymentResult, setPaymentResult] = useState<LoanPayment | null | undefined>(undefined)
  const summary = buildLoanScheduleSummary(conditions)
  const payments = summary.payments

  const paymentByDateMutation = useMutation({
    mutationFn: () => monatisApi.getLoanPaymentByDate(selectedKey!, paymentDate),
    onSuccess: (response) => setPaymentResult(response ?? null),
  })

  const paymentByNumberMutation = useMutation({
    mutationFn: () => monatisApi.getLoanPaymentByNumber(selectedKey!, Number.parseInt(paymentNumber, 10)),
    onSuccess: (response) => setPaymentResult(response ?? null),
  })

  const activeError = paymentByDateMutation.error || paymentByNumberMutation.error

  return (
    <Surface className="data-panel loan-payments-section">
      <div className="section-header">
        <div>
          <h2>Echeances</h2>
          <p>
            {payments.length} échéance{payments.length > 1 ? 's' : ''} générée{payments.length > 1 ? 's' : ''} · coût total {formatCurrencyFromCents(summary.totalPaymentCents)}
          </p>
        </div>
      </div>
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <div className="loan-payment-search">
        <FormField label="Par numero">
          <input type="number" min="1" value={paymentNumber} onChange={(event) => setPaymentNumber(event.target.value)} />
        </FormField>
        <FormField label="Par date">
          <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </FormField>
        <Button type="button" tone="soft" disabled={!selectedKey || paymentByNumberMutation.isPending} onClick={() => void paymentByNumberMutation.mutateAsync()}>
          <Search size={15} />
          Numéro
        </Button>
        <Button type="button" tone="soft" disabled={!selectedKey || paymentByDateMutation.isPending} onClick={() => void paymentByDateMutation.mutateAsync()}>
          <Search size={15} />
          Date
        </Button>
      </div>

      {paymentResult === null ? <EmptyState title="Aucune echeance" description="Le back n a pas trouve d echeance pour ce critere." /> : null}
      {paymentResult ? (
        <div className="loan-payment-result">
          <div>
            <span>Numero</span>
            <strong>{paymentResult.numero}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatShortDate(paymentResult.date)}</strong>
          </div>
          <div>
            <span>Paiement</span>
            <strong>{formatCurrencyFromCents(paymentResult.montantPaiementEnCentimes)}</strong>
          </div>
          <div>
            <span>Capital restant du</span>
            <strong>{formatCurrencyFromCents(paymentResult.capitalEmprunteRestantDuEnCentimes)}</strong>
          </div>
        </div>
      ) : null}
      <div className="table-wrapper">
        <table className="report-table report-table-soft">
          <thead>
            <tr>
              <th>N</th>
              <th>Date</th>
              <th>Paiement</th>
              <th>Capital</th>
              <th>Interets</th>
              <th>Frais</th>
              <th>Restant du</th>
            </tr>
          </thead>
          <tbody>
            {payments.slice(0, 80).map((payment) => (
              <tr key={`${payment.numero}-${payment.date}`}>
                <td>{payment.numero}</td>
                <td>{formatShortDate(payment.date)}</td>
                <td>{formatCurrencyFromCents(payment.montantPaiementEnCentimes)}</td>
                <td>{formatCurrencyFromCents(payment.partCapitalEnCentimes)}</td>
                <td>{formatCurrencyFromCents(payment.partInteretEnCentimes)}</td>
                <td>{formatCurrencyFromCents(payment.partFraisFixesEnCentimes)}</td>
                <td>{formatCurrencyFromCents(payment.capitalEmprunteRestantDuEnCentimes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payments.length > 80 ? <p className="loan-table-note">Affichage limité aux 80 premières échéances pour garder la page lisible.</p> : null}
    </Surface>
  )
}
