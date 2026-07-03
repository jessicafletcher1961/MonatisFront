import { Activity, ArrowDownLeft, ArrowUpRight, Banknote, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'

import { HorizontalScrollArea } from '../../components/horizontal-scroll-area'
import { Badge, Surface } from '../../components/ui'
import { formatCurrency } from '../../lib/format'
import { describePeriod, type BilanAccountView, type BilanPatrimoineView, type BilanPeriodView, type BilanTypeView } from '../../lib/reporting'
import { summarizeBilanPeriods } from './bilan-report-utils'
import { mostSignificantItems, periodCountLabel, recentItems } from './report-detail-utils'

const comparisonColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-8)',
]

function hasAmount(value: number): boolean {
  return Math.abs(value) >= 0.005
}

function accountTitle(account: BilanAccountView): string {
  return account.libelle || account.identifiant
}

function PeriodDetails({ period, title }: { period: BilanPeriodView; title: string }) {
  return (
    <div className="report-hover-card bilan-hover-card">
      <div className="report-hover-head">
        <strong>{title}</strong>
        <span>{describePeriod({ key: '', label: '', start: period.start, end: period.end })}</span>
      </div>
      <div className="bilan-hover-grid">
        <span>Solde initial</span>
        <strong>{formatCurrency(period.montantSoldeInitialEnEuros)}</strong>
        <span>Recettes</span>
        <strong>{formatCurrency(period.montantTotalRecetteEnEuros)}</strong>
        <span>Depenses</span>
        <strong>{formatCurrency(period.montantTotalDepenseEnEuros)}</strong>
        <span>Flux techniques</span>
        <strong>{formatCurrency(period.soldeTotalTechniqueEnEuros)}</strong>
        <span>Ecart controle</span>
        <strong>{formatCurrency(period.montantEcartNonJustifieEnEuros)}</strong>
        <span>Solde final</span>
        <strong>{formatCurrency(period.montantSoldeFinalEnEuros)}</strong>
      </div>
    </div>
  )
}

function PeriodPill({ period, title }: { period: BilanPeriodView; title: string }) {
  const variation = period.montantSoldeFinalEnEuros - period.montantSoldeInitialEnEuros
  const details = [
    hasAmount(variation) ? `Variation ${formatCurrency(variation)}` : null,
    hasAmount(period.montantEcartNonJustifieEnEuros) ? `Ecart ${formatCurrency(period.montantEcartNonJustifieEnEuros)}` : null,
  ].filter(Boolean)

  return (
    <div className="report-hover-wrap bilan-period-pill" tabIndex={0}>
      <div className="bilan-period-pill-main">
        {variation >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
        <span>{period.label}</span>
        <strong>{formatCurrency(period.montantSoldeFinalEnEuros)}</strong>
        {details.length ? <small>{details.join(' - ')}</small> : null}
      </div>
      <PeriodDetails period={period} title={title} />
    </div>
  )
}

function comparisonWidth(value: number, maxValue: number): string {
  if (!maxValue) {
    return '0%'
  }

  return `${Math.max(6, Math.min(100, (Math.abs(value) / maxValue) * 100))}%`
}

function ComparisonPeriodPill({
  period,
  title,
  accounts,
  periodIndex,
  accountColors,
}: {
  period: BilanPeriodView
  title: string
  accounts: BilanAccountView[]
  periodIndex: number
  accountColors: Map<string, string>
}) {
  const values = accounts.map((account) => account.periods[periodIndex]?.montantSoldeFinalEnEuros ?? 0)
  const maxValue = Math.max(1, ...values.map((value) => Math.abs(value)))

  return (
    <div className="report-hover-wrap bilan-period-pill compare" tabIndex={0}>
      <div className="bilan-period-pill-main">
        <Activity size={14} />
        <span>{period.label}</span>
        <strong>{formatCurrency(period.montantSoldeFinalEnEuros)}</strong>
        <small>Cumul du groupe</small>
      </div>
      <div className="bilan-period-comparison-list" aria-label={`Comparaison ${title} ${period.label}`}>
        {accounts.length ? (
          accounts.map((account) => {
            const accountPeriod = account.periods[periodIndex]
            const value = accountPeriod?.montantSoldeFinalEnEuros ?? 0
            const color = accountColors.get(account.identifiant) ?? comparisonColors[0]

            return (
              <div key={account.identifiant} className="bilan-period-comparison-row" style={{ '--compare-color': color } as CSSProperties}>
                <div>
                  <span>{accountTitle(account)}</span>
                  <strong>{formatCurrency(value)}</strong>
                </div>
                <i style={{ '--compare-width': comparisonWidth(value, maxValue) } as CSSProperties} />
              </div>
            )
          })
        ) : (
          <span className="bilan-comparison-empty">Aucun compte selectionne</span>
        )}
      </div>
      <PeriodDetails period={period} title={title} />
    </div>
  )
}

function AccountRow({
  account,
  comparisonEnabled,
  selected,
  color,
  onToggle,
}: {
  account: BilanAccountView
  comparisonEnabled: boolean
  selected: boolean
  color: string
  onToggle: () => void
}) {
  const summary = summarizeBilanPeriods(account.periods)
  const title = accountTitle(account)
  const showVariation = hasAmount(summary.montantVariationEnEuros)
  const showTechnique = hasAmount(summary.soldeTotalTechniqueEnEuros)
  const showEcart = hasAmount(summary.montantEcartNonJustifieEnEuros)

  return (
    <button
      type="button"
      className={comparisonEnabled && selected ? 'bilan-account-row selectable selected' : comparisonEnabled ? 'bilan-account-row selectable' : 'bilan-account-row'}
      aria-pressed={comparisonEnabled ? selected : undefined}
      aria-disabled={!comparisonEnabled}
      onClick={() => {
        if (comparisonEnabled) {
          onToggle()
        }
      }}
      style={{ '--compare-color': color } as CSSProperties}
      data-help="Compte bilan patrimoine : affiche le solde final du compte, sa variation, les flux et les ecarts de controle. En mode comparaison, cliquer selectionne ou retire ce compte du rail temporel."
    >
      <div className="bilan-account-head">
        <div>
          <strong>{title}</strong>
          <span>
            {account.identifiant}
            {account.banque ? ` - ${account.banque}` : ''}
          </span>
        </div>
        <Badge tone={summary.montantVariationEnEuros >= 0 ? 'success' : 'warning'}>{formatCurrency(summary.montantSoldeFinalEnEuros)}</Badge>
      </div>
      {showVariation || showTechnique || showEcart ? (
        <div className="bilan-account-metrics">
          {showVariation ? (
            <span>
              <Activity size={14} />
              Variation {formatCurrency(summary.montantVariationEnEuros)}
            </span>
          ) : null}
          {showTechnique ? (
            <span>
              <Banknote size={14} />
              Tech {formatCurrency(summary.soldeTotalTechniqueEnEuros)}
            </span>
          ) : null}
          {showEcart ? (
            <span>
              <ShieldCheck size={14} />
              Ecart {formatCurrency(summary.montantEcartNonJustifieEnEuros)}
            </span>
          ) : null}
        </div>
      ) : null}
    </button>
  )
}

function GroupCard({ group }: { group: BilanTypeView }) {
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(() => new Set(group.accounts.map((account) => account.identifiant)))
  const summary = summarizeBilanPeriods(group.periods)
  const showPeriods = group.periods.length > 1
  const visiblePeriods = recentItems(group.periods)
  const visibleAccounts = mostSignificantItems(group.accounts, (account) => summarizeBilanPeriods(account.periods).montantSoldeFinalEnEuros)
  const periodCount = periodCountLabel(group.periods)
  const showVariation = hasAmount(summary.montantVariationEnEuros)
  const showEcart = hasAmount(summary.montantEcartNonJustifieEnEuros)
  const accountColors = useMemo(
    () => new Map(group.accounts.map((account, index) => [account.identifiant, comparisonColors[index % comparisonColors.length]])),
    [group.accounts],
  )
  const effectiveSelectedAccountIds = useMemo(() => {
    const validIds = new Set(visibleAccounts.map((account) => account.identifiant))
    const selectedValidIds = Array.from(selectedAccountIds).filter((id) => validIds.has(id))

    return new Set(selectedValidIds.length ? selectedValidIds : visibleAccounts.map((account) => account.identifiant))
  }, [selectedAccountIds, visibleAccounts])
  const selectedAccounts = useMemo(
    () => visibleAccounts.filter((account) => effectiveSelectedAccountIds.has(account.identifiant)),
    [effectiveSelectedAccountIds, visibleAccounts],
  )

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds(() => {
      const next = new Set(effectiveSelectedAccountIds)

      if (next.has(accountId)) {
        if (next.size > 1) {
          next.delete(accountId)
        }
      } else {
        next.add(accountId)
      }

      return next
    })
  }

  return (
    <article className="bilan-group-card">
      <div className="bilan-group-head">
        <div>
          <h3>{group.typeFonctionnement}</h3>
          <span>
            {group.accounts.length} compte(s)
            {periodCount ? ` - ${periodCount}` : ''}
          </span>
        </div>
        <div className="bilan-group-actions">
          <label className="bilan-comparison-toggle">
            <input type="checkbox" checked={comparisonEnabled} onChange={(event) => setComparisonEnabled(event.target.checked)} />
            <span>Comparaison</span>
          </label>
          <Badge tone={summary.montantVariationEnEuros >= 0 ? 'success' : 'warning'}>{formatCurrency(summary.montantSoldeFinalEnEuros)}</Badge>
        </div>
      </div>
      {showVariation || showEcart ? (
        <div className="bilan-group-metrics">
          {showVariation ? (
            <span>
              <Activity size={14} />
              Variation {formatCurrency(summary.montantVariationEnEuros)}
            </span>
          ) : null}
          {showEcart ? (
            <span>
              <ShieldCheck size={14} />
              Ecart {formatCurrency(summary.montantEcartNonJustifieEnEuros)}
            </span>
          ) : null}
        </div>
      ) : null}
      {showPeriods ? (
        <>
          <HorizontalScrollArea className="bilan-period-pills group" aria-label={`Periodes ${group.typeFonctionnement}`}>
            {visiblePeriods.map((period, periodIndex) => (
              comparisonEnabled ? (
                <ComparisonPeriodPill
                  key={`${group.typeFonctionnement}-${period.start}-${period.end}`}
                  period={period}
                  title={group.typeFonctionnement}
                  accounts={selectedAccounts}
                  periodIndex={periodIndex}
                  accountColors={accountColors}
                />
              ) : (
                <PeriodPill key={`${group.typeFonctionnement}-${period.start}-${period.end}`} period={period} title={group.typeFonctionnement} />
              )
            ))}
          </HorizontalScrollArea>
        </>
      ) : null}
      {comparisonEnabled ? <p className="bilan-comparison-note">Cliquez sur les comptes pour les afficher ou les retirer de la comparaison.</p> : null}
      <div className="bilan-account-list">
        {visibleAccounts.map((account) => (
          <AccountRow
            key={account.identifiant}
            account={account}
            comparisonEnabled={comparisonEnabled}
            selected={effectiveSelectedAccountIds.has(account.identifiant)}
            color={accountColors.get(account.identifiant) ?? comparisonColors[0]}
            onToggle={() => toggleAccount(account.identifiant)}
          />
        ))}
      </div>
    </article>
  )
}

export function BilanGroupsPanel({ report }: { report: BilanPatrimoineView }) {
  return (
    <Surface className="data-panel report-panel bilan-groups-panel" data-help="Types et comptes du bilan patrimoine : chaque carte detaille solde final, variation, flux et ecarts par type puis par compte.">
      <div className="bilan-group-grid">
        {report.groups.map((group) => (
          <GroupCard key={group.typeFonctionnement} group={group} />
        ))}
      </div>
    </Surface>
  )
}
