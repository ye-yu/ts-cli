import fs from 'fs'
import path from 'path'
import { spawn } from 'node:child_process'

type WorkerSession = {
  session: string
  reloadRequest: boolean
}

const CACHE_DIR = './cache'
const SESSION_FILE = path.join(CACHE_DIR, 'worker-session.json')

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function createNewSession(): WorkerSession {
  return {
    session: new Date().toISOString(),
    reloadRequest: false,
  }
}

function writeSessionFile(session: WorkerSession) {
  ensureCacheDir()
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2))
}

function readSessionFile(): WorkerSession {
  if (!fs.existsSync(SESSION_FILE)) {
    const newSession = createNewSession()
    writeSessionFile(newSession)
    return newSession
  }
  const content = fs.readFileSync(SESSION_FILE, 'utf-8')
  return JSON.parse(content) as WorkerSession
}

function spawnCliProcess() {
  const { promise, resolve } = Promise.withResolvers<void>()
  const child = spawn('node', ['./cli.ts'], {
    stdio: 'inherit',
    env: process.env,
  })

  child.on('exit', (code) => {
    console.log(`CLI process exited with code ${code}`)
    resolve()
  })

  child.on('error', (error) => {
    console.error('Failed to start CLI process:', error)
    resolve()
  })
  return promise
}

async function main() {
  let shouldRestart = true

  while (shouldRestart) {
    const newSession = createNewSession()
    writeSessionFile(newSession)
    console.log(`Starting CLI process with session: ${newSession.session}`)

    await spawnCliProcess()

    const session = readSessionFile()
    if (session.reloadRequest && session.session === newSession.session) {
      console.log('Reload requested, restarting...')
      shouldRestart = true
    } else {
      shouldRestart = false
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})