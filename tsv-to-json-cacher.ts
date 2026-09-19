import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';
import yauzl from 'yauzl'
import { newProgressLoader, stringifier, type ProgressInfo, type ProgressLoader } from './progress-loader.util.ts';
import { streamFromNodeJSReadable, streamLineFromNodeJsReadable } from './stream.util.ts';

const currentFilePath = fileURLToPath(import.meta.url)
const cachePath = path.join(path.dirname(currentFilePath), 'cache')
fs.mkdirSync(cachePath, { recursive: true })
const cacheMetaPath = path.join(cachePath, 'cache-meta.json')

function abbreviateCount(value: number): string {
  const units = ['', 'K', 'M', 'G', 'T']
  let num = Math.max(0, value)
  let unitIndex = 0

  while (num >= 1000 && unitIndex < units.length - 1) {
    num /= 1000
    unitIndex += 1
  }

  const rounded = num >= 100 ? Math.round(num) : Math.round(num * 10) / 10
  return `${rounded}${units[unitIndex]}`
}

function abbreviateBytesPerSecond(value: number): string {
  return `${abbreviateCount(value)}/s`
}

function createSpeedTracker() {
  let lastTimestamp = Date.now()
  let pendingBytes = 0
  let currentSpeed = 0

  const tracker = {
    set(bytes: number) {
      pendingBytes = bytes
      const now = Date.now()
      const elapsedSeconds = (now - lastTimestamp) / 1000
      if (elapsedSeconds >= 0.2) {
        currentSpeed = pendingBytes / elapsedSeconds
        pendingBytes = 0
        lastTimestamp = now
      }
      return currentSpeed
    },
    add(bytes: number) {
      return tracker.set(pendingBytes + bytes)
    },
    snapshot() {
      return currentSpeed
    }
  }
  return tracker
}

function createPendingTotalProgress<T>(
  unit: 'rows' | 'bytes',
  total: number,
  extra: T,
  message: string,
  appendMessage: (progress: ProgressInfo & ProgressLoader<T>) => string = () => ''
): ProgressLoader<T> {
  const toStringFn = stringifier<T>(message)
  return newProgressLoader<T>({
    total,
    metric: unit === 'rows' ? 'ROWS' : 'BYTES',
    stringify: (progress) => {
      const stringified = toStringFn(progress)
      return stringified + appendMessage(progress)
    },
    extra: () => {
      return extra
    }
  })
}

type FilePath = string
type CacheMeta = Record<FilePath, {
  lastModified: number;
  size: number;
  cacheTargetPath: string;
  handler?: string
}>

const stubWriteStream = {
  write: (_chunk: any) => {
    // do nothing
  },
  end: () => {
    // do nothing
  },
  get bytesWritten() {
    return 0
  }
}

export function loadMeta(): CacheMeta {
  if (!fs.existsSync(cacheMetaPath)) {
    return {}
  }
  return JSON.parse(fs.readFileSync(cacheMetaPath, 'utf-8')) as CacheMeta;
}

export function saveMeta(statResult: fs.Stats, filePath: string, cacheTargetPath: string, handler: string) {
  const meta = loadMeta()
  meta[filePath] = {
    lastModified: statResult.mtimeMs,
    size: statResult.size,
    cacheTargetPath,
    handler
  }
  fs.writeFileSync(cacheMetaPath, JSON.stringify(meta, null, 2), 'utf-8')
}

function cleanPathIntoSingleFileName(filePath: string): string {
  const baseName = path.basename(filePath)
  const dirName = path.dirname(filePath).replace(/[^a-zA-Z0-9]/g, '_')
  return `${dirName}_${baseName}`
}

export function getCacheMeta(filePath: string, handler: string): ({
  cached: CacheMeta[string],
  stat: fs.Stats,
  shouldLoadRaw: false;
}) | ({ stat: fs.Stats, shouldLoadRaw: true }) {
  const stat = fs.statSync(filePath)
  const meta = loadMeta()
  const cached = meta[filePath]
  const shouldLoadRaw = !cached
    || cached.lastModified !== stat.mtimeMs
    || cached.size !== stat.size
    || !fs.existsSync(cached.cacheTargetPath)
    || !fs.statSync(cached.cacheTargetPath).isFile()
    || cached.handler !== handler
  if (!cached || shouldLoadRaw) {
    return { stat, shouldLoadRaw: true }
  }
  return { cached, stat, shouldLoadRaw: false }
}

function tryParseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export type RowHandler<T> = (row: string, index: number) => T | null

export const parseRowRaw = (): RowHandler<Record<string, string> & { __headers: string[] }> => {
  let cachedHeaders: string[] = []
  return function parseRowRawParser(row, index) {
    if (index === 0) {
      cachedHeaders = row.split('\t').map(tryParseJson);
      return null
    }

    const parsedRow = row.split('\t').map((row, i) => [i, tryParseJson(row)]);
    const objectRow = Object.fromEntries(parsedRow)
    objectRow.__headers = cachedHeaders
    return objectRow
  }
}

export async function loadByRow<T = any>(filePath: string, rawHandler: RowHandler<T>, dry = false): Promise<T[]> {
  const cacheMeta = getCacheMeta(filePath, rawHandler.name)

  if (cacheMeta.shouldLoadRaw) {
    const stat = cacheMeta.stat
    const zipfile = await yauzl.openPromise(filePath, { autoClose: false })
    let singleEntry: yauzl.Entry | null = null
    for await (const entry of zipfile.eachEntry()) {
      if (entry.fileName.endsWith('/')) continue
      if (singleEntry !== null) {
        zipfile.close()
        throw new Error('Multiple files found in the zip archive, expected only one');
      }
      singleEntry = entry
    }

    if (singleEntry === null) {
      zipfile.close()
      throw new Error('No files found in the zip archive');
    }

    const file = singleEntry
    const fileStream = await zipfile.openReadStreamPromise(file)
    const cacheTargetPath = path.join(cachePath, cleanPathIntoSingleFileName(filePath)) + Date.now() + '.jsonl'
    const writeStream = dry ? stubWriteStream : fs.createWriteStream(cacheTargetPath, { flags: 'w' })

    const unzipSpeedTracker = createSpeedTracker()
    const writeSpeedTracker = createSpeedTracker()
    const unzipProgress = createPendingTotalProgress(
      'bytes',
      file.uncompressedSize,
      {
        get unzipSpeedTracker() {
          return unzipSpeedTracker
        },
        get writeSpeedTracker() {
          return writeSpeedTracker
        }
      },
      '',
      (progress) => {
        const unzipSpeed = progress.extra().unzipSpeedTracker.snapshot()
        const writeSpeed = writeSpeedTracker.snapshot()
        return `Unzip: ${abbreviateBytesPerSecond(unzipSpeed)} | Write: ${abbreviateBytesPerSecond(writeSpeed)}`
      }
    )

    const rows: T[] = []
    let index = 0
    try {
      fileStream.on('data', c => unzipProgress.increment(c.length))
      const fileStreamReader = streamFromNodeJSReadable(fileStream)
      for await (const chunk of fileStreamReader) {
        const row = rawHandler(chunk.toString(), index++)
        if (row === null) continue;
        const encoded = JSON.stringify(row)
        writeStream.write(encoded)
        writeStream.write("\n")
        rows.push(row)
        unzipSpeedTracker.set(unzipProgress.total)
        writeSpeedTracker.set(writeStream.bytesWritten)
      }
    } finally {
      zipfile.close()
    }
    unzipProgress.done();
    writeStream.end()
    saveMeta(stat, filePath, cacheTargetPath, rawHandler.name)
    return rows
  } else {
    const cached = cacheMeta.cached
    const rows: T[] = []
    const cacheTargetPath = cached.cacheTargetPath
    const expectedBytes = fs.statSync(cacheTargetPath).size;
    const readSpeedTracker = createSpeedTracker()
    const parseProgress = createPendingTotalProgress(
      'bytes',
      expectedBytes,
      {
        get readSpeedTracker() {
          return readSpeedTracker
        }
      },
      '',
      (progress) => {
        return `Read: ${abbreviateBytesPerSecond(progress.extra().readSpeedTracker.snapshot())}`
      })
    const readStream = fs.createReadStream(cacheTargetPath);
    readStream.on('data', c => parseProgress.increment(c.length))
    const readStreamReader = streamLineFromNodeJsReadable(readStream)
    let line = 0
    for await (const s of readStreamReader) {
      line++
      try {
        if (s.trim() === '') continue;
        const row = JSON.parse(s.toString())
        rows.push(row)
      } catch (error) {
        throw new Error(`Failed to parse JSON on line ${line} of cached file ${cacheTargetPath}`, { cause: error })
      }
    }
    parseProgress.done();
    return rows
  }

}