import { Save } from 'lucide-react'

import { Button, FormField } from '../../components/ui'
import { formatCurrencyFromCents, parseMoneyToCents } from '../../lib/format'
import type { BudgetResource, ReferenceBase, Typology } from '../../lib/monatis-api'
import { budgetPeriodPreviewLabel, budgetResourceHint, budgetResourceTargetLabel, budgetTypeOptionLabel, budgetTypeShortLabel, type BudgetFormState } from './budget-panel-utils'

interface BudgetFormProps {
  disabled: boolean
  form: BudgetFormState
  references: ReferenceBase[]
  periods: Typology[]
  budgetTypes: Typology[]
  resource: BudgetResource
  submitLabel: string
  onChange: <Key extends keyof BudgetFormState>(key: Key, value: BudgetFormState[Key]) => void
  onSubmit: () => Promise<unknown>
}

function referenceLabel(name: string, references: ReferenceBase[]): string {
  const reference = references.find((item) => item.nom === name)
  return reference?.libelle?.trim() || reference?.nom || 'Reference a choisir'
}

export function BudgetForm({ disabled, form, references, periods, budgetTypes, resource, submitLabel, onChange, onSubmit }: BudgetFormProps) {
  const referenceOptions =
    form.nomReference && !references.some((reference) => reference.nom === form.nomReference)
      ? [{ nom: form.nomReference, libelle: form.nomReference }, ...references]
      : references
  const previewAmount = formatCurrencyFromCents(parseMoneyToCents(form.montantBudget))
  const targetLabel = budgetResourceTargetLabel(resource)

  return (
    <form
      className="budget-form-shell"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <div className="budget-form-preview" aria-label="Resume du budget">
        <span>{budgetTypeShortLabel(form.codeTypeBudget, budgetTypes)}</span>
        <strong>{previewAmount}</strong>
        <small>
          {targetLabel} : {referenceLabel(form.nomReference, referenceOptions)}
        </small>
        <small>{budgetPeriodPreviewLabel(form.codeTypePeriode, form.dateCible)}</small>
      </div>

      <div className="form-grid two-columns budget-form-grid">
        <FormField label={targetLabel} hint={budgetResourceHint(resource)}>
          <select value={form.nomReference} onChange={(event) => onChange('nomReference', event.target.value)} required>
            <option value="">Choisir une reference</option>
            {referenceOptions.map((reference) => (
              <option key={reference.nom} value={reference.nom}>
                {reference.nom} - {reference.libelle ?? 'Sans libelle'}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Montant">
          <input value={form.montantBudget} onChange={(event) => onChange('montantBudget', event.target.value)} placeholder="0,00" required />
        </FormField>

        <FormField label="Type de budget">
          <select value={form.codeTypeBudget} onChange={(event) => onChange('codeTypeBudget', event.target.value)} required>
            <option value="">Choisir</option>
            {budgetTypes.map((type) => (
              <option key={type.code} value={type.code}>
                {budgetTypeOptionLabel(type)}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Periode">
          <select value={form.codeTypePeriode} onChange={(event) => onChange('codeTypePeriode', event.target.value)} required>
            <option value="">Choisir</option>
            {periods.map((type) => (
              <option key={type.code} value={type.code}>
                {type.libelle}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Date cible" hint={`Periode creee : ${budgetPeriodPreviewLabel(form.codeTypePeriode, form.dateCible)}`}>
          <input type="date" value={form.dateCible} onChange={(event) => onChange('dateCible', event.target.value)} />
        </FormField>

        <FormField label="Cle technique" hint="Facultative en creation : le back genere une cle si ce champ reste vide.">
          <input value={form.cle} onChange={(event) => onChange('cle', event.target.value)} placeholder="Generee si vide" />
        </FormField>

        <FormField label="Libelle">
          <input value={form.libelle} onChange={(event) => onChange('libelle', event.target.value)} placeholder="Facultatif" />
        </FormField>

        <div className="button-row full-span budget-form-actions">
          <Button type="submit" disabled={disabled}>
            <Save size={16} />
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  )
}
