import { CalendarClock, CheckCircle2, Fingerprint, Route, Tags, Target } from 'lucide-react'

import { Badge } from '../../components/ui'
import { formatDate } from '../../lib/format'
import {
  importRuleStatusHint,
  importRuleStatusLabel,
  importRuleStatusTone,
  type ImportRuleViewModel,
} from './import-rule-utils'

interface ImportRuleOverviewProps {
  rule: ImportRuleViewModel
}

export function ImportRuleOverview({ rule }: ImportRuleOverviewProps) {
  const completion = Math.round((rule.qualityScore / rule.qualityMax) * 100)

  return (
    <section className="import-rule-overview" data-help="Resume la regle active, son perimetre et ce qu'elle appliquera aux prochaines lignes similaires.">
      <div className={`import-rule-detail-hero import-rule-detail-hero-${rule.status}`}>
        <div>
          <span>{rule.rule.cleLibelleNormalisee}</span>
          <h2>{rule.title}</h2>
          <p>{importRuleStatusHint(rule)}</p>
        </div>
        <Badge tone={importRuleStatusTone(rule.status)}>{importRuleStatusLabel(rule.status)}</Badge>
      </div>

      <div className="import-rule-kpi-grid">
        <article className="import-rule-kpi-card import-rule-kpi-primary">
          <CheckCircle2 size={20} aria-hidden />
          <span>Completude</span>
          <strong>{completion}%</strong>
          <small>{rule.qualityScore}/{rule.qualityMax} informations de routage</small>
        </article>
        <article className="import-rule-kpi-card">
          <Route size={20} aria-hidden />
          <span>Type applique</span>
          <strong>{rule.typeLabel}</strong>
          <small>{rule.roleLabel}</small>
        </article>
        <article className="import-rule-kpi-card">
          <Target size={20} aria-hidden />
          <span>Perimetre</span>
          <strong>{rule.scope === 'scoped' ? 'Compte precise' : 'Global'}</strong>
          <small>{rule.scope === 'scoped' ? rule.contextAccountLabel : 'Tous comptes internes'}</small>
        </article>
        <article className="import-rule-kpi-card">
          <CalendarClock size={20} aria-hidden />
          <span>Dernier usage</span>
          <strong>{rule.lastUsageDate ? formatDate(rule.lastUsageDate) : 'Jamais'}</strong>
          <small>{rule.usageCount} usage{rule.usageCount > 1 ? 's' : ''} enregistre{rule.usageCount > 1 ? 's' : ''}</small>
        </article>
      </div>

      <div className="import-rule-detail-grid">
        <section className="import-rule-route-panel">
          <div className="import-rule-panel-head">
            <div>
              <span>Routage appris</span>
              <strong>Ce que la suggestion remplira</strong>
            </div>
            <Route size={18} aria-hidden />
          </div>
          <div className="import-rule-route-list">
            <DetailLine label="Type d'operation" value={rule.typeLabel} hint={rule.rule.codeTypeOperation} />
            <DetailLine label="Role du compte externe" value={rule.roleLabel} />
            <DetailLine label="Compte externe" value={rule.externalAccountLabel} />
            <DetailLine label="Sous-categorie" value={rule.categoryLabel} />
            <DetailLine
              label="Beneficiaires"
              value={rule.beneficiaries.length ? rule.beneficiaries.join(', ') : 'Non renseigne'}
              hint={rule.beneficiaries.length ? `${rule.beneficiaries.length} rattachement${rule.beneficiaries.length > 1 ? 's' : ''}` : undefined}
            />
          </div>
        </section>

        <section className="import-rule-signature-panel">
          <div className="import-rule-panel-head">
            <div>
              <span>Signature de reconnaissance</span>
              <strong>Ligne de releve ciblee</strong>
            </div>
            <Fingerprint size={18} aria-hidden />
          </div>
          <div className="import-rule-signature-list">
            <DetailLine label="Cle normalisee" value={rule.rule.cleLibelleNormalisee} />
            <DetailLine label="Libelle exemple" value={rule.rule.libelleExemple || 'Non renseigne'} />
            <DetailLine label="Compte interne contexte" value={rule.scope === 'scoped' ? rule.contextAccountLabel : 'Tous comptes internes'} />
            <DetailLine label="Identifiant technique" value={`#${rule.rule.id}`} />
          </div>
          <div className="import-rule-beneficiary-panel">
            <Tags size={16} aria-hidden />
            <div>
              <strong>Beneficiaires appris</strong>
              <div className="import-rule-beneficiary-list">
                {rule.beneficiaries.length ? rule.beneficiaries.map((name) => <Badge key={name}>{name}</Badge>) : <Badge>Non renseigne</Badge>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}

function DetailLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="import-rule-detail-line">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}
