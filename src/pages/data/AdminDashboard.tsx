import { AlertTriangle, Archive, Download, FolderSync } from 'lucide-react'

import { InsightDonutChart, InsightHero, InsightMetric, InsightMetricGrid, InsightPanel } from '../../components/insight'
import type { AdminBackup } from '../../lib/monatis-api'
import { countCsvExports, latestBackup } from './admin-utils'

interface AdminDashboardProps {
  backups: AdminBackup[]
  lastAction: string | null
}

export function AdminDashboard({ backups, lastAction }: AdminDashboardProps) {
  const latest = latestBackup(backups)

  return (
    <InsightPanel className="admin-dashboard" help="Synthese des outils techniques : exports CSV, sauvegardes, echanges de fichiers et actions critiques.">
      <InsightHero
        eyebrow="CSV et admin"
        value={countCsvExports()}
        subtitle="Exports CSV directs disponibles"
        icon={Download}
        tone="warning"
        tags={[
          { label: `${backups.length} sauvegarde(s)` },
          { label: lastAction ? 'Derniere action disponible' : 'Prudence', tone: lastAction ? 'success' : 'warning' },
        ]}
      />

      <InsightMetricGrid>
        <InsightMetric icon={Download} label="Exports CSV directs" value={countCsvExports()} hint="Telechargements sans modification de donnees" />
        <InsightMetric icon={Archive} label="Sauvegardes detectees" value={backups.length} hint={latest ? `Derniere : ${latest.nom}` : 'Repertoire sauvegardes vide'} />
        <InsightMetric icon={FolderSync} label="Repertoire echanges" value="CSV / SQL" hint="Imports, exports table et scripts back" />
        <InsightMetric icon={AlertTriangle} label="Actions critiques" value={3} hint="Restauration, script, vidange" tone="warning" />
      </InsightMetricGrid>

      <InsightDonutChart
        chartId="data.admin.risk"
        eyebrow="Risque"
        title="Actions disponibles"
        subtitle="Lecture sure, sauvegardes et commandes sensibles"
        help="Entonnoir administration : separe les actions de lecture, les sauvegardes et les commandes sensibles."
        variants={['funnel', 'donut', 'bars']}
        centerValue={countCsvExports() + backups.length + 3}
        centerLabel="actions"
        items={[
          { label: 'Exports CSV', value: countCsvExports(), displayValue: countCsvExports(), tone: 'success' },
          { label: 'Sauvegardes', value: backups.length, displayValue: backups.length, tone: 'accent' },
          { label: 'Actions critiques', value: 3, displayValue: 3, tone: 'warning' },
        ]}
      />

      <div className="insight-footer-note">
        <AlertTriangle size={15} />
        <span>{lastAction ?? 'Aucune action lancee dans cette session'} - les commandes admin sont executees par le back et peuvent modifier l'etat global de la base.</span>
      </div>
    </InsightPanel>
  )
}
