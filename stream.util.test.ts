import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Readable } from 'node:stream'
import { streamFromNodeJSReadable } from './stream.util.ts';

function asReadableStream<T>(iterable: Iterable<T>): NodeJS.ReadableStream {
  const readable = new Readable({
    objectMode: true,
    read() {
      for (const item of iterable) {
        this.push(item);
      }
      this.push(null);
    }
  });
  return readable;
}

async function materialize<T>(generator: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const chunk of generator) {
    result.push(chunk as T);
  }
  return result;
}

describe('stream.util', () => {
  it('should parse strings first line new line', async () => {
    const stringStream = asReadableStream([
      'first line new line\nsecond line',
      'second line before\nthird line no new line',
      'third line before'
    ])

    const stream = streamFromNodeJSReadable(stringStream)
    const result = await materialize(stream)
    assert.deepEqual(result, [
      'first line new line',
      'second linesecond line before',
      'third line no new linethird line before',
    ])
  })

  it('should parse strings', async () => {
    const stringStream = asReadableStream([
      'first line no new line',
      'first line before line\nsecond line\nthird line no new line',
      'last line no new line'
    ])

    const stream = streamFromNodeJSReadable(stringStream)
    const result = await materialize(stream)
    assert.deepEqual(result, [
      'first line no new linefirst line before line',
      'second line',
      'third line no new linelast line no new line'
    ])
  })

    it('should parse strings last line new line', async () => {
    const stringStream = asReadableStream([
      'first line no new line',
      'first line before\nsecond line\nthird line no new line',
      'third line before\nlast line'
    ])

    const stream = streamFromNodeJSReadable(stringStream)
    const result = await materialize(stream)
    assert.deepEqual(result, [
      'first line no new linefirst line before',
      'second line',
      'third line no new linethird line before',
      'last line'
    ])
  })

  it('should parse strings last line new line last empty', async () => {
    const stringStream = asReadableStream([
      'first line no new line',
      'first line before\nsecond line\nthird line no new line',
      'third line before\n'
    ])

    const stream = streamFromNodeJSReadable(stringStream)
    const result = await materialize(stream)
    assert.deepEqual(result, [
      'first line no new linefirst line before',
      'second line',
      'third line no new linethird line before',
      ''
    ])
  })

    it('should parse strings last two lines no new lines', async () => {
    const stringStream = asReadableStream([
      'first line no new line',
      'first line before\nsecond line\nthird line no new line',
      'third line before',
      'last line'
    ])

    const stream = streamFromNodeJSReadable(stringStream)
    const result = await materialize(stream)
    assert.deepEqual(result, [
      'first line no new linefirst line before',
      'second line',
      'third line no new linethird line beforelast line',
    ])
  })

})