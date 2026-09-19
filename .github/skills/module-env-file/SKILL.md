---
name: module-env-file
description: 'Load environment variables for a workspace module from a module-local .env file. Use when a module needs env config, credentials, DB connection settings, API keys, or when adding process.env usage to a module. Keywords: env, .env, loadEnvFile, environment variable, dotenv, credentials, config.'
argument-hint: 'Describe which module needs env variables and what variables it requires.'
---

# Module-Local .env Loading

## Outcome
A module loads its environment variables from a `.env` file that lives beside its own `module.ts`, using Node's built-in `loadEnvFile` — never `dotenv` or manual file parsing.

## When to Use
- A module needs credentials, hosts, ports, tokens, or any config from environment variables.
- Adding `process.env` reads to a module that has no env loading yet.
- Refactoring ad-hoc env handling to the workspace standard.

## Procedure
1. At the top of the module file, load the module-local `.env` with:

   ```ts
   import { loadEnvFile } from 'process';
   import { resolveByMetaUrl } from '../fs.util.ts';

   loadEnvFile(resolveByMetaUrl(import.meta.url, ".env"));
   ```

   - `loadEnvFile` comes from `node:process` (built-in, no dependency).
   - `resolveByMetaUrl` from [fs.util.ts](../../../fs.util.ts) resolves `.env` relative to the module's own directory, not the CWD.
   - Call `loadEnvFile` at module top level, before any code reads `process.env`.
2. Place the `.env` file inside the module's directory (next to `module.ts`).
3. Validate required variables with a fail-fast helper:

   ```ts
   function requireEnv(name: string, value: string | undefined): string {
     if (!value) {
       throw new Error(`Missing required env variable: ${name}`);
     }
     return value;
   }

   const dbHost = requireEnv("MY_DB_HOST", process.env.MY_DB_HOST);
   ```

## Anti-patterns
- Installing or importing `dotenv` — Node's `loadEnvFile` is the standard here.
- Resolving `.env` from `process.cwd()` — the CLI may run from the workspace root, so the path must be anchored to `import.meta.url`.
- Reading `process.env` without validating required variables.

## Completion Checks
- `.env` sits in the module's own directory.
- `loadEnvFile(resolveByMetaUrl(import.meta.url, ".env"))` runs at module top level.
- Required variables are validated with a `requireEnv`-style guard before use.
