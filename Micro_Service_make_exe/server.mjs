import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.MONATIS_PORTABLE_BUILDER_PORT ?? 8095)
const HOST = '127.0.0.1'
const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url))
const FRONT_ROOT = path.resolve(SERVICE_DIR, '..')
const MONATIS_ROOT = path.resolve(FRONT_ROOT, '..')
const DEFAULT_BACK_ROOT = path.resolve(process.env.MONATIS_BACK_ROOT ?? path.join(MONATIS_ROOT, 'MonatisBack-main'))
const WORK_ROOT = path.join(SERVICE_DIR, 'work')
const TOOLS_ROOT = path.join(SERVICE_DIR, 'tools')
const BUNDLED_JDK_ROOT = path.join(TOOLS_ROOT, 'jdk')
const JDK_DOWNLOAD_URL =
  process.env.MONATIS_JDK_DOWNLOAD_URL ??
  'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk'
const MAX_LOG_LINES = 900

const jobs = new Map()

function now() {
  return new Date().toISOString()
}

function isWindows() {
  return process.platform === 'win32'
}

function commandName(command) {
  return isWindows() ? `${command}.cmd` : command
}

function mavenWrapperName() {
  return isWindows() ? 'mvnw.cmd' : 'mvnw'
}

function toolPath(javaHome, command) {
  const executable = isWindows() ? `${command}.exe` : command
  return path.join(javaHome, 'bin', executable)
}

function shouldRunThroughCmd(command) {
  return isWindows() && /\.(bat|cmd)$/i.test(command)
}

function quoteCmdArgument(value) {
  const text = String(value)
  if (!/[\s&()^|<>"]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '\\"')}"`
}

function processInvocation(command, args) {
  if (!shouldRunThroughCmd(command)) {
    return { command, args }
  }

  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', [command, ...args].map(quoteCmdArgument).join(' ')],
  }
}

function javaProcessEnv(javaHome, baseEnv = process.env) {
  const pathKey = Object.keys(baseEnv).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
  const currentPath = baseEnv[pathKey]

  return {
    ...baseEnv,
    JAVA_HOME: javaHome,
    JDK_HOME: javaHome,
    [pathKey]: [path.join(javaHome, 'bin'), currentPath].filter(Boolean).join(path.delimiter),
  }
}

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('error', reject)
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8').trim()
      if (!rawBody) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(rawBody))
      } catch {
        reject(new Error('Corps JSON invalide.'))
      }
    })
  })
}

function text(res, status, body) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function createJob(outputRoot, backRoot, includeData = false) {
  const id = randomUUID()
  const job = {
    id,
    status: 'queued',
    phase: 'Preparation',
    progress: 0,
    createdAt: now(),
    updatedAt: now(),
    outputRoot,
    backRoot,
    includeData,
    outputPath: null,
    exportPath: null,
    archivePath: null,
    stamp: null,
    error: null,
    logs: [],
  }
  jobs.set(id, job)
  return job
}

function jobView(job) {
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    outputRoot: job.outputRoot,
    backRoot: job.backRoot,
    includeData: job.includeData,
    outputPath: job.outputPath,
    exportPath: job.exportPath,
    error: job.error,
    logs: job.logs.slice(-120),
  }
}

function updateJob(job, patch) {
  Object.assign(job, patch, { updatedAt: now() })
}

function log(job, message) {
  const line = `[${new Date().toLocaleTimeString('fr-FR')}] ${message}`
  job.logs.push(line)
  if (job.logs.length > MAX_LOG_LINES) {
    job.logs.splice(0, job.logs.length - MAX_LOG_LINES)
  }
  job.updatedAt = now()
  console.log(`[${job.id}] ${message}`)
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function isBackServiceRunning() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 800)

  try {
    await fetch('http://127.0.0.1:8082/', { signal: controller.signal })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}

async function hasBackDataDirectory(backRoot) {
  const dataDir = path.join(backRoot, 'data')
  try {
    const stat = await fs.stat(dataDir)
    return stat.isDirectory()
  } catch {
    return false
  }
}

function runProcess(job, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    if (job) {
      log(job, `> ${command} ${args.join(' ')}`)
    } else {
      console.log(`> ${command} ${args.join(' ')}`)
    }
    const invocation = processInvocation(command, args)
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: true,
    })

    const logStream = options.logFile ? createWriteStream(options.logFile, { flags: 'a' }) : null

    const handleData = (data) => {
      const textValue = data.toString()
      logStream?.write(textValue)
      for (const rawLine of textValue.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (line) {
          if (job) {
            log(job, line)
          } else {
            console.log(line)
          }
        }
      }
    }

    child.stdout.on('data', handleData)
    child.stderr.on('data', handleData)
    child.on('error', (error) => {
      logStream?.end()
      reject(error)
    })
    child.on('close', (code) => {
      logStream?.end()
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Commande terminee avec le code ${code}: ${command}`))
      }
    })
  })
}

function runCapture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      shell: false,
      windowsHide: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim())
      } else {
        const error = new Error(stderr.trim() || stdout.trim() || `Commande terminee avec le code ${code}`)
        error.code = code
        reject(error)
      }
    })
  })
}

async function retryFileOperation(action, attempts = 5) {
  let lastError = null
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action()
    } catch (error) {
      lastError = error
      if (attempt === attempts) {
        break
      }
      await sleep(250 * attempt)
    }
  }

  throw lastError
}

async function resolveOutputRoot(value) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : path.join(os.homedir(), 'Downloads')
  if (!path.isAbsolute(requested)) {
    throw new Error('Le dossier de sortie doit etre un chemin absolu.')
  }

  const resolved = path.resolve(requested)

  try {
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) {
      throw new Error(`Le chemin de sortie n'est pas un dossier: ${resolved}`)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
    await ensureDir(resolved)
  }

  return resolved
}

async function resolveBackRoot(value) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_BACK_ROOT
  if (!path.isAbsolute(requested)) {
    throw new Error('Le dossier du back doit etre un chemin absolu.')
  }

  const resolved = path.resolve(requested)
  const stat = await fs.stat(resolved).catch((error) => {
    if (error?.code === 'ENOENT') {
      throw new Error(`Le dossier du back est introuvable: ${resolved}`)
    }
    throw error
  })

  if (!stat.isDirectory()) {
    throw new Error(`Le chemin du back n'est pas un dossier: ${resolved}`)
  }

  const wrapper = path.join(resolved, mavenWrapperName())
  const pom = path.join(resolved, 'pom.xml')
  if (!(await exists(wrapper)) || !(await exists(pom))) {
    throw new Error(`Le dossier choisi ne ressemble pas au back MONATIS: ${resolved}`)
  }

  return resolved
}

function existingDirectoryFallback(value) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_BACK_ROOT
  const resolved = path.resolve(requested)
  if (existsSync(resolved)) {
    return resolved
  }
  if (existsSync(DEFAULT_BACK_ROOT)) {
    return DEFAULT_BACK_ROOT
  }
  return MONATIS_ROOT
}

async function selectOutputDirectory(value) {
  let fallback
  try {
    fallback = await resolveOutputRoot(value)
  } catch {
    fallback = await resolveOutputRoot()
  }
  if (!isWindows()) {
    return fallback
  }

  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Choisir le dossier d'export MONATIS portable"
$dialog.ShowNewFolderButton = $true
if (Test-Path -LiteralPath $env:MONATIS_OUTPUT_ROOT) {
  $dialog.SelectedPath = $env:MONATIS_OUTPUT_ROOT
}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
  exit 0
}
exit 2
`

  const selected = await runCapture('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    env: {
      ...process.env,
      MONATIS_OUTPUT_ROOT: fallback,
    },
  })

  return resolveOutputRoot(selected)
}

async function selectBackDirectory(value) {
  const fallback = existingDirectoryFallback(value)
  if (!isWindows()) {
    return resolveBackRoot(fallback)
  }

  const script = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Choisir le dossier du back MONATIS a empaqueter"
$dialog.ShowNewFolderButton = $false
if (Test-Path -LiteralPath $env:MONATIS_BACK_ROOT) {
  $dialog.SelectedPath = $env:MONATIS_BACK_ROOT
}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.SelectedPath
  exit 0
}
exit 2
`

  const selected = await runCapture('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    env: {
      ...process.env,
      MONATIS_BACK_ROOT: fallback,
    },
  })

  return resolveBackRoot(selected)
}

async function uniqueExportFolder(outputRoot, stamp) {
  for (let index = 1; index <= 99; index += 1) {
    const suffix = index === 1 ? '' : `-${index}`
    const candidate = path.join(outputRoot, `MonatisPortable-${stamp}${suffix}`)
    if (!(await exists(candidate))) {
      return candidate
    }
  }

  throw new Error(`Impossible de trouver un nom de dossier libre dans ${outputRoot}.`)
}

async function copyDirectoryRobust(source, target, job, label) {
  await ensureDir(path.dirname(target))
  await retryFileOperation(() => fs.rm(target, { recursive: true, force: true }))
  await retryFileOperation(() => fs.cp(source, target, { recursive: true, force: true }), 8)
  log(job, `${label}: copie terminee vers ${target}.`)
}

async function findBundledJavaHome() {
  const candidates = [BUNDLED_JDK_ROOT]

  try {
    const entries = await fs.readdir(BUNDLED_JDK_ROOT, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        candidates.push(path.join(BUNDLED_JDK_ROOT, entry.name))
      }
    }
  } catch {
    // The bundled JDK directory is optional. It can be downloaded on demand.
  }

  for (const candidate of candidates) {
    if (await hasRequiredJavaTools(candidate)) {
      return path.resolve(candidate)
    }
  }

  return null
}

async function installBundledJdk(job = null) {
  if (!isWindows()) {
    return null
  }

  const existing = await findBundledJavaHome()
  if (existing) {
    return existing
  }

  const downloadDir = path.join(WORK_ROOT, 'jdk-download')
  const zipPath = path.join(downloadDir, 'jdk.zip')
  const extractDir = path.join(downloadDir, 'extract')
  await ensureDir(downloadDir)
  await fs.rm(zipPath, { force: true })
  await fs.rm(extractDir, { recursive: true, force: true })

  if (job) {
    log(job, 'JDK embarque introuvable: telechargement automatique du JDK portable.')
  }

  const response = await fetch(JDK_DOWNLOAD_URL, {
    headers: {
      'User-Agent': 'monatis-portable-builder',
    },
  })
  if (!response.ok || !response.body) {
    throw new Error(`Telechargement du JDK impossible: HTTP ${response.status}`)
  }

  await pipeline(Readable.fromWeb(response.body), createWriteStream(zipPath))
  await ensureDir(extractDir)
  await runProcess(
    job,
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Expand-Archive -LiteralPath $env:MONATIS_JDK_ZIP -DestinationPath $env:MONATIS_JDK_EXTRACT -Force'],
    {
      env: {
        ...process.env,
        MONATIS_JDK_ZIP: zipPath,
        MONATIS_JDK_EXTRACT: extractDir,
      },
    },
  )

  const extractedCandidates = []
  const entries = await fs.readdir(extractDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory()) {
      extractedCandidates.push(path.join(extractDir, entry.name))
    }
  }
  extractedCandidates.unshift(extractDir)

  const extractedJdk = await findFirstJavaHome(extractedCandidates)
  if (!extractedJdk) {
    throw new Error('Le JDK telecharge ne contient pas javac, jar et jpackage.')
  }

  await fs.rm(BUNDLED_JDK_ROOT, { recursive: true, force: true })
  await ensureDir(path.dirname(BUNDLED_JDK_ROOT))
  await fs.cp(extractedJdk, BUNDLED_JDK_ROOT, { recursive: true, force: true })
  await fs.rm(downloadDir, { recursive: true, force: true })

  const installed = await findBundledJavaHome()
  if (!installed) {
    throw new Error(`Installation du JDK embarque incomplete: ${BUNDLED_JDK_ROOT}`)
  }

  if (job) {
    log(job, `JDK embarque installe: ${installed}`)
  }
  return installed
}

async function findFirstJavaHome(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    if (await hasRequiredJavaTools(candidate)) {
      return path.resolve(candidate)
    }
  }

  return null
}

async function detectJavaHome(options = {}) {
  const explicitJavaHome = process.env.MONATIS_JAVA_HOME
  const bundledJavaHome = await findBundledJavaHome()
  const candidates = [explicitJavaHome, bundledJavaHome, process.env.JAVA_HOME].filter(Boolean)

  const configured = await findFirstJavaHome(candidates)
  if (configured) {
    return configured
  }

  if (isWindows()) {
    try {
      const javaPath = (await runCapture('where.exe', ['java'])).split(/\r?\n/)[0]?.trim()
      if (javaPath) {
        const candidate = path.resolve(javaPath, '..', '..')
        if (await hasRequiredJavaTools(candidate)) {
          return candidate
        }
      }
    } catch {
      // PATH lookup is optional; the bundled JDK installer can still be used.
    }
  }

  if (options.installBundled === true) {
    return installBundledJdk(options.job ?? null)
  }

  return null
}

async function hasRequiredJavaTools(javaHome) {
  return (
    (await exists(toolPath(javaHome, 'java'))) &&
    (await exists(toolPath(javaHome, 'javac'))) &&
    (await exists(toolPath(javaHome, 'jar'))) &&
    (await exists(toolPath(javaHome, 'jpackage')))
  )
}

async function findBackJar(backRoot) {
  const targetDir = path.join(backRoot, 'target')
  const entries = await fs.readdir(targetDir, { withFileTypes: true })
  const jars = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jar') || entry.name.endsWith('.original')) {
      continue
    }
    const fullPath = path.join(targetDir, entry.name)
    const stat = await fs.stat(fullPath)
    jars.push({ fullPath, mtime: stat.mtimeMs })
  }

  jars.sort((left, right) => right.mtime - left.mtime)
  return jars[0]?.fullPath ?? null
}

async function copyDirectoryIfExists(source, target, job, label) {
  if (!(await exists(source))) {
    await ensureDir(target)
    log(job, `${label}: dossier absent, creation d'un dossier vide.`)
    return
  }
  await retryFileOperation(() => fs.rm(target, { recursive: true, force: true }))
  await retryFileOperation(() => fs.cp(source, target, { recursive: true, force: true }), 6)
  log(job, `${label}: copie terminee.`)
}

function timestampName() {
  const date = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

async function injectFrontIntoBackJar(job, javaHome, backJar, frontDist, tempDir) {
  const patchRoot = path.join(tempDir, 'jar-patch')
  const staticTarget = path.join(patchRoot, 'BOOT-INF', 'classes', 'static')
  await fs.rm(patchRoot, { recursive: true, force: true })
  await ensureDir(staticTarget)
  await fs.cp(frontDist, staticTarget, { recursive: true })
  await runProcess(job, toolPath(javaHome, 'jar'), ['uf', backJar, '-C', patchRoot, 'BOOT-INF/classes/static'], { cwd: tempDir })
}

function launcherSource() {
  return String.raw`import java.awt.BorderLayout;
import java.awt.Desktop;
import java.io.File;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;

public final class MonatisLauncher {
  private static Process backProcess;
  private static final String APP_URL = "http://127.0.0.1:8082";

  public static void main(String[] args) throws Exception {
    try {
      run();
    } catch (Exception error) {
      showFatalError(error);
      throw error;
    }
  }

  private static void run() throws Exception {
    Path appDir = Paths.get(MonatisLauncher.class.getProtectionDomain().getCodeSource().getLocation().toURI()).getParent();
    Path rootDir = appDir.getParent();
    Files.createDirectories(rootDir.resolve("data"));
    Files.createDirectories(rootDir.resolve("sauvegardes"));
    Files.createDirectories(rootDir.resolve("echanges"));
    Files.createDirectories(rootDir.resolve("logs"));

    startBack(rootDir, appDir);
    Runtime.getRuntime().addShutdownHook(new Thread(MonatisLauncher::stopBack));

    SwingUtilities.invokeLater(() -> showWindow(rootDir));
    new Thread(() -> {
      waitForBack();
      openMonatis();
    }, "monatis-open-browser").start();
  }

  private static void startBack(Path rootDir, Path appDir) throws Exception {
    boolean windows = System.getProperty("os.name").toLowerCase().contains("win");
    Path javaExe = rootDir.resolve("runtime").resolve("bin").resolve(windows ? "java.exe" : "java");
    Path backJar = appDir.resolve("monatis-back.jar");
    if (!Files.exists(javaExe)) {
      throw new IllegalStateException("Runtime Java introuvable: " + javaExe);
    }
    if (!Files.exists(backJar)) {
      throw new IllegalStateException("Jar back introuvable: " + backJar);
    }

    List<String> command = new ArrayList<>();
    command.add(javaExe.toString());
    command.add("-jar");
    command.add(backJar.toString());
    command.add("--server.port=8082");
    command.add("--spring.datasource.url=jdbc:h2:file:./data/monatis");

    ProcessBuilder builder = new ProcessBuilder(command);
    builder.directory(rootDir.toFile());
    builder.redirectOutput(ProcessBuilder.Redirect.appendTo(rootDir.resolve("logs").resolve("monatis-back.log").toFile()));
    builder.redirectError(ProcessBuilder.Redirect.appendTo(rootDir.resolve("logs").resolve("monatis-back.err.log").toFile()));
    backProcess = builder.start();
  }

  private static void showWindow(Path rootDir) {
    JFrame frame = new JFrame("MONATIS");
    JLabel label = new JLabel("<html><b>MONATIS est lance.</b><br>Le navigateur s'ouvre automatiquement. Les logs sont dans " + rootDir.resolve("logs") + ".</html>");
    JButton openButton = new JButton("Ouvrir MONATIS");
    JButton quitButton = new JButton("Quitter");
    JPanel buttons = new JPanel();

    openButton.addActionListener(event -> openMonatis());
    quitButton.addActionListener(event -> {
      stopBack();
      System.exit(0);
    });
    buttons.add(openButton);
    buttons.add(quitButton);

    frame.setLayout(new BorderLayout(12, 12));
    frame.add(label, BorderLayout.CENTER);
    frame.add(buttons, BorderLayout.SOUTH);
    frame.setSize(520, 150);
    frame.setLocationRelativeTo(null);
    frame.setDefaultCloseOperation(JFrame.DO_NOTHING_ON_CLOSE);
    frame.addWindowListener(new java.awt.event.WindowAdapter() {
      @Override
      public void windowClosing(java.awt.event.WindowEvent event) {
        stopBack();
        System.exit(0);
      }
    });
    frame.setVisible(true);
  }

  private static void showFatalError(Exception error) {
    SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(
      null,
      "<html><b>MONATIS n'a pas pu demarrer.</b><br>" + error.getMessage() + "<br><br>Verifiez que le dossier portable complet a ete extrait avant de lancer Monatis.exe.</html>",
      "MONATIS",
      JOptionPane.ERROR_MESSAGE
    ));
  }

  private static void waitForBack() {
    long deadline = System.currentTimeMillis() + 60000;
    while (System.currentTimeMillis() < deadline) {
      try {
        HttpURLConnection connection = (HttpURLConnection) new URL(APP_URL).openConnection();
        connection.setConnectTimeout(1000);
        connection.setReadTimeout(1000);
        connection.setRequestMethod("GET");
        int status = connection.getResponseCode();
        if (status >= 200 && status < 500) {
          return;
        }
      } catch (Exception ignored) {
      }

      try {
        Thread.sleep(1000);
      } catch (InterruptedException ignored) {
        Thread.currentThread().interrupt();
        return;
      }
    }
  }

  private static void openMonatis() {
    try {
      URI uri = URI.create(APP_URL);
      if (Desktop.isDesktopSupported()) {
        Desktop.getDesktop().browse(uri);
        return;
      }
      if (System.getProperty("os.name").toLowerCase().contains("win")) {
        Runtime.getRuntime().exec(new String[] {"rundll32", "url.dll,FileProtocolHandler", uri.toString()});
      }
    } catch (Exception ignored) {
    }
  }

  private static void stopBack() {
    if (backProcess == null || !backProcess.isAlive()) {
      return;
    }
    backProcess.destroy();
    try {
      if (!backProcess.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)) {
        backProcess.destroyForcibly();
      }
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
      backProcess.destroyForcibly();
    }
  }
}
`
}

async function buildLauncher(job, javaHome, tempDir, inputDir) {
  const sourceDir = path.join(tempDir, 'launcher-src')
  await ensureDir(sourceDir)
  const javaFile = path.join(sourceDir, 'MonatisLauncher.java')
  await fs.writeFile(javaFile, launcherSource(), 'utf8')
  await runProcess(job, toolPath(javaHome, 'javac'), [javaFile], { cwd: sourceDir })
  const classFiles = (await fs.readdir(sourceDir)).filter((name) => /^MonatisLauncher.*\.class$/.test(name)).sort()
  if (!classFiles.includes('MonatisLauncher.class')) {
    throw new Error('Compilation du lanceur incomplete: MonatisLauncher.class introuvable.')
  }
  log(job, `Classes du lanceur empaquetees: ${classFiles.join(', ')}`)
  await runProcess(job, toolPath(javaHome, 'jar'), ['cfe', path.join(inputDir, 'monatis-launcher.jar'), 'MonatisLauncher', ...classFiles], {
    cwd: sourceDir,
  })
}

async function ensureRuntimeJavaExecutable(javaHome, imageFolder, job) {
  const runtimeBin = path.join(imageFolder, 'runtime', 'bin')
  const javaExe = path.join(runtimeBin, isWindows() ? 'java.exe' : 'java')
  if (await exists(javaExe)) {
    return
  }

  const sourceJava = toolPath(javaHome, 'java')
  if (!(await exists(sourceJava))) {
    throw new Error(`Executable Java introuvable dans le JDK: ${sourceJava}`)
  }

  await fs.copyFile(sourceJava, javaExe)
  log(job, `Runtime portable: ${path.basename(javaExe)} ajoute dans runtime/bin.`)
}

async function writeWindowsFallbackLauncher(finalFolder) {
  if (!isWindows()) {
    return
  }

  const content = `@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime\\bin\\java.exe" (
  echo Runtime Java introuvable.
  echo Le dossier portable doit etre extrait completement avant lancement.
  echo.
  pause
  exit /b 1
)
if not exist "app\\monatis-launcher.jar" (
  echo Lanceur MONATIS introuvable: app\\monatis-launcher.jar
  echo.
  pause
  exit /b 1
)
"%~dp0runtime\\bin\\java.exe" -jar "%~dp0app\\monatis-launcher.jar"
if errorlevel 1 (
  echo.
  echo MONATIS s'est arrete avec une erreur. Consultez le dossier logs.
  pause
)
`
  await fs.writeFile(path.join(finalFolder, 'Lancer-Monatis.bat'), content, 'utf8')
}

async function writePortableReadme(finalFolder) {
  const content = `# MONATIS portable

Extraire ou copier le dossier portable complet avant lancement.

Lancement recommande :
- double-cliquer sur Monatis.exe ;
- si Windows affiche "Failed to launch JVM", lancer Lancer-Monatis.bat depuis le meme dossier.

Ne pas lancer Monatis.exe directement depuis l'interieur du fichier ZIP : il faut d'abord extraire l'archive.

Le lanceur ouvre http://127.0.0.1:8082 dans le navigateur et garde une petite fenetre de controle.
Fermer cette fenetre avec Quitter pour arreter le back proprement.

Dossiers utiles :
- data : base H2 portable.
- sauvegardes : sauvegardes MONATIS.
- echanges : imports/exports CSV et scripts.
- logs : logs du back portable.

Si Windows affiche SmartScreen, c'est attendu pour un executable local non signe.
`
  await fs.writeFile(path.join(finalFolder, 'README-portable.txt'), content, 'utf8')
}

async function runBuild(job) {
  updateJob(job, { status: 'running', phase: 'Verification des pre-requis', progress: 5 })
  await ensureDir(WORK_ROOT)
  const backRoot = await resolveBackRoot(job.backRoot)

  if (!(await exists(FRONT_ROOT)) || !(await exists(path.join(FRONT_ROOT, 'package.json')))) {
    throw new Error(`Front introuvable: ${FRONT_ROOT}`)
  }
  log(job, `Back utilise: ${backRoot}`)

  const javaHome = await detectJavaHome({ installBundled: true, job })
  if (!javaHome) {
    throw new Error('JDK complet introuvable. Le telechargement automatique du JDK embarque a echoue.')
  }
  log(job, `JDK utilise: ${javaHome}`)

  const jobWorkDir = path.join(WORK_ROOT, job.id)
  const inputDir = path.join(jobWorkDir, 'jpackage-input')
  const imageDest = path.join(jobWorkDir, 'jpackage-output')
  const stamp = timestampName()
  const internalFolder = path.join(imageDest, 'Monatis')
  const buildLog = path.join(jobWorkDir, 'build.log')

  await fs.rm(jobWorkDir, { recursive: true, force: true })
  await ensureDir(inputDir)
  await ensureDir(imageDest)
  updateJob(job, { stamp })

  updateJob(job, { phase: 'Build du front', progress: 15 })
  await runProcess(job, commandName('npm'), ['run', 'build'], {
    cwd: FRONT_ROOT,
    logFile: buildLog,
    env: {
      ...process.env,
      VITE_MONATIS_API_URL: '',
    },
  })

  updateJob(job, { phase: 'Build du back', progress: 35 })
  await runProcess(job, path.join(backRoot, mavenWrapperName()), ['clean', 'package', '-Dmaven.test.skip=true'], {
    cwd: backRoot,
    logFile: buildLog,
    env: javaProcessEnv(javaHome),
  })

  const builtBackJar = await findBackJar(backRoot)
  if (!builtBackJar) {
    throw new Error(`Aucun jar back trouve dans ${path.join(backRoot, 'target')}.`)
  }
  log(job, `Jar back detecte: ${builtBackJar}`)

  updateJob(job, { phase: 'Assemblage front + back', progress: 52 })
  const portableBackJar = path.join(inputDir, 'monatis-back.jar')
  await fs.copyFile(builtBackJar, portableBackJar)
  await injectFrontIntoBackJar(job, javaHome, portableBackJar, path.join(FRONT_ROOT, 'dist'), jobWorkDir)

  updateJob(job, { phase: 'Creation du lanceur', progress: 64 })
  await buildLauncher(job, javaHome, jobWorkDir, inputDir)

  updateJob(job, { phase: 'Creation de Monatis.exe', progress: 76 })
  await runProcess(
    job,
    toolPath(javaHome, 'jpackage'),
    [
      '--type',
      'app-image',
      '--name',
      'Monatis',
      '--input',
      inputDir,
      '--main-jar',
      'monatis-launcher.jar',
      '--dest',
      imageDest,
      '--app-version',
      '1.0.0',
      '--vendor',
      'MONATIS',
    ],
    { cwd: jobWorkDir, logFile: buildLog },
  )

  if (!(await exists(internalFolder))) {
    throw new Error(`Image jpackage introuvable: ${internalFolder}`)
  }

  updateJob(job, { phase: 'Finalisation interne', progress: 88 })
  await ensureRuntimeJavaExecutable(javaHome, internalFolder, job)
  await ensureDir(path.join(internalFolder, 'data'))
  await ensureDir(path.join(internalFolder, 'logs'))
  await copyDirectoryIfExists(path.join(backRoot, 'sauvegardes'), path.join(internalFolder, 'sauvegardes'), job, 'Sauvegardes')
  await copyDirectoryIfExists(path.join(backRoot, 'echanges'), path.join(internalFolder, 'echanges'), job, 'Echanges')

  const shouldIncludeData = job.includeData || process.env.MONATIS_PORTABLE_COPY_DATA === '1'
  if (shouldIncludeData) {
    if (await isBackServiceRunning()) {
      throw new Error('Base H2 non copiee: le back local repond encore sur 127.0.0.1:8082. Arrete le back avant de creer un portable avec la base actuelle.')
    }
    if (!(await hasBackDataDirectory(backRoot))) {
      throw new Error(`Base H2 demandee mais dossier data introuvable: ${path.join(backRoot, 'data')}`)
    }
    await copyDirectoryIfExists(path.join(backRoot, 'data'), path.join(internalFolder, 'data'), job, 'Base H2')
  } else {
    log(job, 'Base H2: non copiee par defaut. Le portable creera ou utilisera sa propre base dans data/.')
  }

  await writePortableReadme(internalFolder)
  await writeWindowsFallbackLauncher(internalFolder)
  updateJob(job, {
    status: 'success',
    phase: 'Termine',
    progress: 100,
    outputPath: internalFolder,
  })
  log(job, `Image portable prete dans le dossier de travail: ${internalFolder}`)
}

async function exportBuild(job, outputRoot) {
  if (job.status !== 'success' || !job.outputPath || !(await exists(job.outputPath))) {
    throw new Error("Aucune image portable terminee n'est disponible pour l'export.")
  }

  const resolvedOutputRoot = await resolveOutputRoot(outputRoot ?? job.outputRoot)
  const finalFolder = await uniqueExportFolder(resolvedOutputRoot, job.stamp ?? timestampName())
  await copyDirectoryRobust(job.outputPath, finalFolder, job, 'Export portable')
  updateJob(job, {
    outputRoot: resolvedOutputRoot,
    exportPath: finalFolder,
  })
  return job
}

async function createArchive(job) {
  if (job.status !== 'success' || !job.outputPath || !(await exists(job.outputPath))) {
    throw new Error("Aucune image portable terminee n'est disponible pour le telechargement.")
  }

  const archivePath = path.join(WORK_ROOT, job.id, `MonatisPortable-${job.stamp ?? job.id}.zip`)
  if (await exists(archivePath)) {
    updateJob(job, { archivePath })
    return archivePath
  }

  const javaHome = await detectJavaHome({ installBundled: true, job })
  if (!javaHome) {
    throw new Error('JDK complet introuvable. Impossible de generer le ZIP.')
  }

  await retryFileOperation(() => fs.rm(archivePath, { force: true }))
  log(job, `Creation de l'archive ZIP: ${archivePath}`)
  await runProcess(job, toolPath(javaHome, 'jar'), ['--create', '--file', archivePath, '-C', job.outputPath, '.'], {
    cwd: path.dirname(job.outputPath),
  })
  updateJob(job, { archivePath })
  return archivePath
}

async function streamArchive(res, archivePath) {
  const stat = await fs.stat(archivePath)
  const fileName = path.basename(archivePath).replace(/["\\]/g, '')
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Content-Type': 'application/zip',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${fileName}"`,
  })

  await new Promise((resolve, reject) => {
    const stream = createReadStream(archivePath)
    stream.on('error', reject)
    stream.on('end', resolve)
    stream.pipe(res)
  })
}

async function startBuild(req, res) {
  const running = [...jobs.values()].find((job) => job.status === 'queued' || job.status === 'running')
  if (running) {
    json(res, 409, { message: 'Un build portable est deja en cours.', job: jobView(running) })
    return
  }

  let outputRoot
  let backRoot
  let includeData = false
  try {
    const payload = await readJson(req)
    outputRoot = await resolveOutputRoot(payload.outputRoot)
    backRoot = await resolveBackRoot(payload.backRoot)
    includeData = payload.includeData === true
    if (includeData && !(await hasBackDataDirectory(backRoot))) {
      throw new Error(`Le dossier data du back choisi est introuvable: ${path.join(backRoot, 'data')}`)
    }
    if (includeData && (await isBackServiceRunning())) {
      throw new Error('Arrete le back local sur 127.0.0.1:8082 avant de copier la base H2 dans le portable.')
    }
  } catch (error) {
    json(res, 400, { message: error.message })
    return
  }

  const job = createJob(outputRoot, backRoot, includeData)
  json(res, 202, { job: jobView(job) })
  runBuild(job).catch((error) => {
    updateJob(job, {
      status: 'error',
      phase: 'Erreur',
      error: error.message,
    })
    log(job, `ERREUR: ${error.stack ?? error.message}`)
  })
}

async function chooseOutputDirectory(req, res) {
  try {
    const payload = await readJson(req)
    const outputRoot = await selectOutputDirectory(payload.outputRoot)
    json(res, 200, { outputRoot })
  } catch (error) {
    json(res, error?.code === 2 ? 400 : 500, {
      message: error?.code === 2 ? 'Selection du dossier annulee.' : error.message,
    })
  }
}

async function chooseBackDirectory(req, res) {
  try {
    const payload = await readJson(req)
    const backRoot = await selectBackDirectory(payload.backRoot)
    json(res, 200, { backRoot })
  } catch (error) {
    json(res, error?.code === 2 ? 400 : 500, {
      message: error?.code === 2 ? 'Selection du dossier annulee.' : error.message,
    })
  }
}

async function inspectBackDirectory(req, res) {
  try {
    const payload = await readJson(req)
    const backRoot = await resolveBackRoot(payload.backRoot)
    const backDataDirectory = path.join(backRoot, 'data')
    const [backServiceRunning, backDataDirectoryExists] = await Promise.all([isBackServiceRunning(), hasBackDataDirectory(backRoot)])
    json(res, 200, {
      valid: true,
      backRoot,
      backDataDirectory,
      backDataDirectoryExists,
      backServiceRunning,
    })
  } catch (error) {
    json(res, 400, { message: error.message })
  }
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }

  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/api/status') {
    const javaHome = await detectJavaHome()
    const bundledJavaHome = await findBundledJavaHome()
    const backDataDirectory = path.join(DEFAULT_BACK_ROOT, 'data')
    const [backServiceRunning, backDataDirectoryExists] = await Promise.all([isBackServiceRunning(), hasBackDataDirectory(DEFAULT_BACK_ROOT)])
    json(res, 200, {
      ok: true,
      service: 'monatis-portable-builder',
      host: HOST,
      port: PORT,
      frontRoot: FRONT_ROOT,
      backRoot: DEFAULT_BACK_ROOT,
      defaultBackRoot: DEFAULT_BACK_ROOT,
      javaHome,
      jdkReady: Boolean(javaHome),
      bundledJavaHome,
      bundledJdkDirectory: BUNDLED_JDK_ROOT,
      bundledJdkReady: Boolean(bundledJavaHome),
      jdkAutoInstallAvailable: isWindows(),
      busy: [...jobs.values()].some((job) => job.status === 'queued' || job.status === 'running'),
      defaultOutputDirectory: path.join(os.homedir(), 'Downloads'),
      backServiceRunning,
      backDataDirectory,
      backDataDirectoryExists,
    })
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/build-portable') {
    await startBuild(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/select-output-directory') {
    await chooseOutputDirectory(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/select-back-directory') {
    await chooseBackDirectory(req, res)
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/inspect-back-directory') {
    await inspectBackDirectory(req, res)
    return
  }

  const jobMatch = url.pathname.match(/^\/api\/build-portable\/jobs\/([^/]+)(?:\/(logs|export|download))?$/)
  if (jobMatch) {
    const job = jobs.get(jobMatch[1])
    if (!job) {
      json(res, 404, { message: 'Job introuvable.' })
      return
    }

    const action = jobMatch[2]
    if (req.method === 'GET' && action === 'logs') {
      text(res, 200, job.logs.join('\n'))
      return
    }

    if (req.method === 'POST' && action === 'export') {
      try {
        const payload = await readJson(req)
        const exportedJob = await exportBuild(job, payload.outputRoot)
        json(res, 200, { job: jobView(exportedJob) })
      } catch (error) {
        json(res, 400, { message: error.message })
      }
      return
    }

    if (req.method === 'GET' && action === 'download') {
      try {
        const archivePath = await createArchive(job)
        await streamArchive(res, archivePath)
      } catch (error) {
        json(res, 400, { message: error.message })
      }
      return
    }

    if (req.method !== 'GET' || action) {
      json(res, 405, { message: 'Methode non autorisee.' })
      return
    }

    json(res, 200, { job: jobView(job) })
    return
  }

  json(res, 404, { message: 'Route introuvable.' })
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error)
    json(res, 500, { message: error.message })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`MONATIS portable builder listening on http://${HOST}:${PORT}`)
  console.log(`Front root: ${FRONT_ROOT}`)
  console.log(`Default back root: ${DEFAULT_BACK_ROOT}`)
})
