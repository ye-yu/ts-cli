import fs from 'fs'
import path from 'path'
import { search } from '@inquirer/prompts'

console.log("Reading modules...")

const moduleCandidates = fs.readdirSync('.')
const modules = moduleCandidates.filter((candidate) => {
  const stats = fs.statSync(candidate)
  const moduleFile = path.join(candidate, 'module.ts')
  const moduleFileStat = fs.existsSync(moduleFile) ? fs.statSync(moduleFile) : null
  return stats.isDirectory() && moduleFileStat && moduleFileStat.isFile()
}).map((candidate) => {
  return {
    name: candidate,
    value: candidate,
    description: `Script: ${candidate}/module.ts`,
  }
})
try {
  do {
    const selectedModule = await search({
      message: 'Select a module to run:',
      source: (input) => {
        if (!input) return Promise.resolve(modules)
        const filtered = modules.filter((module) => {
          return module.name.toLowerCase().includes(input.toLowerCase())
        })
        return Promise.resolve(filtered)
      }
    })

    console.log("Running", selectedModule)

    const imported = await import(`./${selectedModule}/module.ts`)
    if ('default' in imported && typeof imported.default === 'function') {
      await imported.default().catch((error: unknown) => {
        if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ExitPromptError') {
          return null
        }
        throw error
      })
    }
  } while (true)
} catch (error) {
  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'ExitPromptError') {
    console.log("Exiting...")
    process.exit(0)
  }
  throw error
}