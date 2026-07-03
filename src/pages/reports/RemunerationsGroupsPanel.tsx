import { ArrowDownLeft, ArrowUpRight, Landmark, ReceiptText, Scale } from 'lucide-react'

import { HorizontalScrollArea } from '../../components/horizontal-scroll-area'
import { Badge, Surface } from '../../components/ui'
import { formatCurrency } from '../../lib/format'
import { describePeriod, type PeriodTotalView, type RemunerationsAccountView, type RemunerationsFraisView, type RemunerationsTypeView } from '../../lib/reporting'
import { mostSignificantItems, periodCountLabel, recentItems } from './report-detail-utils'
import { sumRemunerationsPeriods } from './remunerations-report-utils'

function PeriodDetails({ period, title }: { period: PeriodTotalView; title: string }) {
  return (
    <div className="report-hover-card remunerations-hover-card">
      <div className="report-hover-head">
        <strong>{title}</strong>
        <span>{describePeriod({ key: '', label: '', start: period.start, end: period.end })}</span>
      </div>
      <div className="remunerations-hover-grid">
        <span>Remunerations</span>
        <strong>{formatCurrency(period.recette)}</strong>
        <span>Frais</span>
        <strong>{formatCurrency(period.depense)}</strong>
        <span>Net</span>
        <strong>{formatCurrency(period.solde)}</strong>
      </div>
    </div>
  )
}

function PeriodPill({ period, title }: { period: PeriodTotalView; title: string }) {
  return (
    <div className="report-hover-wrap remunerations-period-pill" tabIndex={0}>
      <div className="remunerations-period-pill-main">
        {period.solde >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
        <span>{period.label}</span>
        <strong>{formatCurrency(period.solde)}</strong>
        <small>
          Remunerations {formatCurrency(period.recette)} · Frais {formatCurrency(period.depense)}
        </small>
      </div>
      <PeriodDetails period={period} title={title} />
    </div>
  )
}

function AccountRow({ account }: { account: RemunerationsAccountView }) {
  const summary = sumRemunerationsPeriods(account.periods)
  const title = account.libelle || account.identifiant

  return (
    <div className="remunerations-account-row" data-help="Compte remunerations frais : affiche les remunerations, frais et resultat net du compte.">
      <div className="remunerations-account-head">
        <div>
          <strong>{title}</strong>
          <span>
            {account.identifiant}
            {account.banque ? ` · ${account.banque}` : ''}
          </span>
        </div>
        <Badge tone={summary.solde >= 0 ? 'success' : 'warning'}>{formatCurrency(summary.solde)}</Badge>
      </div>
      <div className="remunerations-account-metrics">
        <span>
          <ArrowUpRight size={14} />
          Remunerations {formatCurrency(summary.recette)}
        </span>
        <span>
          <ArrowDownLeft size={14} />
          Frais {formatCurrency(summary.depense)}
        </span>
        <span>
          <Scale size={14} />
          Net {formatCurrency(summary.solde)}
        </span>
      </div>
    </div>
  )
}

function GroupCard({ group }: { group: RemunerationsTypeView }) {
  const summary = sumRemunerationsPeriods(group.periods)
  const showPeriods = group.periods.length > 1
  const visiblePeriods = recentItems(group.periods)
  const visibleAccounts = mostSignificantItems(group.accounts, (account) => sumRemunerationsPeriods(account.periods).solde)
  const periodCount = periodCountLabel(group.periods)

  return (
    <article className="remunerations-group-card">
      <div className="remunerations-group-head">
        <div>
          <h3>{group.typeFonctionnement}</h3>
          <span>
            {group.accounts.length} compte(s)
            {periodCount ? ` - ${periodCount}` : ''}
          </span>
        </div>
        <Badge tone={summary.solde >= 0 ? 'success' : 'warning'}>{formatCurrency(summary.solde)}</Badge>
      </div>
      <div className="remunerations-group-metrics">
        <span>
          <Landmark size={14} />
          {group.accounts.length} compte(s)
        </span>
        <span>
          <ArrowUpRight size={14} />
          Remunerations {formatCurrency(summary.recette)}
        </span>
        <span>
          <ReceiptText size={14} />
          Frais {formatCurrency(summary.depense)}
        </span>
        <span>
          <Scale size={14} />
          Net {formatCurrency(summary.solde)}
        </span>
      </div>
      {showPeriods ? (
        <>
          <HorizontalScrollArea className="remunerations-period-pills group" aria-label={`Periodes ${group.typeFonctionnement}`}>
            {visiblePeriods.map((period) => (
              <PeriodPill key={`${group.typeFonctionnement}-${period.start}-${period.end}`} period={period} title={group.typeFonctionnement} />
            ))}
          </HorizontalScrollArea>
        </>
      ) : null}
      <div className="remunerations-account-list">
        {visibleAccounts.map((account) => (
          <AccountRow key={account.identifiant} account={account} />
        ))}
      </div>
    </article>
  )
}

export function RemunerationsGroupsPanel({ report }: { report: RemunerationsFraisView }) {
  return (
    <Surface className="data-panel report-panel remunerations-groups-panel" data-help="Types et comptes remunerations frais : chaque carte détaille les produits, les frais et le net par type puis par compte.">
      <div className="remunerations-group-grid">
        {report.groups.map((group) => (
          <GroupCard key={group.typeFonctionnement} group={group} />
        ))}
      </div>
    </Surface>
  )
}
