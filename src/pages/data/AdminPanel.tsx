import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { ErrorState, LoadingState } from '../../components/ui'
import { apiErrorMessage, monatisApi } from '../../lib/monatis-api'
import { AdminBackupsPanel } from './AdminBackupsPanel'
import { AdminCsvExports } from './AdminCsvExports'
import { AdminDangerZone } from './AdminDangerZone'
import { AdminDashboard } from './AdminDashboard'
import { AdminExchangePanel } from './AdminExchangePanel'

export function AdminPanel() {
  const queryClient = useQueryClient()
  const [lastAction, setLastAction] = useState<string | null>(null)

  const backupsQuery = useQuery({
    queryKey: ['admin', 'sauvegardes'],
    queryFn: () => monatisApi.listAdminBackups(),
  })

  const backupMutation = useMutation({
    mutationFn: (name: string) => monatisApi.createAdminBackup(name),
    onSuccess: async () => {
      setLastAction('Sauvegarde lancee.')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'sauvegardes'] })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (name: string) => monatisApi.restoreAdminBackup(name),
    onSuccess: () => setLastAction('Restauration lancee.'),
  })

  const exportMutation = useMutation({
    mutationFn: ({ table, file }: { table: string; file: string }) => monatisApi.exportAdminTable(table, file),
    onSuccess: () => setLastAction('Export admin lance.'),
  })

  const importMutation = useMutation({
    mutationFn: ({ file, table }: { file: string; table: string }) => monatisApi.importAdminTable(file, table),
    onSuccess: () => setLastAction('Import admin lance.'),
  })

  const operationCsvMutation = useMutation({
    mutationFn: (file: string) => monatisApi.createOperationsFromCsv(file),
    onSuccess: (operations) => setLastAction(`${operations.length} operation${operations.length > 1 ? 's' : ''} creee${operations.length > 1 ? 's' : ''} depuis CSV.`),
  })

  const scriptMutation = useMutation({
    mutationFn: (script: string) => monatisApi.executeAdminScript(script),
    onSuccess: () => setLastAction('Script execute.'),
  })

  const clearMutation = useMutation({
    mutationFn: () => monatisApi.clearDatabase(),
    onSuccess: () => setLastAction('Vidange lancee.'),
  })

  const activeError =
    backupsQuery.error ||
    backupMutation.error ||
    restoreMutation.error ||
    exportMutation.error ||
    importMutation.error ||
    operationCsvMutation.error ||
    scriptMutation.error ||
    clearMutation.error

  const backups = backupsQuery.data ?? []

  return (
    <div className="page-stack">
      {backupsQuery.isLoading ? <LoadingState label="Chargement des outils admin..." /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <AdminDashboard backups={backups} lastAction={lastAction} />

      <AdminCsvExports />

      <AdminBackupsPanel
        backups={backups}
        creating={backupMutation.isPending}
        restoring={restoreMutation.isPending}
        onCreateBackup={(name) => backupMutation.mutateAsync(name)}
        onRestoreBackup={(name) => restoreMutation.mutateAsync(name)}
      />

      <AdminExchangePanel
        exporting={exportMutation.isPending}
        importing={importMutation.isPending}
        importingOperations={operationCsvMutation.isPending}
        onExportTable={(table, file) => exportMutation.mutateAsync({ table, file })}
        onImportTable={(file, table) => importMutation.mutateAsync({ file, table })}
        onImportOperations={(file) => operationCsvMutation.mutateAsync(file)}
      />

      <AdminDangerZone
        executingScript={scriptMutation.isPending}
        clearing={clearMutation.isPending}
        onExecuteScript={(script) => scriptMutation.mutateAsync(script)}
        onClearDatabase={() => clearMutation.mutateAsync()}
      />
    </div>
  )
}
