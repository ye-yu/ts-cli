import { confirm, search } from '@inquirer/prompts'
import { readJsonSync, mkdirSync, writeJsonSync } from './fs.util.ts';
import FuzzySearch from 'fuzzy-search';
import path from 'path';

const cacheDir = "prompt-cache"
const cacheJson = 'cache.json'
const cacheFullPath = path.join(cacheDir, cacheJson)
mkdirSync(import.meta.url, cacheFullPath)

const responseCache = {} as Record<string, any>
function constructCacheKey(message: string) {
  const maybeStack: { stack?: string } = {}
  Error.captureStackTrace(maybeStack)
  const callSite = maybeStack.stack?.split('\n')[1] ?? ''
  return `${callSite}${message}`
}
function saveResponse(key: string, value: any) {
  responseCache[key] = value
  writeJsonSync(import.meta.url, cacheFullPath, responseCache)
}
try {
  const currentCache = readJsonSync(import.meta.url, cacheFullPath)
  Object.assign(responseCache, currentCache)
} catch {
  // ignored
}

export async function ask(message: string, defaultYes = false): Promise<boolean> {
  return confirm({ message, default: defaultYes })
}

type Mapper<T> = (item: T) => {
  name: string,
  description?: string,
}

const jsonMapper: Mapper<any> = (json: any) => ({
  name: JSON.stringify(json)
})

export async function simpleSelect<T extends object>(message: string, items: T[], mapper = jsonMapper) {
  const mappedOptions = items.map((value) => ({ value, stringified: JSON.stringify(value), ...mapper(value) }))
  const searcher = new FuzzySearch(mappedOptions, ['name', 'description', 'stringified'], { caseSensitive: false })
  const cacheKey = constructCacheKey(message)
  const defaultValue = responseCache[cacheKey]
  const response = await search({
    message,
    source: searcher.search.bind(searcher),
    default: defaultValue,
  })
  saveResponse(cacheKey, response)
  return response
}
