import fs from 'node:fs'
import http from 'node:http'

const PROGRESS_INTERVAL_BYTES = 10 * 1024 * 1024

const RANGE_HEADER_REGEX = /^bytes=(\d+)-(\d*)$/g
function parseRangeHeaderValue(value: string) {
  const matches = value.matchAll(RANGE_HEADER_REGEX)
  const match = matches.next().value
  if (!match) return null

  const start = Number(match.at(1)!)
  if (!Number.isSafeInteger(start)) return null

  const maybeEnd = match.at(2)
  if (maybeEnd === '') return [start, null] as const

  const end = Number(maybeEnd)
  if (!Number.isSafeInteger(end)) return null
  return [start, end] as const
}

function chunkLogger(size: number, mode: string) {
  let bytesSent = 0
  let lastLoggedBytes = 0
  return (chunk: Buffer | string) => {
    bytesSent += chunk.length
    if (bytesSent - lastLoggedBytes >= PROGRESS_INTERVAL_BYTES || bytesSent === size) {
      const progress = size === 0 ? 100 : (bytesSent / size) * 100
      console.log(`Transfer progress (${mode}): ${bytesSent}/${size} bytes (${progress.toFixed(1)}%)`)
      lastLoggedBytes = bytesSent
    }
  }
}

export class HostingServer {
  readonly hostname: string
  port: number
  readonly server: http.Server
  readonly handler: http.RequestListener

  constructor(inputFile: string, port = 0, hostname = '127.0.0.1') {
    this.hostname = hostname
    this.port = port
    try {
      const stats = fs.statSync(inputFile)
      const baseHeaders = {
        'content-length': `${stats.size}`,
        'content-type': 'application/octet-stream',
        'accept-ranges': 'bytes',
      }
      const rangeErrorHeader = {
        ...baseHeaders,
        'content-range': `bytes */${stats.size}`,
      }
      const methodAllowHeader = {
        allow: 'GET, HEAD',
      }

      this.handler = (request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost')
        if (requestUrl.pathname !== '/') {
          response.writeHead(404, { 'Content-Type': 'text/plain' })
          response.end('Not found\n')
          return
        }

        if (request.method === 'HEAD') {
          response.writeHead(200, 'OK', baseHeaders)
          response.end()
          return
        }

        if (request.method !== 'GET') {
          response.writeHead(405, 'Method Not Allowed', methodAllowHeader)
          response.end()
          return
        }

        const header = new Headers(request.headers as Record<string, any>)
        const rangeHeader = header.get('range')

        if (!rangeHeader) {
          response.writeHead(200, 'OK', baseHeaders)
          const fileStream = fs.createReadStream(inputFile)
          fileStream.on('data', chunkLogger(stats.size, 'full'))
          fileStream.on('error', (streamError) => {
            console.error('File stream error:', streamError)
            if (!response.headersSent) {
              response.writeHead(500)
            }
            response.end()
          })
          fileStream.pipe(response)
          return
        }

        const parsedRange = parseRangeHeaderValue(rangeHeader)
        if (!parsedRange) {
          response.writeHead(416, 'Range Not Satisfiable', rangeErrorHeader)
          response.end()
          return
        }

        const [start, maybeEnd] = parsedRange
        const end = maybeEnd === null ? stats.size - 1 : Math.min(maybeEnd, stats.size - 1)
        const contentLength = maybeEnd === null ? stats.size - start : end - start + 1

        if (
          start < 0
          || start >= stats.size
          || (maybeEnd !== null && start > maybeEnd)
          || contentLength <= 0
        ) {
          response.writeHead(416, 'Range Not Satisfiable', rangeErrorHeader)
          response.end()
          return
        }

        const fileStream = fs.createReadStream(inputFile, {
          start,
          end,
        })
        fileStream.on('data', chunkLogger(contentLength, 'range'))
        fileStream.on('error', (streamError) => {
          console.error('File stream error:', streamError)
          if (!response.headersSent) {
            response.writeHead(500)
          }
          response.end()
        })

        const responseHeader = {
          'content-type': 'application/octet-stream',
          'content-length': `${contentLength}`,
          'content-range': `bytes ${start}-${end}/${stats.size}`,
          'accept-ranges': 'bytes',
        }
        response.writeHead(206, 'Partial Content', responseHeader)
        fileStream.pipe(response)
      }
    } catch (statError) {
      throw new Error(`Failed to create a hosting server`, { cause: statError })
    }

    this.server = http.createServer(this.handler)
  }

  get downloadUrl() {
    return `http://${this.hostname}:${this.port}`
  }

  listen() {
    const { resolve, reject, promise } = Promise.withResolvers<void>()
    this.server.listen(this.port, this.hostname, () => {
      const address = this.server.address()
      if (address && typeof address !== 'string') {
        this.port = address.port
      }
      resolve()
    })
    this.server.on('error', reject)
    return promise
  }

  stop() {
    const { resolve, reject, promise } = Promise.withResolvers<void>()
    this.server.close(err => err ? reject(err) : resolve())
    return promise
  }
}

export function createFileStreamingServer(inputFile: string, port?: number, hostname?: string) {
  return new HostingServer(inputFile, port, hostname)
}
