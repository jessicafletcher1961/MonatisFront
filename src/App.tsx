import { BarChart3, Database, LayoutGrid, Menu, Moon, ReceiptText, SunMedium, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, lazy, useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'

import { Button, LoadingState } from './components/ui'
import { cx } from './lib/cx'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((module) => ({ default: module.WorkspacePage })))
const OperationsPage = lazy(() => import('./pages/OperationsPage').then((module) => ({ default: module.OperationsPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })))

const navigation = [
  { to: '/', label: 'Apercu', icon: LayoutGrid, end: true },
  { to: '/donnees', label: 'Donnees', icon: Database },
  { to: '/flux', label: 'Operations', icon: ReceiptText },
  { to: '/analyse', label: 'Analyse', icon: BarChart3 },
]

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('monatis-theme', theme)
  }, [theme])

  return (
    <div className="app-shell">
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
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              )
            })}
          </nav>

          <div className="shell-actions">
            <Button
              tone="ghost"
              className="theme-button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
            >
              {theme === 'dark' ? <SunMedium size={16} /> : <Moon size={16} />}
            </Button>
            <Button
              tone="ghost"
              className="menu-button"
              onClick={() => setNavOpen((current) => !current)}
              aria-label={navOpen ? 'Fermer la navigation' : 'Ouvrir la navigation'}
            >
              {navOpen ? <X size={16} /> : <Menu size={16} />}
            </Button>
          </div>
        </div>
      </header>

      {navOpen ? <button type="button" className="shell-scrim" aria-label="Fermer" onClick={() => setNavOpen(false)} /> : null}

      <div className="shell-main">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${location.pathname}${location.search}`}
            className="route-stage"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <Suspense fallback={<LoadingState label="Chargement..." />}>
              <Routes location={location}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/donnees" element={<WorkspacePage />} />
                <Route path="/flux" element={<OperationsPage />} />
                <Route path="/analyse" element={<ReportsPage />} />
                <Route path="*" element={<DashboardPage />} />
              </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
