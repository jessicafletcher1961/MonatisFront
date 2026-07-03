import { UsersRound } from 'lucide-react'

import { Badge, Surface } from '../../components/ui'
import { cx } from '../../lib/cx'
import { formatCurrency } from '../../lib/format'
import type { ResumeCompteView } from '../../lib/reporting'
import { mostSignificantItems } from './report-detail-utils'
import type { ResumeGroupView } from './resume-report-utils'

function ResumeAccountRow({ account }: { account: ResumeCompteView }) {
  const title = account.libelle || account.identifiant
  const holders = account.titulaires.length ? account.titulaires.join(', ') : 'Sans titulaire'

  return (
    <div className="resume-account-row" data-help="Compte du resume : affiche le solde du compte interne a la date choisie, avec sa banque et ses titulaires.">
      <div className="resume-account-main">
        <strong>{title}</strong>
        <span>
          {account.identifiant}
          {account.banque ? ` - ${account.banque}` : ''}
        </span>
      </div>
      <div className="resume-account-meta">
        <span>
          <UsersRound size={14} />
          {holders}
        </span>
      </div>
      <strong className={cx('resume-account-balance', account.montantSoldeEnEuros < 0 && 'negative')}>{formatCurrency(account.montantSoldeEnEuros)}</strong>
    </div>
  )
}

export function ResumeGroupsPanel({ groups }: { groups: ResumeGroupView[] }) {
  return (
    <Surface className="data-panel report-panel resume-groups-panel" data-help="Groupes du resume : les comptes sont regroupes par type de fonctionnement pour comparer rapidement les soldes.">
      <div className="resume-type-grid">
        {groups.map((group) => {
          const visibleAccounts = mostSignificantItems(group.accounts, (account) => account.montantSoldeEnEuros)

          return (
            <article key={group.type} className="resume-type-card">
              <div className="resume-type-head">
                <div>
                  <h3>{group.type}</h3>
                  <span>{group.accounts.length} compte(s)</span>
                </div>
                <Badge tone={group.total >= 0 ? 'success' : 'warning'}>{formatCurrency(group.total)}</Badge>
              </div>
              <div className="resume-account-list">
                {visibleAccounts.map((account) => (
                  <ResumeAccountRow key={account.identifiant} account={account} />
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </Surface>
  )
}
