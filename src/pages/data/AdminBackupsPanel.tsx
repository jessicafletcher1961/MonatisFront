import { Archive, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, EmptyState, FormField, SectionHeader } from '../../components/ui'
import type { AdminBackup } from '../../lib/monatis-api'
import { normalizeAdminName } from './admin-utils'

interface AdminBackupsPanelProps {
  backups: AdminBackup[]
  creating: boolean
  restoring: boolean
  onCreateBackup: (name: string) => Promise<unknown>
  onRestoreBackup: (name: string) => Promise<unknown>
}

export function AdminBackupsPanel({ backups, creating, restoring, onCreateBackup, onRestoreBackup }: AdminBackupsPanelProps) {
  const [backupName, setBackupName] = useState('')
  const [restoreName, setRestoreName] = useState('')

  return (
    <section className="admin-section admin-section-backup admin-action-card">
      <SectionHeader
        title="Sauvegardes"
        subtitle="Le back lit et ecrit les archives dans le repertoire sauvegardes."
        aside={<Badge tone={backups.length ? 'success' : 'warning'}>{backups.length} archive{backups.length > 1 ? 's' : ''}</Badge>}
      />

      <form
        className="admin-inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          void onCreateBackup(normalizeAdminName(backupName))
        }}
      >
        <FormField label="Nom de sauvegarde" hint="Si le champ reste vide, le back utilise MONATIS.">
          <input value={backupName} onChange={(event) => setBackupName(event.target.value)} placeholder="MONATIS" />
        </FormField>
        <Button type="submit" disabled={creating}>
          <Save size={16} />
          Sauvegarder
        </Button>
      </form>

      <div className="admin-backup-layout">
        <div className="admin-backup-list">
          {!backups.length ? (
            <EmptyState title="Aucune sauvegarde" description="Le repertoire sauvegardes ne contient pas encore d'archive listee par le back." />
          ) : (
            backups.map((backup) => (
              <button
                type="button"
                key={backup.nom}
                className={`admin-backup-row ${restoreName === backup.nom ? 'selected' : ''}`}
                onClick={() => setRestoreName(backup.nom)}
                data-help="Selectionne cette archive pour preparer une restauration."
              >
                <span className="admin-action-icon">
                  <Archive size={17} aria-hidden />
                </span>
                <span>
                  <strong>{backup.nom}</strong>
                  <small>{backup.date || 'Date non renseignee'}</small>
                </span>
                <Badge>Zip</Badge>
              </button>
            ))
          )}
        </div>

        <form
          className="admin-restore-card"
          onSubmit={(event) => {
            event.preventDefault()
            const name = normalizeAdminName(restoreName)
            if (name && window.confirm(`Restaurer la sauvegarde "${name}" ? Cette action remplace l'etat courant de la base.`)) {
              void onRestoreBackup(name)
            }
          }}
        >
          <div className="admin-restore-head">
            <RotateCcw size={18} aria-hidden />
            <div>
              <strong>Restaurer une archive</strong>
              <span>Action critique : restaure le contenu depuis sauvegardes.</span>
            </div>
          </div>
          <FormField label="Fichier zip a restaurer">
            <input value={restoreName} onChange={(event) => setRestoreName(event.target.value)} placeholder="MONATIS-YYYYMMDD.zip" required />
          </FormField>
          <Button type="submit" tone="danger" disabled={restoring || !restoreName.trim()}>
            <RotateCcw size={16} />
            Restaurer
          </Button>
        </form>
      </div>
    </section>
  )
}
