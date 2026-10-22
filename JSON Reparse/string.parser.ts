import type { Builder, CharReader } from "./reader.ts";

const stringEscapedMap: Record<string, string | undefined> = {
  'b': '\b',
  'f': '\f',
  'n': '\n',
  'r': '\r',
  't': '\t',
}

export function stringParser(reader: CharReader, builder: Builder): string {
  const first = reader.next()
  if (first !== '"') throw new Error(`Expected '"' for string`)
  let next: string = reader.next()
  do {
    if (next === '\\') {
      next = reader.next()
      if (next === 'u') {
        // hex reader

        const hex = reader.peek(4)
        const codePoint = parseInt(hex, 16)
        builder.append(String.fromCharCode(codePoint))
        reader.skip(4)
      } else {
        builder.append(stringEscapedMap[next] ?? next)
      }
    } else {
      builder.append(next)
    }
    next = reader.next()
  } while (next !== '"')

  return builder.result()
}

export function maybeString(reader: CharReader): boolean {
  return reader.peek() === '"'
}