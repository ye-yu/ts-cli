import {createHash} from 'node:crypto'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import path from 'node:path'
import {getCurrentDirectory} from './fs.util.ts'

type FetchMetaEntry = {
  etag: string
  cacheFile: string
  updatedAt: string
  method: string
  url: string
}

type FetchMeta = Record<string, FetchMetaEntry>

type CachedResponsePayload = {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyBase64: string
}

const ROOT_DIR = getCurrentDirectory(import.meta.url)
const CACHE_DIR = path.join(ROOT_DIR, 'cache')
const FETCH_META_PATH = path.join(CACHE_DIR, 'fetch-meta.json')

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, {recursive: true})
  }
}

function readFetchMetaSync(): FetchMeta {
  ensureCacheDir()
  if (!existsSync(FETCH_META_PATH)) {
    return {}
  }

  try {
    const raw = readFileSync(FETCH_META_PATH, 'utf8')
    return JSON.parse(raw) as FetchMeta
  } catch {
    return {}
  }
}

function writeFetchMetaSync(meta: FetchMeta): void {
  ensureCacheDir()
  writeFileSync(FETCH_META_PATH, JSON.stringify(meta, null, 2), 'utf8')
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  const objectValue = value as Record<string, unknown>
  const keys = Object.keys(objectValue).sort((a, b) => a.localeCompare(b))
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`)
  return `{${entries.join(',')}}`
}

function hashRequestKey(requestKey: string): string {
  return createHash('sha256').update(requestKey).digest('hex')
}

function serializeHeaders(headers: Headers): Array<[string, string]> {
  return [...headers.entries()].sort((a, b) => {
    const keyDiff = a[0].localeCompare(b[0])
    if (keyDiff !== 0) {
      return keyDiff
    }
    return a[1].localeCompare(b[1])
  })
}

async function serializeRequestKey(request: Request): Promise<string> {
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const body = hasBody ? await request.clone().text().catch(() => '') : ''

  const key = {
    url: request.url,
    method: request.method,
    headers: serializeHeaders(request.headers),
    body,
  }

  return stableStringify(key)
}

function readCachedResponseSync(cachePath: string): CachedResponsePayload | null {
  if (!existsSync(cachePath)) {
    return null
  }

  try {
    const raw = readFileSync(cachePath, 'utf8')
    return JSON.parse(raw) as CachedResponsePayload
  } catch {
    return null
  }
}

function buildCachedResponse(payload: CachedResponsePayload): Response {
  const headers = new Headers(payload.headers)
  const bodyBuffer = Buffer.from(payload.bodyBase64, 'base64')
  return new Response(bodyBuffer, {
    status: payload.status,
    statusText: payload.statusText,
    headers,
  })
}

export async function fetchCached(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const baseRequest = new Request(input, init)
  const requestKey = await serializeRequestKey(baseRequest)
  const meta = readFetchMetaSync()
  const existingMetaEntry = meta[requestKey]

  let requestForFetch = baseRequest
  if (existingMetaEntry?.etag) {
    const headers = new Headers(baseRequest.headers)
    headers.set('If-None-Match', existingMetaEntry.etag)
    requestForFetch = new Request(baseRequest, {headers})
  }

  const response = await fetch(requestForFetch)

  if (response.status === 304) {
    if (!existingMetaEntry) {
      return response
    }

    const cachePath = path.join(CACHE_DIR, existingMetaEntry.cacheFile)
    const cachedPayload = readCachedResponseSync(cachePath)
    if (!cachedPayload) {
      return response
    }

    return buildCachedResponse(cachedPayload)
  }

  const etag = response.headers.get('etag')
  if (!etag) {
    return response
  }

  const cacheFile = `fetch-${hashRequestKey(requestKey)}.json`
  const cachePath = path.join(CACHE_DIR, cacheFile)
  const clone = response.clone()
  const bodyBytes = Buffer.from(await clone.arrayBuffer())

  const serializedResponse: CachedResponsePayload = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    bodyBase64: bodyBytes.toString('base64'),
  }

  ensureCacheDir()
  writeFileSync(cachePath, JSON.stringify(serializedResponse), 'utf8')

  const nextMeta = readFetchMetaSync()
  nextMeta[requestKey] = {
    etag,
    cacheFile,
    updatedAt: new Date().toISOString(),
    method: baseRequest.method,
    url: baseRequest.url,
  }
  writeFetchMetaSync(nextMeta)

  return response
}