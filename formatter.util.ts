export function formatCount(value: number): string {
  const units = ['', 'K', 'M', 'G', 'T']
  let num = Math.max(0, value)
  let unitIndex = 0

  while (num >= 1000 && unitIndex < units.length - 1) {
    num /= 1000
    unitIndex += 1
  }

  const rounded = num >= 100 ? normalizeDecimals(Math.round(num), 0) : normalizeDecimals(Math.round(num * 10) / 10, 1)
  return `${rounded}${units[unitIndex]}`
}

export function normalizeDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function formatSeconds(value: number): string {
  if (value < 1) {
    return `${normalizeDecimals(Math.round(value * 1000), 2)}ms`
  }
  return `${normalizeDecimals(Math.round(value * 10) / 10, 2)}s`
}

export function formatDayHour(value: number): string {
  const days = Math.floor(value / 24)
  const hours = value % 24

  const daysStr = `${days}`.padStart(2, '0')
  const hoursStr = `${hours}`.padStart(2, '0')
  return `${daysStr}d ${hoursStr}h`
}

export function formatHourMinute(value: number): string {
  const hours = Math.floor(value / 60)
  const minutes = value % 60

  const hoursStr = hours > 24 ? formatDayHour(hours) : `${hours}h`.padStart(2, '0')
  const minutesStr = `${minutes}`.padStart(2, '0')
  return `${hoursStr} ${minutesStr}m`
}

export function formatMinuteSeconds(value: number): string {
  const minutes = Math.floor(value / 60)
  const seconds = value % 60

  const minutesStr = minutes > 99 ? formatHourMinute(minutes) : `${minutes}m`.padStart(2, '0')
  const secondsStr = `${seconds}`.padStart(2, '0')
  return `${minutesStr} ${secondsStr}s`
}

export function indentAndFixByMaxTerminalColumn(value: string, indent: number, includeIndentInFirstLine = false): string {
  const maxWidth = process.stdout.columns || 80
  let spaces = includeIndentInFirstLine ? ' '.repeat(indent) : ''
  const getSpaces = () => {
    const currentSpaces = spaces
    spaces = ' '.repeat(indent)
    return currentSpaces
  }
  const lines = value.split('\n')
  const fixedLines = lines.map(line => {
    if (line.length + indent <= maxWidth) {
      return `${getSpaces()}${line}`
    }
    const chunks: string[] = []
    let newLine = ''
    for(const word of line.split(' ')) {
      if ((newLine + word).length + indent <= maxWidth) {
        newLine += (newLine ? ' ' : '') + word
      } else {
        chunks.push(`${getSpaces()}${newLine}`)
        newLine = word
      }
    }
    if (newLine) {
      chunks.push(`${getSpaces()}${newLine}`)
    }
    return chunks.join('\n')
  })
  return fixedLines.join('\n')
}
