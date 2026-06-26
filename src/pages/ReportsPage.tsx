import { useQuery } from '@tanstack/react-query'
import { BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight, Landmark, ListFilter, PiggyBank, Search, TrendingUp, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { Badge, Button, EmptyState, ErrorState, FilterBar, FormField, LoadingState, OverlayPanel, PageHeader, SectionHeader, Surface } from '../components/ui'
import { cx } from '../lib/cx'
import { formatCurrency, formatDate, todayIso, type MonatisPeriodCode } from '../lib/format'
import { apiErrorMessage, monatisApi } from '../lib/monatis-api'
import {
  buildAccountLookup,
  buildBilanPatrimoineReport,
  buildDepenseRecetteReport,
  buildPlusMoinsValueReport,
  buildReleveCompte,
  buildRemunerationsFraisReport,
  buildResumesComptes,
  describePeriod,
  type ReleveRow,
} from '../lib/reporting'

type ReportTab = 'releve' | 'resumes' | 'depense' | 'plusmoins' | 'remunerations' | 'bilan'
type PeriodSelectValue = Exclude<MonatisPeriodCode, null | undefined>
type ReleveMode = 'both' | 'recettes' | 'depenses'
type ReportFilterPicker =
  | 'releve-account'
  | 'releve-date'
  | 'resume-date'
  | 'resume-type'
  | 'resume-account'
  | 'depense-date'
  | 'depense-period'
  | 'depense-beneficiary'
  | 'depense-category'
  | 'depense-subcategory'
  | 'rem-date'
  | 'rem-period'
  | 'rem-type'
  | 'rem-account'
  | 'rem-titulaire'
  | 'plus-date'
  | 'plus-period'
  | 'plus-type'
  | 'plus-account'
  | 'plus-titulaire'
  | 'bilan-date'
  | 'bilan-period'
  | 'bilan-type'
  | 'bilan-account'
  | 'bilan-titulaire'
  | null

const reportTabs: Array<{ value: ReportTab; label: string; icon: typeof Landmark }> = [
  { value: 'releve', label: 'Releve', icon: Landmark },
  { value: 'resumes', label: 'Resume', icon: Wallet },
  { value: 'depense', label: 'Depenses / recettes', icon: ListFilter },
  { value: 'plusmoins', label: 'Plus / moins-value', icon: TrendingUp },
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

const RELEVE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200]

function visibleRelevePageRows(rows: ReleveRow[], currentPage: number, pageSize: number, totalCount: number | null): ReleveRow[] {
  if (rows.length <= pageSize && totalCount != null && totalCount > rows.length) {
    return rows
  }

  const start = Math.max(0, (currentPage - 1) * pageSize)
  return rows.slice(start, start + pageSize)
}

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

function sumPlusMoinsValue(periods: Array<{ montantPlusMoinsValueNetteEnEuros: number }>): number {
  return periods.reduce((total, period) => total + period.montantPlusMoinsValueNetteEnEuros, 0)
}

function reportCellLabel(recette: number, depense: number, depenseLabel = 'D'): string {
  return `R ${formatCurrency(recette)} / ${depenseLabel} ${formatCurrency(depense)}`
}

function rateLabel(value: number | null): string {
  return value == null ? '-' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} %`
}

function compactFilterLabel(values: string[], emptyLabel: string): string {
  if (!values.length) {
    return emptyLabel
  }

  if (values.length === 1) {
    return values[0]
  }

  return `${values.length} selectionnes`
}

function dateRangeFilterLabel(start: string, end: string): string {
  if (start && end) {
    return `${start} - ${end}`
  }

  return start || end || 'Toutes'
}

function periodFilterLabel(value: PeriodSelectValue): string {
  return periodOptions.find((option) => option.value === value)?.label ?? 'Vue globale'
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
  const [reportFilterPicker, setReportFilterPicker] = useState<ReportFilterPicker>(null)
  const [relevePageSize, setRelevePageSize] = useState(RELEVE_PAGE_SIZE_OPTIONS[0])
  const [releveRecettePage, setReleveRecettePage] = useState(1)
  const [releveDepensePage, setReleveDepensePage] = useState(1)

  const [releveAccountId, setReleveAccountId] = useState('')
  const [releveStart, setReleveStart] = useState(todayIso())
  const [releveEnd, setReleveEnd] = useState(todayIso())
  const [releveAccountSearch, setReleveAccountSearch] = useState('')

  const [resumeType, setResumeType] = useState('')
  const [resumeAccounts, setResumeAccounts] = useState<string[]>([])
  const [resumeDate, setResumeDate] = useState(todayIso())
  const [resumeAccountSearch, setResumeAccountSearch] = useState('')

  const [depenseStart, setDepenseStart] = useState(todayIso())
  const [depenseEnd, setDepenseEnd] = useState(todayIso())
  const [depensePeriod, setDepensePeriod] = useState<PeriodSelectValue>('')
  const [depenseCategories, setDepenseCategories] = useState<string[]>([])
  const [depenseSousCategories, setDepenseSousCategories] = useState<string[]>([])
  const [depenseBeneficiaire, setDepenseBeneficiaire] = useState('')
  const [depenseBeneficiaireSearch, setDepenseBeneficiaireSearch] = useState('')
  const [depenseCategorySearch, setDepenseCategorySearch] = useState('')
  const [depenseSousCategoriesSearch, setDepenseSousCategoriesSearch] = useState('')
  const [depenseOpenCategoryNames, setDepenseOpenCategoryNames] = useState<string[]>([])

  const [remStart, setRemStart] = useState(todayIso())
  const [remEnd, setRemEnd] = useState(todayIso())
  const [remPeriod, setRemPeriod] = useState<PeriodSelectValue>('')
  const [remTypes, setRemTypes] = useState<string[]>([])
  const [remAccounts, setRemAccounts] = useState<string[]>([])
  const [remTitulaire, setRemTitulaire] = useState('')
  const [remAccountSearch, setRemAccountSearch] = useState('')
  const [remTitulaireSearch, setRemTitulaireSearch] = useState('')

  const [plusStart, setPlusStart] = useState(todayIso())
  const [plusEnd, setPlusEnd] = useState(todayIso())
  const [plusPeriod, setPlusPeriod] = useState<PeriodSelectValue>('')
  const [plusTypes, setPlusTypes] = useState<string[]>([])
  const [plusAccounts, setPlusAccounts] = useState<string[]>([])
  const [plusTitulaire, setPlusTitulaire] = useState('')
  const [plusAccountSearch, setPlusAccountSearch] = useState('')
  const [plusTitulaireSearch, setPlusTitulaireSearch] = useState('')

  const [bilanStart, setBilanStart] = useState(todayIso())
  const [bilanEnd, setBilanEnd] = useState(todayIso())
  const [bilanPeriod, setBilanPeriod] = useState<PeriodSelectValue>('')
  const [bilanTypes, setBilanTypes] = useState<string[]>([])
  const [bilanAccounts, setBilanAccounts] = useState<string[]>([])
  const [bilanTitulaire, setBilanTitulaire] = useState('')
  const [bilanAccountSearch, setBilanAccountSearch] = useState('')
  const [bilanTitulaireSearch, setBilanTitulaireSearch] = useState('')

  const [resumeSections, setResumeSections] = useState<Record<string, boolean>>({})
  const [depenseSections, setDepenseSections] = useState<Record<string, boolean>>({})
  const [plusSections, setPlusSections] = useState<Record<string, boolean>>({})
  const [remSections, setRemSections] = useState<Record<string, boolean>>({})
  const [bilanSections, setBilanSections] = useState<Record<string, boolean>>({})

  function selectTab(nextTab: ReportTab) {
    setResumeSections({})
    setDepenseSections({})
    setPlusSections({})
    setRemSections({})
    setBilanSections({})
    setReleveMode('both')
    setReportFilterPicker(null)
    setTab(nextTab)
  }

  const deferredReleveAccountSearch = useDeferredValue(releveAccountSearch)
  const deferredResumeAccountSearch = useDeferredValue(resumeAccountSearch)
  const deferredDepenseBeneficiaireSearch = useDeferredValue(depenseBeneficiaireSearch)
  const deferredDepenseCategorySearch = useDeferredValue(depenseCategorySearch)
  const deferredDepenseSousCategoriesSearch = useDeferredValue(depenseSousCategoriesSearch)
  const deferredRemAccountSearch = useDeferredValue(remAccountSearch)
  const deferredRemTitulaireSearch = useDeferredValue(remTitulaireSearch)
  const deferredPlusAccountSearch = useDeferredValue(plusAccountSearch)
  const deferredPlusTitulaireSearch = useDeferredValue(plusTitulaireSearch)
  const deferredBilanAccountSearch = useDeferredValue(bilanAccountSearch)
  const deferredBilanTitulaireSearch = useDeferredValue(bilanTitulaireSearch)

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
    queryKey: ['operations', 'all'],
    queryFn: () => monatisApi.listOperations(),
  })

  const evaluationsQuery = useQuery({
    queryKey: ['evaluations', 'all'],
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

  const effectiveReleveAccountId = releveAccountId || internalAccountsQuery.data?.[0]?.identifiant || ''
  const selectedReleveAccount = useMemo(
    () => (internalAccountsQuery.data ?? []).find((account) => account.identifiant === effectiveReleveAccountId) ?? null,
    [effectiveReleveAccountId, internalAccountsQuery.data],
  )
  const internalAccountTypes = useMemo(
    () =>
      Array.from(new Set((internalAccountsQuery.data ?? []).map((account) => account.codeTypeFonctionnement).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [internalAccountsQuery.data],
  )
  const filteredReleveAccounts = useMemo(() => {
    const needle = deferredReleveAccountSearch.trim().toLowerCase()
    return (internalAccountsQuery.data ?? []).filter((account) => {
      if (!needle) {
        return true
      }

      return [account.identifiant, account.libelle, account.nomBanque, ...account.nomsTitulaires]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredReleveAccountSearch, internalAccountsQuery.data])
  const filteredResumeAccounts = useMemo(() => {
    const needle = deferredResumeAccountSearch.trim().toLowerCase()
    return (internalAccountsQuery.data ?? []).filter((account) => {
      if (!needle) {
        return true
      }

      return [account.identifiant, account.libelle, account.nomBanque, ...account.nomsTitulaires]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredResumeAccountSearch, internalAccountsQuery.data])
  const selectedResumeAccountItems = useMemo(
    () => (internalAccountsQuery.data ?? []).filter((account) => resumeAccounts.includes(account.identifiant)),
    [internalAccountsQuery.data, resumeAccounts],
  )
  const filteredDepenseBeneficiaires = useMemo(() => {
    const needle = deferredDepenseBeneficiaireSearch.trim().toLowerCase()
    return (beneficiairesQuery.data ?? []).filter((item) => {
      if (!needle) {
        return true
      }

      return [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [beneficiairesQuery.data, deferredDepenseBeneficiaireSearch])
  const filteredDepenseCategories = useMemo(() => {
    const needle = deferredDepenseCategorySearch.trim().toLowerCase()
    return (categoriesQuery.data ?? []).filter((item) => {
      if (!needle) {
        return true
      }

      return [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [categoriesQuery.data, deferredDepenseCategorySearch])
  const filteredRemAccounts = useMemo(() => {
    const needle = deferredRemAccountSearch.trim().toLowerCase()
    return (internalAccountsQuery.data ?? []).filter((account) => {
      if (!needle) {
        return true
      }

      return [account.identifiant, account.libelle, account.nomBanque, ...account.nomsTitulaires]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredRemAccountSearch, internalAccountsQuery.data])
  const selectedRemAccountItems = useMemo(
    () => (internalAccountsQuery.data ?? []).filter((account) => remAccounts.includes(account.identifiant)),
    [internalAccountsQuery.data, remAccounts],
  )
  const filteredRemTitulaires = useMemo(() => {
    const needle = deferredRemTitulaireSearch.trim().toLowerCase()
    return (titulairesQuery.data ?? []).filter((item) => {
      if (!needle) {
        return true
      }

      return [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredRemTitulaireSearch, titulairesQuery.data])
  const filteredPlusAccounts = useMemo(() => {
    const needle = deferredPlusAccountSearch.trim().toLowerCase()
    return (internalAccountsQuery.data ?? []).filter((account) => {
      if (!needle) {
        return true
      }

      return [account.identifiant, account.libelle, account.nomBanque, ...account.nomsTitulaires]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredPlusAccountSearch, internalAccountsQuery.data])
  const selectedPlusAccountItems = useMemo(
    () => (internalAccountsQuery.data ?? []).filter((account) => plusAccounts.includes(account.identifiant)),
    [internalAccountsQuery.data, plusAccounts],
  )
  const filteredPlusTitulaires = useMemo(() => {
    const needle = deferredPlusTitulaireSearch.trim().toLowerCase()
    return (titulairesQuery.data ?? []).filter((item) => {
      if (!needle) {
        return true
      }

      return [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredPlusTitulaireSearch, titulairesQuery.data])
  const filteredBilanAccounts = useMemo(() => {
    const needle = deferredBilanAccountSearch.trim().toLowerCase()
    return (internalAccountsQuery.data ?? []).filter((account) => {
      if (!needle) {
        return true
      }

      return [account.identifiant, account.libelle, account.nomBanque, ...account.nomsTitulaires]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredBilanAccountSearch, internalAccountsQuery.data])
  const selectedBilanAccountItems = useMemo(
    () => (internalAccountsQuery.data ?? []).filter((account) => bilanAccounts.includes(account.identifiant)),
    [bilanAccounts, internalAccountsQuery.data],
  )
  const filteredBilanTitulaires = useMemo(() => {
    const needle = deferredBilanTitulaireSearch.trim().toLowerCase()
    return (titulairesQuery.data ?? []).filter((item) => {
      if (!needle) {
        return true
      }

      return [item.nom, item.libelle].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [deferredBilanTitulaireSearch, titulairesQuery.data])

  const accountLookup = useMemo(
    () => buildAccountLookup(internalAccountsQuery.data ?? [], externalAccountsQuery.data ?? [], technicalAccountsQuery.data ?? []),
    [externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data],
  )
  const reportSourcesReady =
    Boolean(internalAccountsQuery.data) &&
    Boolean(externalAccountsQuery.data) &&
    Boolean(technicalAccountsQuery.data) &&
    Boolean(operationsQuery.data) &&
    Boolean(evaluationsQuery.data)
  const reportSourceVersion = [
    internalAccountsQuery.dataUpdatedAt,
    externalAccountsQuery.dataUpdatedAt,
    technicalAccountsQuery.dataUpdatedAt,
    operationsQuery.dataUpdatedAt,
    evaluationsQuery.dataUpdatedAt,
    categoriesQuery.dataUpdatedAt,
    sousCategoriesQuery.dataUpdatedAt,
  ]

  const releveQuery = useQuery({
    queryKey: ['rapports', 'releve_compte', effectiveReleveAccountId, releveStart, releveEnd, reportSourceVersion],
    queryFn: () =>
      buildReleveCompte(
        selectedReleveAccount!,
        operationsQuery.data ?? [],
        accountLookup,
        releveStart,
        releveEnd,
        evaluationsQuery.data ?? [],
      ),
    enabled: tab === 'releve' && reportSourcesReady && Boolean(selectedReleveAccount && releveStart && releveEnd),
    placeholderData: (previousData) => previousData,
  })

  const resumesQuery = useQuery({
    queryKey: ['rapports', 'resumes_comptes_internes', resumeDate, resumeType, resumeAccounts, reportSourceVersion],
    queryFn: () =>
      buildResumesComptes(
        internalAccountsQuery.data ?? [],
        operationsQuery.data ?? [],
        resumeDate,
        resumeType ? [resumeType] : undefined,
        resumeAccounts.length ? resumeAccounts : undefined,
        evaluationsQuery.data ?? [],
      ),
    enabled: tab === 'resumes' && reportSourcesReady && Boolean(resumeDate),
  })

  const depenseReportQuery = useQuery({
    queryKey: [
      'rapports',
      'depense_recette',
      depenseStart,
      depenseEnd,
      depensePeriod,
      depenseCategories,
      depenseSousCategories,
      depenseBeneficiaire,
      reportSourceVersion,
    ],
    queryFn: () =>
      buildDepenseRecetteReport({
        operations: operationsQuery.data ?? [],
        internalAccounts: internalAccountsQuery.data ?? [],
        categories: categoriesQuery.data ?? [],
        sousCategories: sousCategoriesQuery.data ?? [],
        dateDebut: depenseStart,
        dateFin: depenseEnd,
        codeTypePeriode: depensePeriod || null,
        nomsCategories: depenseCategories,
        nomsSousCategories: depenseSousCategories,
        nomBeneficiaire: depenseBeneficiaire || null,
      }),
    enabled: tab === 'depense' && reportSourcesReady && Boolean(categoriesQuery.data && sousCategoriesQuery.data && depenseStart && depenseEnd),
  })

  const plusMoinsReportQuery = useQuery({
    queryKey: ['rapports', 'plus_moins_value', plusStart, plusEnd, plusPeriod, plusAccounts, plusTypes, plusTitulaire, reportSourceVersion],
    queryFn: () =>
      buildPlusMoinsValueReport({
        operations: operationsQuery.data ?? [],
        internalAccounts: internalAccountsQuery.data ?? [],
        evaluations: evaluationsQuery.data ?? [],
        dateDebut: plusStart,
        dateFin: plusEnd,
        codeTypePeriode: plusPeriod || null,
        accountIds: plusAccounts,
        codesTypes: plusTypes,
        nomTitulaire: plusTitulaire || null,
      }),
    enabled: tab === 'plusmoins' && reportSourcesReady && Boolean(plusStart && plusEnd),
  })

  const remunerationReportQuery = useQuery({
    queryKey: ['rapports', 'remunerations_frais', remStart, remEnd, remPeriod, remAccounts, remTypes, remTitulaire, reportSourceVersion],
    queryFn: () =>
      buildRemunerationsFraisReport({
        operations: operationsQuery.data ?? [],
        internalAccounts: internalAccountsQuery.data ?? [],
        dateDebut: remStart,
        dateFin: remEnd,
        codeTypePeriode: remPeriod || null,
        accountIds: remAccounts,
        codesTypes: remTypes,
        nomTitulaire: remTitulaire || null,
      }),
    enabled: tab === 'remunerations' && reportSourcesReady && Boolean(remStart && remEnd),
  })

  const bilanReportQuery = useQuery({
    queryKey: ['rapports', 'bilan_patrimoine', bilanStart, bilanEnd, bilanPeriod, bilanAccounts, bilanTypes, bilanTitulaire, reportSourceVersion],
    queryFn: () =>
      buildBilanPatrimoineReport({
        operations: operationsQuery.data ?? [],
        internalAccounts: internalAccountsQuery.data ?? [],
        technicalAccounts: technicalAccountsQuery.data ?? [],
        evaluations: evaluationsQuery.data ?? [],
        dateDebut: bilanStart,
        dateFin: bilanEnd,
        codeTypePeriode: bilanPeriod || null,
        accountIds: bilanAccounts,
        codesTypes: bilanTypes,
        nomTitulaire: bilanTitulaire || null,
      }),
    enabled: tab === 'bilan' && reportSourcesReady && Boolean(bilanStart && bilanEnd),
  })

  const releve = releveQuery.data ?? null
  const releveOperationsRecette = useMemo(
    () => (releve ? visibleRelevePageRows(releve.operationsRecette, releveRecettePage, relevePageSize, releve.totalOperationsRecette) : []),
    [releve, relevePageSize, releveRecettePage],
  )
  const releveOperationsDepense = useMemo(
    () => (releve ? visibleRelevePageRows(releve.operationsDepense, releveDepensePage, relevePageSize, releve.totalOperationsDepense) : []),
    [releve, releveDepensePage, relevePageSize],
  )
  const resumes = useMemo(() => resumesQuery.data ?? [], [resumesQuery.data])
  const depenseReport = depenseReportQuery.data ?? null
  const plusMoinsReport = plusMoinsReportQuery.data ?? null
  const remunerationReport = remunerationReportQuery.data ?? null
  const bilanReport = bilanReportQuery.data ?? null

  const activeReportLoading =
    (tab === 'releve' && releveQuery.isLoading && !releveQuery.data) ||
    (tab === 'resumes' && resumesQuery.isLoading) ||
    (tab === 'depense' && depenseReportQuery.isLoading) ||
    (tab === 'plusmoins' && plusMoinsReportQuery.isLoading) ||
    (tab === 'remunerations' && remunerationReportQuery.isLoading) ||
    (tab === 'bilan' && bilanReportQuery.isLoading)

  const activeReportError =
    (tab === 'releve' && releveQuery.error) ||
    (tab === 'resumes' && resumesQuery.error) ||
    (tab === 'depense' && depenseReportQuery.error) ||
    (tab === 'plusmoins' && plusMoinsReportQuery.error) ||
    (tab === 'remunerations' && remunerationReportQuery.error) ||
    (tab === 'bilan' && bilanReportQuery.error)

  const loading =
    internalAccountsQuery.isLoading ||
    externalAccountsQuery.isLoading ||
    technicalAccountsQuery.isLoading ||
    operationsQuery.isLoading ||
    evaluationsQuery.isLoading ||
    categoriesQuery.isLoading ||
    sousCategoriesQuery.isLoading ||
    beneficiairesQuery.isLoading ||
    titulairesQuery.isLoading ||
    activeReportLoading

  const error =
    internalAccountsQuery.error ||
    externalAccountsQuery.error ||
    technicalAccountsQuery.error ||
    operationsQuery.error ||
    evaluationsQuery.error ||
    categoriesQuery.error ||
    sousCategoriesQuery.error ||
    beneficiairesQuery.error ||
    titulairesQuery.error ||
    activeReportError

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

  const filteredDepenseSousCategories = useMemo(() => {
    const needle = deferredDepenseSousCategoriesSearch.trim().toLowerCase()
    const items = sousCategoriesQuery.data ?? []

    if (!needle) {
      return items
    }

    return items.filter((item) =>
      [item.nom, item.libelle, item.nomCategorie].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)),
    )
  }, [deferredDepenseSousCategoriesSearch, sousCategoriesQuery.data])

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

  function toggleDepenseSousCategoryAccordion(name: string) {
    setDepenseOpenCategoryNames((current) => {
      if (current.includes(name)) {
        return current.filter((item) => item !== name)
      }

      const next = [...current.filter((item) => item !== name), name]
      return next.slice(-2)
    })
  }

  function renderReportFilterButton(label: string, value: string, picker: Exclude<ReportFilterPicker, null>) {
    return (
      <button type="button" className="picker-field picker-field-compact operation-filter-button" onClick={() => setReportFilterPicker(picker)}>
        <div className="picker-field-content">
          <span className="operation-filter-button-label">{label}</span>
          <strong>{value}</strong>
        </div>
        <ChevronDown size={16} />
      </button>
    )
  }

  function resetReleveFilters() {
    setReleveAccountId('')
    setReleveStart(todayIso())
    setReleveEnd(todayIso())
    setReleveRecettePage(1)
    setReleveDepensePage(1)
  }

  function resetResumeFilters() {
    setResumeDate(todayIso())
    setResumeType('')
    setResumeAccounts([])
  }

  function resetDepenseFilters() {
    setDepenseStart(todayIso())
    setDepenseEnd(todayIso())
    setDepensePeriod('')
    setDepenseBeneficiaire('')
    setDepenseCategories([])
    setDepenseSousCategories([])
    setDepenseOpenCategoryNames([])
  }

  function resetRemunerationFilters() {
    setRemStart(todayIso())
    setRemEnd(todayIso())
    setRemPeriod('')
    setRemTitulaire('')
    setRemTypes([])
    setRemAccounts([])
  }

  function resetPlusMoinsFilters() {
    setPlusStart(todayIso())
    setPlusEnd(todayIso())
    setPlusPeriod('')
    setPlusTitulaire('')
    setPlusTypes([])
    setPlusAccounts([])
  }

  function resetBilanFilters() {
    setBilanStart(todayIso())
    setBilanEnd(todayIso())
    setBilanPeriod('')
    setBilanTitulaire('')
    setBilanTypes([])
    setBilanAccounts([])
  }

  function changeRelevePageSize(value: string) {
    const nextSize = Number.parseInt(value, 10)

    if (!RELEVE_PAGE_SIZE_OPTIONS.includes(nextSize)) {
      return
    }

    setRelevePageSize(nextSize)
    setReleveRecettePage(1)
    setReleveDepensePage(1)
  }

  function renderRelevePaginationControls(type: 'recette' | 'depense', position: 'top' | 'bottom') {
    if (!releve) {
      return null
    }

    const isRecette = type === 'recette'
    const totalCount = isRecette ? releve.totalOperationsRecette ?? releve.operationsRecette.length : releve.totalOperationsDepense ?? releve.operationsDepense.length
    const currentPage = isRecette ? releveRecettePage : releveDepensePage
    const totalPages = isRecette ? releve.totalPagesOperationsRecette ?? (totalCount ? Math.ceil(totalCount / relevePageSize) : 0) : releve.totalPagesOperationsDepense ?? (totalCount ? Math.ceil(totalCount / relevePageSize) : 0)
    const firstVisible = totalCount ? (currentPage - 1) * relevePageSize + 1 : 0
    const lastVisible = totalCount ? Math.min(currentPage * relevePageSize, totalCount) : 0
    const pageLabel = totalCount ? `${currentPage}/${Math.max(totalPages, 1)}` : '0/0'
    const changePage = isRecette ? setReleveRecettePage : setReleveDepensePage

    return (
      <div className={cx('catalog-list-controls', 'report-pagination-controls', position === 'bottom' && 'bottom')} aria-label={`Pagination des ${isRecette ? 'recettes' : 'depenses'} ${position === 'bottom' ? 'bas' : 'haut'}`}>
        <div className="catalog-list-count">
          <strong>{totalCount ? `${firstVisible}-${lastVisible}` : '0'}</strong>
          <span>{`sur ${totalCount}`}</span>
        </div>

        <label className="catalog-page-size">
          <span>Afficher</span>
          <select value={relevePageSize} onChange={(event) => changeRelevePageSize(event.target.value)} aria-label="Nombre d'operations affichees dans le releve">
            {RELEVE_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="catalog-page-buttons">
          <button type="button" disabled={!totalCount || currentPage <= 1} onClick={() => changePage(Math.max(1, currentPage - 1))} aria-label="Page precedente">
            <ChevronLeft size={15} />
          </button>
          <span>{pageLabel}</span>
          <button type="button" disabled={!totalCount || currentPage >= Math.max(totalPages, 1)} onClick={() => changePage(Math.min(Math.max(totalPages, 1), currentPage + 1))} aria-label="Page suivante">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    )
  }

  const releveFilterControls = (
    <Surface className="catalog-panel releve-filter-panel">
      <div className="operation-filter-stack">
        <div className="operation-filter-row">
          {renderReportFilterButton('Compte', selectedReleveAccount?.identifiant ?? 'Choisir', 'releve-account')}
          {renderReportFilterButton('Date', dateRangeFilterLabel(releveStart, releveEnd), 'releve-date')}
          <Button type="button" tone="ghost" onClick={resetReleveFilters}>
            Reinitialiser
          </Button>
        </div>
      </div>
    </Surface>
  )

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
          {!releve ? (
            <>
              {releveFilterControls}
              <EmptyState title="Choisis un compte" description="Le releve apparait des qu un compte interne et une plage valide sont choisis." />
            </>
          ) : (
            <>
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

              {releveFilterControls}

              <div className="stat-grid releve-stat-grid">
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Solde debut</span>
                  <strong>{formatCurrency(releve.montantSoldeDebutReleveEnEuros)}</strong>
                  <p>{describePeriod({ key: '', label: '', start: releve.dateDebutReleve, end: releve.dateDebutReleve })}</p>
                </Surface>
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Recettes</span>
                  <strong>{formatCurrency(releve.montantTotalOperationsRecetteEnEuros)}</strong>
                  <p>{releve.totalOperationsRecette ?? releve.operationsRecette.length} operation(s)</p>
                </Surface>
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Depenses</span>
                  <strong>{formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}</strong>
                  <p>{releve.totalOperationsDepense ?? releve.operationsDepense.length} operation(s)</p>
                </Surface>
                <Surface className="stat-card stat-card-compact">
                  <span className="eyebrow">Solde fin</span>
                  <strong>{formatCurrency(releve.montantSoldeFinReleveEnEuros)}</strong>
                  <p>Ecart {formatCurrency(releve.montantEcartEnEuros)}</p>
                </Surface>
              </div>

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
                        <span>{releve.totalOperationsRecette ?? releve.operationsRecette.length} operation(s)</span>
                      </div>
                    {!releveOperationsRecette.length ? (
                      <EmptyState title="Aucune recette" description="Aucun mouvement sur cette plage." />
                    ) : (
                      <>
                        {renderRelevePaginationControls('recette', 'top')}
                        <div className="report-hover-list-grid dense">
                          {releveOperationsRecette.map((row) => (
                            <div key={`releve-r-${row.numero}`} className="report-hover-wrap">
                              <div className="report-line-card">
                                <div className="releve-line-text">
                                  <strong>{row.libelle ?? row.numero}</strong>
                                  <span>
                                    {formatDate(row.dateComptabilisation)} · {row.identifiantAutreCompte}
                                  </span>
                                </div>
                                <Badge tone="success">{formatCurrency(row.montantEnEuros)}</Badge>
                              </div>
                              <HoverDetailsCard
                                title={row.libelle ?? 'Operation'}
                                subtitle={`${formatDate(row.dateComptabilisation)} · ${row.codeTypeOperation}`}
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
                        {renderRelevePaginationControls('recette', 'bottom')}
                      </>
                    )}
                    </div>
                  ) : null}

                  {releveMode !== 'recettes' ? (
                    <div className="releve-flow-column">
                      <div className="releve-flow-meta">
                        <Badge>{formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}</Badge>
                        <span>{releve.totalOperationsDepense ?? releve.operationsDepense.length} operation(s)</span>
                      </div>
                    {!releveOperationsDepense.length ? (
                      <EmptyState title="Aucune depense" description="Aucun mouvement sur cette plage." />
                    ) : (
                      <>
                        {renderRelevePaginationControls('depense', 'top')}
                        <div className="report-hover-list-grid dense">
                          {releveOperationsDepense.map((row) => (
                            <div key={`releve-d-${row.numero}`} className="report-hover-wrap">
                              <div className="report-line-card">
                                <div className="releve-line-text">
                                  <strong>{row.libelle ?? row.numero}</strong>
                                  <span>
                                    {formatDate(row.dateComptabilisation)} · {row.identifiantAutreCompte}
                                  </span>
                                </div>
                                <Badge>{formatCurrency(row.montantEnEuros)}</Badge>
                              </div>
                              <HoverDetailsCard
                                title={row.libelle ?? 'Operation'}
                                subtitle={`${formatDate(row.dateComptabilisation)} · ${row.codeTypeOperation}`}
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
                        {renderRelevePaginationControls('depense', 'bottom')}
                      </>
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
          <Surface className="catalog-panel">
            <div className="operation-filter-stack">
              <div className="operation-filter-row">
                {renderReportFilterButton('Date', resumeDate || 'Toutes', 'resume-date')}
                {renderReportFilterButton('Type', resumeType || 'Tous', 'resume-type')}
                {renderReportFilterButton(
                  'Compte',
                  compactFilterLabel(selectedResumeAccountItems.map((account) => account.identifiant), 'Tous'),
                  'resume-account',
                )}
                <Button type="button" tone="ghost" onClick={resetResumeFilters}>
                  Reinitialiser
                </Button>
              </div>
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
          <Surface className="catalog-panel">
            <div className="operation-filter-stack">
              <div className="operation-filter-row">
                {renderReportFilterButton('Date', dateRangeFilterLabel(depenseStart, depenseEnd), 'depense-date')}
                {renderReportFilterButton('Periode', periodFilterLabel(depensePeriod), 'depense-period')}
                {renderReportFilterButton('Beneficiaire', depenseBeneficiaire || 'Tous', 'depense-beneficiary')}
                {renderReportFilterButton('Categorie', compactFilterLabel(depenseCategories, 'Toutes'), 'depense-category')}
                {renderReportFilterButton('Sous-categorie', compactFilterLabel(depenseSousCategories, 'Toutes'), 'depense-subcategory')}
                <Button type="button" tone="ghost" onClick={resetDepenseFilters}>
                  Reinitialiser
                </Button>
              </div>
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

      {tab === 'plusmoins' ? (
        <div className="page-stack">
          <Surface className="catalog-panel">
            <div className="operation-filter-stack">
              <div className="operation-filter-row">
                {renderReportFilterButton('Date', dateRangeFilterLabel(plusStart, plusEnd), 'plus-date')}
                {renderReportFilterButton('Periode', periodFilterLabel(plusPeriod), 'plus-period')}
                {renderReportFilterButton('Titulaire', plusTitulaire || 'Tous', 'plus-titulaire')}
                {renderReportFilterButton('Type', compactFilterLabel(plusTypes, 'Tous'), 'plus-type')}
                {renderReportFilterButton(
                  'Compte',
                  compactFilterLabel(selectedPlusAccountItems.map((account) => account.identifiant), 'Tous'),
                  'plus-account',
                )}
                <Button type="button" tone="ghost" onClick={resetPlusMoinsFilters}>
                  Reinitialiser
                </Button>
              </div>
            </div>
          </Surface>

          {!plusMoinsReport || !plusMoinsReport.groups.length ? (
            <EmptyState title="Aucune plus/moins-value" description="Ajuste les filtres ou la plage." />
          ) : (
            <>
              <Surface className="data-panel report-panel">
                <SectionHeader title="Totaux" />
                <InlinePeriodTotals
                  items={plusMoinsReport.totals.map((period) => ({
                    label: period.label,
                    summary: `PMV ${formatCurrency(period.montantPlusMoinsValueNetteEnEuros)} · Taux ${rateLabel(period.tauxPlusMoinsValueNette)} · Frais ${formatCurrency(period.montantFraisEnEuros)}`,
                  }))}
                />
              </Surface>

              {plusMoinsReport.groups.map((group) => (
                <CollapsibleReportSection
                  key={group.typeFonctionnement}
                  title={group.typeFonctionnement}
                  aside={<Badge>{formatCurrency(sumPlusMoinsValue(group.periods))}</Badge>}
                  open={isSectionOpen(plusSections, group.typeFonctionnement)}
                  onToggle={() => setPlusSections((current) => toggleSectionState(current, group.typeFonctionnement))}
                >
                  <div className="table-wrapper report-table-soft">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Compte</th>
                          {plusMoinsReport.periods.map((period) => (
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
                                {formatCurrency(period.montantPlusMoinsValueNetteEnEuros)}
                                <div className="cell-subline">Taux {rateLabel(period.tauxPlusMoinsValueNette)}</div>
                                <div className="cell-subline">Ops {formatCurrency(period.montantOperationsEnEuros)}</div>
                                <div className="cell-subline">Frais {formatCurrency(period.montantFraisEnEuros)}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          {group.periods.map((period) => (
                            <td key={`${group.typeFonctionnement}-${period.start}`}>
                              {formatCurrency(period.montantPlusMoinsValueNetteEnEuros)}
                              <div className="cell-subline">Taux {rateLabel(period.tauxPlusMoinsValueNette)}</div>
                            </td>
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

      {tab === 'remunerations' ? (
        <div className="page-stack">
          <Surface className="catalog-panel">
            <div className="operation-filter-stack">
              <div className="operation-filter-row">
                {renderReportFilterButton('Date', dateRangeFilterLabel(remStart, remEnd), 'rem-date')}
                {renderReportFilterButton('Periode', periodFilterLabel(remPeriod), 'rem-period')}
                {renderReportFilterButton('Titulaire', remTitulaire || 'Tous', 'rem-titulaire')}
                {renderReportFilterButton('Type', compactFilterLabel(remTypes, 'Tous'), 'rem-type')}
                {renderReportFilterButton(
                  'Compte',
                  compactFilterLabel(selectedRemAccountItems.map((account) => account.identifiant), 'Tous'),
                  'rem-account',
                )}
                <Button type="button" tone="ghost" onClick={resetRemunerationFilters}>
                  Reinitialiser
                </Button>
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
          <Surface className="catalog-panel">
            <div className="operation-filter-stack">
              <div className="operation-filter-row">
                {renderReportFilterButton('Date', dateRangeFilterLabel(bilanStart, bilanEnd), 'bilan-date')}
                {renderReportFilterButton('Periode', periodFilterLabel(bilanPeriod), 'bilan-period')}
                {renderReportFilterButton('Titulaire', bilanTitulaire || 'Tous', 'bilan-titulaire')}
                {renderReportFilterButton('Type', compactFilterLabel(bilanTypes, 'Tous'), 'bilan-type')}
                {renderReportFilterButton(
                  'Compte',
                  compactFilterLabel(selectedBilanAccountItems.map((account) => account.identifiant), 'Tous'),
                  'bilan-account',
                )}
                <Button type="button" tone="ghost" onClick={resetBilanFilters}>
                  Reinitialiser
                </Button>
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

      <OverlayPanel open={reportFilterPicker === 'releve-account'} onClose={() => setReportFilterPicker(null)} title="Compte du releve" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button
                type="button"
                tone="ghost"
                onClick={() => {
                  setReleveAccountId('')
                  setReleveRecettePage(1)
                  setReleveDepensePage(1)
                }}
              >
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={releveAccountSearch} onChange={(event) => setReleveAccountSearch(event.target.value)} placeholder="Chercher un compte..." />
            </label>
          </div>
          {!filteredReleveAccounts.length ? (
            <EmptyState title="Aucun compte" description="Aucun compte ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredReleveAccounts.map((account) => {
                const active = effectiveReleveAccountId === account.identifiant
                return (
                  <button
                    key={account.identifiant}
                    type="button"
                    className={cx('wizard-choice-card filter-choice-card', active && 'active')}
                    onClick={() => {
                      setReleveAccountId(account.identifiant)
                      setReleveRecettePage(1)
                      setReleveDepensePage(1)
                    }}
                  >
                    <div>
                      <strong>{account.identifiant}</strong>
                      <span>{account.libelle ?? account.codeTypeFonctionnement}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'releve-date'} onClose={() => setReportFilterPicker(null)} title="Dates" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setReleveStart(todayIso())
                setReleveEnd(todayIso())
                setReleveRecettePage(1)
                setReleveDepensePage(1)
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            <div className="range-filter-row">
              <FormField label="Debut">
                <input
                  type="date"
                  value={releveStart}
                  onChange={(event) => {
                    setReleveStart(event.target.value)
                    setReleveRecettePage(1)
                    setReleveDepensePage(1)
                  }}
                />
              </FormField>
              <FormField label="Fin">
                <input
                  type="date"
                  value={releveEnd}
                  onChange={(event) => {
                    setReleveEnd(event.target.value)
                    setReleveRecettePage(1)
                    setReleveDepensePage(1)
                  }}
                />
              </FormField>
            </div>
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'resume-date'} onClose={() => setReportFilterPicker(null)} title="Date" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setResumeDate(todayIso())}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            <div className="range-filter-row single">
              <FormField label="Date">
                <input type="date" value={resumeDate} onChange={(event) => setResumeDate(event.target.value)} />
              </FormField>
            </div>
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'resume-type'} onClose={() => setReportFilterPicker(null)} title="Type de compte" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setResumeType('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {internalAccountTypes.map((value) => {
              const active = resumeType === value
              return (
                <button key={value} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setResumeType(active ? '' : value)}>
                  <div>
                    <strong>{value}</strong>
                    <span>Type de compte interne</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'resume-account'} onClose={() => setReportFilterPicker(null)} title="Comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setResumeAccounts([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={resumeAccountSearch} onChange={(event) => setResumeAccountSearch(event.target.value)} placeholder="Chercher un compte..." />
            </label>
          </div>
          {!filteredResumeAccounts.length ? (
            <EmptyState title="Aucun compte" description="Aucun compte ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredResumeAccounts.map((account) => {
                const active = resumeAccounts.includes(account.identifiant)
                return (
                  <button key={account.identifiant} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setResumeAccounts((current) => toggleValue(current, account.identifiant))}>
                    <div>
                      <strong>{account.identifiant}</strong>
                      <span>{account.libelle ?? account.codeTypeFonctionnement}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'depense-date'} onClose={() => setReportFilterPicker(null)} title="Dates" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setDepenseStart(todayIso())
                setDepenseEnd(todayIso())
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            <div className="range-filter-row">
              <FormField label="Debut">
                <input type="date" value={depenseStart} onChange={(event) => setDepenseStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={depenseEnd} onChange={(event) => setDepenseEnd(event.target.value)} />
              </FormField>
            </div>
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'depense-period'} onClose={() => setReportFilterPicker(null)} title="Periode" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setDepensePeriod('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {periodOptions.map((option) => {
              const active = depensePeriod === option.value
              return (
                <button key={option.value || 'global'} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setDepensePeriod(option.value)}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.value || 'GLOBAL'}</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'depense-beneficiary'} onClose={() => setReportFilterPicker(null)} title="Beneficiaire" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setDepenseBeneficiaire('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={depenseBeneficiaireSearch} onChange={(event) => setDepenseBeneficiaireSearch(event.target.value)} placeholder="Chercher un beneficiaire..." />
            </label>
          </div>
          {!filteredDepenseBeneficiaires.length ? (
            <EmptyState title="Aucun beneficiaire" description="Aucun beneficiaire ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredDepenseBeneficiaires.map((item) => {
                const active = depenseBeneficiaire === item.nom
                return (
                  <button key={item.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setDepenseBeneficiaire(active ? '' : item.nom)}>
                    <div>
                      <strong>{item.nom}</strong>
                      <span>{item.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'depense-category'} onClose={() => setReportFilterPicker(null)} title="Categories" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setDepenseCategories([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={depenseCategorySearch} onChange={(event) => setDepenseCategorySearch(event.target.value)} placeholder="Chercher une categorie..." />
            </label>
          </div>
          {!filteredDepenseCategories.length ? (
            <EmptyState title="Aucune categorie" description="Aucune categorie ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredDepenseCategories.map((item) => {
                const active = depenseCategories.includes(item.nom)
                return (
                  <button key={item.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setDepenseCategories((current) => toggleValue(current, item.nom))}>
                    <div>
                      <strong>{item.nom}</strong>
                      <span>{item.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'depense-subcategory'} onClose={() => setReportFilterPicker(null)} title="Sous-categories" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setDepenseSousCategories([])
                setDepenseOpenCategoryNames([])
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={depenseSousCategoriesSearch} onChange={(event) => setDepenseSousCategoriesSearch(event.target.value)} placeholder="Chercher une sous-categorie..." />
            </label>
          </div>

          {deferredDepenseSousCategoriesSearch ? (
            !filteredDepenseSousCategories.length ? (
              <EmptyState title="Aucune sous-categorie" description="Aucun resultat." />
            ) : (
              <div className="wizard-choice-grid filter-choice-grid">
                {filteredDepenseSousCategories.map((item) => {
                  const selected = depenseSousCategories.includes(item.nom)
                  return (
                    <button key={item.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', selected && 'active')} onClick={() => setDepenseSousCategories((current) => toggleValue(current, item.nom))}>
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
                              <button key={item.nom} type="button" className={cx('sub-category-option', selected && 'selected')} onClick={() => setDepenseSousCategories((current) => toggleValue(current, item.nom))}>
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

      <OverlayPanel open={reportFilterPicker === 'plus-date'} onClose={() => setReportFilterPicker(null)} title="Dates" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setPlusStart(todayIso())
                setPlusEnd(todayIso())
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            <div className="range-filter-row">
              <FormField label="Debut">
                <input type="date" value={plusStart} onChange={(event) => setPlusStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={plusEnd} onChange={(event) => setPlusEnd(event.target.value)} />
              </FormField>
            </div>
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'plus-period'} onClose={() => setReportFilterPicker(null)} title="Periode" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setPlusPeriod('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {periodOptions.map((option) => {
              const active = plusPeriod === option.value
              return (
                <button key={option.value || 'global'} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setPlusPeriod(option.value)}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.value || 'GLOBAL'}</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'plus-titulaire'} onClose={() => setReportFilterPicker(null)} title="Titulaire" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setPlusTitulaire('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={plusTitulaireSearch} onChange={(event) => setPlusTitulaireSearch(event.target.value)} placeholder="Chercher un titulaire..." />
            </label>
          </div>
          {!filteredPlusTitulaires.length ? (
            <EmptyState title="Aucun titulaire" description="Aucun titulaire ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredPlusTitulaires.map((item) => {
                const active = plusTitulaire === item.nom
                return (
                  <button key={item.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setPlusTitulaire(active ? '' : item.nom)}>
                    <div>
                      <strong>{item.nom}</strong>
                      <span>{item.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'plus-type'} onClose={() => setReportFilterPicker(null)} title="Types de comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setPlusTypes([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {internalAccountTypes.map((value) => {
              const active = plusTypes.includes(value)
              return (
                <button key={value} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setPlusTypes((current) => toggleValue(current, value))}>
                  <div>
                    <strong>{value}</strong>
                    <span>Type de compte interne</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'plus-account'} onClose={() => setReportFilterPicker(null)} title="Comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setPlusAccounts([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={plusAccountSearch} onChange={(event) => setPlusAccountSearch(event.target.value)} placeholder="Chercher un compte..." />
            </label>
          </div>
          {!filteredPlusAccounts.length ? (
            <EmptyState title="Aucun compte" description="Aucun compte ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredPlusAccounts.map((account) => {
                const active = plusAccounts.includes(account.identifiant)
                return (
                  <button key={account.identifiant} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setPlusAccounts((current) => toggleValue(current, account.identifiant))}>
                    <div>
                      <strong>{account.identifiant}</strong>
                      <span>{account.libelle ?? account.codeTypeFonctionnement}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'rem-date'} onClose={() => setReportFilterPicker(null)} title="Dates" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setRemStart(todayIso())
                setRemEnd(todayIso())
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            <div className="range-filter-row">
              <FormField label="Debut">
                <input type="date" value={remStart} onChange={(event) => setRemStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={remEnd} onChange={(event) => setRemEnd(event.target.value)} />
              </FormField>
            </div>
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'rem-period'} onClose={() => setReportFilterPicker(null)} title="Periode" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setRemPeriod('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {periodOptions.map((option) => {
              const active = remPeriod === option.value
              return (
                <button key={option.value || 'global'} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setRemPeriod(option.value)}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.value || 'GLOBAL'}</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'rem-titulaire'} onClose={() => setReportFilterPicker(null)} title="Titulaire" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setRemTitulaire('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={remTitulaireSearch} onChange={(event) => setRemTitulaireSearch(event.target.value)} placeholder="Chercher un titulaire..." />
            </label>
          </div>
          {!filteredRemTitulaires.length ? (
            <EmptyState title="Aucun titulaire" description="Aucun titulaire ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredRemTitulaires.map((item) => {
                const active = remTitulaire === item.nom
                return (
                  <button key={item.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setRemTitulaire(active ? '' : item.nom)}>
                    <div>
                      <strong>{item.nom}</strong>
                      <span>{item.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'rem-type'} onClose={() => setReportFilterPicker(null)} title="Types de comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setRemTypes([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {internalAccountTypes.map((value) => {
              const active = remTypes.includes(value)
              return (
                <button key={value} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setRemTypes((current) => toggleValue(current, value))}>
                  <div>
                    <strong>{value}</strong>
                    <span>Type de compte interne</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'rem-account'} onClose={() => setReportFilterPicker(null)} title="Comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setRemAccounts([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={remAccountSearch} onChange={(event) => setRemAccountSearch(event.target.value)} placeholder="Chercher un compte..." />
            </label>
          </div>
          {!filteredRemAccounts.length ? (
            <EmptyState title="Aucun compte" description="Aucun compte ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredRemAccounts.map((account) => {
                const active = remAccounts.includes(account.identifiant)
                return (
                  <button key={account.identifiant} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setRemAccounts((current) => toggleValue(current, account.identifiant))}>
                    <div>
                      <strong>{account.identifiant}</strong>
                      <span>{account.libelle ?? account.codeTypeFonctionnement}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'bilan-date'} onClose={() => setReportFilterPicker(null)} title="Dates" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => {
                setBilanStart(todayIso())
                setBilanEnd(todayIso())
              }}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="range-filter-list">
            <div className="range-filter-row">
              <FormField label="Debut">
                <input type="date" value={bilanStart} onChange={(event) => setBilanStart(event.target.value)} />
              </FormField>
              <FormField label="Fin">
                <input type="date" value={bilanEnd} onChange={(event) => setBilanEnd(event.target.value)} />
              </FormField>
            </div>
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'bilan-period'} onClose={() => setReportFilterPicker(null)} title="Periode" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setBilanPeriod('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {periodOptions.map((option) => {
              const active = bilanPeriod === option.value
              return (
                <button key={option.value || 'global'} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setBilanPeriod(option.value)}>
                  <div>
                    <strong>{option.label}</strong>
                    <span>{option.value || 'GLOBAL'}</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'bilan-titulaire'} onClose={() => setReportFilterPicker(null)} title="Titulaire" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setBilanTitulaire('')}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={bilanTitulaireSearch} onChange={(event) => setBilanTitulaireSearch(event.target.value)} placeholder="Chercher un titulaire..." />
            </label>
          </div>
          {!filteredBilanTitulaires.length ? (
            <EmptyState title="Aucun titulaire" description="Aucun titulaire ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredBilanTitulaires.map((item) => {
                const active = bilanTitulaire === item.nom
                return (
                  <button key={item.nom} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setBilanTitulaire(active ? '' : item.nom)}>
                    <div>
                      <strong>{item.nom}</strong>
                      <span>{item.libelle ?? ' '}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'bilan-type'} onClose={() => setReportFilterPicker(null)} title="Types de comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setBilanTypes([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
          </div>
          <div className="wizard-choice-grid filter-choice-grid">
            {internalAccountTypes.map((value) => {
              const active = bilanTypes.includes(value)
              return (
                <button key={value} type="button" className={cx('wizard-choice-card filter-choice-card', active && 'active')} onClick={() => setBilanTypes((current) => toggleValue(current, value))}>
                  <div>
                    <strong>{value}</strong>
                    <span>Type de compte interne</span>
                  </div>
                  {active ? <Check size={16} /> : null}
                </button>
              )
            })}
          </div>
        </div>
      </OverlayPanel>

      <OverlayPanel open={reportFilterPicker === 'bilan-account'} onClose={() => setReportFilterPicker(null)} title="Comptes" width="regular" overlayClassName="overlay-top" className="filter-panel">
        <div className="filter-panel-shell">
          <div className="filter-panel-sticky">
            <div className="filter-panel-toolbar">
              <Button type="button" tone="ghost" onClick={() => setBilanAccounts([])}>
                Reinitialiser
              </Button>
              <Button type="button" onClick={() => setReportFilterPicker(null)}>
                Valider
              </Button>
            </div>
            <label className="search-field search-field-thin filter-panel-search">
              <Search size={14} />
              <input value={bilanAccountSearch} onChange={(event) => setBilanAccountSearch(event.target.value)} placeholder="Chercher un compte..." />
            </label>
          </div>
          {!filteredBilanAccounts.length ? (
            <EmptyState title="Aucun compte" description="Aucun compte ne correspond a la recherche." />
          ) : (
            <div className="wizard-choice-grid filter-choice-grid">
              {filteredBilanAccounts.map((account) => {
                const active = bilanAccounts.includes(account.identifiant)
                return (
                  <button key={account.identifiant} type="button" className={cx('wizard-choice-card filter-choice-card compact', active && 'active')} onClick={() => setBilanAccounts((current) => toggleValue(current, account.identifiant))}>
                    <div>
                      <strong>{account.identifiant}</strong>
                      <span>{account.libelle ?? account.codeTypeFonctionnement}</span>
                    </div>
                    {active ? <Check size={16} /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </OverlayPanel>
    </div>
  )
}
