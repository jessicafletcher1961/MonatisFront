import { AlertTriangle, Archive, Download, FolderSync } from 'lucide-react'

import { Badge } from '../../components/ui'
import type { AdminBackup } from '../../lib/monatis-api'
import { countCsvExports, latestBackup } from './admin-utils'

interface AdminDashboardProps {
  backups: AdminBackup[]
  lastAction: string | null
}

export function AdminDashboard({ backups, lastAction }: AdminDashboardProps) {
  const latest = latestBackup(backups)

  return (
    <section className="admin-dashboard" data-help="Synthese des outils techniques : exports CSV, sauvegardes, echanges de fichiers et actions critiques.">
      <article className="admin-summary-item admin-summary-item-main">
        <Download size={22} aria-hidden />
        <div>
          <span>Exports CSV directs</span>
          <strong>{countCsvExports()}</strong>
          <small>Telechargements sans modification de donnees</small>
        </div>
      </article>
      <article className="admin-summary-item">
        <Archive size={22} aria-hidden />
        <div>
          <span>Sauvegardes detectees</span>
          <strong>{backups.length}</strong>
          <small>{latest ? `Derniere : ${latest.nom}` : 'Repertoire sauvegardes vide'}</small>
        </div>
      </article>
      <article className="admin-summary-item">
        <FolderSync size={22} aria-hidden />
        <div>
          <span>Repertoire echanges</span>
          <strong>CSV / SQL</strong>
          <small>Imports, exports table et scripts back</small>
        </div>
      </article>
      <article className="admin-summary-item admin-summary-item-danger">
        <AlertTriangle size={22} aria-hidden />
        <div>
          <span>Actions critiques</span>
          <strong>3</strong>
          <small>Restauration, script, vidange</small>
        </div>
      </article>
      <div className="admin-status-strip">
        <AlertTriangle size={18} aria-hidden />
        <div>
          <strong>{lastAction ?? 'Aucune action lancee dans cette session'}</strong>
          <span>Les commandes admin sont executees par le back et peuvent modifier l'etat global de la base.</span>
        </div>
        {lastAction ? <Badge tone="success">Derniere action</Badge> : <Badge tone="warning">Prudence</Badge>}
      </div>
    </section>
  )
}
