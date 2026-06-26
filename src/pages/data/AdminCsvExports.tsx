import { Database, Download } from 'lucide-react'

import { Badge, Button, SectionHeader } from '../../components/ui'
import { monatisApi } from '../../lib/monatis-api'
import { adminCsvGroups } from './admin-utils'

export function AdminCsvExports() {
  return (
    <section className="admin-section admin-section-safe csv-admin-card">
      <SectionHeader title="Exports CSV" subtitle="Telechargements directs exposes par le back, sans mutation de donnees." />
      <div className="admin-csv-grid">
        {adminCsvGroups.map((group) => (
          <article className="admin-action-card admin-csv-group" key={group.title}>
            <div className="admin-action-card-head">
              <span className="admin-action-icon">
                <Database size={18} aria-hidden />
              </span>
              <div>
                <strong>{group.title}</strong>
                <span>{group.description}</span>
              </div>
              <Badge>Lecture</Badge>
            </div>
            <div className="admin-csv-list">
              {group.items.map((item) => (
                <div className="admin-csv-row" key={item.key}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </div>
                  <Button type="button" tone="soft" onClick={() => window.open(monatisApi.csvDownloadUrl(item.key), '_blank', 'noopener,noreferrer')}>
                    <Download size={16} />
                    CSV
                  </Button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
