import { ArrowDownLeft, ArrowUpRight, Landmark, Scale, WalletCards } from 'lucide-react'

import {
  InsightHeatmapChart,
  InsightHero,
  InsightMetric,
  InsightMetricGrid,
  InsightPanel,
  InsightWaterfall,
} from '../../components/insight'
import { formatCurrency, formatDate } from '../../lib/format'
import type { ReleveCompteView } from '../../lib/reporting'
import { getReleveDashboardSummary } from './releve-dashboard-utils'

export function ReleveDashboard({ releve }: { releve: ReleveCompteView }) {
  const summary = getReleveDashboardSummary(releve)
  const periodLabel = `${formatDate(releve.dateDebutReleve)} - ${formatDate(releve.dateFinReleve)}`
  const movementsByDate = new Map<string, { recette: number; depense: number; count: number }>()

  function addMovement(date: string, type: 'recette' | 'depense', value: number) {
    const current = movementsByDate.get(date) ?? { recette: 0, depense: 0, count: 0 }
    current[type] += Math.abs(value)
    current.count += 1
    movementsByDate.set(date, current)
  }

  releve.operationsRecette.forEach((operation) => {
    addMovement(operation.dateComptabilisation || operation.dateValeur, 'recette', operation.montantEnEuros)
  })
  releve.operationsDepense.forEach((operation) => {
    addMovement(operation.dateComptabilisation || operation.dateValeur, 'depense', operation.montantEnEuros)
  })

  const movementHeatmap = Array.from(movementsByDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-28)
    .map(([date, item]) => {
      const total = item.recette + item.depense
      return {
        label: formatDate(date),
        value: total,
        displayValue: formatCurrency(total),
        hint: `${item.count} mouvement(s)`,
        tone: item.recette >= item.depense ? ('success' as const) : ('warning' as const),
      }
    })

  return (
    <InsightPanel className="releve-dashboard" help="Synthese du releve : resume le compte, la periode, le solde et le controle entre le solde calcule et les mouvements affiches.">
      <InsightHero
        eyebrow="Releve de compte"
        value={formatCurrency(releve.montantSoldeFinReleveEnEuros)}
        subtitle={`${releve.enteteCompte.identifiant} - ${periodLabel}`}
        icon={Landmark}
        tone={summary.balanced ? 'success' : 'warning'}
      />

      <InsightMetricGrid>
        <InsightMetric
          icon={WalletCards}
          label="Operations"
          value={summary.operationCount}
          hint="lignes affichees"
          help="Operations : nombre total de mouvements du releve visibles apres les filtres de compte et de dates."
        />
        <InsightMetric
          icon={ArrowUpRight}
          label="Entrees"
          value={summary.recetteCount}
          hint="operations recette"
          tone="success"
          help="Entrees : nombre d'operations recette qui augmentent le solde du compte sur la periode."
        />
        <InsightMetric
          icon={ArrowDownLeft}
          label="Sorties"
          value={summary.depenseCount}
          hint="operations depense"
          tone="warning"
          help="Sorties : nombre d'operations depense qui diminuent le solde du compte sur la periode."
        />
        <InsightMetric
          icon={Scale}
          label="Ecart controle"
          value={formatCurrency(summary.balanceGap)}
          hint="rapprochement"
          tone={summary.balanced ? 'success' : 'warning'}
          help="Controle : verifie que solde debut + recettes - depenses correspond au solde final du releve."
        />
      </InsightMetricGrid>

      <InsightWaterfall
        chartId="reports.releve.waterfall"
        eyebrow="Rapprochement"
        title="Du solde debut au solde fin"
        subtitle="La lecture suit la formule comptable du releve"
        help="Pont du releve : solde debut plus recettes moins depenses donne le solde attendu."
        steps={[
          {
            label: 'Debut',
            value: releve.montantSoldeDebutReleveEnEuros,
            displayValue: formatCurrency(releve.montantSoldeDebutReleveEnEuros),
          },
          {
            label: 'Recettes',
            value: releve.montantTotalOperationsRecetteEnEuros,
            displayValue: `+ ${formatCurrency(releve.montantTotalOperationsRecetteEnEuros)}`,
            hint: `${summary.recetteCount} operation(s)`,
            tone: 'success',
          },
          {
            label: 'Depenses',
            value: releve.montantTotalOperationsDepenseEnEuros,
            displayValue: `- ${formatCurrency(releve.montantTotalOperationsDepenseEnEuros)}`,
            hint: `${summary.depenseCount} operation(s)`,
            tone: 'warning',
          },
          {
            label: 'Fin',
            value: releve.montantSoldeFinReleveEnEuros,
            displayValue: formatCurrency(releve.montantSoldeFinReleveEnEuros),
            tone: 'accent',
          },
        ]}
      />

      {movementHeatmap.length ? (
        <InsightHeatmapChart
          chartId="reports.releve.heatmap"
          eyebrow="Rythme"
          title="Jours avec mouvements"
          subtitle="Volume recette + depense par date"
          help="Heatmap du releve : chaque case represente un jour avec mouvement, plus la couleur est intense plus le volume cumule des entrees et sorties est eleve."
          items={movementHeatmap}
        />
      ) : null}
    </InsightPanel>
  )
}
