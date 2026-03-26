import { describe, it, expect } from 'vitest'
import { parseSSEStream, parseSSELine } from '@/lib/sse-utils'

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events = []
  for await (const e of parseSSEStream(stream)) events.push(e)
  return events
}

describe('parseSSELine', () => {
  it('data: 접두사가 있는 유효한 JSON을 파싱한다', () => {
    const result = parseSSELine('data: {"type":"token","text":"안녕"}')
    expect(result).toEqual({ type: 'token', text: '안녕' })
  })

  it('data: 접두사가 없으면 null을 반환한다', () => {
    expect(parseSSELine('event: message')).toBeNull()
    expect(parseSSELine('')).toBeNull()
  })

  it('잘못된 JSON이면 null을 반환한다', () => {
    expect(parseSSELine('data: {invalid}')).toBeNull()
  })
})

describe('parseSSEStream', () => {
  it('\\n\\n으로 구분된 이벤트를 순서대로 파싱한다', async () => {
    const stream = makeStream([
      'data: {"type":"token","text":"Hello"}\n\n',
      'data: {"type":"done","nextQuestion":null,"updatedQueue":[],"sessionComplete":false}\n\n',
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'token', text: 'Hello' })
    expect(events[1]).toMatchObject({ type: 'done', sessionComplete: false })
  })

  it('단일 청크에 여러 이벤트가 포함된 경우 모두 파싱한다', async () => {
    const stream = makeStream([
      'data: {"type":"token","text":"A"}\n\ndata: {"type":"token","text":"B"}\n\n',
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ text: 'A' })
    expect(events[1]).toMatchObject({ text: 'B' })
  })

  it('청크가 \\n\\n 경계에서 쪼개져도 올바르게 파싱한다', async () => {
    const stream = makeStream([
      'data: {"type":"token","text":"split"}\n',
      '\ndata: {"type":"done","nextQuestion":null,"updatedQueue":[],"sessionComplete":true}\n\n',
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ type: 'token' })
    expect(events[1]).toMatchObject({ type: 'done', sessionComplete: true })
  })

  it('스트림이 \\n\\n 없이 종료돼도 남은 버퍼를 flush한다', async () => {
    const stream = makeStream([
      'data: {"type":"done","nextQuestion":null,"updatedQueue":[],"sessionComplete":true}',
    ])
    const events = await collect(stream)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'done', sessionComplete: true })
  })

  it('빈 스트림에서 이벤트를 반환하지 않는다', async () => {
    const stream = makeStream([])
    const events = await collect(stream)
    expect(events).toHaveLength(0)
  })
})
