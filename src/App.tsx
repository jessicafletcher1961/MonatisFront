import { BarChart3, Database, LayoutGrid, Menu, Moon, ReceiptText, SunMedium, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'

import { HelpModeOverlay } from './components/help-mode'
import { Button, LoadingState } from './components/ui'
import { cx } from './lib/cx'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const OperationsAccountsPage = lazy(() => import('./pages/OperationsAccountsPage').then((module) => ({ default: module.OperationsAccountsPage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))
const DataPage = lazy(() => import('./pages/DataPage').then((module) => ({ default: module.DataPage })))

const navigation = [
  { to: '/', label: 'Apercu', icon: LayoutGrid, end: true, help: "Ouvre le tableau de bord general avec les raccourcis et indicateurs principaux." },
  { to: '/operations', label: 'Operations et comptes', icon: ReceiptText, help: "Ouvre l'historique des operations et les vues de comptes internes ou externes." },
  { to: '/references', label: 'References', icon: Database, help: "Ouvre la gestion des banques, titulaires, beneficiaires, categories et sous-categories." },
  { to: '/donnees', label: 'Donnees back', icon: Database, help: "Ouvre les ecrans de couverture back : budgets, emprunts, evaluations, imports, typologies et admin." },
  { to: '/analyse', label: 'Analyse', icon: BarChart3, help: "Ouvre les rapports et analyses calcules a partir des donnees chargees." },
]

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const [helpMode, setHelpMode] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark'
    }

    const stored = window.localStorage.getItem('monatis-theme')
    if (stored === 'light' || stored === 'dark') {
      return stored
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  const location = useLocation()
  const closeHelpMode = useCallback(() => setHelpMode(false), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('monatis-theme', theme)
  }, [theme])

  useEffect(() => {
    void import('./pages/DashboardPage')
    void import('./pages/OperationsAccountsPage')
    void import('./pages/WorkspacePage')
    void import('./pages/ReportsPage')
    void import('./pages/DataPage')
  }, [])

  return (
    <div className={cx('app-shell', helpMode && 'help-mode-active')}>
      <header className="shell-header">
        <div className="shell-bar">
          <div className="shell-balance" aria-hidden="true" />

          <nav className={cx('shell-nav', navOpen && 'open')}>
            {navigation.map((item) => {
              const Icon = item.icon

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => cx('shell-nav-link', isActive && 'active')}
                  onClick={() => setNavOpen(false)}
                  data-help={item.help}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="shell-actions">
            <Button
              type="button"
              tone="ghost"
              className={cx('theme-button', 'help-mode-button', helpMode && 'active')}
              onClick={() => setHelpMode((current) => !current)}
              aria-label={helpMode ? "Quitter le mode aide" : "Activer le mode aide"}
              aria-pressed={helpMode}
              data-help="Active le mode aide. Quand il est actif, survolez les elements pour lire leur utilite ; recliquez ici ou faites un clic droit pour quitter."
            >
              <span className="help-button-mark" aria-hidden="true">
                ?
              </span>
            </Button>
            <Button
              tone="ghost"
              className="theme-button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
              data-help={theme === 'dark' ? "Bascule l'interface en mode clair." : "Bascule l'interface en mode sombre."}
            >
              {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
            </Button>
            <Button
              tone="ghost"
              className="menu-button"
              onClick={() => setNavOpen((current) => !current)}
              aria-label={navOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
              data-help={navOpen ? "Ferme le menu de navigation mobile." : "Ouvre le menu de navigation mobile."}
            >
              {navOpen ? <X size={16} /> : <Menu size={16} />}
            </Button>
          </div>
        </div>
      </header>

      {navOpen ? <button type="button" className="shell-scrim" aria-label="Fermer" onClick={() => setNavOpen(false)} /> : null}
      <HelpModeOverlay active={helpMode} onExit={closeHelpMode} />

      <div className="shell-main">
        <AnimatePresence mode="sync">
          <motion.div
            key={`${location.pathname}${location.search}`}
            className="route-stage"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            <Suspense fallback={<LoadingState label="Chargement..." />}>
              <Routes location={location}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/operations" element={<OperationsAccountsPage />} />
                <Route path="/references" element={<WorkspacePage />} />
                <Route path="/analyse" element={<ReportsPage />} />
                <Route path="/donnees" element={<DataPage />} />
                <Route path="/flux" element={<OperationsAccountsPage />} />
                <Route path="*" element={<DashboardPage />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
