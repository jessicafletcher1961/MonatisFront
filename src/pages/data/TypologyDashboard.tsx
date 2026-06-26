import { Boxes, GitBranch, ListChecks, Tags } from 'lucide-react'

import { summarizeTypologies, type TypologyGroupViewModel } from './typology-utils'

interface TypologyDashboardProps {
  groups: TypologyGroupViewModel[]
}

export function TypologyDashboard({ groups }: TypologyDashboardProps) {
  const summary = summarizeTypologies(groups)

  return (
    <section className="typology-dashboard" data-help="Synthese du catalogue de typologies expose par le back.">
      <article className="typology-summary-item typology-summary-item-main">
        <Tags size={22} aria-hidden />
        <div>
          <span>Valeurs exposees</span>
          <strong>{summary.totalValues}</strong>
          <small>{summary.groupCount} familles chargees depuis le back</small>
        </div>
      </article>
      <article className="typology-summary-item">
        <ListChecks size={22} aria-hidden />
        <div>
          <span>Types operations</span>
          <strong>{summary.operationValues}</strong>
          <small>{summary.categorisableValues} categorisables, {summary.nonCategorisableValues} hors categorie</small>
        </div>
      </article>
      <article className="typology-summary-item">
        <GitBranch size={22} aria-hidden />
        <div>
          <span>Flux techniques</span>
          <strong>{summary.technicalValues}</strong>
          <small>Flags portes par les types operation</small>
        </div>
      </article>
      <article className="typology-summary-item">
        <Boxes size={22} aria-hidden />
        <div>
          <span>Famille la plus dense</span>
          <strong>{summary.largestGroupTitle}</strong>
          <small>{summary.largestGroupCount} valeur{summary.largestGroupCount > 1 ? 's' : ''}</small>
        </div>
      </article>
    </section>
  )
}
