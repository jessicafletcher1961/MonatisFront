import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { Badge, Button, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, QuickAddButton, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { apiErrorMessage, monatisApi } from '../lib/monatis-api'
import { nullIfBlank } from '../lib/format'

const schema = z.object({
  identifiant: z.string().trim().min(1, 'L identifiant est obligatoire.'),
  libelle: z.string().optional(),
})

type ExternalAccountFormValues = z.infer<typeof schema>

function previewTip(label: string, value: string): string {
  return `${label}. ${value.trim() || 'Vide'}`
}

export function ExternalAccountsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
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
  const watchedIdentifiant = useWatch({ control: form.control, name: 'identifiant' }) ?? ''
  const watchedLibelle = useWatch({ control: form.control, name: 'libelle' }) ?? ''

  useEffect(() => {
    if (!createOpen) {
      return
    }

    form.reset({
      identifiant: '',
      libelle: '',
    })
  }, [createOpen, form])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    form.reset({
      identifiant: detailQuery.data.identifiant,
      libelle: detailQuery.data.libelle ?? '',
    })
  }, [detailQuery.data, form])

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'externes'] })
      setCreateOpen(false)
      setSelectedId(null)
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
              setCreateOpen(true)
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

      <Surface className="catalog-panel">
        <FilterBar>
          <div className="search-action-row">
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un compte externe..." />
            </label>
            <QuickAddButton
              label="Creer un nouveau compte externe"
              onClick={() => {
                setCreateOpen(true)
                setSelectedId(null)
              }}
            />
          </div>
        </FilterBar>

        {!filteredAccounts.length ? (
          <EmptyState title="Aucun compte externe" description="Ajoute un compte pour demarrer." />
        ) : (
          <div className="catalog-grid">
            {filteredAccounts.map((account) => (
              <button
                key={account.identifiant}
                type="button"
                className={cx('catalog-card', selectedId === account.identifiant && 'selected')}
                onClick={() => {
                  setSelectedId(account.identifiant)
                }}
              >
                <div className="catalog-card-head">
                  <div>
                    <strong>{account.identifiant}</strong>
                    <p>{account.libelle ?? 'Sans libelle'}</p>
                  </div>
                  <Badge>Externe</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </Surface>

      <OverlayPanel open={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau compte externe" width="regular">
        <form
          className="form-grid"
          onSubmit={form.handleSubmit(async (values) => {
            await createMutation.mutateAsync(values)
          })}
        >
          <FormField label="Identifiant" error={form.formState.errors.identifiant?.message}>
            <input {...form.register('identifiant')} placeholder="AMAZON, VENDEUR, IMPOTS..." />
          </FormField>

          <FormField label="Libelle" error={form.formState.errors.libelle?.message}>
            <textarea {...form.register('libelle')} rows={5} placeholder="Facultatif" />
          </FormField>

          <div className="button-row">
            <Button type="submit" disabled={createMutation.isPending}>
              <Save size={16} />
              Enregistrer
            </Button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={selectedId ?? 'Compte externe'}
        width="regular"
        actions={
          selectedId ? (
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
          ) : null
        }
      >
        {!selectedId ? null : detailQuery.isLoading ? (
          <LoadingState label="Chargement..." />
        ) : !detailQuery.data ? (
          <EmptyState title="Compte introuvable" description="Impossible d afficher ce detail." />
        ) : (
          <form
            className="page-stack"
            onSubmit={form.handleSubmit(async (values) => {
              await updateMutation.mutateAsync(values)
            })}
          >
            <div className="operation-overview-grid edit-mode">
              <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Identifiant', watchedIdentifiant || detailQuery.data.identifiant)}>
                <span>Identifiant</span>
                <input {...form.register('identifiant')} />
              </div>

              <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Libelle', watchedLibelle || 'Sans libelle')}>
                <span>Libelle</span>
                <input {...form.register('libelle')} placeholder="Sans libelle" />
              </div>
            </div>

            {form.formState.isDirty ? (
              <div className="button-row operation-edit-actions">
                <Button
                  type="button"
                  tone="ghost"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    form.reset({
                      identifiant: detailQuery.data.identifiant,
                      libelle: detailQuery.data.libelle ?? '',
                    })
                  }
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save size={16} />
                  Modifier
                </Button>
              </div>
            ) : null}
          </form>
        )}
      </OverlayPanel>
    </div>
  )
}
