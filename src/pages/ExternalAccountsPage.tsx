import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { DEFAULT_CATALOG_PAGE_SIZE } from '../components/pagination-constants'
import { CatalogPaginationControls } from '../components/pagination-controls'
import { Button, EmptyState, ErrorState, FormField, LoadingState, OverlayPanel, PageHeader, Surface } from '../components/ui'
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
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_CATALOG_PAGE_SIZE)
  const deferredSearch = useDeferredValue(search)

  const accountsQuery = useQuery({
    queryKey: ['comptes', 'externes', 'page', pageIndex, pageSize, deferredSearch],
    queryFn: () =>
      monatisApi.listExternalAccountsPage({
        numeroPage: pageIndex,
        taillePage: pageSize,
        recherche: deferredSearch.trim() || null,
      }),
    placeholderData: (previousData) => previousData,
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

  const visibleAccounts = useMemo(() => accountsQuery.data?.comptes ?? [], [accountsQuery.data?.comptes])
  const accountTotalCount = accountsQuery.data?.totalComptes ?? 0
  const accountTotalPages = accountsQuery.data?.totalPages ?? 0
  const accountCurrentPage = accountsQuery.data?.numeroPage ?? pageIndex
  const accountFirstVisible = accountsQuery.data?.premierElement ?? 0
  const accountLastVisible = accountsQuery.data?.dernierElement ?? 0
  const selectedAccountIndex = useMemo(
    () => (selectedId ? visibleAccounts.findIndex((account) => account.identifiant === selectedId) : -1),
    [selectedId, visibleAccounts],
  )
  const selectedAccountPosition = selectedAccountIndex >= 0 ? selectedAccountIndex + 1 : 0
  const selectedAccountForDisplay = useMemo(
    () => visibleAccounts.find((account) => account.identifiant === selectedId) ?? detailQuery.data ?? null,
    [detailQuery.data, selectedId, visibleAccounts],
  )
  const selectedAccountTitle = selectedAccountForDisplay?.libelle?.trim() || selectedAccountForDisplay?.identifiant || selectedId || 'Compte externe'

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

      {accountsQuery.isLoading && !accountsQuery.data ? <LoadingState label="Chargement des comptes externes..." /> : null}
      {hasError ? <ErrorState message={apiErrorMessage(hasError)} /> : null}

      <Surface className="catalog-panel">
        <div className="operation-filter-stack">
          <div className="operation-search-pagination-row">
            <label className="search-field operation-history-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPageIndex(1)
                }}
                placeholder="Rechercher un compte externe..."
              />
            </label>

            <CatalogPaginationControls
              ariaLabel="Pagination des comptes externes haut"
              totalCount={accountTotalCount}
              firstVisible={accountFirstVisible}
              lastVisible={accountLastVisible}
              currentPage={accountCurrentPage}
              totalPages={accountTotalPages}
              pageSize={pageSize}
              pageSizeLabel="Nombre de comptes externes affiches"
              onPageChange={setPageIndex}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPageIndex(1)
              }}
            />
          </div>
        </div>

        {!visibleAccounts.length ? (
          <EmptyState title="Aucun compte externe" description="Ajoute un compte pour demarrer." />
        ) : (
          <div className="operation-history-list compact-entity-list">
            {visibleAccounts.map((account) => (
              <button
                key={account.identifiant}
                type="button"
                className={cx('operation-history-row compact-entity-row external-account-row', selectedId === account.identifiant && 'selected')}
                onClick={() => {
                  setSelectedId(account.identifiant)
                }}
              >
                <div className="operation-history-main">
                  <strong title={account.identifiant}>{account.identifiant}</strong>
                  <span title={account.libelle ?? 'Sans libelle'}>{account.libelle ?? 'Sans libelle'}</span>
                </div>
                <div className="operation-history-reference">Compte externe</div>
              </button>
            ))}
          </div>
        )}

        <CatalogPaginationControls
          ariaLabel="Pagination des comptes externes bas"
          totalCount={accountTotalCount}
          firstVisible={accountFirstVisible}
          lastVisible={accountLastVisible}
          currentPage={accountCurrentPage}
          totalPages={accountTotalPages}
          pageSize={pageSize}
          position="bottom"
          pageSizeLabel="Nombre de comptes externes affiches"
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />
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
        width="regular"
        navigator={{
          label: `Compte externe ${selectedAccountPosition || 0}/${visibleAccounts.length}`,
          title: selectedAccountTitle,
          previousDisabled: selectedAccountIndex <= 0,
          nextDisabled: selectedAccountIndex < 0 || selectedAccountIndex >= visibleAccounts.length - 1,
          onPrevious: () => {
            const account = visibleAccounts[selectedAccountIndex - 1]
            if (account) {
              setSelectedId(account.identifiant)
            }
          },
          onNext: () => {
            const account = visibleAccounts[selectedAccountIndex + 1]
            if (account) {
              setSelectedId(account.identifiant)
            }
          },
        }}
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

            <div className="detail-footer-actions">
              <div className="detail-footer-primary">
                {form.formState.isDirty ? (
                  <>
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
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                tone="danger"
                className="detail-delete-button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (selectedId && window.confirm(`Supprimer ${selectedAccountTitle} ?`)) {
                    void deleteMutation.mutateAsync()
                  }
                }}
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
            </div>
          </form>
        )}
      </OverlayPanel>
    </div>
  )
}
