import { nullIfBlank, parseMoneyToCents, toMoneyInput, todayIso } from '../../lib/format'
import type { LoanCondition, LoanConditionPayload } from '../../lib/monatis-api'

export interface LoanConditionFormState {
  libelle: string
  tauxAnnuel: string
  capitalEmprunte: string
  duree: string
  codeTypePeriodeEcheances: string
  numeroPremiereEcheance: string
  datePremiereEcheance: string
  montantTotalEcheance: string
  montantFraisFixesEcheance: string
}

export function emptyCondition(codeTypePeriodeEcheances = 'MENSUEL'): LoanConditionFormState {
  return {
    libelle: '',
    tauxAnnuel: '',
    capitalEmprunte: '',
    duree: '',
    codeTypePeriodeEcheances,
    numeroPremiereEcheance: '1',
    datePremiereEcheance: todayIso(),
    montantTotalEcheance: '',
    montantFraisFixesEcheance: '0',
  }
}

export function conditionToForm(condition: LoanCondition): LoanConditionFormState {
  return {
    libelle: condition.libelle ?? '',
    tauxAnnuel: String(condition.tauxAnnuel ?? ''),
    capitalEmprunte: toMoneyInput(condition.capitalEmprunteEnCentimes),
    duree: String(condition.duree ?? ''),
    codeTypePeriodeEcheances: condition.typePeriodeEcheances?.code ?? condition.codeTypePeriodeEcheances ?? 'MENSUEL',
    numeroPremiereEcheance: String(condition.numeroPremiereEcheance ?? 1),
    datePremiereEcheance: condition.datePremiereEcheance ?? todayIso(),
    montantTotalEcheance: toMoneyInput(condition.montantTotalEcheanceEnCentimes),
    montantFraisFixesEcheance: toMoneyInput(condition.montantFraisFixesEcheanceEnCentimes),
  }
}

export function conditionPayload(condition: LoanConditionFormState): LoanConditionPayload {
  return {
    libelle: nullIfBlank(condition.libelle),
    tauxAnnuel: condition.tauxAnnuel.trim() ? Number(condition.tauxAnnuel.replace(',', '.')) : null,
    capitalEmprunteEnCentimes: parseMoneyToCents(condition.capitalEmprunte),
    duree: condition.duree.trim() ? Number.parseInt(condition.duree, 10) : null,
    codeTypePeriodeEcheances: nullIfBlank(condition.codeTypePeriodeEcheances),
    numeroPremiereEcheance: condition.numeroPremiereEcheance.trim() ? Number.parseInt(condition.numeroPremiereEcheance, 10) : null,
    datePremiereEcheance: condition.datePremiereEcheance || null,
    montantTotalEcheanceEnCentimes: parseMoneyToCents(condition.montantTotalEcheance),
    montantFraisFixesEcheanceEnCentimes: parseMoneyToCents(condition.montantFraisFixesEcheance),
  }
}
