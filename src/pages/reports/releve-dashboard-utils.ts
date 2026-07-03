import type { ReleveCompteView } from '../../lib/reporting'

export interface ReleveDashboardSummary {
  recetteCount: number
  depenseCount: number
  operationCount: number
  netMovement: number
  expectedEndBalance: number
  balanceGap: number
  balanced: boolean
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2))
}

export function getReleveDashboardSummary(releve: ReleveCompteView): ReleveDashboardSummary {
  const recetteCount = releve.totalOperationsRecette ?? releve.operationsRecette.length
  const depenseCount = releve.totalOperationsDepense ?? releve.operationsDepense.length
  const netMovement = roundMoney(releve.montantTotalOperationsRecetteEnEuros - releve.montantTotalOperationsDepenseEnEuros)
  const expectedEndBalance = roundMoney(releve.montantSoldeDebutReleveEnEuros + netMovement)
  const balanceGap = roundMoney(releve.montantSoldeFinReleveEnEuros - expectedEndBalance)

  return {
    recetteCount,
    depenseCount,
    operationCount: recetteCount + depenseCount,
    netMovement,
    expectedEndBalance,
    balanceGap,
    balanced: Math.abs(balanceGap) < 0.01,
  }
}

export function releveAccountTitle(releve: ReleveCompteView): string {
  return releve.enteteCompte.libelle || releve.enteteCompte.identifiant
}
