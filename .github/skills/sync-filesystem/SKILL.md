---
name: sync-filesystem
description: 'Implement Node.js filesystem logic with synchronous APIs only. Use when generating or refactoring file I/O code and you want deterministic flow without Promise or callback complexity. Workspace rule: use sync fs everywhere. Keywords: fs, filesystem, readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, node:fs.'
argument-hint: 'Describe the file I/O task to implement with sync fs APIs.'
user-invocable: true
disable-model-invocation: false
---

# Sync Filesystem Workflow

## Outcome
Produce filesystem code that uses synchronous Node.js APIs only, with clear control flow and explicit error handling.
Apply this rule everywhere in this workspace, including hot server request paths.

## When To Use
- Writing new file I/O logic in TypeScript or JavaScript.
- Refactoring async/callback filesystem code to sync style.
- CLI scripts, build scripts, migrations, and one-shot local tooling.
- Any request handler or runtime path in this workspace that performs file I/O.

## Workspace Rule
- Always use synchronous filesystem APIs in this workspace.
- Do not introduce async or callback filesystem code, even in hot paths.
- Prefer imports from `node:fs` and `node:path` for all new code.

## Procedure
1. Identify all required filesystem operations and their required order.
2. Create a sync API plan:
   - `fs.readFileSync`
   - `fs.writeFileSync`
   - `fs.appendFileSync`
   - `fs.existsSync`
   - `fs.mkdirSync`
   - `fs.readdirSync`
   - `fs.statSync`
3. Replace async patterns with direct sync calls:
   - Remove `await`, `Promise.all`, and `fs.promises` usage.
   - Remove callback-style `fs.*` APIs.
   - Standardize imports to `node:fs` (and `node:path` when needed).
4. Add guardrails around file paths and directories:
   - Ensure parent directories exist with `mkdirSync(path, { recursive: true })`.
   - Use explicit encodings (for example, `utf8`) for text content.
5. Add error handling at operation boundaries:
   - Wrap write/read sequences in `try/catch`.
   - Surface actionable error context (operation + path).
6. Keep implementation linear and deterministic:
   - Preserve required ordering with direct statements.
   - Avoid background or deferred file tasks.

## Decision Points
- If the task performs filesystem I/O in this workspace: use sync APIs.
- If many writes are required: keep sync order unless there is an explicit requirement to preserve existing order semantics.
- If existing code is async: convert it to sync during the same change when practical.

## Completion Checks
- Imports prefer `node:fs` (and `node:path` if used).
- No `fs.promises` imports or usage.
- No async filesystem methods (`readFile`, `writeFile`, etc.) or callback-based fs calls.
- No `await`, `Promise.all`, or promise wrappers for filesystem operations.
- All required directories are created before writes.
- Text reads/writes specify encoding when appropriate.
- Error messages include enough context to debug quickly.

## TypeScript Examples

### Read, transform, and write JSON synchronously
```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

type Config = {
   version: number;
   features: string[];
};

export function bumpConfig(inputPath: string, outputPath: string): void {
   try {
      const raw = readFileSync(inputPath, "utf8");
      const parsed = JSON.parse(raw) as Config;
      const next: Config = { ...parsed, version: parsed.version + 1 };

      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, JSON.stringify(next, null, 2), "utf8");
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to bump config from ${inputPath} to ${outputPath}: ${message}`);
   }
}
```

### Append line-oriented logs synchronously
```ts
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function appendAuditLine(logPath: string, line: string): void {
   try {
      mkdirSync(dirname(logPath), { recursive: true });
      appendFileSync(logPath, `${line}\n`, "utf8");
   } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to append audit line to ${logPath}: ${message}`);
   }
}
```

## Example Prompt
"Implement a log export feature that writes JSON and CSV files using only synchronous fs APIs."
