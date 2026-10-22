import { Readable } from "node:stream";

const whitespaces = new Set([' ', '\n', '\r', '\t'])

export type CharReader = {
  peek: (stride?: number) => string
  next: () => string
  skip: (stride?: number) => void
  skipWhitespaces: () => void
  hasNext: () => boolean
}

export type Builder = {
  append: (char: string) => void
  result: () => string
}

export const noopBuilder: Builder = {
  append: () => void 0,
  result: () => ''
}

export function newPersistentBuilder(): Builder {
  let builder = ''
  return {
    append: (char) => builder += char,
    result: () => builder
  }
}

/**
 * Materializes stream as it reads
 */
export class StreamReader implements CharReader {
  buffer = ''
  position = 0
  readSize = 8
  stream: NodeJS.ReadableStream

  constructor(stream: NodeJS.ReadableStream) {
    this.stream = stream
  }

  peek() {
    this.feedBuffer()
    return this.buffer[this.position]
  }

  feedBuffer() {
    if (this.buffer[this.position] !== undefined) return
    if (!this.stream.readable) return
    const missingSize = this.position - this.buffer.length
    const maxReadSize = Math.max(this.readSize, missingSize)
    this.buffer += this.stream.read(maxReadSize).toString()
  }

  next() {
    this.feedBuffer()
    const next = this.peek()
    this.position++
    return next
  }

  skip(stride = 1) {
    this.position += stride
    this.feedBuffer()
  }

  skipWhitespaces() {
    while (this.hasNext() && whitespaces.has(this.peek())) {
      this.skip()
    }
  }

  hasNext() {
    if (this.position < this.buffer.length) {
      return true
    }
    this.feedBuffer()
    return this.position < this.buffer.length
  }

  static of(input: string | NodeJS.ReadableStream) {
    if (typeof input === "string") {
      input = Readable.from(input)
    }
    return new StreamReader(input)
  }
}

export class StringReader implements CharReader {
  position = 0
  input: string
  constructor(input: string) {
    this.input = input
  }

  next() {
    const val = this.input.at(this.position)
    if (val === undefined) {
      throw new Error("EOF")
    }
    this.position++
    return val
  }

  peek(stride = 1) {
    if ((this.position + stride - 1) >= this.input.length) {
      throw new Error("EOF")
    }
    return Array
      .from({ length: stride })
      .map((_, offset) => this.input.at(this.position + offset)!)
      .join('')
  }

  skip(stride = 1) {
    this.position += stride
  }

  hasNext() {
    return this.position < this.input.length
  }

  skipWhitespaces() {
    while (this.hasNext() && whitespaces.has(this.peek())) {
      this.skip()
    }
  }
}