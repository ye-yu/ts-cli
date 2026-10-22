import { literalParser } from "./literal.parser.ts";
import { maybeNumber, numberParser } from "./number.parser.ts";
import { type Builder, type CharReader, newPersistentBuilder, noopBuilder } from "./reader.ts";
import { maybeString, stringParser } from "./string.parser.ts";

function valueParser(reader: CharReader, builder: Builder): any {
  reader.skipWhitespaces()
  if (!reader.hasNext()) {
    throw new Error("Expected literal true, false, null or a string or a number but got blank instead")
  }

  try {
    const literalCheck = literalParser(reader)
    if (literalCheck !== undefined) {
      return literalCheck
    }
  } catch (_) {
    // literal check failed, try string or number next
  }
  if (maybeString(reader)) {
    return stringParser(reader, builder)
  }

  if (maybeNumber(reader)) {
    return numberParser(reader, builder)
  }

  throw new Error(`Expected literal true, false, null or a string or a number but got ${reader.peek()} instead`)
}



function getArrayValue(reader: CharReader, index: number): any {
  reader.skipWhitespaces()
  if (reader.peek() !== '[') {
    throw new Error(`Expected [ but got ${reader.peek()} instead`)
  }
  reader.skip()
  for (let i = 0; i < index; i++) {
    // TODO: do check if value starts with { or [ and return branded type
    valueParser(reader, noopBuilder)
    reader.skipWhitespaces()
    if (!reader.hasNext() || reader.peek() !== ',') {
      throw new Error(`Index ${index} is out of bound (undeterminable array length)`)
    }
    reader.skip()
    reader.skipWhitespaces()
  }

  return valueParser(reader, newPersistentBuilder())
}

function getObjectValue(reader: CharReader, key: string): any {
  reader.skipWhitespaces()
  if (reader.peek() !== '{') {
    throw new Error(`Expected { but got ${reader.peek()} instead`)
  }
  reader.skip()
  reader.skipWhitespaces()
  while (reader.hasNext() && reader.peek() !== '}') {
    const candidateKey = valueParser(reader, newPersistentBuilder())
    reader.skipWhitespaces()
    if (!reader.hasNext() || reader.peek() !== ":") {
      throw new Error(`Expected separator : after key ${candidateKey} but got ${reader.peek()} instead`)
    }
    reader.skip()

    if (candidateKey === key) {
      return valueParser(reader, newPersistentBuilder())
    }

    // otherwise skip
    valueParser(reader, noopBuilder)
    reader.skipWhitespaces()
    if (reader.hasNext() && reader.peek() === ',') {
      reader.skip()
      reader.skipWhitespaces()
    }
  }

  return undefined
}

function createCharReader(input: string): CharReader {
  const testBuffer = Buffer.from(input, 'utf-8')
  const whitespaces = new Set([' ', '\n', '\r', '\t'])
  let i = 0
  const reader: CharReader = {
    next: () => {
      const val = testBuffer.at(i)
      if (val === undefined) {
        throw new Error("EOF")
      }
      i++
      return String.fromCharCode(val)
    },
    peek: (stride = 1) => {
      if ((i + stride - 1) >= testBuffer.length) {
        throw new Error("EOF")
      }
      return Array
        .from({ length: stride })
        .map((_, offset) => testBuffer.at(i + offset)!)
        .map(e => String.fromCharCode(e))
        .join('')
    },
    skip: (stride = 1) => {
      i += stride
    },
    hasNext: () => {
      return i < testBuffer.length
    },
    skipWhitespaces: () => {
      while (reader.hasNext() && whitespaces.has(reader.peek())) {
        reader.skip()
      }
    },
  }
  return reader
}

const test = JSON.stringify({ hello: 'world', what: 'are you doing', [3]: "three" }, null, 5)
console.log(getObjectValue(createCharReader(test), "what"))