import { useQuery } from '@tanstack/react-query'
import { BarChart3, Landmark, ListFilter, PiggyBank, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge, EmptyState, ErrorState, FilterBar, FormField, LoadingState, PageHeader, SectionHeader, Surface } from '../components/ui'
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
import { formatCurrency, formatDate, todayIso, type MonatisPeriodCode } from '../lib/format'

type ReportTab = 'releve' | 'resumes' | 'depense' | 'remunerations' | 'bilan'
type PeriodSelectValue = Exclude<MonatisPeriodCode, null | undefined>

const reportTabs: Array<{ value: ReportTab; label: string; icon: typeof Landmark }> = [
  { value: 'releve', label: 'Releve', icon: Landmark },
  { value: 'resumes', label: 'Resumes', icon: Wallet },
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

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('releve')

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
    categoriesQuery.isLoading ||
    sousCategoriesQuery.isLoading ||
    beneficiairesQuery.isLoading ||
    titulairesQuery.isLoading

  const error =
    internalAccountsQuery.error ||
    externalAccountsQuery.error ||
    technicalAccountsQuery.error ||
    operationsQuery.error ||
    categoriesQuery.error ||
    sousCategoriesQuery.error ||
    beneficiairesQuery.error ||
    titulairesQuery.error

  const selectedReleveAccount = useMemo(
    () => (internalAccountsQuery.data ?? []).find((account) => account.identifiant === releveAccountId) ?? null,
    [internalAccountsQuery.data, releveAccountId],
  )

  const accountLookup = useMemo(() => {
    if (!internalAccountsQuery.data || !externalAccountsQuery.data || !technicalAccountsQuery.data) {
      return null
    }

    return buildAccountLookup(internalAccountsQuery.data, externalAccountsQuery.data, technicalAccountsQuery.data)
  }, [externalAccountsQuery.data, internalAccountsQuery.data, technicalAccountsQuery.data])

  const releve = useMemo(() => {
    if (!selectedReleveAccount || !operationsQuery.data || !accountLookup) {
      return null
    }

    return buildReleveCompte(selectedReleveAccount, operationsQuery.data, accountLookup, releveStart, releveEnd)
  }, [accountLookup, operationsQuery.data, releveEnd, releveStart, selectedReleveAccount])

  const resumes = useMemo(() => {
    if (!internalAccountsQuery.data || !operationsQuery.data) {
      return []
    }

    return buildResumesComptes(
      internalAccountsQuery.data,
      operationsQuery.data,
      resumeDate,
      resumeType ? [resumeType] : undefined,
      resumeAccounts.length ? resumeAccounts : undefined,
    )
  }, [internalAccountsQuery.data, operationsQuery.data, resumeAccounts, resumeDate, resumeType])

  const depenseReport = useMemo(() => {
    if (!operationsQuery.data || !internalAccountsQuery.data || !categoriesQuery.data || !sousCategoriesQuery.data) {
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

  const remunerationReport = useMemo(() => {
    if (!operationsQuery.data || !internalAccountsQuery.data) {
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
    if (!operationsQuery.data || !internalAccountsQuery.data || !technicalAccountsQuery.data) {
      return null
    }

    return buildBilanPatrimoineReport({
      operations: operationsQuery.data,
      internalAccounts: internalAccountsQuery.data,
      technicalAccounts: technicalAccountsQuery.data,
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
    internalAccountsQuery.data,
    operationsQuery.data,
    technicalAccountsQuery.data,
  ])

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Analyse"
        title="Rapports"
        subtitle="Vues locales."
        actions={<Badge tone="warning">Local</Badge>}
      />

      {loading ? <LoadingState label="Preparation des rapports..." /> : null}
      {error ? <ErrorState message={apiErrorMessage(error)} /> : null}

      <FilterBar>
        <div className="tab-bar">
          {reportTabs.map(({ value, label, icon: Icon }) => {
            return (
              <button key={value} className={`tab-button ${tab === value ? 'active' : ''}`} onClick={() => setTab(value)}>
                <Icon size={16} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </FilterBar>

      {tab === 'releve' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <SectionHeader title="Filtre du releve" subtitle="Version V1 centree sur les comptes internes." />
            <div className="form-grid three-columns">
              <FormField label="Compte">
                <select value={releveAccountId} onChange={(event) => setReleveAccountId(event.target.value)}>
                  <option value="">Choisir un compte interne</option>
                  {(internalAccountsQuery.data ?? []).map((account) => (
                    <option key={account.identifiant} value={account.identifiant}>
                      {account.identifiant}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Date debut">
                <input type="date" value={releveStart} onChange={(event) => setReleveStart(event.target.value)} />
              </FormField>
              <FormField label="Date fin">
                <input type="date" value={releveEnd} onChange={(event) => setReleveEnd(event.target.value)} />
              </FormField>
            </div>
          </Surface>

          {!releve ? (
            <EmptyState title="Choisis un compte interne" description="Le releve se genere des qu un compte est selectionne." />
          ) : (
            <>
              <div className="stat-grid">
                <Surface className="stat-card">
                  <span className="eyebrow">Solde debut</span>
                  <strong>{formatCurrency(releve.montantSoldeDebutReleveEnEuros)}</strong>
                  <p>{describePeriod({ key: '', label: '', start: releve.dateDebutReleve, end: releve.dateDebutReleve })}</p>
                </Surface>
                <Surface className="stat-card">
                  <span className="eyebrow">Total recettes</span>
                  <strong>{formatCurrency(releve.montantTotalOperationsRecetteEnEuros)}</strong>
                  <p>{releve.operationsRecette.length} ligne(s)</p>
                </Surface>
                <Surface className="stat-card">
                  <span className="eyebrow">Total depenses</span>
                  <strong>{formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}</strong>
                  <p>{releve.operationsDepense.length} ligne(s)</p>
                </Surface>
                <Surface className="stat-card">
                  <span className="eyebrow">Solde fin</span>
                  <strong>{formatCurrency(releve.montantSoldeFinReleveEnEuros)}</strong>
                  <p>Ecart : {formatCurrency(releve.montantEcartEnEuros)}</p>
                </Surface>
              </div>

              <Surface className="data-panel">
                <SectionHeader title={releve.enteteCompte.identifiant} subtitle={releve.enteteCompte.libelle ?? 'Sans libelle'} />
                <div className="pill-list">
                  <Badge>{releve.enteteCompte.typeFonctionnement ?? 'INTERNE'}</Badge>
                  {releve.enteteCompte.banque ? <Badge>{releve.enteteCompte.banque}</Badge> : null}
                  {(releve.enteteCompte.titulaires ?? []).map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </div>
              </Surface>

              <div className="card-grid two-columns">
                <Surface className="data-panel">
                  <SectionHeader title="Recettes" subtitle="Operations qui augmentent le solde du compte." />
                  {!releve.operationsRecette.length ? (
                    <EmptyState title="Aucune recette" description="Aucun mouvement de recette sur la plage demandee." />
                  ) : (
                    <div className="stacked-cards">
                      {releve.operationsRecette.map((row) => (
                        <div key={row.numero} className="mini-card">
                          <div>
                            <strong>{row.libelle ?? row.numero}</strong>
                            <p>
                              {formatDate(row.dateValeur)} · {row.identifiantAutreCompte}
                            </p>
                          </div>
                          <Badge tone="success">{formatCurrency(row.montantEnEuros)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>

                <Surface className="data-panel">
                  <SectionHeader title="Depenses" subtitle="Operations qui diminuent le solde du compte." />
                  {!releve.operationsDepense.length ? (
                    <EmptyState title="Aucune depense" description="Aucun mouvement de depense sur la plage demandee." />
                  ) : (
                    <div className="stacked-cards">
                      {releve.operationsDepense.map((row) => (
                        <div key={row.numero} className="mini-card">
                          <div>
                            <strong>{row.libelle ?? row.numero}</strong>
                            <p>
                              {formatDate(row.dateValeur)} · {row.identifiantAutreCompte}
                            </p>
                          </div>
                          <Badge>{formatCurrency(row.montantEnEuros)}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'resumes' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <SectionHeader title="Filtre des resumes" subtitle="Selection multiple de comptes et filtre de type optionnel." />
            <div className="form-grid three-columns">
              <FormField label="Date de solde">
                <input type="date" value={resumeDate} onChange={(event) => setResumeDate(event.target.value)} />
              </FormField>
              <FormField label="Type de fonctionnement">
                <select value={resumeType} onChange={(event) => setResumeType(event.target.value)}>
                  <option value="">Tous les types</option>
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
                  <label key={account.identifiant} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => setResumeAccounts((current) => toggleValue(current, account.identifiant))} />
                    <span>{account.identifiant}</span>
                  </label>
                )
              })}
            </div>
          </Surface>

          {!resumes.length ? (
            <EmptyState title="Aucun resume disponible" description="Ajuste les filtres ou cree des comptes internes pour alimenter cette vue." />
          ) : (
            <Surface className="data-panel">
              <SectionHeader title="Resumes de comptes" subtitle={`${resumes.length} compte(s) analyses pour la date ${formatDate(resumeDate)}.`} />
              <div className="table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Compte</th>
                      <th>Type</th>
                      <th>Banque</th>
                      <th>Titulaires</th>
                      <th>Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumes.map((row) => (
                      <tr key={row.identifiant}>
                        <td>{row.identifiant}</td>
                        <td>{row.typeFonctionnement}</td>
                        <td>{row.banque ?? 'Aucune'}</td>
                        <td>{row.titulaires.join(', ') || 'Aucun'}</td>
                        <td>{formatCurrency(row.montantSoldeEnEuros)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'depense' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <SectionHeader title="Filtres depenses / recettes" subtitle="Analyse par categorie, sous-categorie et periode." />
            <div className="form-grid three-columns">
              <FormField label="Date debut">
                <input type="date" value={depenseStart} onChange={(event) => setDepenseStart(event.target.value)} />
              </FormField>
              <FormField label="Date fin">
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
                  <option value="">Tous les beneficiaires</option>
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
                    <label key={item.nom} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setDepenseCategories((current) => toggleValue(current, item.nom))} />
                      <span>{item.nom}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="form-field">
              <span className="form-field-label">Sous-categories</span>
              <div className="checkbox-grid">
                {(sousCategoriesQuery.data ?? []).map((item) => {
                  const checked = depenseSousCategories.includes(item.nom)
                  return (
                    <label key={item.nom} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setDepenseSousCategories((current) => toggleValue(current, item.nom))} />
                      <span>{item.nom}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </Surface>

          {!depenseReport || !depenseReport.categories.length ? (
            <EmptyState title="Aucune donnee sur la plage choisie" description="Ajuste les filtres ou enrichis les operations recuperees depuis le back." />
          ) : (
            <Surface className="data-panel">
              <SectionHeader title="Etat depenses / recettes" subtitle={`${depenseReport.categories.length} categorie(s) visibles.`} />
              <div className="page-stack">
                {depenseReport.categories.map((category) => (
                  <Surface key={category.categorie?.nom ?? 'none'} className="nested-panel">
                    <SectionHeader
                      title={category.categorie?.nom ?? 'Sans categorie'}
                      subtitle={category.categorie?.libelle ?? 'Categorie implicite de secours'}
                    />
                    <div className="table-wrapper">
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
                                  {formatCurrency(period.solde)}
                                  <div className="cell-subline">
                                    R {formatCurrency(period.recette)} / D {formatCurrency(period.depense)}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>
                ))}
              </div>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'remunerations' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <SectionHeader title="Filtres remunerations / frais" subtitle="Vue par type de fonctionnement puis par compte." />
            <div className="form-grid three-columns">
              <FormField label="Date debut">
                <input type="date" value={remStart} onChange={(event) => setRemStart(event.target.value)} />
              </FormField>
              <FormField label="Date fin">
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
                  <option value="">Tous les titulaires</option>
                  {(titulairesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-field">
              <span className="form-field-label">Types de fonctionnement</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? [])
                  .map((item) => item.codeTypeFonctionnement)
                  .filter((value, index, array) => array.indexOf(value) === index)
                  .map((value) => {
                    const checked = remTypes.includes(value)
                    return (
                      <label key={value} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => setRemTypes((current) => toggleValue(current, value))} />
                        <span>{value}</span>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="form-field">
              <span className="form-field-label">Comptes internes</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? []).map((item) => {
                  const checked = remAccounts.includes(item.identifiant)
                  return (
                    <label key={item.identifiant} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setRemAccounts((current) => toggleValue(current, item.identifiant))} />
                      <span>{item.identifiant}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </Surface>

          {!remunerationReport || !remunerationReport.groups.length ? (
            <EmptyState title="Aucune remuneration ou frais sur cette plage" description="Elargis la plage ou verifie les types d operations presents dans MONATIS." />
          ) : (
            <Surface className="data-panel">
              <SectionHeader title="Etat remunerations / frais" subtitle={`${remunerationReport.groups.length} groupe(s) de comptes.`} />
              <div className="page-stack">
                {remunerationReport.groups.map((group) => (
                  <Surface key={group.typeFonctionnement} className="nested-panel">
                    <SectionHeader title={group.typeFonctionnement} subtitle={`${group.accounts.length} compte(s)`} />
                    <div className="table-wrapper">
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
                                  <div className="cell-subline">
                                    R {formatCurrency(period.recette)} / F {formatCurrency(period.depense)}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>
                ))}
              </div>
            </Surface>
          )}
        </div>
      ) : null}

      {tab === 'bilan' ? (
        <div className="page-stack">
          <Surface className="editor-panel">
            <SectionHeader title="Filtres bilan patrimoine" subtitle="Vue de synthese par type de fonctionnement et par compte." />
            <div className="form-grid three-columns">
              <FormField label="Date debut">
                <input type="date" value={bilanStart} onChange={(event) => setBilanStart(event.target.value)} />
              </FormField>
              <FormField label="Date fin">
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
                  <option value="">Tous les titulaires</option>
                  {(titulairesQuery.data ?? []).map((item) => (
                    <option key={item.nom} value={item.nom}>
                      {item.nom}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="form-field">
              <span className="form-field-label">Types de fonctionnement</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? [])
                  .map((item) => item.codeTypeFonctionnement)
                  .filter((value, index, array) => array.indexOf(value) === index)
                  .map((value) => {
                    const checked = bilanTypes.includes(value)
                    return (
                      <label key={value} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => setBilanTypes((current) => toggleValue(current, value))} />
                        <span>{value}</span>
                      </label>
                    )
                  })}
              </div>
            </div>

            <div className="form-field">
              <span className="form-field-label">Comptes internes</span>
              <div className="checkbox-grid">
                {(internalAccountsQuery.data ?? []).map((item) => {
                  const checked = bilanAccounts.includes(item.identifiant)
                  return (
                    <label key={item.identifiant} className={`toggle-chip ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => setBilanAccounts((current) => toggleValue(current, item.identifiant))} />
                      <span>{item.identifiant}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </Surface>

          {!bilanReport || !bilanReport.groups.length ? (
            <EmptyState title="Aucun bilan visible" description="Ajuste les filtres pour ouvrir une vue patrimoniale pertinente." />
          ) : (
            <Surface className="data-panel">
              <SectionHeader
                title="Bilan patrimoine"
                subtitle={`Solde initial cumule : ${formatCurrency(bilanReport.montantSoldeInitialEnEuros)}`}
              />
              <div className="page-stack">
                {bilanReport.groups.map((group) => (
                  <Surface key={group.typeFonctionnement} className="nested-panel">
                    <SectionHeader
                      title={group.typeFonctionnement}
                      subtitle={`Solde initial groupe : ${formatCurrency(group.montantSoldeInitialEnEuros)}`}
                    />
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
                                  <div className="cell-subline">
                                    Init {formatCurrency(period.montantSoldeInitialEnEuros)}
                                  </div>
                                  <div className="cell-subline">
                                    Tech {formatCurrency(period.soldeTotalTechniqueEnEuros)}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Surface>
                ))}
              </div>
            </Surface>
          )}
        </div>
      ) : null}
    </div>
  )
}
