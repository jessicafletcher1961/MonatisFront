import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Save, Search, Trash2 } from 'lucide-react'
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Badge, Button, DataPanel, EmptyState, ErrorState, FilterBar, FormField, LoadingState, PageHeader, Surface } from '../components/ui'
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

function listHint(resource: ReferenceResource, item: ReferenceListItem): string {
  switch (resource) {
    case 'banque':
    case 'titulaire':
      return `${item.identifiantsComptesInternes?.length ?? 0} compte(s) lie(s)`
    case 'categorie':
      return `${item.nomsSousCategories?.length ?? 0} sous-categorie(s)`
    case 'souscategorie':
      return item.nomCategorie ? `Categorie : ${item.nomCategorie}` : 'Categorie non renseignee'
    default:
      return item.libelle ?? 'Reference simple'
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
  const [mode, setMode] = useState<'create' | 'edit'>('create')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

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
    if (mode === 'edit' && detailQuery.data) {
      form.reset({
        nom: detailQuery.data.nom,
        libelle: detailQuery.data.libelle ?? '',
        nomCategorie: detailQuery.data.categorie?.nom ?? '',
      })
    }

    if (mode === 'create') {
      form.reset({
        nom: '',
        libelle: '',
        nomCategorie: '',
      })
    }
  }, [detailQuery.data, form, mode])

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
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['references', config.resource] })
      setSelectedName(response.nom)
      setMode('edit')
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
      startTransition(() => {
        setSelectedName(null)
        setMode('create')
      })
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
              setMode('create')
              setSelectedName(null)
            }}
          >
            <Plus size={16} />
            Nouveau
          </Button>
        }
      />

      {listQuery.isLoading ? <LoadingState label={`Chargement des ${config.plural}...`} /> : null}
      {activeError ? <ErrorState message={apiErrorMessage(activeError)} /> : null}

      <div className="split-layout">
        <DataPanel title={config.plural}>
          <FilterBar>
            <label className="search-field">
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Rechercher ${config.singular.toLowerCase()}...`} />
            </label>
          </FilterBar>

          {!filteredItems.length ? (
            <EmptyState title={`Aucune ${config.singular.toLowerCase()} visible`} description="Ajuste le filtre ou ajoute une entree." />
          ) : (
            <div className="list-stack">
              {filteredItems.map((item) => (
                <button key={item.nom} className={`list-row ${selectedName === item.nom ? 'selected' : ''}`} onClick={() => setSelectedName(item.nom)}>
                  <div>
                    <strong>{item.nom}</strong>
                    <p>{item.libelle ?? 'Sans libelle'}</p>
                  </div>
                  <Badge>{listHint(config.resource, item)}</Badge>
                </button>
              ))}
            </div>
          )}
        </DataPanel>

        <Surface className="editor-panel">
          <div className="editor-panel-header">
            <div>
              <span className="eyebrow">{mode === 'create' ? 'Creation' : 'Edition'}</span>
              <h2>{mode === 'create' ? `Nouvelle ${config.singular}` : detailQuery.data?.nom ?? `Editer ${config.singular}`}</h2>
              <p>Edition simple.</p>
            </div>
            {selectedName && mode === 'edit' ? (
              <div className="button-row">
                <Button tone="ghost" onClick={() => setMode('edit')}>
                  <Pencil size={16} />
                  Modifier
                </Button>
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
              </div>
            ) : null}
          </div>

          <form
            className="form-grid"
            onSubmit={form.handleSubmit(async (values) => {
              if (config.resource === 'souscategorie' && !values.nomCategorie?.trim()) {
                form.setError('nomCategorie', { message: 'La categorie est obligatoire.' })
                return
              }

              if (mode === 'create') {
                await createMutation.mutateAsync(values)
              } else {
                await updateMutation.mutateAsync(values)
              }
            })}
          >
            <FormField label="Nom" error={form.formState.errors.nom?.message}>
              <input {...form.register('nom')} placeholder={`Nom ${config.singular.toLowerCase()}`} />
            </FormField>

            <FormField label="Libelle" hint="Facultatif. Laisser vide pour ne rien stocker." error={form.formState.errors.libelle?.message}>
              <textarea {...form.register('libelle')} rows={4} placeholder="Description lisible pour l’interface" />
            </FormField>

            {config.resource === 'souscategorie' ? (
              <FormField label="Categorie de rattachement" error={form.formState.errors.nomCategorie?.message}>
                <select {...form.register('nomCategorie')}>
                  <option value="">Choisir une categorie</option>
                  {(categoriesQuery.data ?? []).map((category) => (
                    <option key={category.nom} value={category.nom}>
                      {category.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : null}

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
                    setMode('create')
                    setSelectedName(null)
                  }}
                >
                  Revenir a la creation
                </Button>
              ) : null}
            </div>
          </form>

          {selectedName && detailQuery.isLoading ? <LoadingState label={`Chargement du detail de ${selectedName}...`} /> : null}

          {detailQuery.data ? (
            <Surface className="detail-panel">
              <div className="section-header">
                <div>
                  <h2>Contexte metier</h2>
                  <p>Ce bloc affiche les relations deja presentes cote back.</p>
                </div>
              </div>
              <div className="detail-list">
                <div>
                  <span>Nom</span>
                  <strong>{detailQuery.data.nom}</strong>
                </div>
                <div>
                  <span>Libelle</span>
                  <strong>{detailQuery.data.libelle ?? 'Sans libelle'}</strong>
                </div>
                {detailSummary(config.resource, detailQuery.data).length ? (
                  <div>
                    <span>Relations</span>
                    <div className="pill-list">
                      {detailSummary(config.resource, detailQuery.data).map((item) => (
                        <Badge key={item}>{item}</Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Surface>
          ) : null}
        </Surface>
      </div>
    </div>
  )
}
