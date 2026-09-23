import { Worker } from 'node:worker_threads'
import { resolveByMetaUrl } from '../fs.util.ts';
import { pathToFileURL } from 'node:url';
import type { DownloaderWorkerData } from './downloader.ts';
import { grey } from '../style.util.ts';

function spawnWorker(start: number, end: number) {
  const id = crypto.randomUUID().split('-')[0]
  const prefix = grey(`[${id}]`)
  const workerData: DownloaderWorkerData = {
    url: downloadUrl,
    start, end
  }
  const { resolve, reject, promise } = Promise.withResolvers<void>()
  const downloaderModuleFile = 'downloader.ts'
  const relativeDownloaderModuleFile = resolveByMetaUrl(import.meta.url, downloaderModuleFile)
  const downloaderModuleUrl = pathToFileURL(relativeDownloaderModuleFile)

  console.log(prefix, "Spawning worker", downloaderModuleUrl.toString(), workerData)
  const worker = new Worker(downloaderModuleUrl, { workerData })
  worker.on('message', value => {
    if (value.event === 'progress') {
      console.log(prefix, "Progress", `${value.progress}%`)
    }
  })
  worker.on('error', reject)
  worker.on('exit', resolve)
  return promise

}
async function askForSize(url: string) {
  const response = await fetch(url, { method: 'HEAD' })
  const contentLengthMaybe = response.headers.get('content-length')
  const contentLength = Number(contentLengthMaybe)
  if (!Number.isSafeInteger(contentLength)) {
    throw new Error("Cannot get target file size")
  }
  return contentLength
}

const downloadUrl = 'http://127.0.0.1:52179'

const downloadSize = await askForSize(downloadUrl)
const parts = 10
const minSize = Math.floor(downloadSize / parts)

const ranges = Array.from({ length: parts }).map((_, i) => [i * minSize, (i + 1) * minSize - 1] as [number, number])
ranges.at(-1)![1] = downloadSize
const workers: Promise<void>[] = []
for (const [start, end] of ranges) {
  console.log(start, '->', end, `(${end - start}) bytes`)
  workers.push(spawnWorker(start, end))
}

const promiseResults = await Promise.allSettled(workers)
console.log(promiseResults)

