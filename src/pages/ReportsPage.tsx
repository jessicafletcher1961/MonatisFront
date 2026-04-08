import { useQuery } from '@tanstack/react-query'
import { BarChart3, Check, ChevronDown, ChevronRight, Landmark, ListFilter, PiggyBank, Search, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { Badge, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, SectionHeader, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { formatCurrency, formatDate, todayIso, type MonatisPeriodCode } from '../lib/format'
import { apiErrorMessage, monatisApi } from '../lib/monatis-api'
import {
  buildAccountLookup,
  buildBilanPatrimoineReport,
  buildDepenseRecetteReport,
  buildReleveCompte,
  buildRemunerationsFraisReport,
  buildResumesComptes,
  describePeriod,
} from '../lib/reporting'

type ReportTab = 'releve' | 'resumes' | 'depense' | 'remunerations' | 'bilan'
type PeriodSelectValue = Exclude<MonatisPeriodCode, null | undefined>
type ReleveMode = 'both' | 'recettes' | 'depenses'

const reportTabs: Array<{ value: ReportTab; label: string; icon: typeof Landmark }> = [
  { value: 'releve', label: 'Releve', icon: Landmark },
  { value: 'resumes', label: 'Resume', icon: Wallet },
  { value: 'depense', label: 'Depenses / recettes', icon: ListFilter },
  { value: 'remunerations', label: 'Remunerations / frais', icon: BarChart3 },
  { value: 'bilan', label: 'Bilan patrimoine', icon: PiggyBank },
]

const periodOptions: Array<{ value: PeriodSelectValue; label: string }> = [
  { value: '', label: 'Vue globale' },
  { value: 'MOIS', label: 'Mois' },
  { value: 'BIMESTRE', label: 'Bimestre' },
  { value: 'TRIMESTRE', label: 'Trimestre' },
  { value: 'SEMESTRE', label: 'Semestre' },
  { value: 'ANNEE', label: 'Annee' },
]

function toggleValue(values: string[], nextValue: string): string[] {
  return values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue]
}

function isSectionOpen(state: Record<string, boolean>, key: string): boolean {
  return state[key] ?? false
}

function toggleSectionState(state: Record<string, boolean>, key: string): Record<string, boolean> {
  return {
    ...state,
    [key]: !(state[key] ?? false),
  }
}

function sumPeriodSolde(periods: Array<{ solde: number }>): number {
  return periods.reduce((total, period) => total + period.solde, 0)
}

function safeTrailingValue(periods: Array<{ montantSoldeFinalEnEuros: number }>): number {
  return periods.length ? periods[periods.length - 1].montantSoldeFinalEnEuros : 0
}

function reportCellLabel(recette: number, depense: number, depenseLabel = 'D'): string {
  return `R ${formatCurrency(recette)} / ${depenseLabel} ${formatCurrency(depense)}`
}

function HoverDetailsCard({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle?: string
  items: Array<{ primary: string; secondary?: string; amount?: string }>
}) {
  return (
    <div className="report-hover-card">
      <div className="report-hover-head">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <div className="report-hover-list">
        {items.map((item, index) => (
          <div key={`${item.primary}-${index}`} className="report-hover-item">
            <div>
              <strong>{item.primary}</strong>
              {item.secondary ? <span>{item.secondary}</span> : null}
            </div>
            {item.amount ? <span>{item.amount}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function InlinePeriodTotals({
  items,
}: {
  items: Array<{ label: string; summary: string }>
}) {
  return (
    <div className="report-inline-summary">
      {items.map((item) => (
        <div key={item.label} className="report-inline-summary-item">
          <strong>{item.label}</strong>
          <span>{item.summary}</span>
        </div>
      ))}
    </div>
  )
}

function CollapsibleReportSection({
  title,
  aside,
  open,
  onToggle,
  children,
}: {
  title: string
  aside?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const sectionRef = useRef<HTMLDivElement | null>(null)
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }

    if (!open) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [open])

  return (
    <Surface className="report-section">
      <div ref={sectionRef}>
        <button type="button" className="report-section-toggle" onClick={onToggle}>
          <div className="report-section-heading">
            <div className="report-section-title">
              <ChevronRight size={15} className={cx(open && 'open')} />
              <strong>{title}</strong>
            </div>
            {aside ? <div className="report-section-aside">{aside}</div> : null}
          </div>
        </button>
        {open ? <div className="report-section-body">{children}</div> : null}
      </div>
    </Surface>
  )
}

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('releve')
  const [releveMode, setReleveMode] = useState<ReleveMode>('both')

  const [releveAccountId, setReleveAccountId] = useState('')
  const [releveStart, setReleveStart] = useState(todayIso())
  const [releveEnd, setReleveEnd] = useState(todayIso())

  const [resumeType, setResumeType] = useState('')
  const [resumeAccounts, setResumeAccounts] = useState<string[]>([])
  const [resumeDate, setResumeDate] = useState(todayIso())

  const [depenseStart, setDepenseStart] = useState(todayIso())
  const [depenseEnd, setDepenseEnd] = useState(todayIso())
  const [depensePeriod, setDepensePeriod] = useState<PeriodSelectValue>('')
  const [depenseCategories, setDepenseCategories] = useState<string[]>([])
  const [depenseSousCategories, setDepenseSousCategories] = useState<string[]>([])
  const [depenseBeneficiaire, setDepenseBeneficiaire] = useState('')
  const [depenseSousCategoriesOpen, setDepenseSousCategoriesOpen] = useState(false)
  const [depenseSousCategoriesSearch, setDepenseSousCategoriesSearch] = useState('')
  const [depenseOpenCategoryNames, setDepenseOpenCategoryNames] = useState<string[]>([])

  const [remStart, setRemStart] = useState(todayIso())
  const [remEnd, setRemEnd] = useState(todayIso())
  const [remPeriod, setRemPeriod] = useState<PeriodSelectValue>('')
  const [remTypes, setRemTypes] = useState<string[]>([])
  const [remAccounts, setRemAccounts] = useState<string[]>([])
  const [remTitulaire, setRemTitulaire] = useState('')

  const [bilanStart, setBilanStart] = useState(todayIso())
  const [bilanEnd, setBilanEnd] = useState(todayIso())
  const [bilanPeriod, setBilanPeriod] = useState<PeriodSelectValue>('')
  const [bilanTypes, setBilanTypes] = useState<string[]>([])
  const [bilanAccounts, setBilanAccounts] = useState<string[]>([])
  const [bilanTitulaire, setBilanTitulaire] = useState('')

  const [resumeSections, setResumeSections] = useState<Record<string, boolean>>({})
  const [depenseSections, setDepenseSections] = useState<Record<string, boolean>>({})
  const [remSections, setRemSections] = useState<Record<string, boolean>>({})
  const [bilanSections, setBilanSections] = useState<Record<string, boolean>>({})

  function selectTab(nextTab: ReportTab) {
    setResumeSections({})
    setDepenseSections({})
    setRemSections({})
    setBilanSections({})
    setReleveMode('both')
    setTab(nextTab)
  }

  const deferredDepenseSousCategoriesSearch = useDeferredValue(depenseSousCategoriesSearch)

  const internalAccountsQuery = useQuery({
    queryKey: ['comptes', 'internes'],
    queryFn: () => monatisApi.listInternalAccounts(),
  })

  const externalAccountsQuery = useQuery({
    queryKey: ['comptes', 'externes'],
    queryFn: () => monatisApi.listExternalAccounts(),
  })

  const technicalAccountsQuery = useQuery({
    queryKey: ['comptes', 'techniques'],
    queryFn: () => monatisApi.listTechnicalAccounts(),
  })

  const operationsQuery = useQuery({
    queryKey: ['operations'],
    queryFn: () => monatisApi.listOperations(),
  })

  const evaluationsQuery = useQuery({
    queryKey: ['evaluations'],
    queryFn: () => monatisApi.listEvaluations(),
  })

  const categoriesQuery = useQuery({
    queryKey: ['references', 'categorie'],
    queryFn: () => monatisApi.listReferences('categorie'),
  })

  const sousCategoriesQuery = useQuery({
    queryKey: ['references', 'souscategorie'],
    queryFn: () => monatisApi.listReferences('souscategorie'),
  })

  const beneficiairesQuery = useQuery({
    queryKey: ['references', 'beneficiaire'],
    queryFn: () => monatisApi.listReferences('beneficiaire'),
  })

  const titulairesQuery = useQuery({
    queryKey: ['references', 'titulaire'],
    queryFn: () => monatisApi.listReferences('titulaire'),
  })

  const loading =
    internalAccountsQuery.isLoading ||
    externalAccountsQuery.isLoading ||
    technicalAccountsQuery.isLoading ||
    operationsQuery.isLoading ||
    evaluationsQuery.isLoading ||
    categoriesQuery.isLoading ||
    sousCategoriesQuery.isLoading ||
    beneficiairesQuery.isLoading ||
    titulairesQuery.isLoading

  const error =
    internalAccountsQuery.error ||
    externalAccountsQuery.error ||
    technicalAccountsQuery.error ||
    operationsQuery.error ||
    evaluationsQuery.error ||
    categoriesQuery.error ||
    sousCategoriesQuery.error ||
    beneficiairesQuery.error ||
    titulairesQuery.error

  const effectiveReleveAccountId = releveAccountId || internalAccountsQuery.data?.[0]?.identifiant || ''
  const selectedReleveAccount = useMemo(
    () => (internalAccountsQuery.data ?? []).find((account) => account.identifiant === effectiveReleveAccountId) ?? null,
    [effectiveReleveAccountId, internalAccountsQuery.data],
  )

  const accountLookup = useMemo(() => {
    if (!internalAccountsQuery.data || !externalAccountsQuery.data || !technicalAccountsQuery.data) {
      return null
    }

    return buildAccountLookup(internalAccountsQuery.data, externalAccountsQuery.data, technicalAccountsQuery.data)
  }, [externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data])

  const releve = useMemo(() => {
    if (!selectedReleveAccount || !operationsQuery.data || !accountLookup || !releveStart || !releveEnd) {
      return null
    }

    return buildReleveCompte(
      selectedReleveAccount,
      operationsQuery.data,
      accountLookup,
      releveStart,
      releveEnd,
      evaluationsQuery.data ?? [],
    )
  }, [accountLookup, evaluationsQuery.data, operationsQuery.data, releveEnd, releveStart, selectedReleveAccount])

  const resumes = useMemo(() => {
    if (!internalAccountsQuery.data || !operationsQuery.data || !resumeDate) {
      return []
    }

    return buildResumesComptes(
      internalAccountsQuery.data,
      operationsQuery.data,
      resumeDate,
      resumeType ? [resumeType] : undefined,
      resumeAccounts.length ? resumeAccounts : undefined,
      evaluationsQuery.data ?? [],
    )
  }, [evaluationsQuery.data, internalAccountsQuery.data, operationsQuery.data, resumeAccounts, resumeDate, resumeType])

  const resumeGroups = useMemo(() => {
    const groups = new Map<string, typeof resumes>()
    resumes.forEach((row) => {
      groups.set(row.typeFonctionnement, [...(groups.get(row.typeFonctionnement) ?? []), row])
    })

    return Array.from(groups.entries())
      .map(([type, accounts]) => ({
        type,
        accounts: [...accounts].sort((left, right) => left.identifiant.localeCompare(right.identifiant)),
        total: accounts.reduce((sum, account) => sum + account.montantSoldeEnEuros, 0),
      }))
      .sort((left, right) => left.type.localeCompare(right.type))
  }, [resumes])

  const depenseReport = useMemo(() => {
    if (!operationsQuery.data || !internalAccountsQuery.data || !categoriesQuery.data || !sousCategoriesQuery.data || !depenseStart || !depenseEnd) {
      return null
    }

    return buildDepenseRecetteReport({
      operations: operationsQuery.data,
      internalAccounts: internalAccountsQuery.data,
      categories: categoriesQuery.data,
      sousCategories: sousCategoriesQuery.data,
      dateDebut: depenseStart,
      dateFin: depenseEnd,
      codeTypePeriode: depensePeriod,
      nomsCategories: depenseCategories.length ? depenseCategories : undefined,
      nomsSousCategories: depenseSousCategories.length ? depenseSousCategories : undefined,
      nomBeneficiaire: depenseBeneficiaire || undefined,
    })
  }, [
    categoriesQuery.data,
    depenseBeneficiaire,
    depenseCategories,
    depenseEnd,
    depensePeriod,
    depenseSousCategories,
    depenseStart,
    internalAccountsQuery.data,
    operationsQuery.data,
    sousCategoriesQuery.data,
  ])

  const filteredDepenseSousCategories = useMemo(() => {
    const needle = depenseSousCategoriesSearch.trim().toLowerCase()
    const items = sousCategoriesQuery.data ?? []

    if (!needle) {
      return items
    }

    return items.filter((item) =>
      [item.nom, item.libelle, item.nomCategorie].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [depenseSousCategoriesSearch, sousCategoriesQuery.data])

  const groupedDepenseSousCategories = useMemo(() => {
    const categories = categoriesQuery.data ?? []
    const sousCategories = sousCategoriesQuery.data ?? []
    const map = new Map<string, typeof sousCategories>()

    categories.forEach((category) => {
      map.set(category.nom, [])
    })

    sousCategories.forEach((item) => {
      const categoryName = item.nomCategorie ?? 'Sans categorie'
      map.set(categoryName, [...(map.get(categoryName) ?? []), item])
    })

    return Array.from(map.entries()).map(([name, items]) => ({
      name,
      items: [...items].sort((left, right) => left.nom.localeCompare(right.nom)),
    }))
  }, [categoriesQuery.data, sousCategoriesQuery.data])

  const remunerationReport = useMemo(() => {
    if (!operationsQuery.data || !internalAccountsQuery.data || !remStart || !remEnd) {
      return null
    }

    return buildRemunerationsFraisReport({
      operations: operationsQuery.data,
      internalAccounts: internalAccountsQuery.data,
      dateDebut: remStart,
      dateFin: remEnd,
      codeTypePeriode: remPeriod,
      accountIds: remAccounts.length ? remAccounts : undefined,
      codesTypes: remTypes.length ? remTypes : undefined,
      nomTitulaire: remTitulaire || undefined,
    })
  }, [internalAccountsQuery.data, operationsQuery.data, remAccounts, remEnd, remPeriod, remStart, remTitulaire, remTypes])

  const bilanReport = useMemo(() => {
    if (!operationsQuery.data || !internalAccountsQuery.data || !technicalAccountsQuery.data || !bilanStart || !bilanEnd) {
      return null
    }

    return buildBilanPatrimoineReport({
      operations: operationsQuery.data,
      internalAccounts: internalAccountsQuery.data,
      technicalAccounts: technicalAccountsQuery.data,
      evaluations: evaluationsQuery.data ?? [],
      dateDebut: bilanStart,
      dateFin: bilanEnd,
      codeTypePeriode: bilanPeriod,
      accountIds: bilanAccounts.length ? bilanAccounts : undefined,
      codesTypes: bilanTypes.length ? bilanTypes : undefined,
      nomTitulaire: bilanTitulaire || undefined,
    })
  }, [
    bilanAccounts,
    bilanEnd,
    bilanPeriod,
    bilanStart,
    bilanTitulaire,
    bilanTypes,
    evaluationsQuery.data,
    internalAccountsQuery.data,
    operationsQuery.data,
    technicalAccountsQuery.data,
  ])

  function toggleDepenseSousCategoryAccordion(name: string) {
    setDepenseOpenCategoryNames((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name)
      }

      const next = [...current.filter((item) => item !== name), name]
      return next.slice(-2)
    })
  }

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Analyse" title="Analyse" />

      {loading ? <LoadingState label="Preparation des analyses..." /> : null}
      {error ? <ErrorState message={apiErrorMessage(error)} /> : null}

      <FilterBar>
        <div className="tab-bar">
          {reportTabs.map(({ value, label, icon: Icon }) => (
            <button key={value} className={cx('tab-button', tab === value && 'active')} onClick={() => selectTab(value)}>
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </FilterBar>

      {tab === 'releve' ? (
        <div className="page-stack releve-page-stack">
          <Surface className="editor-panel">
            <div className="form-grid three-columns">
              <FormField label="Compte">
                <select value={effectiveReleveAccountId} onChange={(event) => setReleveAccountId(event.target.value)}>
                  <option value="">Choisir</option>
                  {(internalAccountsQuery.data ?? []).map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {account.identifiant}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Debut">
                <input type="date" value={releveStart} onChange={(event) => setReleveStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={releveEnd} onChange={(event) => setReleveEnd(event.target.value)} />
              </FormField>
            </div>
          </Surface>

          {!releve ? (
            <EmptyState title="Choisis un compte" description="Le releve apparait des qu un compte interne et une plage valide sont choisis." />
          ) : (
            <>
              <div className="stat-grid releve-stat-grid">
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Solde debut</span>
                  <strong>{formatCurrency(releve.montantSoldeDebutReleveEnEuros)}</strong>
                  <p>{describePeriod({ key: '', label: '', start: releve.dateDebutReleve, end: releve.dateDebutReleve })}</p>
                </Surface>
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Recettes</span>
                  <strong>{formatCurrency(releve.montantTotalOperationsRecetteEnEuros)}</strong>
                  <p>{releve.operationsRecette.length} operation(s)</p>
                </Surface>
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Depenses</span>
                  <strong>{formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}</strong>
                  <p>{releve.operationsDepense.length} operation(s)</p>
                </Surface>
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Solde fin</span>
                  <strong>{formatCurrency(releve.montantSoldeFinReleveEnEuros)}</strong>
                  <p>Ecart {formatCurrency(releve.montantEcartEnEuros)}</p>
                </Surface>
              </div>

              <Surface className="data-panel report-panel releve-account-panel">
                <div className="releve-account-head">
                  <div className="releve-account-copy">
                    <strong>{releve.enteteCompte.identifiant}</strong>
                    <span>{releve.enteteCompte.typeFonctionnement ?? 'INTERNE'}</span>
                  </div>
                  <Badge>{formatCurrency(releve.montantSoldeFinReleveEnEuros)}</Badge>
                </div>
                <div className="pill-list releve-account-pills">
                  {releve.enteteCompte.libelle ? <Badge>{releve.enteteCompte.libelle}</Badge> : null}
                  {releve.enteteCompte.banque ? <Badge>{releve.enteteCompte.banque}</Badge> : null}
                  {(releve.enteteCompte.titulaires ?? []).map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </Surface>

              <Surface className="data-panel report-panel releve-flow-panel">
                <div className="releve-flow-head">
                  <div className="report-switch-row releve-switch-row">
                    <button
                      type="button"
                      className={cx('report-switch-chip', 'releve-switch-chip', 'left', releveMode !== 'depenses' && 'active')}
                      onClick={() => setReleveMode((current) => (current === 'recettes' ? 'both' : 'recettes'))}
                    >
                      Recettes
                    </button>
                    <button
                      type="button"
                      className={cx('report-switch-chip', 'releve-switch-chip', 'right', releveMode !== 'recettes' && 'active')}
                      onClick={() => setReleveMode((current) => (current === 'depenses' ? 'both' : 'depenses'))}
                    >
                      Depenses
                    </button>
                  </div>
                </div>

                <div className={cx('report-split-grid releve-split-grid', releveMode !== 'both' && 'single', releveMode === 'both' && 'dual')}>
                  {releveMode !== 'depenses' ? (
                    <div className="releve-flow-column">
                      <div className="releve-flow-meta">
                        <Badge tone="success">{formatCurrency(releve.montantTotalOperationsRecetteEnEuros)}</Badge>
                        <span>{releve.operationsRecette.length} operation(s)</span>
                      </div>
                    {!releve.operationsRecette.length ? (
                      <EmptyState title="Aucune recette" description="Aucun mouvement sur cette plage." />
                    ) : (
                      <div className="report-hover-list-grid dense">
                        {releve.operationsRecette.map((row) => (
                          <div key={`releve-r-${row.numero}`} className="report-hover-wrap">
                            <div className="report-line-card">
                              <div>
                                <strong>{row.libelle ?? row.numero}</strong>
                                <span>
                                  {formatDate(row.dateValeur)} · {row.identifiantAutreCompte}
                                </span>
                              </div>
                              <Badge tone="success">{formatCurrency(row.montantEnEuros)}</Badge>
                            </div>
                            <HoverDetailsCard
                              title={row.numero}
                              subtitle={row.codeTypeOperation}
                              items={[
                                {
                                  primary: row.identifiantAutreCompte,
                                  secondary: row.libelleAutreCompte ?? undefined,
                                  amount: formatCurrency(row.montantEnEuros),
                                },
                              ]}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  ) : null}

                  {releveMode !== 'recettes' ? (
                    <div className="releve-flow-column">
                      <div className="releve-flow-meta">
                        <Badge>{formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}</Badge>
                        <span>{releve.operationsDepense.length} operation(s)</span>
                      </div>
                    {!releve.operationsDepense.length ? (
                      <EmptyState title="Aucune depense" description="Aucun mouvement sur cette plage." />
                    ) : (
                      <div className="report-hover-list-grid dense">
                        {releve.operationsDepense.map((row) => (
                          <div key={`releve-d-${row.numero}`} className="report-hover-wrap">
                            <div className="report-line-card">
                              <div>
                                <strong>{row.libelle ?? row.numero}</strong>
                                <span>
                                  {formatDate(row.dateValeur)} · {row.identifiantAutreCompte}
                                </span>
                              </div>
                              <Badge>{formatCurrency(row.montantEnEuros)}</Badge>
                            </div>
                            <HoverDetailsCard
                              title={row.numero}
                              subtitle={row.codeTypeOperation}
                              items={[
                                {
                                  primary: row.identifiantAutreCompte,
                                  secondary: row.libelleAutreCompte ?? undefined,
                                  amount: formatCurrency(row.montantEnEuros),
                                },
                              ]}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    </div>
                  ) : null}
                </div>
              </Surface>
            </>
          )}
        </div>
      ) : null}

      {tab === 'resumes' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <div className="form-grid three-columns">
              <FormField label="Date">
                <input type="date" value={resumeDate} onChange={(event) => setResumeDate(event.target.value)} />
              </FormField>
              <FormField label="Type">
                <select value={resumeType} onChange={(event) => setResumeType(event.target.value)}>
                  <option value="">Tous</option>
                  {(internalAccountsQuery.data ?? [])
                    .map((item) => item.codeTypeFonctionnement)
                    .filter((value, index, array) => array.indexOf(value) === index)
                    .map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                </select>
              </FormField>
            </div>
            <div className="checkbox-grid">
              {(internalAccountsQuery.data ?? []).map((account) => {
                const checked = resumeAccounts.includes(account.identifiant)
                return (
                  <label key={account.identifiant} className={cx('toggle-chip', checked && 'checked')}>
                    <input type="checkbox" checked={checked} onChange={() => setResumeAccounts((current) => toggleValue(current, account.identifiant))} />
                    <span>{account.identifiant}</span>
                  </label>
                )
              })}
            </div>
          </Surface>

          {!resumeGroups.length ? (
            <EmptyState title="Aucun resume" description="Ajuste les filtres ou choisis une date valide." />
          ) : (
            <>
              <Surface className="data-panel">
                <SectionHeader title="Total" aside={<Badge>{formatCurrency(resumes.reduce((sum, row) => sum + row.montantSoldeEnEuros, 0))}</Badge>} />
              </Surface>

              {resumeGroups.map((group) => (
                <CollapsibleReportSection
                  key={group.type}
                  title={group.type}
                  aside={<Badge>{formatCurrency(group.total)}</Badge>}
                  open={isSectionOpen(resumeSections, group.type)}
                  onToggle={() => setResumeSections((current) => toggleSectionState(current, group.type))}
                >
                  <div className="table-wrapper">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Compte</th>
                          <th>Banque</th>
                          <th>Titulaires</th>
                          <th>Solde</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.accounts.map((row) => (
                          <tr key={row.identifiant}>
                            <td>{row.identifiant}</td>
                            <td>{row.banque ?? 'Aucune'}</td>
                            <td>{row.titulaires.join(', ') || 'Aucun'}</td>
                            <td>{formatCurrency(row.montantSoldeEnEuros)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>Total</td>
                          <td>{formatCurrency(group.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CollapsibleReportSection>
              ))}
            </>
          )}
        </div>
      ) : null}

      {tab === 'depense' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <div className="form-grid three-columns">
              <FormField label="Debut">
                <input type="date" value={depenseStart} onChange={(event) => setDepenseStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={depenseEnd} onChange={(event) => setDepenseEnd(event.target.value)} />
              </FormField>
              <FormField label="Periode">
                <select value={depensePeriod} onChange={(event) => setDepensePeriod(event.target.value as PeriodSelectValue)}>
                  {periodOptions.map((option) => (
                    <option key={option.value || 'global'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Beneficiaire">
                <select value={depenseBeneficiaire} onChange={(event) => setDepenseBeneficiaire(event.target.value)}>
                  <option value="">Tous</option>
                  {(beneficiairesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-field">
              <span className="form-field-label">Categories</span>
              <div className="checkbox-grid">
                {(categoriesQuery.data ?? []).map((item) => {
                  const checked = depenseCategories.includes(item.nom)
                  return (
                    <label key={item.nom} className={cx('toggle-chip', checked && 'checked')}>
                      <input type="checkbox" checked={checked} onChange={() => setDepenseCategories((current) => toggleValue(current, item.nom))} />
                      <span>{item.nom}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="form-field">
              <span className="form-field-label">Sous-categories</span>
              <button
                type="button"
                className="picker-field"
                onClick={() => {
                  setDepenseSousCategoriesOpen(true)
                  setDepenseSousCategoriesSearch('')
                  setDepenseOpenCategoryNames([])
                }}
              >
                <div className="picker-field-content">
                  {depenseSousCategories.length ? (
                    <div className="picker-chip-list">
                      {depenseSousCategories.map((name) => (
                        <span key={name} className="picker-chip">
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span>Choisir</span>
                  )}
                </div>
                <ChevronDown size={16} />
              </button>
            </div>
          </Surface>

          {!depenseReport || !depenseReport.categories.length ? (
            <EmptyState title="Aucune donnee" description="Ajuste les filtres ou choisis une plage valide." />
          ) : (
            <>
              <Surface className="data-panel report-panel">
                <SectionHeader title="Totaux" />
                <InlinePeriodTotals
                  items={depenseReport.totals.map((period) => ({
                    label: period.label,
                    summary: `R ${formatCurrency(period.recette)} · D ${formatCurrency(period.depense)} · S ${formatCurrency(period.solde)}`,
                  }))}
                />
              </Surface>

              {depenseReport.categories.map((category) => {
                const key = category.categorie?.nom ?? 'Sans categorie'
                return (
                  <CollapsibleReportSection
                    key={key}
                    title={key}
                    aside={<Badge>{formatCurrency(sumPeriodSolde(category.totals))}</Badge>}
                    open={isSectionOpen(depenseSections, key)}
                    onToggle={() => setDepenseSections((current) => toggleSectionState(current, key))}
                  >
                    <div className="table-wrapper report-table-soft">
                      <table className="report-table">
                        <thead>
                          <tr>
                            <th>Sous-categorie</th>
                            {depenseReport.periods.map((period) => (
                              <th key={period.key}>{period.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {category.children.map((child) => (
                            <tr key={child.sousCategorie?.nom ?? 'none'}>
                              <td>{child.sousCategorie?.nom ?? 'Sans sous-categorie'}</td>
                              {child.periods.map((period) => (
                                <td key={`${child.sousCategorie?.nom}_${period.start}`}>
                                  <div className="report-hover-wrap table-cell-hover">
                                    <div className="report-cell-main">
                                      <strong>{formatCurrency(period.solde)}</strong>
                                      <span className="cell-subline">{reportCellLabel(period.recette, period.depense)}</span>
                                    </div>
                                    {period.details.length ? (
                                      <HoverDetailsCard
                                        title={child.sousCategorie?.nom ?? 'Sans sous-categorie'}
                                        subtitle={describePeriod({ key: '', label: '', start: period.start, end: period.end })}
                                        items={period.details.map((item) => ({
                                          primary: item.libelle ?? item.numero,
                                          secondary: `${formatDate(item.date)}${item.beneficiaires.length ? ` · ${item.beneficiaires.join(', ')}` : ''}`,
                                          amount: formatCurrency(item.montantEnEuros),
                                        }))}
                                      />
                                    ) : null}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td>Total</td>
                            {category.totals.map((period) => (
                              <td key={`${key}-${period.start}`}>{formatCurrency(period.solde)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CollapsibleReportSection>
                )
              })}
            </>
          )}
        </div>
      ) : null}

      <OverlayPanel
        open={depenseSousCategoriesOpen}
        onClose={() => {
          setDepenseSousCategoriesOpen(false)
          setDepenseSousCategoriesSearch('')
          setDepenseOpenCategoryNames([])
        }}
        title="Sous-categories"
        width="regular"
        overlayClassName="overlay-top"
      >
        <div className="page-stack">
          <label className="search-field search-field-thin">
            <Search size={14} />
            <input value={depenseSousCategoriesSearch} onChange={(event) => setDepenseSousCategoriesSearch(event.target.value)} placeholder="Chercher..." />
          </label>

          {deferredDepenseSousCategoriesSearch ? (
            !filteredDepenseSousCategories.length ? (
              <EmptyState title="Aucune sous-categorie" description="Aucun resultat." />
            ) : (
              <div className="picker-option-list">
                {filteredDepenseSousCategories.map((item) => {
                  const selected = depenseSousCategories.includes(item.nom)
                  return (
                    <button
                      key={item.nom}
                      type="button"
                      className={cx('picker-option', selected && 'selected')}
                      onClick={() => setDepenseSousCategories((current) => toggleValue(current, item.nom))}
                    >
                      <div>
                        <strong>{item.nom}</strong>
                        <span>{item.nomCategorie ?? 'Sans categorie'}</span>
                      </div>
                      {selected ? <Check size={16} /> : null}
                    </button>
                  )
                })}
              </div>
            )
          ) : (
            <div className="sub-category-groups">
              {groupedDepenseSousCategories.map((category) => {
                const open = depenseOpenCategoryNames.includes(category.name)
                return (
                  <div key={category.name} className={cx('sub-category-group', open && 'open')}>
                    <button type="button" className="sub-category-group-toggle" onClick={() => toggleDepenseSousCategoryAccordion(category.name)}>
                      <span>{category.name}</span>
                      <ChevronDown size={14} />
                    </button>

                    {open ? (
                      <div className="sub-category-options">
                        {category.items.length ? (
                          category.items.map((item) => {
                            const selected = depenseSousCategories.includes(item.nom)
                            return (
                              <button
                                key={item.nom}
                                type="button"
                                className={cx('sub-category-option', selected && 'selected')}
                                onClick={() => setDepenseSousCategories((current) => toggleValue(current, item.nom))}
                              >
                                <span>{item.nom}</span>
                                {selected ? <Check size={14} /> : null}
                              </button>
                            )
                          })
                        ) : (
                          <div className="sub-category-empty">Aucune sous-categorie</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      {tab === 'remunerations' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <div className="form-grid three-columns">
              <FormField label="Debut">
                <input type="date" value={remStart} onChange={(event) => setRemStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={remEnd} onChange={(event) => setRemEnd(event.target.value)} />
              </FormField>
              <FormField label="Periode">
                <select value={remPeriod} onChange={(event) => setRemPeriod(event.target.value as PeriodSelectValue)}>
                  {periodOptions.map((option) => (
                    <option key={option.value || 'global'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Titulaire">
                <select value={remTitulaire} onChange={(event) => setRemTitulaire(event.target.value)}>
                  <option value="">Tous</option>
                  {(titulairesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-field">
              <span className="form-field-label">Types</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? [])
                  .map((item) => item.codeTypeFonctionnement)
                  .filter((value, index, array) => array.indexOf(value) === index)
                  .map((value) => {
                    const checked = remTypes.includes(value)
                    return (
                      <label key={value} className={cx('toggle-chip', checked && 'checked')}>
                        <input type="checkbox" checked={checked} onChange={() => setRemTypes((current) => toggleValue(current, value))} />
                        <span>{value}</span>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="form-field">
              <span className="form-field-label">Comptes</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? []).map((item) => {
                  const checked = remAccounts.includes(item.identifiant)
                  return (
                    <label key={item.identifiant} className={cx('toggle-chip', checked && 'checked')}>
                      <input type="checkbox" checked={checked} onChange={() => setRemAccounts((current) => toggleValue(current, item.identifiant))} />
                      <span>{item.identifiant}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </Surface>

          {!remunerationReport || !remunerationReport.groups.length ? (
            <EmptyState title="Aucune donnee" description="Ajuste les filtres ou la plage." />
          ) : (
            <>
              <Surface className="data-panel report-panel">
                <SectionHeader title="Totaux" />
                <InlinePeriodTotals
                  items={remunerationReport.totals.map((period) => ({
                    label: period.label,
                    summary: `R ${formatCurrency(period.recette)} · F ${formatCurrency(period.depense)} · N ${formatCurrency(period.solde)}`,
                  }))}
                />
              </Surface>

              {remunerationReport.groups.map((group) => (
                <CollapsibleReportSection
                  key={group.typeFonctionnement}
                  title={group.typeFonctionnement}
                  aside={<Badge>{formatCurrency(sumPeriodSolde(group.periods))}</Badge>}
                  open={isSectionOpen(remSections, group.typeFonctionnement)}
                  onToggle={() => setRemSections((current) => toggleSectionState(current, group.typeFonctionnement))}
                >
                  <div className="table-wrapper report-table-soft">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Compte</th>
                          {remunerationReport.periods.map((period) => (
                            <th key={period.key}>{period.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.accounts.map((account) => (
                          <tr key={account.identifiant}>
                            <td>{account.identifiant}</td>
                            {account.periods.map((period) => (
                              <td key={`${account.identifiant}_${period.start}`}>
                                {formatCurrency(period.solde)}
                                <div className="cell-subline">{reportCellLabel(period.recette, period.depense, 'F')}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          {group.periods.map((period) => (
                            <td key={`${group.typeFonctionnement}-${period.start}`}>{formatCurrency(period.solde)}</td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CollapsibleReportSection>
              ))}
            </>
          )}
        </div>
      ) : null}

      {tab === 'bilan' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <div className="form-grid three-columns">
              <FormField label="Debut">
                <input type="date" value={bilanStart} onChange={(event) => setBilanStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={bilanEnd} onChange={(event) => setBilanEnd(event.target.value)} />
              </FormField>
              <FormField label="Periode">
                <select value={bilanPeriod} onChange={(event) => setBilanPeriod(event.target.value as PeriodSelectValue)}>
                  {periodOptions.map((option) => (
                    <option key={option.value || 'global'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Titulaire">
                <select value={bilanTitulaire} onChange={(event) => setBilanTitulaire(event.target.value)}>
                  <option value="">Tous</option>
                  {(titulairesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-field">
              <span className="form-field-label">Types</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? [])
                  .map((item) => item.codeTypeFonctionnement)
                  .filter((value, index, array) => array.indexOf(value) === index)
                  .map((value) => {
                    const checked = bilanTypes.includes(value)
                    return (
                      <label key={value} className={cx('toggle-chip', checked && 'checked')}>
                        <input type="checkbox" checked={checked} onChange={() => setBilanTypes((current) => toggleValue(current, value))} />
                        <span>{value}</span>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="form-field">
              <span className="form-field-label">Comptes</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? []).map((item) => {
                  const checked = bilanAccounts.includes(item.identifiant)
                  return (
                    <label key={item.identifiant} className={cx('toggle-chip', checked && 'checked')}>
                      <input type="checkbox" checked={checked} onChange={() => setBilanAccounts((current) => toggleValue(current, item.identifiant))} />
                      <span>{item.identifiant}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </Surface>

          {!bilanReport || !bilanReport.groups.length ? (
            <EmptyState title="Aucun bilan" description="Ajuste les filtres ou la plage." />
          ) : (
            <>
              <CollapsibleReportSection
                title="Bilan patrimoine"
                aside={<Badge>{formatCurrency(bilanReport.montantSoldeInitialEnEuros)}</Badge>}
                open={isSectionOpen(bilanSections, '__overview__')}
                onToggle={() => setBilanSections((current) => toggleSectionState(current, '__overview__'))}
              >
                <InlinePeriodTotals
                  items={bilanReport.totals.map((period) => ({
                    label: period.label,
                    summary: `Fin ${formatCurrency(period.montantSoldeFinalEnEuros)} · Tech ${formatCurrency(period.soldeTotalTechniqueEnEuros)} · Ecart ${formatCurrency(period.montantEcartNonJustifieEnEuros)}`,
                  }))}
                />
              </CollapsibleReportSection>

              {bilanReport.groups.map((group) => (
                <CollapsibleReportSection
                  key={group.typeFonctionnement}
                  title={group.typeFonctionnement}
                  aside={<Badge>{formatCurrency(safeTrailingValue(group.periods))}</Badge>}
                  open={isSectionOpen(bilanSections, group.typeFonctionnement)}
                  onToggle={() => setBilanSections((current) => toggleSectionState(current, group.typeFonctionnement))}
                >
                  <div className="report-inline-note">
                    <span>Initial</span>
                    <strong>{formatCurrency(group.montantSoldeInitialEnEuros)}</strong>
                  </div>
                  <div className="table-wrapper">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Compte</th>
                          {bilanReport.periods.map((period) => (
                            <th key={period.key}>{period.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.accounts.map((account) => (
                          <tr key={account.identifiant}>
                            <td>{account.identifiant}</td>
                            {account.periods.map((period) => (
                              <td key={`${account.identifiant}_${period.start}`}>
                                {formatCurrency(period.montantSoldeFinalEnEuros)}
                                <div className="cell-subline">Init {formatCurrency(period.montantSoldeInitialEnEuros)}</div>
                                <div className="cell-subline">Ecart {formatCurrency(period.montantEcartNonJustifieEnEuros)}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          {group.periods.map((period) => (
                            <td key={`${group.typeFonctionnement}-${period.start}`}>{formatCurrency(period.montantSoldeFinalEnEuros)}</td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CollapsibleReportSection>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
