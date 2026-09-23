import { parentPort, workerData } from 'node:worker_threads'
import { createWriteStream, mkdirSync } from '../fs.util.ts';
import path from 'node:path';
import http from 'node:http'

function requireInteger(value: any, name: string, validations: string[]): value is number {
  if (Number.isSafeInteger(value) && Math.round(value) === value) {
    return true;
  }
  validations.push(`${name} must be an integer`)
  return false
}

function requireString(value: any, name: string, validations: string[]): value is string {
  if (typeof value === 'string' && value.length) {
    return true;
  }
  validations.push(`${name} must be a non-empty string`)
  return false
}

function coalesceObject(value: any): Record<string, any> {
  if (typeof value !== 'object' || value === null) {
    return {}
  }
  return value
}

function getWorkerData(): DownloaderWorkerData {
  const { url, start, end } = coalesceObject(workerData)

  const validations: string[] = []
  requireString(url, 'url', validations)
  requireInteger(start, 'start', validations)
  requireInteger(end, 'end', validations)

  if (validations.length) {
    throw new Error(`Validation failed: ${validations.join(', ')}`, { cause: { workerData } })
  }

  return { url, start, end }
}

async function worker() {
  const { url, start, end } = getWorkerData()
  const range = end - start
  const tempDir = `./temp`
  const target = `data-${start}-${end}`
  mkdirSync(import.meta.url, tempDir)

  const targetFullPath = path.join(tempDir, target)
  console.log("download requested for", url, start, end)
  const headers = {
    range: `bytes=${start}-${end}`
  }
  let progress = 0
  let chunks = 0
  const ws = createWriteStream(import.meta.url, targetFullPath)

  const { resolve, reject, promise } = Promise.withResolvers<void>()
  http.get(url, { headers }, (response) => {
    if (!`${response.statusCode}`.startsWith('2')) {
      response.resume()
      console.error(`Download failed with HTTP ${response.statusCode}`)
      process.exitCode = 1
      return
    }

    response.on('data', chunk => {
      chunks += chunk.length
      const newProgress = Math.floor((chunks / range) * 50 ) * 2
      if (newProgress === progress) return
      progress = newProgress
      parentPort?.postMessage(createProgressEvent(progress))
    })
    response.on('end', () => {
      parentPort?.postMessage({ progress: 100, event: 'progress' })
      resolve()
    })
    response.on('error', reject)
    response.pipe(ws)
  })
  await promise
}

function parent() {
  console.log("Running on main thread")
}

export type DownloaderWorkerData = {
  url: string,
  start: number,
  end: number,
}

export type ProgressEvent = {
  event: 'progress'
  progress: number
}

function createProgressEvent(progress: number): ProgressEvent {
  return { event: 'progress', progress }
}

export type Events = ProgressEvent

if (parentPort) {
  worker()
} else {
  parent()
}
