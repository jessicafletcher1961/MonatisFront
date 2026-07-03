import {
  Blocks,
  ChartBar,
  ChartColumn,
  ChartColumnStacked,
  ChartLine,
  ChartNoAxesCombined,
  ChartPie,
  Donut,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts'

import { cx } from '../lib/cx'
import { compactNumber } from '../lib/format'
import { HorizontalScrollArea } from './horizontal-scroll-area'
import { Badge, Surface } from './ui'

type InsightTone = 'default' | 'success' | 'warning' | 'accent' | 'neutral'
type InsightChartVariant =
  | 'line'
  | 'area'
  | 'columns'
  | 'stack'
  | 'waterfall'
  | 'mosaic'
  | 'treemap'
  | 'donut'
  | 'pie'
  | 'bars'
  | 'bullet'
  | 'bubble'
  | 'heatmap'
  | 'flow'
  | 'funnel'

export interface InsightChartDatum {
  label: ReactNode
  value: number
  displayValue?: ReactNode
  hint?: ReactNode
  tone?: InsightTone
}

const chartVariantLabels: Record<InsightChartVariant, string> = {
  line: 'Courbe',
  area: 'Aire',
  columns: 'Colonnes',
  stack: 'Empile',
  waterfall: 'Pont',
  mosaic: 'Blocs',
  treemap: 'Treemap',
  donut: 'Anneau',
  pie: 'Camembert',
  bars: 'Barres',
  bullet: 'Jauge',
  bubble: 'Bulles',
  heatmap: 'Heatmap',
  flow: 'Flux',
  funnel: 'Entonnoir',
}

const chartVariantHelps: Record<InsightChartVariant, string> = {
  line: 'Courbe : suit une evolution dans le temps et met en avant la trajectoire generale.',
  area: 'Aire : suit une trajectoire et rend le poids cumule plus visible qu une simple courbe.',
  columns: 'Colonnes : compare plusieurs periodes ou valeurs cote a cote.',
  stack: 'Empile : montre le poids relatif de plusieurs segments dans un total.',
  waterfall: 'Pont : explique le passage d une valeur de depart vers une valeur finale.',
  mosaic: 'Blocs : compare rapidement des groupes avec une surface proportionnelle a leur poids.',
  treemap: 'Treemap : compare des groupes par surface lorsque la repartition compte plus que le detail chronologique.',
  donut: 'Anneau : montre une repartition avec une valeur centrale de reference.',
  pie: 'Camembert : visualise la part de chaque segment dans un total.',
  bars: 'Barres : compare des montants ou volumes par categorie avec une lecture horizontale.',
  bullet: 'Jauge : compare un realise avec une cible et signale vite le reste ou le depassement.',
  bubble: 'Bulles : compare plusieurs dimensions en meme temps, comme montant, taux et duree.',
  heatmap: 'Heatmap : repere les jours ou segments qui concentrent le plus de volume.',
  flow: 'Flux : montre comment un total se repartit entre plusieurs destinations.',
  funnel: 'Entonnoir : classe des etats de haut en bas pour visualiser une qualite ou un niveau de risque.',
}

const chartVariantIcons: Record<InsightChartVariant, LucideIcon> = {
  line: ChartLine,
  area: ChartNoAxesCombined,
  columns: ChartColumn,
  stack: ChartColumnStacked,
  waterfall: ChartNoAxesCombined,
  mosaic: Blocks,
  treemap: Blocks,
  donut: Donut,
  pie: ChartPie,
  bars: ChartBar,
  bullet: ChartBar,
  bubble: ChartNoAxesCombined,
  heatmap: Blocks,
  flow: ChartNoAxesCombined,
  funnel: ChartColumnStacked,
}

const chartPalette = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
  'var(--chart-11)',
  'var(--chart-12)',
]

const semanticChartColors: Record<Exclude<InsightTone, 'default'>, string> = {
  success: 'var(--chart-1)',
  warning: 'var(--chart-4)',
  accent: 'var(--chart-2)',
  neutral: 'var(--chart-6)',
}

const SCROLLABLE_CHART_MIN_WIDTH = 720
const SCROLLABLE_CHART_MAX_WIDTH = 18000
const SCROLLABLE_CHART_THRESHOLD = 10

function scrollableChartWidth(itemCount: number, pointWidth = 86): string {
  if (itemCount <= SCROLLABLE_CHART_THRESHOLD) {
    return '100%'
  }

  const width = Math.max(SCROLLABLE_CHART_MIN_WIDTH, itemCount * pointWidth)
  return `${Math.min(SCROLLABLE_CHART_MAX_WIDTH, width)}px`
}

function compactAxisLabel(value: unknown): string {
  const label = String(value ?? '')
  const periodMatch = label.match(/^\d{1,2}\s+([A-Za-zÀ-ÿ]{3,})\s+-\s+.*?(\d{4})$/)

  if (periodMatch) {
    return `${periodMatch[1]} ${periodMatch[2].slice(2)}`
  }

  if (label.length > 18) {
    return `${label.slice(0, 15)}...`
  }

  return label
}

interface ChartEntry extends InsightChartDatum {
  name: string
  rawValue: number
  chartValue: number
  color: string
}

export interface InsightBubbleDatum {
  label: ReactNode
  x: number
  y: number
  size: number
  displayX?: ReactNode
  displayY?: ReactNode
  displaySize?: ReactNode
  hint?: ReactNode
  tone?: InsightTone
}

interface BubbleEntry extends InsightBubbleDatum {
  name: string
  color: string
}

function plainLabel(label: ReactNode, fallback: string): string {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label)
  }

  return fallback
}

function labelHash(value: string): number {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7)
}

function normalizedLabel(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function semanticToneColor(tone: InsightTone = 'default', index = 0) {
  switch (tone) {
    case 'success':
      return semanticChartColors.success
    case 'warning':
      return semanticChartColors.warning
    case 'accent':
      return semanticChartColors.accent
    case 'neutral':
      return semanticChartColors.neutral
    default:
      return chartPalette[index % chartPalette.length]
  }
}

function fallbackChartColor(label: string, index: number, used: Set<string>) {
  const base = labelHash(label)

  for (let attempt = 0; attempt < 360; attempt += 1) {
    const hue = Math.round((base + (index + attempt) * 137.508) % 360)
    const color = `hsl(${hue} 72% 56%)`

    if (!used.has(color)) {
      return color
    }
  }

  return `hsl(${(base + index * 29) % 360} 72% 56%)`
}

function distinctChartColors(items: InsightChartDatum[]) {
  const used = new Set<string>()

  return items.map((item, index) => {
    const label = plainLabel(item.label, `Serie ${index + 1}`)
    const normalized = normalizedLabel(label)
    const preferred = normalized.includes('recette') || normalized.includes('entree') ? semanticChartColors.success : null
    const warning = normalized.includes('depense') || normalized.includes('sortie') || normalized.includes('frais') ? semanticChartColors.warning : null
    const toned = item.tone && item.tone !== 'default' ? semanticToneColor(item.tone, index) : null
    const semantic = preferred ?? warning ?? toned

    if (semantic && !used.has(semantic)) {
      used.add(semantic)
      return semantic
    }

    const start = labelHash(label) % chartPalette.length
    for (let offset = 0; offset < chartPalette.length; offset += 1) {
      const color = chartPalette[(start + offset) % chartPalette.length]
      if (!used.has(color)) {
        used.add(color)
        return color
      }
    }

    const fallback = fallbackChartColor(label, index, used)
    used.add(fallback)
    return fallback
  })
}

function ScrollableInsightFrame({
  children,
  frameClassName,
  itemCount,
  pointWidth,
}: {
  children: ReactNode
  frameClassName: string
  itemCount: number
  pointWidth?: number
}) {
  return (
    <HorizontalScrollArea className="insight-chart-scroll" aria-label="Graphique defilable horizontalement">
      <div className="insight-chart-scroll-inner" style={{ width: scrollableChartWidth(itemCount, pointWidth) }}>
        <div className={cx('insight-recharts-frame', frameClassName)}>{children}</div>
      </div>
    </HorizontalScrollArea>
  )
}

function buildChartEntries(items: InsightChartDatum[], absolute = false): ChartEntry[] {
  const colors = distinctChartColors(items)

  return items.map((item, index) => ({
    ...item,
    name: plainLabel(item.label, `Serie ${index + 1}`),
    rawValue: item.value,
    chartValue: absolute ? Math.abs(item.value) : item.value,
    color: colors[index],
  }))
}

function variantHelp(variant: InsightChartVariant, title: ReactNode, subtitle?: ReactNode) {
  const context = [plainLabel(title, ''), subtitle ? plainLabel(subtitle, '') : ''].filter(Boolean).join(' - ')
  return context ? `${chartVariantHelps[variant]} Cette vue concerne : ${context}.` : chartVariantHelps[variant]
}

function ChartTooltip({ active, payload, label }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="insight-recharts-tooltip">
      {label ? <strong>{label}</strong> : null}
      {payload.map((item, index) => {
        const entry = item.payload as Partial<ChartEntry> | undefined
        const displayValue = entry?.displayValue ?? item.value
        const name = entry?.name ?? item.name
        const color = entry?.color ?? item.color ?? chartPalette[index % chartPalette.length]

        return (
          <div key={`${String(name)}-${index}`}>
            <span style={{ background: color }} />
            <em>{name}</em>
            <b>{displayValue}</b>
          </div>
        )
      })}
    </div>
  )
}

function StackTooltip({
  active,
  payload,
  entries,
}: TooltipContentProps<TooltipValueType, string | number> & { entries: ChartEntry[] }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="insight-recharts-tooltip">
      {payload.map((item, index) => {
        const dataKey = typeof item.dataKey === 'string' ? item.dataKey : ''
        const entryIndex = Number(dataKey.replace('segment', ''))
        const entry = entries[Number.isFinite(entryIndex) ? entryIndex : index]

        if (!entry) {
          return null
        }

        return (
          <div key={entry.name}>
            <span style={{ background: entry.color }} />
            <em>{entry.name}</em>
            <b>{entry.displayValue ?? entry.rawValue}</b>
          </div>
        )
      })}
    </div>
  )
}

function BubbleTooltip({ active, payload }: TooltipContentProps<TooltipValueType, string | number>) {
  if (!active || !payload?.length) {
    return null
  }

  const entry = payload[0]?.payload as BubbleEntry | undefined
  if (!entry) {
    return null
  }

  return (
    <div className="insight-recharts-tooltip">
      <strong>{entry.name}</strong>
      <div>
        <span style={{ background: entry.color }} />
        <em>Montant</em>
        <b>{entry.displayY ?? entry.y}</b>
      </div>
      <div>
        <span style={{ background: entry.color }} />
        <em>Taux</em>
        <b>{entry.displayX ?? entry.x}</b>
      </div>
      <div>
        <span style={{ background: entry.color }} />
        <em>Taille</em>
        <b>{entry.displaySize ?? entry.size}</b>
      </div>
      {entry.hint ? (
        <div>
          <span style={{ background: entry.color }} />
          <em>Info</em>
          <b>{entry.hint}</b>
        </div>
      ) : null}
    </div>
  )
}

function isChartVariant(value: string | null, variants: InsightChartVariant[]): value is InsightChartVariant {
  return Boolean(value && variants.includes(value as InsightChartVariant))
}

function useStoredChartVariant(chartId: string | undefined, defaultVariant: InsightChartVariant, variants: InsightChartVariant[]) {
  const normalizedDefault = variants.includes(defaultVariant) ? defaultVariant : variants[0]
  const [variant, setVariant] = useState<InsightChartVariant>(() => {
    if (!chartId || typeof window === 'undefined') {
      return normalizedDefault
    }

    const stored = window.localStorage.getItem(`monatis-chart:${chartId}`)
    return isChartVariant(stored, variants) ? stored : normalizedDefault
  })
  const safeVariant = variants.includes(variant) ? variant : normalizedDefault

  useEffect(() => {
    if (!chartId || typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(`monatis-chart:${chartId}`, safeVariant)
  }, [chartId, safeVariant])

  return [safeVariant, setVariant] as const
}

export function InsightPanel({
  className,
  children,
  help,
}: {
  className?: string
  children: ReactNode
  help?: string
}) {
  return (
    <Surface className={cx('insight-panel', className)} data-help={help}>
      {children}
    </Surface>
  )
}

export function InsightHero({
  eyebrow,
  title,
  value,
  subtitle,
  icon: Icon,
  tags = [],
  tone = 'default',
}: {
  eyebrow: string
  title?: string
  value: ReactNode
  subtitle?: ReactNode
  icon?: LucideIcon
  tags?: Array<{ label: ReactNode; tone?: 'default' | 'success' | 'warning' }>
  tone?: InsightTone
}) {
  const hasSide = Boolean(subtitle) || tags.length > 0

  return (
    <div className={cx('insight-hero', `insight-hero-${tone}`)}>
      <div className="insight-hero-copy">
        <div className="insight-hero-label">
          {Icon ? (
            <span className="insight-hero-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
          ) : null}
          <span className="eyebrow">{eyebrow}</span>
        </div>
        {title ? <h2>{title}</h2> : null}
        <strong>{value}</strong>
      </div>
      {hasSide ? (
        <div className="insight-hero-side">
          {subtitle ? <p>{subtitle}</p> : null}
          {tags.length ? (
            <div className="insight-tags">
              {tags.map((tag, index) => (
                <Badge key={index} tone={tag.tone ?? 'default'}>
                  {tag.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function InsightMetricGrid({ children }: { children: ReactNode }) {
  return <div className="insight-metric-grid">{children}</div>
}

export function InsightMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  help,
}: {
  icon?: LucideIcon
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: InsightTone
  help?: string
}) {
  return (
    <div className={cx('insight-metric', `insight-metric-${tone}`)} data-help={help}>
      <div className="insight-metric-label">
        {Icon ? <Icon size={15} aria-hidden="true" /> : null}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  )
}

export function InsightChartCard({
  title,
  subtitle,
  eyebrow,
  variants,
  selectedVariant,
  onVariantChange,
  help,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  variants?: InsightChartVariant[]
  selectedVariant?: InsightChartVariant
  onVariantChange?: (variant: InsightChartVariant) => void
  help?: string
  children: ReactNode
}) {
  return (
    <div className={cx('insight-chart-card', variants && variants.length > 1 && 'with-switch')} data-help={help} aria-label={plainLabel(title, 'Graphique')}>
      {variants && variants.length > 1 && selectedVariant && onVariantChange ? (
        <div className="insight-chart-switch" data-help="Type de graphique : choisis la forme de lecture de cette visualisation. Le choix est conserve pour cet emplacement.">
          {variants.map((variant) => {
            const Icon = chartVariantIcons[variant]

            return (
              <button
                key={variant}
                type="button"
                className={cx(selectedVariant === variant && 'active')}
                onClick={() => onVariantChange(variant)}
                aria-label={chartVariantLabels[variant]}
                aria-pressed={selectedVariant === variant}
                title={chartVariantLabels[variant]}
                data-help={variantHelp(variant, title, subtitle ?? eyebrow)}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="visually-hidden">{chartVariantLabels[variant]}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="insight-chart-body">{children}</div>
    </div>
  )
}

function InsightCategoryBars({ items }: { items: InsightChartDatum[] }) {
  const visibleItems = buildChartEntries(
    items.filter((item) => Number.isFinite(item.value)),
    true,
  )

  return (
    <div className="insight-category-bars">
      {visibleItems.length ? (
        <div className="insight-recharts-frame bars">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleItems} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="var(--surface-border)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={116} tickLine={false} axisLine={false} tick={{ fill: 'var(--ink-soft)', fontSize: 12 }} />
              <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: 'rgba(148, 161, 184, 0.08)' }} />
              <Bar dataKey="chartValue" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                {visibleItems.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
                <LabelList dataKey="displayValue" position="right" className="insight-recharts-label" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </div>
  )
}

function InsightPieView({
  items,
  donut = false,
  centerValue,
  centerLabel,
}: {
  items: InsightChartDatum[]
  donut?: boolean
  centerValue?: ReactNode
  centerLabel?: ReactNode
}) {
  const chartItems = buildChartEntries(
    items.filter((item) => Number.isFinite(item.value)),
    true,
  )
  const visibleItems = chartItems.filter((item) => item.chartValue > 0)
  const emptyPieEntry: ChartEntry = {
    label: 'Aucune donnee',
    name: 'Aucune donnee',
    value: 0,
    rawValue: 0,
    chartValue: 1,
    color: 'rgba(148, 161, 184, 0.18)',
  }
  const hasCenterValue = centerValue !== undefined && centerValue !== null
  const hasCenterLabel = centerLabel !== undefined && centerLabel !== null

  return (
    <div className="insight-pie-layout">
      <div className={cx('insight-recharts-pie-wrap', donut && 'donut')}>
        <div className="insight-recharts-frame pie">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={(props) => <ChartTooltip {...props} />} />
              <Pie
                data={visibleItems.length ? visibleItems : [emptyPieEntry]}
                dataKey="chartValue"
                nameKey="name"
                innerRadius={donut ? '58%' : 0}
                outerRadius="86%"
                paddingAngle={visibleItems.length > 1 ? 2 : 0}
                isAnimationActive={false}
              >
                {(visibleItems.length ? visibleItems : [emptyPieEntry]).map((item) => (
                  <Cell key={item.name} fill={item.color} stroke="var(--surface-strong)" strokeWidth={2} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        {donut && (hasCenterValue || hasCenterLabel) ? (
          <div className="insight-donut-center">
            {hasCenterValue ? <strong>{centerValue}</strong> : null}
            {hasCenterLabel ? <span>{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="insight-pie-legend">
        {chartItems.map((item) => (
          <div key={item.name} className="insight-pie-item" style={{ '--chart-color': item.color } as CSSProperties}>
            <span />
            <strong>{item.label}</strong>
            <small>{item.displayValue ?? item.rawValue}</small>
          </div>
        ))}
      </div>
      {!donut && (hasCenterValue || hasCenterLabel) ? (
        <div className="insight-pie-caption">
          {hasCenterValue ? <strong>{centerValue}</strong> : null}
          {hasCenterLabel ? <span>{centerLabel}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

function InsightColumnChart({
  items,
  formatValue,
}: {
  items: Array<{ label: ReactNode; value: number }>
  formatValue: (value: number) => ReactNode
}) {
  const visibleItems = buildChartEntries(
    items
      .filter((item) => Number.isFinite(item.value))
      .map((item) => ({
        label: item.label,
        value: item.value,
        displayValue: formatValue(item.value),
      })),
  )
  const showLabels = visibleItems.length <= 12

  return (
    <div className="insight-column-chart">
      {visibleItems.length ? (
        <ScrollableInsightFrame frameClassName="columns" itemCount={visibleItems.length} pointWidth={82}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleItems} margin={{ top: 18, right: 8, bottom: 6, left: 8 }}>
              <CartesianGrid stroke="var(--surface-border)" vertical={false} />
              <XAxis
                dataKey="name"
                interval={0}
                minTickGap={6}
                tickFormatter={compactAxisLabel}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
              />
              <YAxis hide />
              <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ fill: 'rgba(148, 161, 184, 0.08)' }} />
              <Bar dataKey="chartValue" radius={[8, 8, 0, 0]} minPointSize={2} isAnimationActive={false}>
                {visibleItems.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
                {showLabels ? <LabelList dataKey="displayValue" position="top" className="insight-recharts-label" /> : null}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ScrollableInsightFrame>
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </div>
  )
}

function InsightMosaicView({ items }: { items: InsightChartDatum[] }) {
  const visibleItems = buildChartEntries(
    items.filter((item) => Number.isFinite(item.value)),
    true,
  )
  const maxValue = Math.max(1, ...visibleItems.map((item) => Math.abs(item.value)))

  return (
    <div className="insight-mosaic">
      {visibleItems.length ? (
        visibleItems.map((item) => {
          const grow = Math.max(1, Math.round((Math.abs(item.value) / maxValue) * 8))
          return (
            <div
              key={item.name}
              className="insight-mosaic-tile"
              style={{ '--chart-color': item.color, flexGrow: grow } as CSSProperties}
            >
              <span>{item.label}</span>
              <strong>{item.displayValue ?? item.value}</strong>
              {item.hint ? <small>{item.hint}</small> : null}
            </div>
          )
        })
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </div>
  )
}

function InsightFunnelView({ items }: { items: InsightChartDatum[] }) {
  const visibleItems = buildChartEntries(
    items.filter((item) => Number.isFinite(item.value)),
    true,
  )
  const maxValue = Math.max(1, ...visibleItems.map((item) => item.chartValue))

  return (
    <div className="insight-funnel">
      {visibleItems.length ? (
        visibleItems.map((item) => {
          const width = Math.max(34, Math.round((item.chartValue / maxValue) * 100))
          return (
            <div key={item.name} className="insight-funnel-row" style={{ '--chart-color': item.color, '--funnel-width': `${width}%` } as CSSProperties}>
              <div>
                <strong>{item.label}</strong>
                {item.hint ? <small>{item.hint}</small> : null}
              </div>
              <b>{item.displayValue ?? item.rawValue}</b>
            </div>
          )
        })
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </div>
  )
}

function InsightFlowView({ items }: { items: InsightChartDatum[] }) {
  const visibleItems = buildChartEntries(
    items.filter((item) => Number.isFinite(item.value)),
    true,
  )
  const total = visibleItems.reduce((sum, item) => sum + item.chartValue, 0)

  return (
    <div className="insight-flow">
      {visibleItems.length ? (
        <>
          <div className="insight-flow-source">
            <span>Total</span>
            <strong>{visibleItems.length} flux</strong>
          </div>
          <div className="insight-flow-lanes">
            {visibleItems.map((item) => {
              const width = total > 0 ? Math.max(12, Math.round((item.chartValue / total) * 100)) : 100 / visibleItems.length
              return (
                <div key={item.name} className="insight-flow-lane" style={{ '--chart-color': item.color, '--flow-width': `${width}%` } as CSSProperties}>
                  <span aria-hidden="true" />
                  <div>
                    <strong>{item.label}</strong>
                    {item.hint ? <small>{item.hint}</small> : null}
                  </div>
                  <b>{item.displayValue ?? item.rawValue}</b>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </div>
  )
}

function InsightHeatmapView({ items }: { items: InsightChartDatum[] }) {
  const visibleItems = buildChartEntries(
    items.filter((item) => Number.isFinite(item.value)),
    true,
  )
  const maxValue = Math.max(1, ...visibleItems.map((item) => item.chartValue))

  return (
    <div className="insight-heatmap">
      {visibleItems.length ? (
        visibleItems.map((item) => {
          const intensity = Math.round(Math.max(12, Math.min(100, (item.chartValue / maxValue) * 100)))
          return (
            <div
              key={item.name}
              className="insight-heatmap-cell"
              style={{ '--chart-color': item.color, '--heat-intensity': `${intensity}%` } as CSSProperties}
            >
              <span>{item.label}</span>
              <strong>{item.displayValue ?? item.rawValue}</strong>
              {item.hint ? <small>{item.hint}</small> : null}
            </div>
          )
        })
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </div>
  )
}

function buildBubbleEntries(points: InsightBubbleDatum[]): BubbleEntry[] {
  const colors = distinctChartColors(points.map((point) => ({ label: point.label, value: point.y, tone: point.tone })))

  return points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.size))
    .map((point, index) => ({
      ...point,
      name: plainLabel(point.label, `Point ${index + 1}`),
      color: colors[index],
    }))
}

export function InsightTrendChart({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['line', 'columns', 'pie'],
  items,
  formatValue,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  items: Array<{ label: ReactNode; value: number }>
  formatValue: (value: number) => ReactNode
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'line', variants)
  const pieItems = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        displayValue: formatValue(item.value),
        tone: item.value < 0 ? ('warning' as const) : undefined,
        hint: index === items.length - 1 ? 'dernier point' : undefined,
      })),
    [formatValue, items],
  )
  const lineItems = buildChartEntries(
    items
      .filter((item) => Number.isFinite(item.value))
      .map((item) => ({
        label: item.label,
        value: item.value,
        displayValue: formatValue(item.value),
      })),
  )
  const showPointMarkers = lineItems.length <= 14

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'columns' ? (
        <InsightColumnChart items={items} formatValue={formatValue} />
      ) : variant === 'pie' ? (
        <InsightPieView items={pieItems} />
      ) : variant === 'area' && lineItems.length > 1 ? (
        <>
          <ScrollableInsightFrame frameClassName="line" itemCount={lineItems.length} pointWidth={86}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineItems} margin={{ top: 12, right: 14, bottom: 6, left: 14 }}>
                <defs>
                  <linearGradient id={`insight-area-${chartId ?? 'default'}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-strong)" stopOpacity={0.46} />
                    <stop offset="95%" stopColor="var(--accent-strong)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--surface-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  minTickGap={6}
                  tickFormatter={compactAxisLabel}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ stroke: 'var(--surface-border)' }} />
                <Area
                  type="monotone"
                  dataKey="chartValue"
                  stroke="var(--accent-strong)"
                  strokeWidth={3}
                  fill={`url(#insight-area-${chartId ?? 'default'})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ScrollableInsightFrame>
          <div className="insight-trend-labels">
            <span>{lineItems[0]?.label}</span>
            <strong>{lineItems[lineItems.length - 1]?.displayValue}</strong>
            <span>{lineItems[lineItems.length - 1]?.label}</span>
          </div>
        </>
      ) : lineItems.length > 1 ? (
        <>
          <ScrollableInsightFrame frameClassName="line" itemCount={lineItems.length} pointWidth={86}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineItems} margin={{ top: 12, right: 14, bottom: 6, left: 14 }}>
                <CartesianGrid stroke="var(--surface-border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  minTickGap={6}
                  tickFormatter={compactAxisLabel}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={(props) => <ChartTooltip {...props} />} cursor={{ stroke: 'var(--surface-border)' }} />
                <Line
                  type="monotone"
                  dataKey="chartValue"
                  stroke="var(--accent-strong)"
                  strokeWidth={3}
                  dot={showPointMarkers ? { r: 4, fill: 'var(--surface-strong)', stroke: 'var(--accent-strong)', strokeWidth: 2 } : false}
                  activeDot={{ r: 5, fill: 'var(--accent-strong)', stroke: 'var(--surface-strong)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ScrollableInsightFrame>
          <div className="insight-trend-labels">
            <span>{lineItems[0]?.label}</span>
            <strong>{lineItems[lineItems.length - 1]?.displayValue}</strong>
            <span>{lineItems[lineItems.length - 1]?.label}</span>
          </div>
        </>
      ) : (
        <div className="insight-empty-chart">
          {lineItems.length ? (
            <>
              <span>{lineItems[0].label}</span>
              <strong>{lineItems[0].displayValue}</strong>
            </>
          ) : (
            'Aucune donnee a visualiser.'
          )}
        </div>
      )}
    </InsightChartCard>
  )
}

export function InsightStackedBar({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['stack', 'pie', 'bars'],
  segments,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  segments: InsightChartDatum[]
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'stack', variants)
  const visibleSegments = buildChartEntries(
    segments.filter((segment) => Number.isFinite(segment.value)),
    true,
  )
  const stackData = [
    visibleSegments.reduce<Record<string, string | number>>(
      (row, segment, index) => ({
        ...row,
        [`segment${index}`]: segment.chartValue,
      }),
      { name: 'Total' },
    ),
  ]

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'pie' ? (
        <InsightPieView items={segments} />
      ) : variant === 'bars' ? (
        <InsightCategoryBars items={segments} />
      ) : variant === 'flow' ? (
        <InsightFlowView items={segments} />
      ) : visibleSegments.length ? (
        <div className="insight-stack-visual">
          <div className="insight-recharts-frame stack">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackData} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip content={(props) => <StackTooltip {...props} entries={visibleSegments} />} cursor={{ fill: 'rgba(148, 161, 184, 0.08)' }} />
                {visibleSegments.map((segment, index) => (
                  <Bar
                    key={segment.name}
                    dataKey={`segment${index}`}
                    stackId="total"
                    name={segment.name}
                    fill={segment.color}
                    radius={index === 0 ? [8, 0, 0, 8] : index === visibleSegments.length - 1 ? [0, 8, 8, 0] : [0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="insight-stack-legend">
            {visibleSegments.map((segment) => (
              <div key={segment.name} className="insight-stack-item" style={{ '--chart-color': segment.color } as CSSProperties}>
                <span />
                <div>
                  <strong>{segment.label}</strong>
                  {segment.hint ? <small>{segment.hint}</small> : null}
                </div>
                <b>{segment.displayValue ?? segment.rawValue}</b>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </InsightChartCard>
  )
}

export function InsightWaterfall({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['waterfall', 'bars', 'pie'],
  steps,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  steps: InsightChartDatum[]
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'waterfall', variants)
  const visibleSteps = buildChartEntries(
    steps.filter((step) => Number.isFinite(step.value)),
    true,
  )

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'pie' ? (
        <InsightPieView items={steps} />
      ) : variant === 'bars' ? (
        <InsightCategoryBars items={steps} />
      ) : (
        <div className="insight-waterfall">
          {visibleSteps.map((step) => (
            <div key={step.name} className="insight-waterfall-step" style={{ '--chart-color': step.color } as CSSProperties}>
              <span className="insight-waterfall-node" aria-hidden="true" />
              <span>{step.label}</span>
              <strong>{step.displayValue ?? step.rawValue}</strong>
              {step.hint ? <small>{step.hint}</small> : null}
            </div>
          ))}
        </div>
      )}
    </InsightChartCard>
  )
}

export function InsightMosaicChart({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['treemap', 'pie', 'bars'],
  items,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  items: InsightChartDatum[]
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'treemap', variants)

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'pie' || variant === 'donut' ? (
        <InsightPieView items={items} donut={variant === 'donut'} />
      ) : variant === 'bars' ? (
        <InsightCategoryBars items={items} />
      ) : (
        <InsightMosaicView items={items} />
      )}
    </InsightChartCard>
  )
}

export function InsightDonutChart({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['pie', 'donut', 'bars', 'mosaic'],
  items,
  centerValue,
  centerLabel,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  items: InsightChartDatum[]
  centerValue: ReactNode
  centerLabel: ReactNode
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'pie', variants)

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'bars' ? (
        <InsightCategoryBars items={items} />
      ) : variant === 'mosaic' || variant === 'treemap' ? (
        <InsightMosaicView items={items} />
      ) : variant === 'funnel' ? (
        <InsightFunnelView items={items} />
      ) : (
        <InsightPieView items={items} donut={variant === 'donut'} centerValue={centerValue} centerLabel={centerLabel} />
      )}
    </InsightChartCard>
  )
}

export function InsightBudgetChart({
  title,
  subtitle,
  eyebrow,
  chartId,
  plannedValue,
  actualValue,
  remainingValue,
  formatValue,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  plannedValue: number
  actualValue: number
  remainingValue: number
  formatValue: (value: number) => ReactNode
  help?: string
}) {
  const variants: InsightChartVariant[] = ['bullet', 'bars', 'pie']
  const [variant, setVariant] = useStoredChartVariant(chartId, 'bullet', variants)
  const progress = plannedValue > 0 ? (actualValue / plannedValue) * 100 : 0
  const cappedProgress = Math.min(140, Math.max(0, progress))
  const overBudget = remainingValue < 0
  const segments: InsightChartDatum[] = [
    { label: 'Realise', value: actualValue, displayValue: formatValue(actualValue), tone: overBudget ? 'warning' : 'accent' },
    {
      label: overBudget ? 'Depassement' : 'Reste',
      value: Math.abs(remainingValue),
      displayValue: formatValue(Math.abs(remainingValue)),
      tone: overBudget ? 'warning' : 'success',
    },
  ]

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'bars' ? (
        <InsightCategoryBars items={segments} />
      ) : variant === 'pie' ? (
        <InsightPieView items={segments} />
      ) : (
        <div className="insight-bullet">
          <div className="insight-bullet-track" data-over={overBudget ? 'true' : 'false'}>
            <span className="insight-bullet-value" style={{ width: `${cappedProgress}%` }} />
            <span className="insight-bullet-target" />
          </div>
          <div className="insight-bullet-grid">
            <div>
              <span>Realise</span>
              <strong>{formatValue(actualValue)}</strong>
            </div>
            <div>
              <span>Cible</span>
              <strong>{formatValue(plannedValue)}</strong>
            </div>
            <div>
              <span>{overBudget ? 'Depassement' : 'Reste'}</span>
              <strong>{formatValue(Math.abs(remainingValue))}</strong>
            </div>
          </div>
        </div>
      )}
    </InsightChartCard>
  )
}

export function InsightBubbleChart({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['bubble', 'treemap', 'bars'],
  points,
  formatXTick = compactNumber,
  formatYTick = compactNumber,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  points: InsightBubbleDatum[]
  formatXTick?: (value: number) => string
  formatYTick?: (value: number) => string
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'bubble', variants)
  const entries = buildBubbleEntries(points)
  const fallbackItems = entries.map((entry) => ({
    label: entry.label,
    value: entry.size,
    displayValue: entry.displaySize ?? entry.size,
    hint: entry.hint,
    tone: entry.tone,
  }))

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'treemap' || variant === 'mosaic' ? (
        <InsightMosaicView items={fallbackItems} />
      ) : variant === 'bars' ? (
        <InsightCategoryBars items={fallbackItems} />
      ) : entries.length ? (
        <div className="insight-recharts-frame bubble">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--surface-border)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Taux"
                tickFormatter={(value) => formatXTick(Number(value))}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Montant"
                width={74}
                tickFormatter={(value) => formatYTick(Number(value))}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="size" range={[90, 900]} />
              <Tooltip content={(props) => <BubbleTooltip {...props} />} cursor={{ strokeDasharray: '3 3', stroke: 'var(--surface-border)' }} />
              <Scatter data={entries} isAnimationActive={false}>
                {entries.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} stroke="var(--surface-strong)" strokeWidth={2} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="insight-empty-chart">Aucune donnee a visualiser.</div>
      )}
    </InsightChartCard>
  )
}

export function InsightHeatmapChart({
  title,
  subtitle,
  eyebrow,
  chartId,
  variants = ['heatmap', 'bars', 'pie'],
  items,
  help,
}: {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  chartId?: string
  variants?: InsightChartVariant[]
  items: InsightChartDatum[]
  help?: string
}) {
  const [variant, setVariant] = useStoredChartVariant(chartId, variants[0] ?? 'heatmap', variants)

  return (
    <InsightChartCard title={title} subtitle={subtitle} eyebrow={eyebrow} variants={variants} selectedVariant={variant} onVariantChange={setVariant} help={help}>
      {variant === 'bars' ? (
        <InsightCategoryBars items={items} />
      ) : variant === 'pie' ? (
        <InsightPieView items={items} />
      ) : (
        <InsightHeatmapView items={items} />
      )}
    </InsightChartCard>
  )
}
