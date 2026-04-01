import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge, Button, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { apiErrorMessage, monatisApi } from '../lib/monatis-api'
import { nullIfBlank } from '../lib/format'

const schema = z.object({
  identifiant: z.string().trim().min(1, 'L identifiant est obligatoire.'),
  libelle: z.string().optional(),
})

type ExternalAccountFormValues = z.infer<typeof schema>
type DetailTab = 'overview' | 'edit'

export function ExternalAccountsPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
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
      setDetailTab('overview')
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
      setDetailTab('overview')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => monatisApi.deleteExternalAccount(selectedId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['comptes', 'externes'] })
      setSelectedId(null)
      setDetailTab('overview')
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
          <label className="search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un compte externe..." />
          </label>
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
                  setDetailTab('overview')
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
          <>
            <div className="modal-tabs">
              <button type="button" className={cx('modal-tab-button', detailTab === 'overview' && 'active')} onClick={() => setDetailTab('overview')}>
                Apercu
              </button>
              <button type="button" className={cx('modal-tab-button', detailTab === 'edit' && 'active')} onClick={() => setDetailTab('edit')}>
                Modifier
              </button>
            </div>

            {detailTab === 'overview' ? (
              <Surface className="inline-panel">
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

            {detailTab === 'edit' ? (
              <form
                className="form-grid"
                onSubmit={form.handleSubmit(async (values) => {
                  await updateMutation.mutateAsync(values)
                })}
              >
                <FormField label="Identifiant" error={form.formState.errors.identifiant?.message}>
                  <input {...form.register('identifiant')} />
                </FormField>

                <FormField label="Libelle" error={form.formState.errors.libelle?.message}>
                  <textarea {...form.register('libelle')} rows={5} />
                </FormField>

                <div className="button-row">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save size={16} />
                    Sauvegarder
                  </Button>
                </div>
              </form>
            ) : null}
          </>
        )}
      </OverlayPanel>
    </div>
  )
}
