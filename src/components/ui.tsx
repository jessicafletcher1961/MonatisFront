import { AlertTriangle, LoaderCircle, Sparkles, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cx } from '../lib/cx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: 'primary' | 'ghost' | 'danger' | 'soft'
  children: ReactNode
}

export function Button({ tone = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        'button',
        tone === 'primary' && 'button-primary',
        tone === 'ghost' && 'button-ghost',
        tone === 'danger' && 'button-danger',
        tone === 'soft' && 'button-soft',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Surface({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <section className={cx('surface', className)}>{children}</section>
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  )
}

export function SectionHeader({
  title,
  subtitle,
  aside,
}: {
  title: string
  subtitle?: string
  aside?: ReactNode
}) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {aside ? <div>{aside}</div> : null}
    </div>
  )
}

export function Badge({
  children,
  tone = 'default',
}: {
  children: ReactNode
  tone?: 'default' | 'success' | 'warning'
}) {
  return <span className={cx('badge', tone === 'success' && 'badge-success', tone === 'warning' && 'badge-warning')}>{children}</span>
}

export function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint?: string
}) {
  return (
    <Surface className="stat-card">
      <strong>{value}</strong>
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
    </Surface>
  )
}

export function SegmentedControl({
  items,
  value,
  onChange,
}: {
  items: Array<{ value: string; label: string; icon?: LucideIcon }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="segmented">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button key={item.value} type="button" className={cx('segmented-option', value === item.value && 'active')} onClick={() => onChange(item.value)}>
            {Icon ? <Icon size={15} /> : null}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Surface className="empty-state">
      <div className="empty-icon">
        <Sparkles size={18} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div>{action}</div> : null}
    </Surface>
  )
}

export function LoadingState({ label = 'Chargement en cours...' }: { label?: string }) {
  return (
    <Surface className="loading-state">
      <LoaderCircle className="spin" size={18} />
      <span>{label}</span>
    </Surface>
  )
}

export function ErrorState({
  title = 'Impossible de charger les donnees.',
  message,
}: {
  title?: string
  message: string
}) {
  return (
    <Surface className="error-state">
      <div className="empty-icon warning">
        <AlertTriangle size={18} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
    </Surface>
  )
}

export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="form-field">
      <span className="form-field-label">{label}</span>
      {children}
      {hint ? <small className="form-field-hint">{hint}</small> : null}
      {error ? <small className="form-field-error">{error}</small> : null}
    </label>
  )
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="filter-bar">{children}</div>
}

export function DataPanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <Surface className="data-panel">
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </Surface>
  )
}
