import { DatabaseBackup, FileSpreadsheet, Upload } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, FormField, SectionHeader } from '../../components/ui'
import { normalizeAdminName } from './admin-utils'

interface AdminExchangePanelProps {
  exporting: boolean
  importing: boolean
  importingOperations: boolean
  onExportTable: (table: string, file: string) => Promise<unknown>
  onImportTable: (file: string, table: string) => Promise<unknown>
  onImportOperations: (file: string) => Promise<unknown>
}

export function AdminExchangePanel({
  exporting,
  importing,
  importingOperations,
  onExportTable,
  onImportTable,
  onImportOperations,
}: AdminExchangePanelProps) {
  const [exportTable, setExportTable] = useState('')
  const [exportFile, setExportFile] = useState('')
  const [importFile, setImportFile] = useState('')
  const [importTable, setImportTable] = useState('')
  const [operationCsvFile, setOperationCsvFile] = useState('')

  return (
    <section className="admin-section">
      <SectionHeader title="Echanges fichiers" subtitle="Actions qui lisent ou ecrivent dans le repertoire echanges du back." />
      <div className="admin-exchange-grid">
        <form
          className="admin-action-card"
          onSubmit={(event) => {
            event.preventDefault()
            void onExportTable(normalizeAdminName(exportTable), normalizeAdminName(exportFile))
          }}
        >
          <div className="admin-action-card-head">
            <span className="admin-action-icon">
              <DatabaseBackup size={18} aria-hidden />
            </span>
            <div>
              <strong>Exporter une table</strong>
              <span>Cree un CSV dans echanges si le fichier n'existe pas deja.</span>
            </div>
            <Badge>Controle</Badge>
          </div>
          <div className="form-grid two-columns">
            <FormField label="Table export">
              <input value={exportTable} onChange={(event) => setExportTable(event.target.value)} placeholder="operation" required />
            </FormField>
            <FormField label="Fichier CSV export">
              <input value={exportFile} onChange={(event) => setExportFile(event.target.value)} placeholder="operation-export.csv" required />
            </FormField>
          </div>
          <Button type="submit" disabled={exporting || !exportTable.trim() || !exportFile.trim()}>
            <DatabaseBackup size={16} />
            Exporter
          </Button>
        </form>

        <form
          className="admin-action-card"
          onSubmit={(event) => {
            event.preventDefault()
            const file = normalizeAdminName(importFile)
            const table = normalizeAdminName(importTable)
            if (file && table && window.confirm(`Importer "${file}" dans la table "${table}" ?`)) {
              void onImportTable(file, table)
            }
          }}
        >
          <div className="admin-action-card-head">
            <span className="admin-action-icon warning">
              <Upload size={18} aria-hidden />
            </span>
            <div>
              <strong>Importer une table</strong>
              <span>Lit un CSV existant dans echanges et recharge la table cible.</span>
            </div>
            <Badge tone="warning">Controle</Badge>
          </div>
          <div className="form-grid two-columns">
            <FormField label="Fichier CSV import">
              <input value={importFile} onChange={(event) => setImportFile(event.target.value)} placeholder="operation-export.csv" required />
            </FormField>
            <FormField label="Table import">
              <input value={importTable} onChange={(event) => setImportTable(event.target.value)} placeholder="operation" required />
            </FormField>
          </div>
          <Button type="submit" tone="danger" disabled={importing || !importFile.trim() || !importTable.trim()}>
            <Upload size={16} />
            Importer table
          </Button>
        </form>

        <form
          className="admin-action-card admin-action-card-wide"
          onSubmit={(event) => {
            event.preventDefault()
            void onImportOperations(normalizeAdminName(operationCsvFile))
          }}
        >
          <div className="admin-action-card-head">
            <span className="admin-action-icon">
              <FileSpreadsheet size={18} aria-hidden />
            </span>
            <div>
              <strong>Creer des operations depuis CSV</strong>
              <span>Lit un fichier du repertoire echanges et cree les operations via le parser back.</span>
            </div>
            <Badge tone="warning">Mutation</Badge>
          </div>
          <FormField label="CSV operations">
            <input value={operationCsvFile} onChange={(event) => setOperationCsvFile(event.target.value)} placeholder="operations-a-creer.csv" required />
          </FormField>
          <Button type="submit" disabled={importingOperations || !operationCsvFile.trim()}>
            <FileSpreadsheet size={16} />
            Importer operations
          </Button>
        </form>
      </div>
    </section>
  )
}
