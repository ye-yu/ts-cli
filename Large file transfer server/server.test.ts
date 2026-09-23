import { relativeByMetaUrl, resolveByMetaUrl } from "../fs.util.ts";
import { ask } from "../prompt.util.ts";
import { createFileStreamingServer } from './server.ts'

const targetFile = resolveByMetaUrl(import.meta.url, './input/Firefox.zip')
const server = createFileStreamingServer(targetFile)
await server.listen()
console.log('Hosting', relativeByMetaUrl(import.meta.url, targetFile), 'at', server.downloadUrl)
while(!(await ask("Stop server?"))) {}
await server.stop()