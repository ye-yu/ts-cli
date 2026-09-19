---
name: create-module
description: 'Create a new runnable module for this workspace. Use when adding a new module directory that will be discovered by cli.ts, exports a default async function from module.ts, uses fs.util.ts to enumerate working files, uses @inquirer/prompts to browse inputs, and optionally restarts exploration in a rerunnable loop.'
argument-hint: 'Describe the new module purpose, input files to browse, and the exploration flow.'
user-invocable: true
disable-model-invocation: false
---

# Create Workspace Module

## Outcome
Produce a new module directory that the workspace CLI can discover and run.
The module must expose a default async function from `module.ts` and keep its exploration flow safe to rerun.

## When To Use
- Adding a new module folder that should appear in the CLI search menu.
- Replacing one-off scripts with a reusable interactive module.
- Building data exploration flows that let the user browse working files and restart the session.
- Standardizing module structure across this workspace.

## Workspace Contract
- The CLI discovers modules by scanning top-level directories for `module.ts` files.
- Each module must live in its own top-level directory and include `module.ts`.
- `module.ts` must export a default async function.
- Module code should be rerunnable: the user can finish one exploration pass and start another without restarting the CLI.
- When listing files that live next to the module, use `readdirSync(import.meta.url)` from [fs.util.ts](../../../fs.util.ts).
- If the module needs files outside its own directory, direct `node:fs` access is allowed for those external paths.
- Use `@inquirer/prompts` for interactive browsing and confirmations.

## Procedure
1. Create a new top-level directory for the module.
2. Add `module.ts` inside that directory.
3. Put the interactive flow inside `export default async function () { ... }` so each rerun can rescan the module directory.
4. Start from the local module directory by using `import.meta.url`:
   - Use `readdirSync(import.meta.url)` when the module needs to inspect working files that live beside `module.ts`.
   - Filter the returned entries to the file types the module actually supports.
   - If the module must access files outside its own directory, use `node:fs` for that separate path handling.
5. Build the interactive file-selection step with `@inquirer/prompts`:
   - Use `search` when the working file list can grow.
   - Present names as the prompt value and include the resolved path or a short explanation as the description.
6. Wrap the main user flow in a `do { ... } while (restart)` loop.
7. Explore the selected working file or dataset.
8. After the exploration completes, ask whether the user wants to restart:
   - Use `confirm({ message: "Do you want to restart?", default: false })`.
9. Keep only reusable caches outside the loop, keyed by stable identifiers such as file paths.

## Decision Points
- If the module needs to browse files in its own directory: use [fs.util.ts](../../../fs.util.ts) instead of reimplementing path resolution.
- If the module needs external files or directories: use `node:fs` for those non-local paths and keep the local-module scan rule unchanged.
- If the list is small and fixed: `select` can work, but default to `search` because the workspace modules already use searchable browsing.
- If expensive parsing results can be reused across reruns: keep a module-level cache keyed by the selected file path.
- Rescan the module directory inside the default async function on every run so new working files are visible after restart.

## Completion Checks
- The module sits in a top-level directory with a `module.ts` file.
- `module.ts` exports `default async function`.
- The flow is compatible with [cli.ts](../../../cli.ts) discovery.
- Working files in the module directory are enumerated through [fs.util.ts](../../../fs.util.ts).
- Any external-file access is handled separately and does not replace the local module scan pattern.
- `@inquirer/prompts` drives file selection or browsing.
- The exploration path is rerunnable.
- Restart confirmation happens after the exploration step.

## Starter Template
Use [module template](./assets/module.template.md) as the default scaffold.
The template content assumes it will be copied into `<new-module>/module.ts` at the workspace root.

## Example Prompt
"Create a new module that lets me browse CSV files in its folder, inspect one interactively, and ask whether to restart when I finish."