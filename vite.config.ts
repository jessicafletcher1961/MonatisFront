import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { Readable } from 'node:stream'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'

const FRONT_DIR = fileURLToPath(new URL('.', import.meta.url))
const PDF_READER_DIR = path.resolve(FRONT_DIR, 'Micro_Service_PDF_Reader')
const PDF_READER_MOUNT = '/__monatis_pdf_reader'
const PORTABLE_BUILDER_DIR = path.resolve(FRONT_DIR, 'Micro_Service_make_exe')
const PORTABLE_BUILDER_MOUNT = '/__monatis_portable_builder'

function pdfReaderPort(): number {
  const rawPort = process.env.MONATIS_PDF_IMPORTER_PORT ?? process.env.VITE_MONATIS_PDF_IMPORTER_PORT ?? '8000'
  const parsedPort = Number.parseInt(rawPort, 10)

  return Number.isFinite(parsedPort) ? parsedPort : 8000
}

function pdfReaderBaseUrl(): string {
  return `http://127.0.0.1:${pdfReaderPort()}`
}

function portableBuilderPort(): number {
  const rawPort = process.env.MONATIS_PORTABLE_BUILDER_PORT ?? '8095'
  const parsedPort = Number.parseInt(rawPort, 10)

  return Number.isFinite(parsedPort) ? parsedPort : 8095
}

function portableBuilderBaseUrl(): string {
  return `http://127.0.0.1:${portableBuilderPort()}`
}

function pythonExecutable(): string {
  const venvExecutable =
    process.platform === 'win32'
      ? path.join(PDF_READER_DIR, '.venv', 'Scripts', 'python.exe')
      : path.join(PDF_READER_DIR, '.venv', 'bin', 'python')

  if (fs.existsSync(venvExecutable)) {
    return venvExecutable
  }

  return process.platform === 'win32' ? 'python' : 'python3'
}

function copyProxyHeaders(req: IncomingMessage): Headers {
  const headers = new Headers()
  const skippedHeaders = new Set(['connection', 'content-length', 'host', 'transfer-encoding'])

  for (const [name, value] of Object.entries(req.headers)) {
    if (!value || skippedHeaders.has(name.toLowerCase())) {
      continue
    }

    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(name, item))
    } else {
      headers.set(name, value)
    }
  }

  return headers
}

function sendJsonError(res: ServerResponse, status: number, detail: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ detail, message: detail }))
}

function requestHasBody(req: IncomingMessage): boolean {
  const contentLength = Number.parseInt(String(req.headers['content-length'] ?? ''), 10)

  return Number.isFinite(contentLength) && contentLength > 0
}

function readRequestBody(req: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('error', reject)
    req.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
  })
}

function createPdfReaderLauncherPlugin(): Plugin {
  let pdfReaderProcess: ChildProcess | null = null
  let startPromise: Promise<void> | null = null

  async function isPdfReaderAlive(): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 800)

    try {
      const response = await fetch(`${pdfReaderBaseUrl()}/health`, { signal: controller.signal })
      return response.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  async function ensurePdfReader(): Promise<void> {
    if (await isPdfReaderAlive()) {
      return
    }

    if (startPromise) {
      return startPromise
    }

    startPromise = (async () => {
      if (!fs.existsSync(PDF_READER_DIR)) {
        throw new Error(`Microservice PDF introuvable : ${PDF_READER_DIR}`)
      }

      pdfReaderProcess = spawn(
        pythonExecutable(),
        ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(pdfReaderPort())],
        {
          cwd: PDF_READER_DIR,
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
          stdio: ['ignore', 'ignore', 'ignore'],
          windowsHide: true,
        },
      )

      pdfReaderProcess.once('exit', () => {
        pdfReaderProcess = null
      })

      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await isPdfReaderAlive()) {
          return
        }

        if (pdfReaderProcess?.exitCode != null) {
          throw new Error('Le microservice PDF a demarre puis s est arrete. Lance `python -m uvicorn app.main:app` dans son dossier pour voir le detail.')
        }

        await sleep(250)
      }

      throw new Error(`Le microservice PDF ne repond pas sur ${pdfReaderBaseUrl()}.`)
    })()

    try {
      await startPromise
    } finally {
      startPromise = null
    }
  }

  async function proxyToPdfReader(req: IncomingMessage, res: ServerResponse) {
    const currentUrl = new URL(req.url ?? '/', 'http://localhost')
    const targetPath = currentUrl.pathname.replace(PDF_READER_MOUNT, '') || '/'
    const targetUrl = `${pdfReaderBaseUrl()}${targetPath}${currentUrl.search}`
    const init: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers: copyProxyHeaders(req),
    }

    if (req.method && !['GET', 'HEAD'].includes(req.method)) {
      init.body = req as RequestInit['body']
      init.duplex = 'half'
    }

    const response = await fetch(targetUrl, init)
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      if (!['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value)
      }
    })
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res)
      return
    }
    res.end()
  }

  function attachMiddleware(server: ViteDevServer | PreviewServer) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith(PDF_READER_MOUNT)) {
        next()
        return
      }

      try {
        await ensurePdfReader()
        await proxyToPdfReader(req, res)
      } catch (error) {
        sendJsonError(res, 502, error instanceof Error ? error.message : 'Impossible de lancer le microservice PDF.')
      }
    })

    server.httpServer?.once('close', () => {
      if (pdfReaderProcess && !pdfReaderProcess.killed) {
        pdfReaderProcess.kill()
      }
    })
  }

  return {
    name: 'monatis-pdf-reader-launcher',
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  }
}

function createPortableBuilderLauncherPlugin(): Plugin {
  let portableBuilderProcess: ChildProcess | null = null
  let startPromise: Promise<void> | null = null

  async function isPortableBuilderAlive(): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)

    try {
      const response = await fetch(`${portableBuilderBaseUrl()}/api/status`, { signal: controller.signal })
      return response.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  async function ensurePortableBuilder(): Promise<void> {
    if (await isPortableBuilderAlive()) {
      return
    }

    if (startPromise) {
      return startPromise
    }

    startPromise = (async () => {
      if (!fs.existsSync(PORTABLE_BUILDER_DIR)) {
        throw new Error(`Microservice de creation portable introuvable : ${PORTABLE_BUILDER_DIR}`)
      }

      const logDir = path.join(PORTABLE_BUILDER_DIR, 'work')
      fs.mkdirSync(logDir, { recursive: true })
      const serviceLog = fs.createWriteStream(path.join(logDir, 'vite-service.log'), { flags: 'a' })
      serviceLog.write(`\n[${new Date().toISOString()}] Demarrage via Vite\n`)

      portableBuilderProcess = spawn(process.execPath, ['server.mjs'], {
        cwd: PORTABLE_BUILDER_DIR,
        env: {
          ...process.env,
          MONATIS_PORTABLE_BUILDER_PORT: String(portableBuilderPort()),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      portableBuilderProcess.stdout?.pipe(serviceLog, { end: false })
      portableBuilderProcess.stderr?.pipe(serviceLog, { end: false })
      portableBuilderProcess.once('exit', () => {
        serviceLog.write(`[${new Date().toISOString()}] Arret du service\n`)
        serviceLog.end()
        portableBuilderProcess = null
      })

      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await isPortableBuilderAlive()) {
          return
        }

        if (portableBuilderProcess?.exitCode != null) {
          throw new Error('Le microservice de creation portable a demarre puis s est arrete. Lance `node server.mjs` dans son dossier pour voir le detail.')
        }

        await sleep(250)
      }

      throw new Error(`Le microservice de creation portable ne repond pas sur ${portableBuilderBaseUrl()}.`)
    })()

    try {
      await startPromise
    } finally {
      startPromise = null
    }
  }

  async function proxyToPortableBuilder(req: IncomingMessage, res: ServerResponse) {
    const currentUrl = new URL(req.url ?? '/', 'http://localhost')
    const targetPath = currentUrl.pathname.replace(PORTABLE_BUILDER_MOUNT, '') || '/'
    const targetUrl = `${portableBuilderBaseUrl()}${targetPath}${currentUrl.search}`
    const init: RequestInit & { duplex?: 'half' } = {
      method: req.method,
      headers: copyProxyHeaders(req),
    }

    if (req.method && !['GET', 'HEAD'].includes(req.method) && requestHasBody(req)) {
      init.body = (await readRequestBody(req)) as RequestInit['body']
    }

    const response = await fetch(targetUrl, init)
    res.statusCode = response.status
    response.headers.forEach((value, key) => {
      if (!['connection', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value)
      }
    })
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res)
      return
    }
    res.end()
  }

  function attachMiddleware(server: ViteDevServer | PreviewServer) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith(PORTABLE_BUILDER_MOUNT)) {
        next()
        return
      }

      try {
        await ensurePortableBuilder()
        await proxyToPortableBuilder(req, res)
      } catch (error) {
        sendJsonError(res, 502, error instanceof Error ? error.message : 'Impossible de lancer le microservice de creation portable.')
      }
    })

    server.httpServer?.once('close', () => {
      if (portableBuilderProcess && !portableBuilderProcess.killed) {
        portableBuilderProcess.kill()
      }
    })
  }

  return {
    name: 'monatis-portable-builder-launcher',
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), createPdfReaderLauncherPlugin(), createPortableBuilderLauncherPlugin()],
})
