const PORTABLE_BUILDER_BASE_URL = import.meta.env.VITE_MONATIS_PORTABLE_BUILDER_URL ?? '/__monatis_portable_builder'

export interface PortableBuilderStatus {
  ok: boolean
  service: string
  host: string
  port: number
  frontRoot: string
  backRoot: string
  defaultBackRoot: string
  javaHome: string | null
  jdkReady: boolean
  bundledJavaHome: string | null
  bundledJdkDirectory: string
  bundledJdkReady: boolean
  jdkAutoInstallAvailable: boolean
  busy: boolean
  defaultOutputDirectory: string
  backServiceRunning: boolean
  backDataDirectory: string
  backDataDirectoryExists: boolean
}

export type PortableBuildJobStatus = 'queued' | 'running' | 'success' | 'error'

export interface PortableBuildJob {
  id: string
  status: PortableBuildJobStatus
  phase: string
  progress: number
  createdAt: string
  updatedAt: string
  outputRoot: string
  backRoot: string
  includeData: boolean
  outputPath: string | null
  exportPath: string | null
  error: string | null
  logs: string[]
}

interface PortableBuildJobResponse {
  job: PortableBuildJob
}

interface PortableBuildRequest {
  outputRoot: string
  backRoot: string
  includeData: boolean
}

interface PortableOutputDirectoryResponse {
  outputRoot: string
}

interface PortableBackDirectoryResponse {
  backRoot: string
}

export interface PortableBackInspection {
  valid: boolean
  backRoot: string
  backDataDirectory: string
  backDataDirectoryExists: boolean
  backServiceRunning: boolean
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PORTABLE_BUILDER_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload ? String(payload.message) : `Erreur HTTP ${response.status}`
    throw new Error(message)
  }

  return payload as T
}

export const portableBuilderApi = {
  status(): Promise<PortableBuilderStatus> {
    return requestJson<PortableBuilderStatus>('/api/status')
  },

  startBuild(request: PortableBuildRequest): Promise<PortableBuildJob> {
    return requestJson<PortableBuildJobResponse>('/api/build-portable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }).then((response) => response.job)
  },

  selectOutputDirectory(outputRoot: string): Promise<PortableOutputDirectoryResponse> {
    return requestJson<PortableOutputDirectoryResponse>('/api/select-output-directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ outputRoot }),
    })
  },

  selectBackDirectory(backRoot: string): Promise<PortableBackDirectoryResponse> {
    return requestJson<PortableBackDirectoryResponse>('/api/select-back-directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ backRoot }),
    })
  },

  inspectBackDirectory(backRoot: string): Promise<PortableBackInspection> {
    return requestJson<PortableBackInspection>('/api/inspect-back-directory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ backRoot }),
    })
  },

  exportBuild(id: string, outputRoot: string): Promise<PortableBuildJob> {
    return requestJson<PortableBuildJobResponse>(`/api/build-portable/jobs/${encodeURIComponent(id)}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ outputRoot }),
    }).then((response) => response.job)
  },

  downloadUrl(id: string): string {
    return `${PORTABLE_BUILDER_BASE_URL}/api/build-portable/jobs/${encodeURIComponent(id)}/download`
  },

  getJob(id: string): Promise<PortableBuildJob> {
    return requestJson<PortableBuildJobResponse>(`/api/build-portable/jobs/${encodeURIComponent(id)}`).then((response) => response.job)
  },
}
