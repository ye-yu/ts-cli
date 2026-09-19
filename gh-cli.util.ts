import type { paths } from "./gh-api.d.ts";
import { fetchCached } from "./fetch.util.ts";
import { executeCli, rateLimit } from "./spawn.util.ts";

type RawLogs = {
  timestamp: string
  parsedDate: Date
  message: string
}

type PrUrl = {
  createdBy: { url: string }[],
  currentBranch?: { "url": string },
  needsReview: { url: string }[]
}

type PrBody = {
  body: string | null
}

type PrFiles = {
  files: { path: string }[]
}

function parseLog(logs: string): RawLogs[] {
  // format: utctimestamp message
  return logs.split('\n').filter(e => e).map(line => {
    const [timestamp, message] = line.split(' ', 2)
    try {
      const parsedDate = new Date(timestamp)
      return { timestamp, parsedDate, message }
    } catch (_) {
      console.log("Failed to parse date for log line:", line)
      return null
    }
  }).filter(e => e) as RawLogs[]
}

function parsePrUrl(maybeJson: string): PrUrl | null {
  try {
    return JSON.parse(maybeJson) as PrUrl
  } catch (_) {
    console.log("Failed to parse PR URL JSON:", maybeJson)
    return null
  }
}

type ArtifactResponse = paths["/repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"]["get"]["responses"]["200"]["content"]["application/json"]

export type RepoView = {
  nameWithOwner: string
  url: string
}

export const GH = {
  repo: {
    clone(owner: string, repo: string, targetDir: string, options?: { depth?: number }): string {
      const args = ["repo", "clone", `${owner}/${repo}`, targetDir]
      if (options?.depth) {
        args.push("--", `--depth=${options.depth}`)
      }
      const { stderr } = executeCli('gh', args)
      if (stderr) {
        console.log(stderr)
      }
      return targetDir
    },
    view(repoDir: string): RepoView | null {
      const { stdout, stderr, code } = executeCli('gh', [
        "repo", "view",
        "--json", "nameWithOwner,url"
      ], { cwd: repoDir })
      if (code !== 0 || !stdout.trim()) {
        console.log(`[gh] repo view failed for ${repoDir}:`, stderr.trim())
        return null
      }
      return JSON.parse(stdout) as RepoView
    }
  },
  auth: {
    token() {
      const { stdout, stderr } = executeCli('gh', ["auth", "token"])
      if (stderr) {
        throw new Error(stderr)
      }
      return stdout.trim()
    }
  },
  actions: {
    jobs: {
      async downloadLogs(owner: string, repo: string, jobId: string): Promise<RawLogs[]> {
        await rateLimit('gh')
        const additionalFlags = "--allow-escape-sequences"
        const path = `/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`
        const { stdout, stderr } = executeCli('gh', [
          "api", path,
          additionalFlags
        ])
        if (stderr) {
          throw new Error(stderr, { cause: { owner, repo, jobId } })
        }
        return parseLog(stdout)
      }
    },
    artifacts: {
      async listByRunId(owner: string, repo: string, runId: string): Promise<ArtifactResponse> {
        await rateLimit('gh')
        const artifactPath = `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`
        const { stdout, stderr } = executeCli('gh', [
          "api", artifactPath,
        ])
        if (stderr) {
          throw new Error(stderr, { cause: { owner, repo, runId } })
        }
        return JSON.parse(stdout)
      },
      async downloadByUrl(url: string): Promise<ArrayBuffer> {
        await rateLimit('gh')
        const headers = new Headers()
        headers.append("Authorization", `Bearer ${GH.auth.token()}`)
        headers.append("Accept", "application/vnd.github+json")
        headers.append("X-GitHub-Api-Version", "2026-03-10")
        const response = await fetchCached(new URL(url), {
          headers
        })
        if (!response.ok) {
          throw new Error(`Failed to download artifact: ${response.statusText}`, { cause: { url } })
        }
        if (response.status === 302) {
          const redirectUrl = response.headers.get("Location")
          if (!redirectUrl) {
            throw new Error(`Redirected to invalid URL: ${response.statusText}`, { cause: { url } })
          }
          return GH.actions.artifacts.downloadByUrl(redirectUrl)
        }
        return await response.arrayBuffer()
      }
    },
  },
  pr: {
    currentUrl(repoDir: string): string | null {
      const { stdout, stderr } = executeCli('gh', ['pr', 'status', '--json="url"'], { cwd: repoDir })
      const prUrl = parsePrUrl(stdout)
      if (stderr) {
        console.log(`[gh] pr status failed for ${repoDir}:`, stderr.trim())
        throw new Error(stderr, { cause: { repoDir } })
      }
      if (!prUrl) {
        return null
      }
      return prUrl.currentBranch?.url ?? null
    },
    createWithFill(repoDir: string, head?: string): void {
      const headArg = head ? ['--head', head] : []
      const { stdout, stderr } = executeCli('gh', ['pr', 'create', '--fill', ...headArg], { cwd: repoDir })
      if (stderr) {
        console.log(`[gh] pr create failed for ${repoDir}:`, stderr.trim())
        throw new Error(stderr, { cause: { repoDir } })
      }
      console.log(stdout)
    },
    ensureBodyContains(repoDir: string, text: string): void {
      const { stdout, stderr } = executeCli('gh', ['pr', 'view', '--json', 'body'], { cwd: repoDir })
      if (stderr) {
        console.log(`[gh] pr view failed for ${repoDir}:`, stderr.trim())
        throw new Error(stderr, { cause: { repoDir } })
      }
      const { body } = JSON.parse(stdout) as PrBody
      if (body?.includes(text)) {
        return
      }
      const updatedBody = body ? `${body}\n\n${text}` : text
      const result = executeCli('gh', ['pr', 'edit', '--body', updatedBody], { cwd: repoDir })
      if (result.stderr) {
        console.log(`[gh] pr edit failed for ${repoDir}:`, result.stderr.trim())
        throw new Error(result.stderr, { cause: { repoDir } })
      }
    },
    files(repoDir: string): string[] {
      const { stdout, stderr } = executeCli('gh', ['pr', 'view', '--json', 'files'], { cwd: repoDir })
      if (stderr) {
        console.log(`[gh] pr view files failed for ${repoDir}:`, stderr.trim())
        throw new Error(stderr, { cause: { repoDir } })
      }
      const { files } = JSON.parse(stdout) as PrFiles
      return files.map(({ path }) => path)
    }
  },
  secret: {
    set(name: string, value: string, repoDir: string) {
      executeCli('gh', ['secret', 'set', name, '--body', value], { cwd: repoDir })
      executeCli('gh', ['secret', 'set', name, '--body', value, "--app", "dependabot"], { cwd: repoDir })
    },
  },
}