import type { CharReader } from "./reader.ts";

export function literalParser(reader: CharReader) {
  const peeked4 = reader.peek(4)
  if (peeked4 === 'true') {
    reader.skip(4)
    return true
  }
  if (peeked4 === 'null') {
    reader.skip(4)
    return null
  }
  if (reader.peek(5) === 'false') {
    reader.skip(5)
    return false
  }

  return undefined // use string or number parse
}
