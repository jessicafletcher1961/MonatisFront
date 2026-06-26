import { AlertTriangle, History, ListChecks, Route, Target } from 'lucide-react'

import { formatDate } from '../../lib/format'
import { summarizeImportRules, type ImportRuleViewModel } from './import-rule-utils'

interface ImportRulesDashboardProps {
  rules: ImportRuleViewModel[]
}

export function ImportRulesDashboard({ rules }: ImportRulesDashboardProps) {
  const summary = summarizeImportRules(rules)
  const rulesToReview = summary.partialRules + summary.unusedRules

  return (
    <section className="import-rules-dashboard" data-help="Synthese des regles apprises pendant l'import de releves bancaires.">
      <article className="import-rules-summary-item import-rules-summary-item-main">
        <ListChecks size={22} aria-hidden />
        <div>
          <span>Regles actives</span>
          <strong>{summary.totalRules}</strong>
          <small>{summary.readyRules} pretes, {rulesToReview} a controler</small>
        </div>
      </article>
      <article className="import-rules-summary-item">
        <History size={22} aria-hidden />
        <div>
          <span>Utilisations apprises</span>
          <strong>{summary.totalUsages}</strong>
          <small>{summary.latestUsageDate ? `Dernier usage ${formatDate(summary.latestUsageDate)}` : 'Aucune reutilisation'}</small>
        </div>
      </article>
      <article className="import-rules-summary-item">
        <Target size={22} aria-hidden />
        <div>
          <span>Par compte</span>
          <strong>{summary.scopedRules}</strong>
          <small>{summary.totalRules - summary.scopedRules} regle{summary.totalRules - summary.scopedRules > 1 ? 's' : ''} globale{summary.totalRules - summary.scopedRules > 1 ? 's' : ''}</small>
        </div>
      </article>
      <article className="import-rules-summary-item">
        <AlertTriangle size={22} aria-hidden />
        <div>
          <span>A completer</span>
          <strong>{rulesToReview}</strong>
          <small>{summary.unusedRules} sans usage, {summary.partialRules} partielles</small>
        </div>
      </article>
      <div className="import-rules-type-strip">
        {summary.topTypes.length ? (
          summary.topTypes.map((item) => (
            <div className="import-rules-type-item" key={item.code}>
              <Route size={18} aria-hidden />
              <div>
                <span>{item.label}</span>
                <strong>{item.count} regle{item.count > 1 ? 's' : ''}</strong>
                <small>{item.usages} usage{item.usages > 1 ? 's' : ''} cumule{item.usages > 1 ? 's' : ''}</small>
              </div>
            </div>
          ))
        ) : (
          <div className="import-rules-type-item">
            <Route size={18} aria-hidden />
            <div>
              <span>Typage</span>
              <strong>Aucune regle</strong>
              <small>Les types apparaitront apres apprentissage.</small>
            </div>
          </div>
        )}
        <div className="import-rules-type-item">
          <Target size={18} aria-hidden />
          <div>
            <span>Routage renseigne</span>
            <strong>{summary.withExternalAccount}/{summary.totalRules || 0} comptes externes</strong>
            <small>{summary.withCategory} categories, {summary.withBeneficiary} beneficiaires</small>
          </div>
        </div>
      </div>
    </section>
  )
}
