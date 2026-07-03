import { Banknote, Landmark, Percent, ReceiptText, Scale, TrendingDown, TrendingUp } from 'lucide-react'

import { HorizontalScrollArea } from '../../components/horizontal-scroll-area'
import { Badge, Surface } from '../../components/ui'
import { formatCurrency } from '../../lib/format'
import { describePeriod, type PlusMoinsValueAccountView, type PlusMoinsValuePeriodView, type PlusMoinsValueTypeView, type PlusMoinsValueView } from '../../lib/reporting'
import { plusMoinsRateLabel, summarizePlusMoinsPeriods } from './plus-moins-report-utils'
import { mostSignificantItems, periodCountLabel, recentItems } from './report-detail-utils'

function PeriodDetails({ period, title }: { period: PlusMoinsValuePeriodView; title: string }) {
  return (
    <div className="report-hover-card plus-moins-hover-card">
      <div className="report-hover-head">
        <strong>{title}</strong>
        <span>{describePeriod({ key: '', label: '', start: period.start, end: period.end })}</span>
      </div>
      <div className="plus-moins-hover-grid">
        <span>Solde initial</span>
        <strong>{formatCurrency(period.montantSoldeInitialEnEuros)}</strong>
        <span>Operations ponderees</span>
        <strong>{formatCurrency(period.montantOperationsEnEuros)}</strong>
        <span>Plus / moins-value</span>
        <strong>{formatCurrency(period.montantPlusMoinsValueNetteEnEuros)}</strong>
        <span>Taux net</span>
        <strong>{plusMoinsRateLabel(period.tauxPlusMoinsValueNette)}</strong>
        <span>Frais</span>
        <strong>{formatCurrency(period.montantFraisEnEuros)}</strong>
        <span>Solde final</span>
        <strong>{formatCurrency(period.montantSoldeFinalEnEuros)}</strong>
      </div>
    </div>
  )
}

function PeriodPill({ period, title }: { period: PlusMoinsValuePeriodView; title: string }) {
  const positive = period.montantPlusMoinsValueNetteEnEuros >= 0

  return (
    <div className="report-hover-wrap plus-moins-period-pill" tabIndex={0}>
      <div className="plus-moins-period-pill-main">
        {positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{period.label}</span>
        <strong>{formatCurrency(period.montantPlusMoinsValueNetteEnEuros)}</strong>
        <small>
          Taux {plusMoinsRateLabel(period.tauxPlusMoinsValueNette)} · Final {formatCurrency(period.montantSoldeFinalEnEuros)}
        </small>
      </div>
      <PeriodDetails period={period} title={title} />
    </div>
  )
}

function AccountRow({ account }: { account: PlusMoinsValueAccountView }) {
  const summary = summarizePlusMoinsPeriods(account.periods)
  const title = account.libelle || account.identifiant

  return (
    <div className="plus-moins-account-row" data-help="Compte plus moins-value : affiche la performance nette du compte, son taux, ses frais et ses periodes.">
      <div className="plus-moins-account-head">
        <div>
          <strong>{title}</strong>
          <span>
            {account.identifiant}
            {account.banque ? ` · ${account.banque}` : ''}
          </span>
        </div>
        <Badge tone={summary.montantPlusMoinsValueNetteEnEuros >= 0 ? 'success' : 'warning'}>{formatCurrency(summary.montantPlusMoinsValueNetteEnEuros)}</Badge>
      </div>
      <div className="plus-moins-account-metrics">
        <span>
          <Percent size={14} />
          {plusMoinsRateLabel(summary.tauxPlusMoinsValueNette)}
        </span>
        <span>
          <ReceiptText size={14} />
          Frais {formatCurrency(summary.montantFraisEnEuros)}
        </span>
        <span>
          <Scale size={14} />
          Final {formatCurrency(summary.montantSoldeFinalEnEuros)}
        </span>
      </div>
    </div>
  )
}

function GroupCard({ group }: { group: PlusMoinsValueTypeView }) {
  const summary = summarizePlusMoinsPeriods(group.periods)
  const showPeriods = group.periods.length > 1
  const visiblePeriods = recentItems(group.periods)
  const visibleAccounts = mostSignificantItems(group.accounts, (account) => summarizePlusMoinsPeriods(account.periods).montantPlusMoinsValueNetteEnEuros)
  const periodCount = periodCountLabel(group.periods)

  return (
    <article className="plus-moins-group-card">
      <div className="plus-moins-group-head">
        <div>
          <h3>{group.typeFonctionnement}</h3>
          <span>
            {group.accounts.length} compte(s)
            {periodCount ? ` - ${periodCount}` : ''}
          </span>
        </div>
        <Badge tone={summary.montantPlusMoinsValueNetteEnEuros >= 0 ? 'success' : 'warning'}>{formatCurrency(summary.montantPlusMoinsValueNetteEnEuros)}</Badge>
      </div>
      <div className="plus-moins-group-metrics">
        <span>
          <Landmark size={14} />
          {group.accounts.length} compte(s)
        </span>
        <span>
          <Percent size={14} />
          {plusMoinsRateLabel(summary.tauxPlusMoinsValueNette)}
        </span>
        <span>
          <Banknote size={14} />
          Frais {formatCurrency(summary.montantFraisEnEuros)}
        </span>
      </div>
      {showPeriods ? (
        <>
          <HorizontalScrollArea className="plus-moins-period-pills group" aria-label={`Periodes ${group.typeFonctionnement}`}>
            {visiblePeriods.map((period) => (
              <PeriodPill key={`${group.typeFonctionnement}-${period.start}-${period.end}`} period={period} title={group.typeFonctionnement} />
            ))}
          </HorizontalScrollArea>
        </>
      ) : null}
      <div className="plus-moins-account-list">
        {visibleAccounts.map((account) => (
          <AccountRow key={account.identifiant} account={account} />
        ))}
      </div>
    </article>
  )
}

export function PlusMoinsGroupsPanel({ report }: { report: PlusMoinsValueView }) {
  return (
    <Surface className="data-panel report-panel plus-moins-groups-panel" data-help="Types et comptes plus moins-value : chaque carte permet de comparer performance, frais et taux par type puis par compte.">
      <div className="plus-moins-group-grid">
        {report.groups.map((group) => (
          <GroupCard key={group.typeFonctionnement} group={group} />
        ))}
      </div>
    </Surface>
  )
}
