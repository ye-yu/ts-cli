---
name: module-restart-defer
description: 'Structure a module entry point with the restart-loop + defer cleanup pattern. Use when creating or refactoring a module.ts default export: wrap main() in a do/while restart loop with an @inquirer/prompts confirm, and register cleanup callbacks (DB client.end, file handles) via a defer function that runs after each pass. Keywords: export default async function, restart prompt, defer, cleanup, confirm, rerunnable module.'
argument-hint: 'Describe the module whose entry point needs the restart/defer scaffold.'
---

# Module Entry Point: Restart Loop with Defer Cleanup

## Outcome
`module.ts` exports a default async function that runs `main` in a rerunnable loop, guarantees cleanup of acquired resources after every pass, and asks the user whether to restart.

## When to Use
- Creating a new module entry point (`module.ts` default export).
- A module acquires resources that must be released each run (DB clients, file handles, watchers, child processes).
- Converting a one-shot script into a rerunnable interactive module.

## The Pattern
Use this scaffold verbatim as the module's default export:

```ts
import { confirm } from '@inquirer/prompts'

type defereable = () => void | PromiseLike<void>
type deferfn = (fn: defereable) => void
export default async function () {
  let restart = false;
  do {
    const defered: (defereable)[] = []
    await main((fn) => defered.push(fn));
    for (const d of defered) {
      try {
        await d()
      } catch (ignored) {
        console.error("defer error:", ignored)
      }
    }

    restart = await confirm({ message: 'Restart?', default: false })
  } while (restart)
}
```

And give `main` this signature:

```ts
async function main(defer: deferfn) {
  const client = await createReadOnlyClient({ /* ... */ });
  defer(() => client.end())

  // ... module logic ...
}
```

## Rules
1. `main` receives `defer` as its only structural obligation — register every resource's cleanup immediately after acquiring it (`defer(() => client.end())`).
2. Deferred callbacks run after `main` completes, in registration order, each wrapped in try/catch so one failing cleanup never blocks the others.
3. The restart `confirm` happens after cleanup, so each pass starts fresh with new resources.
4. Keep the `defered` array inside the loop — cleanups must not leak across passes.
5. Reusable caches keyed by stable identifiers may live at module scope, outside the loop.
6. Do not `process.exit()` inside `main`; return normally so cleanup and the restart prompt run.

## Completion Checks
- `module.ts` exports `default async function` with the do/while restart loop.
- `main(defer: deferfn)` registers cleanup via `defer` right after each resource acquisition.
- Deferred callbacks are awaited in a try/catch before the restart prompt.
- Restart uses `confirm({ message: 'Restart?', default: false })` from `@inquirer/prompts`.

## Related
- [create-module](../create-module/SKILL.md) covers overall module structure and CLI discovery; this skill governs the entry-point scaffold specifically.
