import fs from 'fs'
import path from 'path'
import { search } from '@inquirer/prompts'

console.log("Reading modules...")

const moduleCandidates = fs.readdirSync('.')
const modules = moduleCandidates.flatMap((candidate) => {
  const stats = fs.statSync(candidate)
  if (!stats.isDirectory()) {
    return []
  }

  const moduleFiles = fs.readdirSync(candidate).filter((file) => {
    const fullPath = path.join(candidate, file)
    const fileStats = fs.statSync(fullPath)
    return fileStats.isFile() && file.endsWith('module.ts')
  })
  return moduleFiles.map((file) => {
    return {
      name: `${candidate} (${file})`,
      value: path.join(candidate, file),
      description: `Script: ${candidate}/${file}`,
    }
  })
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

    const imported = await import(`./${selectedModule}`)
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