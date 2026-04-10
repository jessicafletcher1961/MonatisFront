import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { apiErrorMessage, type ReferenceResource, monatisApi } from '../lib/monatis-api'
import { nullIfBlank, parseMoneyToCents, todayIso } from '../lib/format'
import { cx } from '../lib/cx'
import { Button, EmptyState, FormField, OverlayPanel, QuickAddButton } from './ui'

const quickReferenceSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.'),
  libelle: z.string().optional(),
  nomCategorie: z.string().optional(),
})

const quickCategorySchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire.'),
  libelle: z.string().optional(),
})

const quickInternalAccountSchema = z.object({
  identifiant: z.string().trim().min(1, 'L identifiant est obligatoire.'),
  libelle: z.string().optional(),
  codeTypeFonctionnement: z.string().trim().min(1, 'Le type est obligatoire.'),
  nomBanque: z.string().optional(),
  dateSoldeInitial: z.string().optional(),
  montantSoldeInitial: z.string().optional(),
  nomsTitulaires: z.array(z.string()),
})

const quickExternalAccountSchema = z.object({
  identifiant: z.string().trim().min(1, 'L identifiant est obligatoire.'),
  libelle: z.string().optional(),
})

type QuickReferenceValues = z.infer<typeof quickReferenceSchema>
type QuickCategoryValues = z.infer<typeof quickCategorySchema>
type QuickInternalAccountValues = z.infer<typeof quickInternalAccountSchema>
type QuickExternalAccountValues = z.infer<typeof quickExternalAccountSchema>

export interface QuickReferenceDialogState {
  resource: ReferenceResource
  title: string
  overlayClassName?: string
  initialCategoryName?: string
  onCreated?: (name: string) => void
}

export interface QuickAccountDialogState {
  title: string
  overlayClassName?: string
  initialKind?: 'interne' | 'externe'
  allowedKinds?: Array<'interne' | 'externe'>
  onCreated?: (identifiant: string) => void
}

const resourceLabels: Record<ReferenceResource, string> = {
  banque: 'banque',
  titulaire: 'titulaire',
  beneficiaire: 'beneficiaire',
  categorie: 'categorie',
  souscategorie: 'sous-categorie',
}

function pickerHint(resource: ReferenceResource): string {
  if (resource === 'categorie') {
    return 'Choisir une categorie'
  }

  return 'Choisir'
}

function appendUniqueName(values: string[], nextValue: string): string[] {
  return values.includes(nextValue) ? values : [...values, nextValue]
}

export function QuickReferenceOverlay({
  dialog,
  onClose,
}: {
  dialog: QuickReferenceDialogState | null
  onClose: () => void
}) {
  if (!dialog) {
    return null
  }

  return <QuickReferenceOverlayContent key={`${dialog.resource}-${dialog.title}-${dialog.initialCategoryName ?? ''}`} dialog={dialog} onClose={onClose} />
}

function QuickReferenceOverlayContent({
  dialog,
  onClose,
}: {
  dialog: QuickReferenceDialogState
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false)

  const form = useForm<QuickReferenceValues>({
    resolver: zodResolver(quickReferenceSchema),
    defaultValues: {
      nom: '',
      libelle: '',
      nomCategorie: dialog.initialCategoryName ?? '',
    },
  })

  const categoryForm = useForm<QuickCategoryValues>({
    resolver: zodResolver(quickCategorySchema),
    defaultValues: {
      nom: '',
      libelle: '',
    },
  })

  const currentResource = dialog.resource
  const currentCategoryName = useWatch({ control: form.control, name: 'nomCategorie' }) ?? ''

  const categoriesQuery = useQuery({
    queryKey: ['references', 'categorie'],
    queryFn: () => monatisApi.listReferences('categorie'),
    enabled: currentResource === 'souscategorie' || categoryCreateOpen,
  })

  const filteredCategories = useMemo(() => {
    const needle = categorySearch.trim().toLowerCase()
    const items = categoriesQuery.data ?? []

    if (!needle) {
      return items
    }

    return items.filter((item) => [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))
  }, [categoriesQuery.data, categorySearch])

  const createMutation = useMutation({
    mutationFn: async (values: QuickReferenceValues) => {
      if (currentResource === 'souscategorie') {
        return monatisApi.createSousCategorie({
          nom: values.nom.trim(),
          libelle: nullIfBlank(values.libelle ?? ''),
          nomCategorie: values.nomCategorie?.trim() ?? '',
        })
      }

      return monatisApi.createReference(currentResource as Exclude<ReferenceResource, 'souscategorie'>, {
        nom: values.nom.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      })
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['references', currentResource] })
      if (currentResource === 'categorie' || currentResource === 'souscategorie') {
        await queryClient.invalidateQueries({ queryKey: ['references', 'categorie'] })
      }

      dialog?.onCreated?.(response.nom)
      onClose()
    },
  })

  const createCategoryMutation = useMutation({
    mutationFn: (values: QuickCategoryValues) =>
      monatisApi.createReference('categorie', {
        nom: values.nom.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['references', 'categorie'] })
      form.setValue('nomCategorie', response.nom, { shouldDirty: true, shouldTouch: true })
      setCategoryCreateOpen(false)
      setCategoryPickerOpen(false)
    },
  })

  const resourceLabel = resourceLabels[currentResource]
  const createError = createMutation.error ? apiErrorMessage(createMutation.error) : ''
  const categoryCreateError = createCategoryMutation.error ? apiErrorMessage(createCategoryMutation.error) : ''

  return (
    <>
      <OverlayPanel open={Boolean(dialog)} onClose={onClose} title={dialog.title} width="regular" overlayClassName={dialog.overlayClassName ?? 'overlay-super-top'}>
        <form
          className="form-grid"
          onSubmit={form.handleSubmit(async (values) => {
            if (currentResource === 'souscategorie' && !values.nomCategorie?.trim()) {
              form.setError('nomCategorie', { message: 'La categorie est obligatoire.' })
              return
            }

            await createMutation.mutateAsync(values)
          })}
        >
          <FormField label="Nom" error={form.formState.errors.nom?.message}>
            <input {...form.register('nom')} placeholder={`Nom ${resourceLabel}`} />
          </FormField>

          <FormField label="Libelle" error={form.formState.errors.libelle?.message}>
            <textarea {...form.register('libelle')} rows={4} placeholder="Facultatif" />
          </FormField>

          {currentResource === 'souscategorie' ? (
            <FormField label="Categorie" error={form.formState.errors.nomCategorie?.message}>
              <button type="button" className="picker-field" onClick={() => setCategoryPickerOpen(true)}>
                <div className="picker-field-content">
                  {currentCategoryName ? (
                    <div className="picker-chip-list">
                      <span className="picker-chip">{currentCategoryName}</span>
                    </div>
                  ) : (
                    <span>{pickerHint(currentResource)}</span>
                  )}
                </div>
                <Search size={16} />
              </button>
            </FormField>
          ) : null}

          {createError ? <small className="form-field-error">{createError}</small> : null}

          <div className="button-row">
            <Button type="submit" disabled={createMutation.isPending}>
              <Save size={16} />
              Enregistrer
            </Button>
          </div>
        </form>
      </OverlayPanel>

      <OverlayPanel open={categoryPickerOpen} onClose={() => setCategoryPickerOpen(false)} title="Choisir une categorie" width="regular" overlayClassName="overlay-super-top">
        <div className="page-stack">
          <div className="search-action-row">
            <label className="search-field search-field-thin">
              <Search size={14} />
              <input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Chercher une categorie..." />
            </label>
            <QuickAddButton label="Creer une nouvelle categorie" onClick={() => setCategoryCreateOpen(true)} />
          </div>

          {!filteredCategories.length ? (
            <EmptyState title="Aucune categorie" description="Aucun resultat." />
          ) : (
            <div className="picker-option-list">
              {filteredCategories.map((category) => {
                const selected = currentCategoryName === category.nom
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

      <OverlayPanel open={categoryCreateOpen} onClose={() => setCategoryCreateOpen(false)} title="Nouvelle categorie" width="regular" overlayClassName="overlay-super-top">
        <form
          className="form-grid"
          onSubmit={categoryForm.handleSubmit(async (values) => {
            await createCategoryMutation.mutateAsync(values)
          })}
        >
          <FormField label="Nom" error={categoryForm.formState.errors.nom?.message}>
            <input {...categoryForm.register('nom')} placeholder="Nom categorie" />
          </FormField>

          <FormField label="Libelle" error={categoryForm.formState.errors.libelle?.message}>
            <textarea {...categoryForm.register('libelle')} rows={4} placeholder="Facultatif" />
          </FormField>

          {categoryCreateError ? <small className="form-field-error">{categoryCreateError}</small> : null}

          <div className="button-row">
            <Button type="submit" disabled={createCategoryMutation.isPending}>
              <Save size={16} />
              Enregistrer
            </Button>
          </div>
        </form>
      </OverlayPanel>
    </>
  )
}

export function QuickAccountOverlay({
  dialog,
  onClose,
}: {
  dialog: QuickAccountDialogState | null
  onClose: () => void
}) {
  if (!dialog) {
    return null
  }

  return <QuickAccountOverlayContent key={`${dialog.title}-${dialog.initialKind ?? 'interne'}-${dialog.allowedKinds?.join('-') ?? 'all'}`} dialog={dialog} onClose={onClose} />
}

function QuickAccountOverlayContent({
  dialog,
  onClose,
}: {
  dialog: QuickAccountDialogState
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const allowedKinds: Array<'interne' | 'externe'> = dialog.allowedKinds?.length ? dialog.allowedKinds : ['interne', 'externe']
  const defaultKind: 'interne' | 'externe' = allowedKinds.includes(dialog.initialKind ?? 'interne') ? (dialog.initialKind ?? 'interne') : allowedKinds[0]
  const [kind, setKind] = useState<'interne' | 'externe'>(defaultKind)
  const [quickReferenceDialog, setQuickReferenceDialog] = useState<QuickReferenceDialogState | null>(null)

  const internalForm = useForm<QuickInternalAccountValues>({
    resolver: zodResolver(quickInternalAccountSchema),
    defaultValues: {
      identifiant: '',
      libelle: '',
      codeTypeFonctionnement: '',
      nomBanque: '',
      dateSoldeInitial: todayIso(),
      montantSoldeInitial: '',
      nomsTitulaires: [],
    },
  })

  const externalForm = useForm<QuickExternalAccountValues>({
    resolver: zodResolver(quickExternalAccountSchema),
    defaultValues: {
      identifiant: '',
      libelle: '',
    },
  })

  const typesQuery = useQuery({
    queryKey: ['typologies', 'fonctionnements'],
    queryFn: () => monatisApi.listTypeFonctionnements(),
    enabled: allowedKinds.includes('interne'),
  })

  const banksQuery = useQuery({
    queryKey: ['references', 'banque'],
    queryFn: () => monatisApi.listReferences('banque'),
    enabled: allowedKinds.includes('interne'),
  })

  const titulairesQuery = useQuery({
    queryKey: ['references', 'titulaire'],
    queryFn: () => monatisApi.listReferences('titulaire'),
    enabled: allowedKinds.includes('interne'),
  })

  const internalTitulaires = useWatch({ control: internalForm.control, name: 'nomsTitulaires' }) ?? []

  const createInternalMutation = useMutation({
    mutationFn: (values: QuickInternalAccountValues) =>
      monatisApi.createInternalAccount({
        identifiant: values.identifiant.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
        dateCloture: null,
        codeTypeFonctionnement: values.codeTypeFonctionnement,
        dateSoldeInitial: nullIfBlank(values.dateSoldeInitial ?? ''),
        montantSoldeInitialEnCentimes: values.montantSoldeInitial?.trim() ? parseMoneyToCents(values.montantSoldeInitial) : null,
        nomBanque: nullIfBlank(values.nomBanque ?? ''),
        nomsTitulaires: values.nomsTitulaires ?? [],
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes'] })
      await queryClient.invalidateQueries({ queryKey: ['operations', 'compat'] })
      dialog?.onCreated?.(response.identifiant)
      onClose()
    },
  })

  const createExternalMutation = useMutation({
    mutationFn: (values: QuickExternalAccountValues) =>
      monatisApi.createExternalAccount({
        identifiant: values.identifiant.trim(),
        libelle: nullIfBlank(values.libelle ?? ''),
      }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['comptes'] })
      await queryClient.invalidateQueries({ queryKey: ['operations', 'compat'] })
      dialog?.onCreated?.(response.identifiant)
      onClose()
    },
  })

  const internalError = createInternalMutation.error ? apiErrorMessage(createInternalMutation.error) : ''
  const externalError = createExternalMutation.error ? apiErrorMessage(createExternalMutation.error) : ''

  return (
    <>
      <OverlayPanel open={Boolean(dialog)} onClose={onClose} title={dialog.title} width="regular" overlayClassName={dialog.overlayClassName ?? 'overlay-super-top'}>
        <div className="page-stack">
          {allowedKinds.length > 1 ? (
            <div className="inline-segmented">
              <button type="button" className={cx('inline-segmented-option', kind === 'interne' && 'active')} onClick={() => setKind('interne')}>
                Interne
              </button>
              <button type="button" className={cx('inline-segmented-option', kind === 'externe' && 'active')} onClick={() => setKind('externe')}>
                Externe
              </button>
            </div>
          ) : null}

          {kind === 'interne' ? (
            <form
              className="form-grid"
              onSubmit={internalForm.handleSubmit(async (values) => {
                await createInternalMutation.mutateAsync(values)
              })}
            >
              <FormField label="Identifiant" error={internalForm.formState.errors.identifiant?.message}>
                <input {...internalForm.register('identifiant')} placeholder="COMPTE JOINT" />
              </FormField>

              <FormField label="Type" error={internalForm.formState.errors.codeTypeFonctionnement?.message}>
                <select {...internalForm.register('codeTypeFonctionnement')}>
                  <option value="">Choisir</option>
                  {(typesQuery.data ?? []).map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.code}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Banque">
                <div className="field-action-row">
                  <select {...internalForm.register('nomBanque')}>
                    <option value="">Aucune</option>
                    {(banksQuery.data ?? []).map((bank) => (
                      <option key={bank.nom} value={bank.nom}>
                        {bank.nom}
                      </option>
                    ))}
                  </select>
                  <QuickAddButton
                    label="Creer une nouvelle banque"
                    onClick={() =>
                      setQuickReferenceDialog({
                        resource: 'banque',
                        title: 'Nouvelle banque',
                        onCreated: (name) => internalForm.setValue('nomBanque', name, { shouldDirty: true, shouldTouch: true }),
                      })
                    }
                  />
                </div>
              </FormField>

              <div className="form-grid two-columns">
                <FormField label="Date solde initial">
                  <input type="date" {...internalForm.register('dateSoldeInitial')} />
                </FormField>

                <FormField label="Montant solde initial">
                  <input {...internalForm.register('montantSoldeInitial')} inputMode="decimal" placeholder="0.00" />
                </FormField>
              </div>

              <FormField label="Libelle">
                <textarea {...internalForm.register('libelle')} rows={4} placeholder="Facultatif" />
              </FormField>

              <div className="form-field">
                <span className="form-field-label">Titulaires</span>
                <div className="checkbox-grid">
                  <QuickAddButton
                    label="Creer un nouveau titulaire"
                    onClick={() =>
                      setQuickReferenceDialog({
                        resource: 'titulaire',
                        title: 'Nouveau titulaire',
                        onCreated: (name) =>
                          internalForm.setValue('nomsTitulaires', appendUniqueName(internalForm.getValues('nomsTitulaires'), name), {
                            shouldDirty: true,
                            shouldTouch: true,
                          }),
                      })
                    }
                  />
                  {(titulairesQuery.data ?? []).map((titulaire) => {
                    const checked = internalTitulaires.includes(titulaire.nom)
                    return (
                      <label key={titulaire.nom} className={cx('toggle-chip', checked && 'checked')}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const current = internalForm.getValues('nomsTitulaires')
                            internalForm.setValue('nomsTitulaires', checked ? current.filter((value) => value !== titulaire.nom) : [...current, titulaire.nom], {
                              shouldDirty: true,
                              shouldTouch: true,
                            })
                          }}
                        />
                        <span>{titulaire.nom}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {internalError ? <small className="form-field-error">{internalError}</small> : null}

              <div className="button-row">
                <Button type="submit" disabled={createInternalMutation.isPending}>
                  <Save size={16} />
                  Enregistrer
                </Button>
              </div>
            </form>
          ) : (
            <form
              className="form-grid"
              onSubmit={externalForm.handleSubmit(async (values) => {
                await createExternalMutation.mutateAsync(values)
              })}
            >
              <FormField label="Identifiant" error={externalForm.formState.errors.identifiant?.message}>
                <input {...externalForm.register('identifiant')} placeholder="AMAZON" />
              </FormField>

              <FormField label="Libelle">
                <textarea {...externalForm.register('libelle')} rows={4} placeholder="Facultatif" />
              </FormField>

              {externalError ? <small className="form-field-error">{externalError}</small> : null}

              <div className="button-row">
                <Button type="submit" disabled={createExternalMutation.isPending}>
                  <Save size={16} />
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </div>
      </OverlayPanel>

      <QuickReferenceOverlay dialog={quickReferenceDialog} onClose={() => setQuickReferenceDialog(null)} />
    </>
  )
}
