# Module Template

Copy this into `<new-module>/module.ts` and adapt the file filter plus exploration logic.

```ts
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { confirm, search } from '@inquirer/prompts'
import { readdirSync } from '../fs.util.ts'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export default async function () {
  let restart = false

  do {
    const workingFiles = readdirSync(import.meta.url).filter((entry: string) => {
      const entryPath = path.join(currentDir, entry)
      return fs.statSync(entryPath).isFile()
    })

    if (workingFiles.length === 0) {
      throw new Error(`No working files found in ${currentDir}`)
    }

    const selectedFile = await search({
      message: 'Select file to explore:',
      source: (input) => {
        const searchTerm = (input ?? '').trim().toLowerCase()
        const filtered = workingFiles
          .filter((candidate) => candidate.toLowerCase().includes(searchTerm))
          .map((candidate) => ({
            name: candidate,
            value: candidate,
            description: path.join(currentDir, candidate),
          }))

        return Promise.resolve(filtered)
      },
    })

    console.log('Explore', selectedFile)

    restart = await confirm({
      message: 'Do you want to restart?',
      default: false,
    })
  } while (restart)
}
```