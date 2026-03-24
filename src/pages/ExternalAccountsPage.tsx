import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge, Button, DataPanel, EmptyState, ErrorState, FilterBar, FormField, LoadingState, PageHeader, Surface } from '../components/ui'
import { apiErrorMessage, monatisApi } from '../lib/monatis-api'
import { nullIfBlank } from '../lib/format'

const schema = z.object({
  identifiant: z.string().trim().min(1, 'L’identifiant est obligatoire.'),
  libelle: z.string().optional(),
})

type ExternalAccountFormValues = z.infer<typeof schema>

export function ExternalAccountsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const accountsQuery = useQuery({
    queryKey: ['comptes', 'externes'],
    queryFn: () => monatisApi.listExternalAccounts(),
  })

  const detailQuery = useQuery({
    queryKey: ['comptes', 'externes', selectedId],
    queryFn: () => monatisApi.getExternalAccount(selectedId!),
    enabled: Boolean(selectedId),
  })

  const form = useForm<ExternalAccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      identifiant: '',
      libelle: '',
    },
  })

  useEffect(() => {
    if (mode === 'edit' && detailQuery.data) {
      form.reset({
        identifiant: detailQuery.data.identifiant,
        libelle: detailQuery.data.libelle ?? '',
      })
    }

    if (mode === 'create') {
      form.reset({
        identifiant: '',
        libelle: '',
      })
    }
  }, [detailQuery.data, form, mode])

  const filteredAccounts = useMemo(() => {
    const list = accountsQuery.data ?? []
    const needle = deferredSearch.trim().toLowerCase()
    if (!needle) {
      return list
    }

    return list.filter((account) => [account.identifiant, account.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
  }, [accountsQuery.data, deferredSearch])

  const createMutation = useMutation({
    mutationFn: (values: ExternalAccountFormValues) =>
      monatisApi.createExternalAccount({
        identifiant: values.identifiant.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'externes'] })
      setSelectedId(response.identifiant)
      setMode('edit')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: ExternalAccountFormValues) =>
      monatisApi.updateExternalAccount(selectedId!, {
        identifiant: values.identifiant.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'externes'] })
      setSelectedId(response.identifiant)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteExternalAccount(selectedId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'externes'] })
      setSelectedId(null)
      setMode('create')
    },
  })

  const hasError = accountsQuery.error || detailQuery.error || createMutation.error || updateMutation.error || deleteMutation.error

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Comptes"
        title="Externes"
        actions={
          <Button
            tone="soft"
            onClick={() => {
              setMode('create')
              setSelectedId(null)
            }}
          >
            <Plus size={16} />
            Nouveau
          </Button>
        }
      />

      {accountsQuery.isLoading ? <LoadingState label="Chargement des comptes externes..." /> : null}
      {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

      <div className="split-layout">
        <DataPanel title="Externes">
          <FilterBar>
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un compte externe..." />
            </label>
          </FilterBar>

          {!filteredAccounts.length ? (
            <EmptyState title="Aucun compte externe" description="Ajoute un compte pour demarrer." />
          ) : (
            <div className="list-stack">
              {filteredAccounts.map((account) => (
                <button key={account.identifiant} className={`list-row ${selectedId === account.identifiant ? 'selected' : ''}`} onClick={() => setSelectedId(account.identifiant)}>
                  <div>
                    <strong>{account.identifiant}</strong>
                    <p>{account.libelle ?? 'Sans libelle'}</p>
                  </div>
                  <Badge>Externe</Badge>
                </button>
              ))}
            </div>
          )}
        </DataPanel>

        <Surface className="editor-panel">
          <div className="editor-panel-header">
            <div>
              <span className="eyebrow">{mode === 'create' ? 'Creation' : 'Edition'}</span>
              <h2>{mode === 'create' ? 'Nouveau compte externe' : selectedId}</h2>
              <p>Forme simple.</p>
            </div>
            {selectedId && mode === 'edit' ? (
              <div className="button-row">
                <Button tone="ghost" onClick={() => setMode('edit')}>
                  <Pencil size={16} />
                  Modifier
                </Button>
                <Button
                  tone="danger"
                  onClick={() => {
                    if (window.confirm(`Supprimer ${selectedId} ?`)) {
                      void deleteMutation.mutateAsync()
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Supprimer
                </Button>
              </div>
            ) : null}
          </div>

          <form
            className="form-grid"
            onSubmit={form.handleSubmit(async (values) => {
              if (mode === 'create') {
                await createMutation.mutateAsync(values)
              } else {
                await updateMutation.mutateAsync(values)
              }
            })}
          >
            <FormField label="Identifiant" error={form.formState.errors.identifiant?.message}>
              <input {...form.register('identifiant')} placeholder="MEDECINS, AMAZON, VENDEUR-IMMO..." />
            </FormField>

            <FormField label="Libelle" hint="Facultatif" error={form.formState.errors.libelle?.message}>
              <textarea {...form.register('libelle')} rows={5} placeholder="Description detaillee du compte externe" />
            </FormField>

            <div className="button-row">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                <Save size={16} />
                {mode === 'create' ? 'Enregistrer' : 'Mettre a jour'}
              </Button>
              {mode === 'edit' ? (
                <Button
                  type="button"
                  tone="ghost"
                  onClick={() => {
                    setSelectedId(null)
                    setMode('create')
                  }}
                >
                  Nouveau
                </Button>
              ) : null}
            </div>
          </form>

          {detailQuery.data ? (
            <Surface className="detail-panel">
              <div className="detail-list">
                <div>
                  <span>Identifiant</span>
                  <strong>{detailQuery.data.identifiant}</strong>
                </div>
                <div>
                  <span>Libelle</span>
                  <strong>{detailQuery.data.libelle ?? 'Sans libelle'}</strong>
                </div>
              </div>
            </Surface>
          ) : null}
        </Surface>
      </div>
    </div>
  )
}
