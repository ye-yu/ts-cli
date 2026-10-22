import type { Builder, CharReader } from "./reader.ts";

type StateMachine = {
  name: string,
  nextCandidate: () => StateMachine[],
  isNextCandidate: (nextChar: string) => boolean
}

const numberInitialState: StateMachine = {
  name: 'numberInitialState',
  nextCandidate: () => [numberZeroState, numberNegativeState, numberOneNineState],
  isNextCandidate: () => { throw new Error("Unreachable statement") },
}

const numberNegativeState: StateMachine = {
  name: 'numberNegativeState',
  nextCandidate: () => [numberZeroState],
  isNextCandidate: (char) => char === '-',
}

const numberZeroState: StateMachine = {
  name: 'numberZeroState',
  nextCandidate: () => [numberFractionState, numberExpState],
  isNextCandidate: (char) => char === '0',
}

const numberOneNineState: StateMachine = {
  name: 'numberOneNineState',
  nextCandidate: () => [numberDigitState],
  isNextCandidate: (char) => char !== '0' && isFinite(+char),
}

const numberDigitState: StateMachine = {
  name: 'numberDigitState',
  nextCandidate: () => [numberDigitState, numberFractionState, numberExpState],
  isNextCandidate: (char) => isFinite(+char),
}

const numberFractionState: StateMachine = {
  name: 'numberFractionState',
  nextCandidate: () => [numberFractionDigitState],
  isNextCandidate: (char) => char === '.',
}

const numberFractionDigitState: StateMachine = {
  name: 'numberFractionDigitState',
  nextCandidate: () => [numberFractionDigitState, numberExpState],
  isNextCandidate: (char) => isFinite(+char),
}

const numberExpState: StateMachine = {
  name: 'numberExpState',
  nextCandidate: () => [numberExpSignState, numberExpDigitState],
  isNextCandidate: (char) => char === 'e' || char === 'E',
}

const numberExpSignState: StateMachine = {
  name: 'numberExpSignState',
  nextCandidate: () => [numberExpDigitState],
  isNextCandidate: (char) => char === '-' || char === '+',
}

const numberExpDigitState: StateMachine = {
  name: 'numberExpDigitState',
  nextCandidate: () => [numberExpDigitState],
  isNextCandidate: (char) => isFinite(+char),
}

export function numberParser(reader: CharReader, builder: Builder): number | undefined {
  let state: StateMachine | undefined = numberInitialState
  while (
    reader.hasNext() &&
    (state = state.nextCandidate().find(e => e.isNextCandidate(reader.peek())))
  ) {
    builder.append(reader.next())
  }
  const result = builder.result()
  return result ? JSON.parse(result) : undefined
}

export function maybeNumber(reader: CharReader): boolean {
  return !!numberInitialState.nextCandidate().find(e => e.isNextCandidate(reader.peek()))
}