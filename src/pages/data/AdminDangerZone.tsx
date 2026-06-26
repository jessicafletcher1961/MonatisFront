import { Play, ShieldAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, FormField, SectionHeader } from '../../components/ui'
import { normalizeAdminName } from './admin-utils'

interface AdminDangerZoneProps {
  executingScript: boolean
  clearing: boolean
  onExecuteScript: (file: string) => Promise<unknown>
  onClearDatabase: () => Promise<unknown>
}

export function AdminDangerZone({ executingScript, clearing, onExecuteScript, onClearDatabase }: AdminDangerZoneProps) {
  const [scriptName, setScriptName] = useState('')
  const [clearConfirmation, setClearConfirmation] = useState('')
  const clearEnabled = clearConfirmation.trim().toUpperCase() === 'VIDANGER'
  const updateClearConfirmation = (value: string) => {
    setClearConfirmation(value)
  }

  return (
    <section className="admin-section admin-danger-zone">
      <SectionHeader
        title="Zone critique"
        subtitle="Actions capables de modifier massivement la base. Une sauvegarde recente est recommandee avant execution."
        aside={<Badge tone="warning">Critique</Badge>}
      />
      <div className="admin-danger-grid">
        <form
          className="admin-action-card admin-action-card-danger"
          onSubmit={(event) => {
            event.preventDefault()
            const script = normalizeAdminName(scriptName)
            if (script && window.confirm(`Executer le script "${script}" depuis le repertoire echanges ?`)) {
              void onExecuteScript(script)
            }
          }}
        >
          <div className="admin-action-card-head">
            <span className="admin-action-icon warning">
              <Play size={18} aria-hidden />
            </span>
            <div>
              <strong>Executer un script SQL</strong>
              <span>Le back desactive les contraintes, execute le fichier, puis reactive les contraintes.</span>
            </div>
            <Badge tone="warning">Controle</Badge>
          </div>
          <FormField label="Script SQL">
            <input value={scriptName} onChange={(event) => setScriptName(event.target.value)} placeholder="script.sql" required />
          </FormField>
          <Button type="submit" tone="soft" disabled={executingScript || !scriptName.trim()}>
            <Play size={16} />
            Executer
          </Button>
        </form>

        <form
          className="admin-action-card admin-action-card-danger"
          onSubmit={(event) => {
            event.preventDefault()
            if (clearEnabled && window.confirm('Vidanger toute la base MONATIS ? Cette action supprime les donnees rechargeables par restauration.')) {
              void onClearDatabase()
            }
          }}
        >
          <div className="admin-action-card-head">
            <span className="admin-action-icon danger">
              <ShieldAlert size={18} aria-hidden />
            </span>
            <div>
              <strong>Vidanger la base</strong>
              <span>Action destructive globale. Elle doit rester exceptionnelle.</span>
            </div>
            <Badge tone="warning">Danger</Badge>
          </div>
          <FormField label="Confirmation" hint='Tapez exactement "VIDANGER" pour activer le bouton.'>
            <input
              value={clearConfirmation}
              onChange={(event) => updateClearConfirmation(event.target.value)}
              onInput={(event) => updateClearConfirmation(event.currentTarget.value)}
              placeholder="VIDANGER"
            />
          </FormField>
          <Button type="submit" tone="danger" disabled={clearing || !clearEnabled}>
            <Trash2 size={16} />
            Vidanger la base
          </Button>
        </form>
      </div>
    </section>
  )
}
