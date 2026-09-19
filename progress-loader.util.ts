import { TerminalRenderer } from './terminal.ts'

let loaderId = 0
let renderTimeout: NodeJS.Timeout | undefined
let lastRenderAt = 0
const QUARTER_A_SECOND = 250
const HALF_A_SECOND = 500
const ONE_SECOND = 1000
let renderAt = Date.now()
const progressLoaderById: Record<string, ProgressLoader<any>> = {}
const terminalRenderer = new TerminalRenderer(process.stdout)
let renderedLineCount = 0
const percentFormatter = new Intl.NumberFormat("en", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})
const bytesFormatter = {
  format(value: number) {
    const parts = currencyFormatter.formatToParts(value);

    const isNegative = parts.some((p) => p.type === "minusSign");
    const currency =
      parts.find((p) => p.type === "currency")?.value.slice(1) ?? "";
    const compact = parts.find((p) => p.type === "compact")?.value ?? "";

    const numberText = parts
      .filter(
        (p) =>
          p.type === "integer" ||
          p.type === "group" ||
          p.type === "decimal" ||
          p.type === "fraction",
      )
      .map((p) => p.value)
      .join("");

    const numeric = Number(numberText.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return currencyFormatter.format(value);

    const suffixMap: Record<string, string> = {
      K: "K",
      M: "M",
      B: "G",
      T: "T",
    };

    const suffix = suffixMap[compact] ?? "";
    const numberOut = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numeric);

    return (isNegative ? "-" : "") + currency + numberOut + suffix;
  },
}

export const METRICS = {
  ROWS: 'ROWS',
  BYTES: 'BYTES',
} as const
export type METRICS = typeof METRICS[keyof typeof METRICS]

export type ProgressInfo = {
  remainingMs: number
  processedFormatted: string
  totalFormatted: string
  percentFormatted: string
}

export type ProgressLoader<T = any> = {
  id: number
  total: number
  current: number,
  metric: METRICS
  startedAt: number,
  updatedAt: number,
  stringify: (progress: ProgressInfo & ProgressLoader<T>) => string
  increment: (n?: number) => void
  done: () => void
  extra: () => T
}

export function getProgressTimeInfo(progress: ProgressLoader<any>) {
  const percent = progress.current / progress.total;
  const elapsedTime = progress.updatedAt - progress.startedAt;
  const remainingMs = progress.current ?
    (elapsedTime * (progress.total - progress.current)) /
    progress.current : 0;
  const processedFormatted = bytesFormatter.format(progress.current);
  const totalFormatted = bytesFormatter.format(progress.total);
  const percentFormatted = percentFormatter.format(percent);
  return {
    remainingMs,
    processedFormatted,
    totalFormatted,
    percentFormatted,
  }
}

export function nextId() {
  return ++loaderId
}

export const stringifier: <T>(message: string) => ProgressLoader<T>['stringify'] = <T>(message: string) => (progress: ProgressInfo & ProgressLoader<T>): string => {
  const currentFmt = bytesFormatter.format(progress.current)
  const totalFmt = bytesFormatter.format(progress.total)
  const percentFmt = percentFormatter.format(progress.current / progress.total)
  return `${currentFmt}/${totalFmt} (${percentFmt}) ${Math.round(progress.remainingMs / 1000)}s: ${message}`
}

type Prettify<T extends object> = {
  [K in keyof T]: T[K]
} & {}

export function* withProgressLoader<T = any>(data: T[], init?: Prettify<
  Partial<Pick<ProgressLoader<T>, 'extra' | 'metric' | 'stringify'>>
>): Generator<T> {
  const progressLoader = newProgressLoader<T>({
    ...init,
    total: data.length,
    metric: init?.metric ?? METRICS.ROWS,
    extra: init?.extra ?? (() => ({} as any)),
    stringify: init?.stringify ?? stringifier<T>('Processing')
  })
  try {
    for (const item of data) {
      yield item
      progressLoader.increment()
    }
  } finally {
    progressLoader.done()
  }
}

export function newProgressLoader<T = any>(init: Pick<ProgressLoader<T>, 'extra' | 'total' | 'metric' | 'stringify'>): ProgressLoader<T> {
  const id = nextId()
  const now = Date.now()
  const progressLoader: ProgressLoader<T> = {
    id,
    total: init.total,
    current: 0,
    metric: init.metric,
    extra: init.extra,
    startedAt: now,
    updatedAt: now,
    stringify: init.stringify,
    increment: (n = 1) => {
      progressLoader.current += n
      progressLoader.updatedAt = Date.now()
      queueRenderInTimeout()
    },
    done: () => {
      progressLoader.current = progressLoader.total
      progressLoader.updatedAt = Date.now()
      cleanupProgressLoader(progressLoader.id)
      renderProgressLoaderUpdates()
      if (Object.keys(progressLoaderById).length > 0) {
        queueRenderInTimeout()
      } else if (Object.keys(progressLoaderById).length === 1) {
        console.log("")
      }
    }
  }
  progressLoaderById[id] = progressLoader
  renderProgressLoaderUpdates()
  queueRenderInTimeout()
  return progressLoader
}

export function renderProgressLoaderUpdates() {
  lastRenderAt = Date.now()
  const loaders = Object.values(progressLoaderById)

  if (!process.stdout.isTTY) {
    if (loaders.length === 0) {
      renderTimeout = undefined
      return
    }

    for (const loader of loaders) {
      const progressInfo = getProgressTimeInfo(loader)
      const output = loader.stringify({
        ...progressInfo,
        ...loader
      })
      console.log(output)
    }
    return
  }

  if (loaders.length === 0) {
    if (renderedLineCount > 0) {
      terminalRenderer.moveUp(renderedLineCount).carriageReturn()
      for (let i = 0; i < renderedLineCount; i += 1) {
        terminalRenderer.clearLine('all').line()
      }
      terminalRenderer.moveUp(renderedLineCount).carriageReturn().flush()
      renderedLineCount = 0
    }

    renderTimeout = undefined
    return;
  }

  const outputs = loaders.map((loader) => {
    const progressInfo = getProgressTimeInfo(loader)
    return loader.stringify({
      ...progressInfo,
      ...loader
    })
  })

  if (renderedLineCount > 0) {
    terminalRenderer.moveUp(renderedLineCount).carriageReturn()
  }

  for (const output of outputs) {
    terminalRenderer.clearLine('all').text(output).line()
  }

  if (renderedLineCount > outputs.length) {
    const extraLines = renderedLineCount - outputs.length
    for (let i = 0; i < extraLines; i += 1) {
      terminalRenderer.clearLine('all').line()
    }
    terminalRenderer.moveUp(extraLines).carriageReturn()
  }

  renderedLineCount = outputs.length
  terminalRenderer.flush()
}

export function renderInTimeout() {
  if (Date.now() - renderAt < QUARTER_A_SECOND && Date.now() - lastRenderAt < HALF_A_SECOND) {
    const nextRenderAt = QUARTER_A_SECOND - (Date.now() - renderAt)
    renderTimeout = setTimeout(renderInTimeout, nextRenderAt)
    return;
  }
  // render is now valid
  renderProgressLoaderUpdates()

  renderTimeout = undefined
}

export function queueRenderInTimeout() {
  if (renderTimeout) {
    renderAt = Date.now() + QUARTER_A_SECOND
    return;
  }
  renderTimeout = setTimeout(renderInTimeout, QUARTER_A_SECOND)
  return;
}

export function cleanupProgressLoader(id: number) {
  setTimeout(() => {
    delete progressLoaderById[id]
  }, ONE_SECOND)
}