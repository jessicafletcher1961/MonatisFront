import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Database, Download, FolderOpen, LoaderCircle, PackagePlus, RefreshCw, Terminal } from 'lucide-react'
import { useState } from 'react'

import { Badge, Button, SectionHeader } from '../../components/ui'
import { portableBuilderApi, type PortableBuildJob } from '../../lib/portable-builder-api'

function jobBadge(job: PortableBuildJob | null) {
  if (!job) {
    return <Badge>En attente</Badge>
  }
  if (job.status === 'success') {
    return <Badge tone="success">Termine</Badge>
  }
  if (job.status === 'error') {
    return <Badge tone="warning">Erreur</Badge>
  }
  return <Badge tone="warning">En cours</Badge>
}

export function AdminPortableBuilderPanel() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [outputRootDraft, setOutputRootDraft] = useState<string | null>(null)
  const [includeData, setIncludeData] = useState(false)
  const [lastStatusCheck, setLastStatusCheck] = useState<string | null>(null)

  const statusQuery = useQuery({
    queryKey: ['portable-builder', 'status'],
    queryFn: () => portableBuilderApi.status(),
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 5000),
  })

  const startMutation = useMutation({
    mutationFn: () => portableBuilderApi.startBuild({ outputRoot: outputRoot.trim(), includeData }),
    onSuccess: (job) => setJobId(job.id),
  })

  const selectDirectoryMutation = useMutation({
    mutationFn: () => portableBuilderApi.selectOutputDirectory(outputRoot.trim() || statusQuery.data?.defaultOutputDirectory || ''),
    onSuccess: ({ outputRoot }) => setOutputRootDraft(outputRoot),
  })

  const exportMutation = useMutation({
    mutationFn: () => {
      if (!jobId) {
        throw new Error('Aucun build termine a exporter.')
      }
      return portableBuilderApi.exportBuild(jobId, outputRoot.trim())
    },
  })

  const jobQuery = useQuery({
    queryKey: ['portable-builder', 'job', jobId],
    queryFn: () => portableBuilderApi.getJob(jobId ?? ''),
    enabled: Boolean(jobId),
    retry: false,
    refetchInterval: (query) => {
      const job = query.state.data
      return job?.status === 'queued' || job?.status === 'running' ? 1600 : false
    },
  })

  const status = statusQuery.data
  const outputRoot = outputRootDraft ?? status?.defaultOutputDirectory ?? ''
  const currentJob = exportMutation.data?.id === jobId ? exportMutation.data : jobQuery.data ?? startMutation.data ?? null
  const serviceUnavailable = statusQuery.isError
  const buildBusy = Boolean(status?.busy || currentJob?.status === 'queued' || currentJob?.status === 'running' || startMutation.isPending)
  const actionBusy = Boolean(buildBusy || selectDirectoryMutation.isPending || exportMutation.isPending)
  const dataCopyBlocked = Boolean(includeData && (status?.backServiceRunning || !status?.backDataDirectoryExists))
  const canBuild = Boolean(!serviceUnavailable && status?.ok && status.jdkReady && outputRoot.trim() && !actionBusy && !dataCopyBlocked)
  const canExport = Boolean(!serviceUnavailable && currentJob?.status === 'success' && currentJob.outputPath && outputRoot.trim() && !actionBusy)
  const canDownload = Boolean(!serviceUnavailable && currentJob?.status === 'success' && currentJob.outputPath && !buildBusy)

  async function refreshStatus() {
    await statusQuery.refetch()
    setLastStatusCheck(new Date().toLocaleTimeString('fr-FR'))
  }

  function downloadArchive() {
    if (!currentJob?.id) {
      return
    }
    window.location.assign(portableBuilderApi.downloadUrl(currentJob.id))
  }

  return (
    <section className="admin-section admin-portable-section" data-help="Creation portable : demande un dossier de sortie puis construit une version Windows autonome de MONATIS via le microservice local.">
      <SectionHeader
        title="Executable portable"
        subtitle="Cree une image Windows autonome, puis l'exporte ou la telecharge en ZIP sans modifier le back."
        aside={jobBadge(currentJob)}
      />

      <div className="admin-portable-layout">
        <article className="admin-action-card admin-portable-primary" data-help="Bloc de lancement : indique si le service local et le JDK sont disponibles avant de creer le dossier portable.">
          <div className="admin-action-card-head">
            <span className="admin-action-icon">
              <PackagePlus size={18} aria-hidden />
            </span>
            <div>
              <strong>Créer MONATIS portable</strong>
              <span>Le service local utilise le dossier indique puis produit Monatis.exe avec le front, le back et le runtime Java.</span>
            </div>
            {status?.jdkReady ? <Badge tone="success">JDK OK</Badge> : <Badge tone="warning">JDK requis</Badge>}
          </div>

          <div className="admin-portable-status-grid">
            <span data-help="Etat du microservice local qui fabrique le package portable. Il doit etre lance depuis Micro_Service_make_exe.">
              <strong>{serviceUnavailable ? 'Indisponible' : 'Disponible'}</strong>
              <small>Service local</small>
            </span>
            <span data-help="Port local utilise par le microservice de creation portable. Il reste limite a 127.0.0.1.">
              <strong>{status?.port ?? 8095}</strong>
              <small>Port 127.0.0.1</small>
            </span>
            <span data-help="Dossier propose par defaut quand la fenetre de choix du dossier de sortie s'ouvre.">
              <strong>{status?.defaultOutputDirectory ?? 'Téléchargements'}</strong>
              <small>Dossier d'export proposé</small>
            </span>
            <span data-help="Etat de la base locale du back actif. Elle ne peut etre copiee que si le dossier data existe et si le back n'est pas lance.">
              <strong>{status?.backDataDirectoryExists ? (status.backServiceRunning ? 'Back actif' : 'Disponible') : 'Absente'}</strong>
              <small>Base locale</small>
            </span>
          </div>

          <label className="admin-portable-output-field" data-help="Dossier d'export : chemin absolu ou le microservice copiera le dossier MonatisPortable apres un build reussi.">
            <span>Dossier d'export</span>
            <input
              value={outputRoot}
              onChange={(event) => setOutputRootDraft(event.target.value)}
              placeholder={status?.defaultOutputDirectory ?? 'C:\\Users\\vous\\Downloads'}
              disabled={actionBusy}
            />
            <small>Le build se fait d'abord dans le dossier de travail, puis ce chemin sert pour l'export.</small>
          </label>

          <label className="admin-portable-data-option" data-help="Inclure la base actuelle : copie le dossier data du back dans le portable pour retrouver les donnees locales sur un autre PC. Le back doit etre arrete avant la copie.">
            <input type="checkbox" checked={includeData} onChange={(event) => setIncludeData(event.target.checked)} disabled={actionBusy || serviceUnavailable} />
            <span className="admin-portable-data-icon">
              <Database size={16} aria-hidden />
            </span>
            <span>
              <strong>Inclure la base actuelle</strong>
              <small>{status?.backDataDirectory ?? 'MonatisBack-main\\data'}</small>
            </span>
          </label>

          {serviceUnavailable ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Service de création non lancé</strong>
                <span>Le front tente de le lancer automatiquement. Si ce message persiste, redémarre `npm run dev`.</span>
              </div>
            </div>
          ) : null}

          {!serviceUnavailable && status && !status.jdkReady ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>JDK complet introuvable</strong>
                <span>Définis `MONATIS_JAVA_HOME` ou `JAVA_HOME` vers un JDK avec javac, jar et jpackage.</span>
              </div>
            </div>
          ) : null}

          {includeData && status?.backServiceRunning ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Base en cours d'utilisation</strong>
                <span>Arrête le back local sur le port 8082 avant de créer un portable avec la base actuelle.</span>
              </div>
            </div>
          ) : null}

          {includeData && status && !status.backDataDirectoryExists ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Base locale introuvable</strong>
                <span>Le dossier `data` du back n'a pas été trouvé : {status.backDataDirectory}</span>
              </div>
            </div>
          ) : null}

          {startMutation.error ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Création non lancée</strong>
                <span>{startMutation.error.message}</span>
              </div>
            </div>
          ) : null}

          {selectDirectoryMutation.error ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Dossier non sélectionné</strong>
                <span>{selectDirectoryMutation.error.message}</span>
              </div>
            </div>
          ) : null}

          {exportMutation.error ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Export impossible</strong>
                <span>{exportMutation.error.message}</span>
              </div>
            </div>
          ) : null}

          <div className="admin-portable-actions">
            <Button
              type="button"
              onClick={() => startMutation.mutate()}
              disabled={!canBuild}
              data-help="Lance la creation portable dans le dossier de travail local. L'export ou le telechargement se fait ensuite."
            >
              {buildBusy ? <LoaderCircle className="spin" size={16} /> : <PackagePlus size={16} />}
              Créer la version portable
            </Button>
            <Button
              type="button"
              tone="soft"
              onClick={() => selectDirectoryMutation.mutate()}
              disabled={serviceUnavailable || actionBusy}
              data-help="Ouvre un choix de dossier Windows pour definir la cible d'export. Le dossier choisi remplit le champ ci-dessus."
            >
              {selectDirectoryMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <FolderOpen size={16} />}
              Choisir dossier
            </Button>
            <Button
              type="button"
              tone="soft"
              onClick={() => exportMutation.mutate()}
              disabled={!canExport}
              data-help="Copie l'image portable deja construite vers le dossier d'export indique."
            >
              {exportMutation.isPending ? <LoaderCircle className="spin" size={16} /> : <FolderOpen size={16} />}
              Exporter vers le dossier
            </Button>
            <Button
              type="button"
              tone="soft"
              onClick={downloadArchive}
              disabled={!canDownload}
              data-help="Telecharge une archive ZIP de l'image portable construite. Utile pour la copier ensuite sur une cle USB."
            >
              <Download size={16} />
              Télécharger ZIP
            </Button>
            <Button
              type="button"
              tone="soft"
              onClick={() => void refreshStatus()}
              disabled={statusQuery.isFetching}
              data-help="Recharge l'etat du microservice local sans lancer de creation portable."
            >
              {statusQuery.isFetching ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
              Vérifier le service
            </Button>
          </div>

          {lastStatusCheck ? <small className="admin-portable-action-note">Service vérifié à {lastStatusCheck}.</small> : null}
        </article>

        <article className="admin-action-card admin-portable-progress" data-help="Suivi du build portable : phase courante, progression, dossier cree et logs techniques.">
          <div className="admin-action-card-head">
            <span className="admin-action-icon">
              {currentJob?.status === 'success' ? <CheckCircle2 size={18} aria-hidden /> : <Terminal size={18} aria-hidden />}
            </span>
            <div>
              <strong>{currentJob?.phase ?? 'Aucun build lancé'}</strong>
              <span>{currentJob ? `${currentJob.progress}% - ${currentJob.status}` : 'Les logs apparaissent ici pendant la création.'}</span>
              {currentJob?.includeData ? <span>Base actuelle incluse dans ce build.</span> : null}
            </div>
          </div>

          <div className="admin-portable-progress-track" aria-label={`Progression ${currentJob?.progress ?? 0}%`}>
            <span style={{ width: `${currentJob?.progress ?? 0}%` }} />
          </div>

          {currentJob?.outputPath ? (
            <div className="admin-portable-output">
              <FolderOpen size={16} aria-hidden />
              <div>
                <strong>Image interne prête</strong>
                <code>{currentJob.outputPath}</code>
              </div>
            </div>
          ) : null}

          {currentJob?.exportPath ? (
            <div className="admin-portable-output">
              <FolderOpen size={16} aria-hidden />
              <div>
                <strong>Export créé</strong>
                <code>{currentJob.exportPath}</code>
              </div>
            </div>
          ) : null}

          {currentJob?.error ? (
            <div className="admin-portable-warning">
              <AlertTriangle size={17} aria-hidden />
              <div>
                <strong>Erreur de build</strong>
                <span>{currentJob.error}</span>
              </div>
            </div>
          ) : null}

          <pre className="admin-portable-log" data-help="Journal du microservice. Les dernieres lignes indiquent quelle etape de creation portable est en cours ou pourquoi elle a echoue.">
            {currentJob?.logs.length ? currentJob.logs.join('\n') : 'Aucun log pour le moment.'}
          </pre>
        </article>
      </div>
    </section>
  )
}
