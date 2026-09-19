---
name: styled-console-output
description: 'Style and format console output in this workspace. Use when logging with colors, highlighting text, formatting numbers, durations, counts, or wrapping long lines in terminal output. Prefer style.util.ts for ANSI colors/modifiers and formatter.util.ts for number/time formatting. Keywords: console.log, color, red, green, bold, chalk, styleText, format duration, human readable, terminal width.'
argument-hint: 'Describe what output needs styling or formatting.'
---

# Styled Console Output

## Outcome
Console output uses the workspace utilities: colors and text modifiers from [style.util.ts](../../../style.util.ts), and value formatting (counts, durations, wrapping) from [formatter.util.ts](../../../formatter.util.ts). No `chalk`, no raw ANSI escape codes, no ad-hoc formatting math.

## When to Use
- Adding colored or emphasized text to `console.log` output.
- Displaying counts, durations, or elapsed times in human-readable form.
- Printing long messages that must wrap cleanly within the terminal width.

## Text Styling — style.util.ts
Import named style functions and chain them fluently:

```ts
import { red, green, yellow, cyan } from '../style.util.ts';

console.log(red(`(${failedCount})`));          // single style
console.log(green.bold("SUCCESS"));            // chained styles
console.log(yellow.bgBlack.underline("warn")); // any combination
```

- Every foreground color, background color (`bgRed`, `bgBlack`, ...), and modifier (`bold`, `dim`, `italic`, `underline`, `inverse`, `strikethrough`, ...) is chainable off any exported style.
- Built on Node's `util.styleText` — do not add `chalk` or hand-written `\x1b[` escape codes.

## Value Formatting — formatter.util.ts

| Function | Use for | Example |
|----------|---------|---------|
| `formatCount(n)` | Large counts with K/M/G/T units | `formatCount(15300)` → `15.3K` |
| `formatSeconds(s)` | Sub-minute durations, ms precision below 1s | `formatSeconds(0.5)` → `500ms` |
| `formatMinuteSeconds(s)` | Elapsed time in seconds → `MMm SSs` (auto-escalates to hours/days) | `formatMinuteSeconds(125)` → `2m 05s` |
| `formatHourMinute(min)` | Durations in minutes → `HHh MMm` | |
| `formatDayHour(h)` | Durations in hours → `DDd HHh` | |
| `normalizeDecimals(v, d)` | Round to fixed decimal places | |
| `indentAndFixByMaxTerminalColumn(text, indent, includeIndentInFirstLine?)` | Wrap long messages to terminal width with a hanging indent | status messages, multi-line logs |

```ts
import { formatMinuteSeconds, indentAndFixByMaxTerminalColumn } from '../formatter.util.ts';

console.log("Elapsed:", formatMinuteSeconds(elapsedSeconds));
console.log(prefix, indentAndFixByMaxTerminalColumn(longMessage, prefix.length + 1));
```

## Anti-patterns
- Adding `chalk`, `picocolors`, or similar dependencies.
- Inlining ANSI escape sequences (`\x1b[31m`).
- Hand-rolling duration math (`Math.floor(s / 60) + "m"`) when a formatter exists.
- Manual string wrapping with hard-coded widths instead of `indentAndFixByMaxTerminalColumn`.

## Completion Checks
- All colored/emphasized output goes through style.util.ts exports.
- Counts and durations are rendered via formatter.util.ts functions.
- Long messages wrap via `indentAndFixByMaxTerminalColumn`, not manual slicing.
