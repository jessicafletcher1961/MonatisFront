import { useEffect, useState } from 'react'

import { pageSpecificHelp } from './help-content'

interface HelpState {
  text: string
  x: number
  y: number
}

interface HelpCandidate {
  element: HTMLElement
  text: string
}

const helpSelector = [
  '[data-help]',
  '.search-field',
  '.form-field',
  '.segmented-option',
  '.inline-segmented-option',
  '.shell-nav-link',
  '.section-header',
  '.stat-card',
  '.budget-summary-item',
  '.budget-row',
  '.list-row',
  '.operation-history-row',
  '.compact-entity-row',
  '.report-line-card',
  '.releve-account-card',
  '.wizard-summary-card',
  '.filter-choice-card',
  '.floating-panel-nav-header',
  'button',
  'a',
  'input',
  'select',
  'textarea',
].join(',')

function normalizeText(value?: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() ?? ''
}

function elementLabel(element: HTMLElement): string {
  return (
    normalizeText(element.getAttribute('aria-label')) ||
    normalizeText(element.getAttribute('title')) ||
    normalizeText(element.textContent) ||
    normalizeText(element.getAttribute('placeholder')) ||
    element.tagName.toLowerCase()
  )
}

function fieldLabel(element: HTMLElement): string {
  const field = element.closest<HTMLElement>('.form-field')
  return normalizeText(field?.querySelector('.form-field-label')?.textContent) || elementLabel(element)
}

function actionHelp(label: string): string {
  const lower = label.toLowerCase()
  if (lower.includes('supprimer')) return `Supprime l'element concerne. Cette action modifie les donnees et demande souvent une confirmation.`
  if (lower.includes('enregistrer') || lower.includes('valider') || lower.includes('creer')) return `Enregistre les informations du formulaire courant.`
  if (lower.includes('annuler')) return `Annule les changements en cours et revient a l'etat precedent.`
  if (lower.includes('fermer')) return `Ferme le cadre ou le panneau actuellement ouvert.`
  if (lower.includes('nouveau') || lower.includes('ajouter')) return `Ouvre le formulaire de creation de l'element concerne.`
  if (lower.includes('rechercher')) return `Lance ou affine la recherche avec les criteres saisis.`
  if (lower.includes('precedent')) return `Affiche l'element precedent de la liste courante.`
  if (lower.includes('suivant')) return `Affiche l'element suivant de la liste courante.`
  return `Action "${label}" : declenche la commande associee a ce bouton.`
}

function inferHelp(element: HTMLElement): string | null {
  const explicit = element.closest<HTMLElement>('[data-help]')?.getAttribute('data-help')
  if (explicit) return explicit

  const pageHelp = pageSpecificHelp(element)
  if (pageHelp) return pageHelp

  if (element.closest('.search-field')) {
    return `Zone de recherche : filtre la liste ou les resultats affiches sans changer directement les donnees.`
  }

  const field = element.closest<HTMLElement>('.form-field')
  if (field) {
    const label = fieldLabel(field)
    return `Champ "${label}" : renseigne ou modifie cette information dans le formulaire courant.`
  }

  if (element.matches('input, textarea')) {
    return `Champ de saisie : entre une valeur qui sera utilisee par le filtre ou le formulaire.`
  }

  if (element.matches('select')) {
    return `Liste de choix : selectionne une valeur parmi celles proposees.`
  }

  if (element.closest('.shell-nav-link')) {
    const label = elementLabel(element.closest<HTMLElement>('.shell-nav-link') ?? element)
    return `Navigation "${label}" : change la grande section affichee dans MONATIS.`
  }

  if (element.closest('.segmented-option') || element.closest('.inline-segmented-option')) {
    const option = element.closest<HTMLElement>('.segmented-option, .inline-segmented-option') ?? element
    return `Option "${elementLabel(option)}" : change la vue, le type ou le filtre actif.`
  }

  if (element.closest('.budget-summary-item')) {
    return `Carte de synthese budget : resume le prevu, le realise, le disponible ou les alertes des budgets actifs.`
  }

  if (element.closest('.budget-row')) {
    return `Ligne budget : ouvre le detail et montre la progression calculee avec les operations de la periode.`
  }

  if (element.closest('.operation-history-row')) {
    return `Ligne operation : ouvre le detail de l'operation selectionnee.`
  }

  if (element.closest('.compact-entity-row') || element.closest('.list-row')) {
    return `Ligne de liste : selectionne cet element et ouvre son cadre de detail quand il existe.`
  }

  if (element.closest('.stat-card')) {
    return `Carte d'indicateur : affiche une valeur importante calculee pour l'ecran courant.`
  }

  if (element.closest('.report-line-card') || element.closest('.releve-account-card')) {
    return `Carte de rapport : resume un resultat d'analyse et permet de comparer les valeurs affichees.`
  }

  if (element.closest('.wizard-summary-card')) {
    return `Carte de resume : affiche une valeur deja choisie dans le parcours de creation.`
  }

  if (element.closest('.filter-choice-card')) {
    return `Carte de choix : applique cette valeur comme critere ou champ du formulaire courant.`
  }

  if (element.closest('.floating-panel-nav-header')) {
    return `Bandeau de detail : permet de passer a l'element precedent ou suivant et de fermer le cadre.`
  }

  if (element.closest('.section-header')) {
    return `Titre de section : presente le bloc d'informations ou d'actions qui suit.`
  }

  if (element.closest('button')) {
    const button = element.closest<HTMLElement>('button') ?? element
    return actionHelp(elementLabel(button))
  }

  if (element.closest('a')) {
    const link = element.closest<HTMLElement>('a') ?? element
    return `Lien "${elementLabel(link)}" : ouvre la destination associee.`
  }

  return null
}

function helpCandidateFromTarget(target: EventTarget | null): HelpCandidate | null {
  if (!(target instanceof Element)) return null
  if (target.closest('.help-mode-banner, .help-tooltip')) return null

  const element = target.closest<HTMLElement>(helpSelector)
  if (!element) return null

  const text = inferHelp(element)
  return text ? { element, text } : null
}

function tooltipPosition(event: MouseEvent | PointerEvent | FocusEvent): { x: number; y: number } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const fallbackRect = event.target instanceof Element ? event.target.getBoundingClientRect() : null
  const clientX = 'clientX' in event ? event.clientX : fallbackRect ? fallbackRect.right : viewportWidth / 2
  const clientY = 'clientY' in event ? event.clientY : fallbackRect ? fallbackRect.bottom : 96
  return {
    x: Math.max(12, Math.min(clientX + 16, viewportWidth - 340)),
    y: Math.max(68, Math.min(clientY + 18, viewportHeight - 140)),
  }
}

export function HelpModeOverlay({ active, onExit }: { active: boolean; onExit: () => void }) {
  const [help, setHelp] = useState<HelpState | null>(null)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !targetElement) return
    targetElement.classList.add('help-mode-target')
    return () => targetElement.classList.remove('help-mode-target')
  }, [active, targetElement])

  useEffect(() => {
    if (!active) {
      const cleanupId = window.setTimeout(() => {
        setHelp(null)
        setTargetElement(null)
      }, 0)
      return () => window.clearTimeout(cleanupId)
    }

    function updateHelp(event: PointerEvent | FocusEvent) {
      const candidate = helpCandidateFromTarget(event.target)
      if (!candidate) {
        setHelp(null)
        setTargetElement(null)
        return
      }
      const position = tooltipPosition(event)
      setTargetElement(candidate.element)
      setHelp({ text: candidate.text, x: position.x, y: position.y })
    }

    function moveHelp(event: PointerEvent) {
      setHelp((current) => (current ? { ...current, ...tooltipPosition(event) } : current))
    }

    function exitWithContextMenu(event: MouseEvent) {
      event.preventDefault()
      onExit()
    }

    document.addEventListener('pointerover', updateHelp, true)
    document.addEventListener('focusin', updateHelp, true)
    document.addEventListener('pointermove', moveHelp, true)
    document.addEventListener('contextmenu', exitWithContextMenu, true)
    return () => {
      document.removeEventListener('pointerover', updateHelp, true)
      document.removeEventListener('focusin', updateHelp, true)
      document.removeEventListener('pointermove', moveHelp, true)
      document.removeEventListener('contextmenu', exitWithContextMenu, true)
    }
  }, [active, onExit])

  if (!active) return null

  return (
    <>
      <div className="help-mode-banner" role="status">
        Mode aide actif : survolez un element. Clic droit ou recliquez sur ? pour quitter.
      </div>
      {help ? (
        <div className="help-tooltip" role="tooltip" style={{ left: help.x, top: help.y }}>
          {help.text}
        </div>
      ) : null}
    </>
  )
}
