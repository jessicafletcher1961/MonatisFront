import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2 } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge, Button, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, SectionHeader, Surface } from '../components/ui'
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
type DetailTab = 'overview' | 'edit'

function listHint(resource: ReferenceResource, item: ReferenceListItem): string {
  switch (resource) {
    case 'banque':
    case 'titulaire':
      return `${item.identifiantsComptesInternes?.length ?? 0} compte(s)`
    case 'categorie':
      return `${item.nomsSousCategories?.length ?? 0} sous-categorie(s)`
    case 'souscategorie':
      return item.nomCategorie ? `Categorie · ${item.nomCategorie}` : 'Sans categorie'
    default:
      return item.libelle ?? 'Reference'
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

export function ReferencePage({ config }: { config: ReferencePageConfig }) {
  const queryClient = useQueryClient()
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const deferredCategorySearch = useDeferredValue(categorySearch)

  const listQuery = useQuery({
    queryKey: ['references', config.resource],
    queryFn: () => monatisApi.listReferences(config.resource),
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

  const filteredItems = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()
    const list = listQuery.data ?? []

    if (!needle) {
      return list
    }

    return list.filter((item) =>
      [item.nom, item.libelle, item.nomCategorie, ...(item.nomsSousCategories ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [deferredSearch, listQuery.data])

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
      setDetailTab('overview')
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
      setDetailTab('overview')
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
      setDetailTab('overview')
    },
  })

  const activeError = listQuery.error || detailQuery.error || createMutation.error || updateMutation.error || deleteMutation.error

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        subtitle={config.subtitle}
        actions={
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
        }
      />

      {listQuery.isLoading ? <LoadingState label={`Chargement des ${config.plural}...`} /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <Surface className="catalog-panel">
        <FilterBar>
          <label className="search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Rechercher ${config.singular.toLowerCase()}...`} />
          </label>
        </FilterBar>

        {!filteredItems.length ? (
          <EmptyState title={`Aucune ${config.singular.toLowerCase()} visible`} description="Ajuste le filtre ou ajoute une entree." />
        ) : (
          <div className="catalog-grid">
            {filteredItems.map((item) => (
              <button
                key={item.nom}
                type="button"
                className={cx('catalog-card', selectedName === item.nom && 'selected')}
                onClick={() => {
                  setSelectedName(item.nom)
                  setDetailTab('overview')
                }}
              >
                <div className="catalog-card-head">
                  <div>
                    <strong>{item.nom}</strong>
                    <p>{item.libelle ?? 'Sans libelle'}</p>
                  </div>
                  <Badge>{listHint(config.resource, item)}</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
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
                  {form.getValues('nomCategorie') ? (
                    <div className="picker-chip-list">
                      <span className="picker-chip">{form.getValues('nomCategorie')}</span>
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
          <label className="search-field search-field-thin">
            <Search size={14} />
            <input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Chercher une categorie..." />
          </label>

          {!filteredCategories.length ? (
            <EmptyState title="Aucune categorie" description="Aucun resultat pour cette recherche." />
          ) : (
            <div className="picker-option-list">
              {filteredCategories.map((category) => {
                const selected = form.getValues('nomCategorie') === category.nom
                return (
                  <button
                    key={category.nom}
                    type="button"
                    className={cx('picker-option', selected && 'selected')}
                    onClick={() => {
                      form.setValue('nomCategorie', category.nom)
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
        onClose={() => setSelectedName(null)}
        title={selectedName ?? config.title}
        width="regular"
        actions={
          selectedName ? (
            <Button
              tone="danger"
              onClick={() => {
                if (window.confirm(`Supprimer ${selectedName} ?`)) {
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
        {!selectedName ? null : detailQuery.isLoading ? (
          <LoadingState label={`Chargement du detail de ${selectedName}...`} />
        ) : !detailQuery.data ? (
          <EmptyState title="Reference introuvable" description="Impossible d afficher ce detail." />
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
                <SectionHeader title={detailQuery.data.nom} subtitle={detailQuery.data.libelle ?? 'Sans libelle'} />
                {detailSummary(config.resource, detailQuery.data).length ? (
                  <div className="pill-list">
                    {detailSummary(config.resource, detailQuery.data).map((item) => (
                      <Badge key={item}>{item}</Badge>
                    ))}
                  </div>
                ) : (
                  <div className="catalog-meta">Aucune relation supplementaire.</div>
                )}
              </Surface>
            ) : null}

            {detailTab === 'edit' ? (
              <form
                className="form-grid"
                onSubmit={form.handleSubmit(async (values) => {
                  if (config.resource === 'souscategorie' && !values.nomCategorie?.trim()) {
                    form.setError('nomCategorie', { message: 'La categorie est obligatoire.' })
                    return
                  }

                  await updateMutation.mutateAsync(values)
                })}
              >
                <FormField label="Nom" error={form.formState.errors.nom?.message}>
                  <input {...form.register('nom')} />
                </FormField>

                <FormField label="Libelle" error={form.formState.errors.libelle?.message}>
                  <textarea {...form.register('libelle')} rows={4} />
                </FormField>

                {config.resource === 'souscategorie' ? (
                  <FormField label="Categorie de rattachement" error={form.formState.errors.nomCategorie?.message}>
                    <button type="button" className="picker-field" onClick={() => setCategoryPickerOpen(true)}>
                      <div className="picker-field-content">
                        {form.getValues('nomCategorie') ? (
                          <div className="picker-chip-list">
                            <span className="picker-chip">{form.getValues('nomCategorie')}</span>
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
