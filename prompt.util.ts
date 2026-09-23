import { confirm, search } from '@inquirer/prompts'
import { readJsonSync, mkdirSync, writeJsonSync } from './fs.util.ts';
import FuzzySearch from 'fuzzy-search';
import path from 'path';
import { green } from './style.util.ts';

const cacheDir = "prompt-cache"
const cacheJson = 'cache.json'
const cacheFullPath = path.join(cacheDir, cacheJson)
mkdirSync(import.meta.url, cacheDir)

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
  name: typeof json === "string"
    || typeof json === "number"
    || typeof json === "boolean" ? `${json}`
    : JSON.stringify(json)
})

export async function simpleSelect<T>(message: string, items: T[], mapper = jsonMapper) {
  const mappedOptions = items.map((value, index) => ({ 
    value: { value, index },
    stringified: JSON.stringify(value),
    ...mapper(value),
   }))
  const searcher = new FuzzySearch(mappedOptions, ['name', 'description', 'stringified'], { caseSensitive: false })
  const cacheKey = constructCacheKey(message)
  const defaultValue = responseCache[cacheKey]
  const response = await search({
    message,
    source: search => searcher.search(search),
    default: mappedOptions[defaultValue]?.value,
  })
  saveResponse(cacheKey, response.index)
  return response.value
}

/**
 * node -p -e "import('./prompt.util.ts').then(e => e.testSimpleSelect())"
 */
export async function testSimpleSelect() {
  const types = ["string", "object"]
  const selectedType = await simpleSelect("Select test type:", types)
  const fruits = ['Apple', 'Oranges', 'Pineapple']
  const options = selectedType === "object" ? fruits.map(e => ({ fruit: e })) : fruits
  const selectedFruits = await simpleSelect("Select your fruits:", options as any)
  console.log("You selected", green(jsonMapper(selectedFruits).name))
  return selectedFruits
}