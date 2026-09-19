import { styleText } from "node:util";
import child_process from "node:child_process";
import { formatSeconds } from "./formatter.util.ts";

function gray(text: string) {
  return styleText(["gray"], text)
}

function yellow(text: string) {
  return styleText(["yellow"], text)
}

function red(text: string) {
  return styleText(["red"], text)
}

function maskSecrets(text: string[]) {
  const secrets = new Set(Object.values(process.env ?? {}).filter(e => e && e.length > 5))
  return text.map(t => {
    for (const secret of secrets) {
      if (secret && t.includes(secret)) {
        t = t.replaceAll(secret, '****')
      }
    }
    return t
  })
}

const lastExecutedById: Record<string, Promise<void>[]> = {}
export async function rateLimit(id: string, duration = 1000) {
  lastExecutedById[id] ??= []
  const lastExecuted = lastExecutedById[id]
  const toAwait = Promise.all([...lastExecuted])
  lastExecuted.push(new Promise<void>(res => setTimeout(res, duration)))
  return toAwait
}

export function executeCli(command: string, args: string[], options?: child_process.SpawnSyncOptions & { silent?: boolean }): { stdout: string, stderr: string, code: number } {
  const { silent, ...spawnOptions } = options ?? {}
  const now = Date.now()
  // shell:true re-joins args with spaces before cmd.exe re-splits them, so quote args containing spaces
  const shellSafeArgs = args.map(arg => arg.includes(' ') && !arg.startsWith('"') ? `"${arg}"` : arg)
  const process = child_process.spawnSync(command, shellSafeArgs, { stdio: "pipe", shell: true, ...spawnOptions })
  if (process.error) {
    throw process.error
  }
  const stdout = process.stdout?.toString('utf-8') ?? ''
  const stderr = process.stderr?.toString('utf-8') ?? ''
  const elapsed = Date.now() - now
  const seconds = formatSeconds(elapsed / 1000)
  if (!silent) {
    console.log(gray(`[${command}]`), ...maskSecrets(args), yellow(`(${seconds})`), stdout ? gray(stdout.slice(0, 20) + '...') : '')
    if (stderr) {
      console.error(red(`[${command}]`), stderr)
    }
  }
  return { stdout, stderr, code: process.status ?? 0 }
}

export function spawnCliProcess(exe: string, args: string[], options?: child_process.SpawnOptions): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>()
  const child = child_process.spawn(exe, args, {
    stdio: 'inherit',
    env: process.env,
    shell: true,
    ...options
  })

  const prefix = gray(`[${exe}]`)
  const prefixRed = red(`[${exe}]`)
  child.stdout?.on('data', (data) => {
    console.log(prefix, data.toString('utf-8'))
  })

  child.stderr?.on('data', (data) => {
    console.error(prefixRed, data)
  })

  child.on('exit', (code) => {
    console.log(prefix, `CLI process exited with code ${code}`)
    resolve()
  })

  child.on('error', (error) => {
    console.error(prefix, 'Failed to start CLI process:', error)
    resolve()
  })
  return promise
}