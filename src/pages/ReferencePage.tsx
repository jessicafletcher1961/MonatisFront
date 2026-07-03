import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { QuickReferenceOverlay, type QuickReferenceDialogState } from '../components/quick-create'
import { DEFAULT_CATALOG_PAGE_SIZE } from '../components/pagination-constants'
import { CatalogPaginationControls } from '../components/pagination-controls'
import { Badge, Button, EmptyState, ErrorState, FormField, LoadingState, OverlayPanel, QuickAddButton, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { apiErrorMessage, type ReferenceDetail, type ReferenceListItem, type ReferenceResource, monatisApi } from '../lib/monatis-api'
import { nullIfBlank } from '../lib/format'

export interface ReferencePageConfig {
  resource: ReferenceResource
  eyebrow: string
  title: string
  subtitle?: string
  singular: string
  plural: string
}

const baseSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.'),
  libelle: z.string().optional(),
  nomCategorie: z.string().optional(),
})

type ReferenceFormValues = z.infer<typeof baseSchema>

function previewTip(label: string, value: string): string {
  return `${label}. ${value.trim() || 'Vide'}`
}

function listHint(resource: ReferenceResource, item: ReferenceListItem): string {
  switch (resource) {
    case 'banque':
    case 'titulaire':
      return `${item.identifiantsComptesInternes?.length ?? 0} compte(s)`
    case 'categorie':
      return `${item.nomsSousCategories?.length ?? 0} sous-categorie(s)`
    case 'souscategorie':
      return item.nomCategorie ? `Categorie · ${item.nomCategorie}` : 'Sans categorie'
    case 'beneficiaire':
      return 'Beneficiaire'
    default:
      return 'Reference'
  }
}

function detailSummary(resource: ReferenceResource, detail?: ReferenceDetail | null): string[] {
  if (!detail) {
    return []
  }

  switch (resource) {
    case 'banque':
    case 'titulaire':
      return detail.comptesInternes?.map((item) => `${item.identifiant}${item.libelle ? ` · ${item.libelle}` : ''}`) ?? []
    case 'categorie':
      return detail.sousCategories?.map((item) => `${item.nom}${item.libelle ? ` · ${item.libelle}` : ''}`) ?? []
    case 'souscategorie':
      return detail.categorie ? [`${detail.categorie.nom}${detail.categorie.libelle ? ` · ${detail.categorie.libelle}` : ''}`] : []
    default:
      return []
  }
}

function navigatorLabel(resource: ReferenceResource): string {
  switch (resource) {
    case 'banque':
      return 'Banque'
    case 'titulaire':
      return 'Titulaire'
    case 'beneficiaire':
      return 'Bénéficiaire'
    case 'categorie':
      return 'Catégorie'
    case 'souscategorie':
      return 'Sous-catégorie'
    default:
      return 'Référence'
  }
}

export function ReferencePage({ config }: { config: ReferencePageConfig }) {
  const queryClient = useQueryClient()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [search, setSearch] = useState('')
  const [pageIndex, setPageIndex] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_CATALOG_PAGE_SIZE)
  const [quickReferenceDialog, setQuickReferenceDialog] = useState<QuickReferenceDialogState | null>(null)
  const deferredSearch = useDeferredValue(search)
  const deferredCategorySearch = useDeferredValue(categorySearch)

  const listQuery = useQuery({
    queryKey: ['references', config.resource, 'page', pageIndex, pageSize, deferredSearch],
    queryFn: () =>
      monatisApi.listReferencesPage(config.resource, {
        numeroPage: pageIndex,
        taillePage: pageSize,
        recherche: deferredSearch.trim() || null,
      }),
    placeholderData: (previousData) => previousData,
  })

  const categoriesQuery = useQuery({
    queryKey: ['references', 'categorie'],
    queryFn: () => monatisApi.listReferences('categorie'),
    enabled: config.resource === 'souscategorie',
  })

  const detailQuery = useQuery({
    queryKey: ['references', config.resource, selectedName],
    queryFn: () => monatisApi.getReference(config.resource, selectedName!),
    enabled: Boolean(selectedName),
  })

  const form = useForm<ReferenceFormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      nom: '',
      libelle: '',
      nomCategorie: '',
    },
  })
  const watchedNom = useWatch({ control: form.control, name: 'nom' }) ?? ''
  const watchedLibelle = useWatch({ control: form.control, name: 'libelle' }) ?? ''
  const watchedNomCategorie = useWatch({ control: form.control, name: 'nomCategorie' }) ?? ''

  useEffect(() => {
    if (!createOpen) {
      return
    }

    form.reset({
      nom: '',
      libelle: '',
      nomCategorie: '',
    })
  }, [createOpen, form])

  useEffect(() => {
    if (!detailQuery.data) {
      return
    }

    form.reset({
      nom: detailQuery.data.nom,
      libelle: detailQuery.data.libelle ?? '',
      nomCategorie: detailQuery.data.categorie?.nom ?? '',
    })
  }, [detailQuery.data, form])

  const visibleItems = useMemo(() => listQuery.data?.references ?? [], [listQuery.data?.references])
  const referenceTotalCount = listQuery.data?.totalReferences ?? 0
  const referenceTotalPages = listQuery.data?.totalPages ?? 0
  const referenceCurrentPage = listQuery.data?.numeroPage ?? pageIndex
  const referenceFirstVisible = listQuery.data?.premierElement ?? 0
  const referenceLastVisible = listQuery.data?.dernierElement ?? 0
  const selectedReferenceIndex = useMemo(
    () => (selectedName ? visibleItems.findIndex((item) => item.nom === selectedName) : -1),
    [selectedName, visibleItems],
  )
  const selectedReferencePosition = selectedReferenceIndex >= 0 ? selectedReferenceIndex + 1 : 0
  const selectedReferenceForDisplay = useMemo(
    () => visibleItems.find((item) => item.nom === selectedName) ?? detailQuery.data ?? null,
    [detailQuery.data, selectedName, visibleItems],
  )
  const selectedReferenceTitle = selectedReferenceForDisplay?.libelle?.trim() || selectedReferenceForDisplay?.nom || selectedName || config.title

  const filteredCategories = useMemo(() => {
    const needle = deferredCategorySearch.trim().toLowerCase()
    const items = categoriesQuery.data ?? []

    if (!needle) {
      return items
    }

    return items.filter((item) => [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
  }, [categoriesQuery.data, deferredCategorySearch])

  const createMutation = useMutation({
    mutationFn: async (values: ReferenceFormValues) => {
      if (config.resource === 'souscategorie') {
        return monatisApi.createSousCategorie({
          nom: values.nom.trim(),
          libelle: nullIfBlank(values.libelle ?? ''),
          nomCategorie: values.nomCategorie?.trim() ?? '',
        })
      }

      return monatisApi.createReference(config.resource as Exclude<ReferenceResource, 'souscategorie'>, {
        nom: values.nom.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['references', config.resource] })
      setCreateOpen(false)
      setSelectedName(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (values: ReferenceFormValues) => {
      if (!selectedName) {
        throw new Error('Aucune reference selectionnee.')
      }

      if (config.resource === 'souscategorie') {
        return monatisApi.updateSousCategorie(selectedName, {
          nom: values.nom.trim(),
          libelle: nullIfBlank(values.libelle ?? ''),
          nomCategorie: values.nomCategorie?.trim() ?? '',
        })
      }

      return monatisApi.updateReference(config.resource as Exclude<ReferenceResource, 'souscategorie'>, selectedName, {
        nom: values.nom.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      })
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['references', config.resource] })
      setSelectedName(response.nom)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedName) {
        return
      }

      return monatisApi.deleteReference(config.resource, selectedName)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['references', config.resource] })
      setSelectedName(null)
    },
  })

  const activeError = listQuery.error || detailQuery.error || createMutation.error || updateMutation.error || deleteMutation.error

  function openQuickReferenceDialog(dialog: QuickReferenceDialogState) {
    setQuickReferenceDialog(dialog)
  }

  function closeQuickReferenceDialog() {
    setQuickReferenceDialog(null)
  }

  return (
    <div className="page-stack">
      {listQuery.isLoading && !listQuery.data ? <LoadingState label={`Chargement des ${config.plural}...`} /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

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
                placeholder={`Rechercher ${config.singular.toLowerCase()}...`}
              />
            </label>
            <div className="catalog-primary-actions">
              <Button
                tone="soft"
                onClick={() => {
                  setCreateOpen(true)
                  setSelectedName(null)
                  setCategorySearch('')
                }}
              >
                <Plus size={16} />
                Nouveau
              </Button>
            </div>

            <CatalogPaginationControls
              ariaLabel={`Pagination des ${config.plural} haut`}
              totalCount={referenceTotalCount}
              firstVisible={referenceFirstVisible}
              lastVisible={referenceLastVisible}
              currentPage={referenceCurrentPage}
              totalPages={referenceTotalPages}
              pageSize={pageSize}
              pageSizeLabel={`Nombre de ${config.plural} affichees`}
              onPageChange={setPageIndex}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPageIndex(1)
              }}
            />
          </div>
        </div>

        {!visibleItems.length ? (
          <EmptyState title={`Aucune ${config.singular.toLowerCase()} visible`} description="Ajuste le filtre ou ajoute une entree." />
        ) : (
          <div className="operation-history-list compact-entity-list">
            {visibleItems.map((item) => (
              <button
                key={item.nom}
                type="button"
                className={cx('operation-history-row compact-entity-row reference-row', selectedName === item.nom && 'selected')}
                onClick={() => {
                  setSelectedName(item.nom)
                }}
              >
                <div className="operation-history-main">
                  <strong title={item.nom}>{item.nom}</strong>
                  <span title={item.libelle ?? 'Sans libelle'}>{item.libelle ?? 'Sans libelle'}</span>
                </div>
                <div className="operation-history-reference" title={listHint(config.resource, item)}>
                  {listHint(config.resource, item)}
                </div>
              </button>
            ))}
          </div>
        )}

        <CatalogPaginationControls
          ariaLabel={`Pagination des ${config.plural} bas`}
          totalCount={referenceTotalCount}
          firstVisible={referenceFirstVisible}
          lastVisible={referenceLastVisible}
          currentPage={referenceCurrentPage}
          totalPages={referenceTotalPages}
          pageSize={pageSize}
          position="bottom"
          pageSizeLabel={`Nombre de ${config.plural} affichees`}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPageIndex(1)
          }}
        />
      </Surface>

      <OverlayPanel open={createOpen} onClose={() => setCreateOpen(false)} title={`Nouvelle ${config.singular}`} width="regular">
        <form
          className="form-grid"
          onSubmit={form.handleSubmit(async (values) => {
            if (config.resource === 'souscategorie' && !values.nomCategorie?.trim()) {
              form.setError('nomCategorie', { message: 'La categorie est obligatoire.' })
              return
            }

            await createMutation.mutateAsync(values)
          })}
        >
          <FormField label="Nom" error={form.formState.errors.nom?.message}>
            <input {...form.register('nom')} placeholder={`Nom ${config.singular.toLowerCase()}`} />
          </FormField>

          <FormField label="Libelle" error={form.formState.errors.libelle?.message}>
            <textarea {...form.register('libelle')} rows={4} placeholder="Facultatif" />
          </FormField>

          {config.resource === 'souscategorie' ? (
            <FormField label="Categorie de rattachement" error={form.formState.errors.nomCategorie?.message}>
              <button type="button" className="picker-field" onClick={() => setCategoryPickerOpen(true)}>
                <div className="picker-field-content">
                  {watchedNomCategorie ? (
                    <div className="picker-chip-list">
                      <span className="picker-chip">{watchedNomCategorie}</span>
                    </div>
                  ) : (
                    <span>Choisir une categorie</span>
                  )}
                </div>
                <Search size={16} />
              </button>
            </FormField>
          ) : null}

          <div className="button-row">
            <Button type="submit" disabled={createMutation.isPending}>
              <Save size={16} />
              Enregistrer
            </Button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel open={categoryPickerOpen} onClose={() => setCategoryPickerOpen(false)} title="Choisir une categorie" width="regular" overlayClassName="overlay-top">
        <div className="page-stack">
          <div className="search-action-row">
            <label className="search-field search-field-thin">
              <Search size={14} />
              <input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Chercher une categorie..." />
            </label>
            <QuickAddButton
              label="Creer une nouvelle categorie"
              onClick={() =>
                openQuickReferenceDialog({
                  resource: 'categorie',
                  title: 'Nouvelle categorie',
                  onCreated: (name) => form.setValue('nomCategorie', name, { shouldDirty: true, shouldTouch: true }),
                })
              }
            />
          </div>

          {!filteredCategories.length ? (
            <EmptyState title="Aucune categorie" description="Aucun resultat pour cette recherche." />
          ) : (
            <div className="picker-option-list">
              {filteredCategories.map((category) => {
                const selected = watchedNomCategorie === category.nom
                return (
                  <button
                    key={category.nom}
                    type="button"
                    className={cx('picker-option', selected && 'selected')}
                    onClick={() => {
                      form.setValue('nomCategorie', category.nom, { shouldDirty: true, shouldTouch: true })
                      setCategoryPickerOpen(false)
                    }}
                  >
                    <div>
                      <strong>{category.nom}</strong>
                      <span>{category.libelle ?? 'Categorie'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel
        open={Boolean(selectedName)}
        onClose={() => {
          setSelectedName(null)
          setCategoryPickerOpen(false)
        }}
        width="regular"
        navigator={{
          label: `${navigatorLabel(config.resource)} ${selectedReferencePosition || 0}/${visibleItems.length}`,
          title: selectedReferenceTitle,
          previousDisabled: selectedReferenceIndex <= 0,
          nextDisabled: selectedReferenceIndex < 0 || selectedReferenceIndex >= visibleItems.length - 1,
          onPrevious: () => {
            const item = visibleItems[selectedReferenceIndex - 1]
            if (item) {
              setSelectedName(item.nom)
              setCategoryPickerOpen(false)
            }
          },
          onNext: () => {
            const item = visibleItems[selectedReferenceIndex + 1]
            if (item) {
              setSelectedName(item.nom)
              setCategoryPickerOpen(false)
            }
          },
        }}
      >
        {!selectedName ? null : detailQuery.isLoading ? (
          <LoadingState label={`Chargement du detail de ${selectedName}...`} />
        ) : !detailQuery.data ? (
          <EmptyState title="Reference introuvable" description="Impossible d afficher ce detail." />
        ) : (
          <form
            className="page-stack"
            onSubmit={form.handleSubmit(async (values) => {
              if (config.resource === 'souscategorie' && !values.nomCategorie?.trim()) {
                form.setError('nomCategorie', { message: 'La categorie est obligatoire.' })
                return
              }

              await updateMutation.mutateAsync(values)
            })}
          >
            <div className="operation-overview-grid edit-mode">
              <div className="operation-overview-card compact preview-tip" data-tooltip={previewTip('Nom', watchedNom || detailQuery.data.nom)}>
                <span>Nom</span>
                <input {...form.register('nom')} />
              </div>

              <div className="operation-overview-card wide preview-tip" data-tooltip={previewTip('Libelle', watchedLibelle || 'Aucun')}>
                <span>Libelle</span>
                <input {...form.register('libelle')} placeholder="Aucun" />
              </div>

              {config.resource === 'souscategorie' ? (
                <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Categorie', watchedNomCategorie || 'Aucune')}>
                  <span>Categorie</span>
                  <div className="field-action-row">
                    <button type="button" className="picker-field picker-field-compact" onClick={() => setCategoryPickerOpen(true)}>
                      <div className="picker-field-content">
                        {watchedNomCategorie ? (
                          <div className="picker-chip-list">
                            <span className="picker-chip">{watchedNomCategorie}</span>
                          </div>
                        ) : (
                          <span>Choisir</span>
                        )}
                      </div>
                      <Search size={16} />
                    </button>
                    <QuickAddButton
                      label="Creer une nouvelle categorie"
                      onClick={() =>
                        openQuickReferenceDialog({
                          resource: 'categorie',
                          title: 'Nouvelle categorie',
                          onCreated: (name) => form.setValue('nomCategorie', name, { shouldDirty: true, shouldTouch: true }),
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}

              {config.resource === 'categorie' ? (
                <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Sous-categories', `${detailSummary(config.resource, detailQuery.data).length} element(s)`)}>
                  <div className="surface-inline-head">
                    <span>Sous-categories</span>
                    <QuickAddButton
                      label="Creer une nouvelle sous-categorie"
                      onClick={() =>
                        openQuickReferenceDialog({
                          resource: 'souscategorie',
                          title: 'Nouvelle sous-categorie',
                          initialCategoryName: detailQuery.data?.nom,
                        })
                      }
                    />
                  </div>
                  {detailSummary(config.resource, detailQuery.data).length ? (
                    <div className="pill-list">
                      {detailSummary(config.resource, detailQuery.data).map((item) => (
                        <Badge key={item}>{item}</Badge>
                      ))}
                    </div>
                  ) : (
                    <small className="muted-inline">Aucune</small>
                  )}
                </div>
              ) : config.resource !== 'souscategorie' && detailSummary(config.resource, detailQuery.data).length ? (
                <div className="operation-overview-card compact wide preview-tip" data-tooltip={previewTip('Liens', `${detailSummary(config.resource, detailQuery.data).length} element(s)`)}>
                  <span>Liens</span>
                  <div className="pill-list">
                    {detailSummary(config.resource, detailQuery.data).map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="detail-footer-actions">
              <div className="detail-footer-primary">
                {form.formState.isDirty ? (
                  <>
                    <Button
                      type="button"
                      tone="ghost"
                      disabled={updateMutation.isPending}
                      onClick={() => {
                        if (!detailQuery.data) {
                          return
                        }

                        form.reset({
                          nom: detailQuery.data.nom,
                          libelle: detailQuery.data.libelle ?? '',
                          nomCategorie: detailQuery.data.categorie?.nom ?? '',
                        })
                      }}
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
                  if (selectedName && window.confirm(`Supprimer ${selectedReferenceTitle} ?`)) {
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

      <QuickReferenceOverlay dialog={quickReferenceDialog} onClose={closeQuickReferenceDialog} />
    </div>
  )
}
