import { Trash2 } from 'lucide-react'

import { Button, FormField, Surface } from '../../components/ui'
import type { Typology } from '../../lib/monatis-api'
import type { LoanConditionFormState } from './loan-condition-utils'
import { formatRate } from './loan-summary-utils'

export function LoanConditionEditor({
  condition,
  index,
  periods,
  removable,
  onChange,
  onRemove,
}: {
  condition: LoanConditionFormState
  index: number
  periods: Typology[]
  removable: boolean
  onChange: (index: number, key: keyof LoanConditionFormState, value: string) => void
  onRemove: (index: number) => void
}) {
  return (
    <Surface className="data-panel loan-condition-editor">
      <div className="section-header">
        <div>
          <h2>{index === 0 ? 'Condition initiale' : `Revision ${index}`}</h2>
          <p>
            Echéance {condition.numeroPremiereEcheance || '1'} · {condition.duree || 0} paiement{condition.duree && Number(condition.duree) > 1 ? 's' : ''} ·{' '}
            {formatRate(condition.tauxAnnuel.trim() ? Number(condition.tauxAnnuel.replace(',', '.')) : null)}
          </p>
        </div>
        {removable ? (
          <Button type="button" tone="danger" onClick={() => onRemove(index)}>
            <Trash2 size={16} />
            Supprimer
          </Button>
        ) : null}
      </div>
      <div className="form-grid three-columns">
        <FormField label="Libelle de condition">
          <input value={condition.libelle} onChange={(event) => onChange(index, 'libelle', event.target.value)} placeholder="Facultatif" />
        </FormField>
        <FormField label="Taux annuel">
          <input value={condition.tauxAnnuel} onChange={(event) => onChange(index, 'tauxAnnuel', event.target.value)} placeholder="Ex. 3,5" required />
        </FormField>
        <FormField label="Capital emprunte">
          <input value={condition.capitalEmprunte} onChange={(event) => onChange(index, 'capitalEmprunte', event.target.value)} placeholder="0,00" required />
        </FormField>
        <FormField label="Nombre d echeances">
          <input type="number" min="1" value={condition.duree} onChange={(event) => onChange(index, 'duree', event.target.value)} required />
        </FormField>
        <FormField label="Periodicite">
          <select value={condition.codeTypePeriodeEcheances} onChange={(event) => onChange(index, 'codeTypePeriodeEcheances', event.target.value)}>
            {periods.map((period) => (
              <option key={period.code} value={period.code}>
                {period.libelle}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Premiere echeance">
          <input
            type="number"
            min="1"
            value={condition.numeroPremiereEcheance}
            onChange={(event) => onChange(index, 'numeroPremiereEcheance', event.target.value)}
          />
        </FormField>
        <FormField label="Date premiere echeance">
          <input type="date" value={condition.datePremiereEcheance} onChange={(event) => onChange(index, 'datePremiereEcheance', event.target.value)} required />
        </FormField>
        <FormField label="Paiement total">
          <input value={condition.montantTotalEcheance} onChange={(event) => onChange(index, 'montantTotalEcheance', event.target.value)} placeholder="0,00" required />
        </FormField>
        <FormField label="Frais fixes">
          <input
            value={condition.montantFraisFixesEcheance}
            onChange={(event) => onChange(index, 'montantFraisFixesEcheance', event.target.value)}
            placeholder="0,00"
            required
          />
        </FormField>
      </div>
    </Surface>
  )
}
