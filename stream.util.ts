import readline from 'node:readline'

type ByteStringAsyncGenerator = AsyncGenerator<string, void, undefined>

const sliceOneByDelimiter = (delimiter: string) => {
  const codePoint = delimiter.charCodeAt(0);
  return (buffer: Buffer, start: number): { found: boolean; start: number; end: number; } => {
    const end = buffer.indexOf(codePoint, start);
    if (end === -1) {
      return { found: false, start: -1, end: -1 };
    }
    return { found: true, start: start, end: end };
  }
}

const sliceOneByDelimiterFromString = (delimiter: string) => function (buffer: string, start: number): { found: boolean, start: number, end: number } {
  const end = buffer.indexOf(delimiter, start);
  if (end === -1) {
    return { found: false, start: -1, end: -1 };
  }
  return { found: true, start: start, end: end };
}

export async function* streamLineFromNodeJsReadable(readStream: NodeJS.ReadableStream): ByteStringAsyncGenerator {
  const readInterface = readline.createInterface({ input: readStream, crlfDelay: Infinity });
  for await (const line of readInterface) {
    yield line;
  }
}

export async function* streamFromNodeJSReadable(
  readStream: NodeJS.ReadableStream,
  delimiter = '\n',
): ByteStringAsyncGenerator {
  const asyncIterator = readStream[Symbol.asyncIterator]();
  let peeked = await asyncIterator.next();
  const peekedValue: string | Buffer = peeked.value ?? '';
  const sliceFn = typeof peekedValue === 'string' ? sliceOneByDelimiterFromString(delimiter) : sliceOneByDelimiter(delimiter)
  let chunked = ''
  // outer for peeked
  {
    let start = 0;
    let sliced = sliceFn(peekedValue as any, start);
    if (!sliced.found) {
      chunked += peekedValue.toString();
    } else {
      do {
        chunked += peekedValue.slice(sliced.start, sliced.end).toString();
        yield chunked;
        chunked = '';
        start = sliced.end + 1;
        sliced = sliceFn(peekedValue as any, start);
      } while (sliced.found)
      // sliced.found is now false again
      chunked = peekedValue.slice(start).toString();
    }
  }
  for await (const chunk of asyncIterator) {
    let start = 0;
    let sliced = sliceFn(chunk as any, start);
    if (!sliced.found) {
      chunked += chunk.toString();
      continue;
    }
    do {
      chunked += chunk.slice(sliced.start, sliced.end).toString();
      yield chunked;
      chunked = '';
      start = sliced.end + 1;
      sliced = sliceFn(chunk as any, start);
    } while (sliced.found)
    // sliced.found is now false again
    chunked = chunk.slice(start).toString();
  }
  yield chunked;
}

const decoder = new TextDecoder()
export async function* streamFromReadable(readable: ReadableStream<Uint8Array<ArrayBuffer>>, delimiter = '\n'): AsyncGenerator<string, void, undefined> {
  let chunked = "";
  for await (const chunk of readable) {
    chunked += decoder.decode(chunk);
    const splitted = chunked.split(delimiter);
    for (const s of splitted.slice(0, splitted.length - 1)) {
      yield s;
    }
    chunked = splitted[splitted.length - 1];
  }
  if (chunked) {
    yield chunked;
  }
}

export async function* streamBytesFromReadable(readable: NodeJS.ReadableStream): AsyncGenerator<Uint8Array, void, undefined> {

}