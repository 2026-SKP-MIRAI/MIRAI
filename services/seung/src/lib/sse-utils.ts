export type SSEEvent =
  | { type: 'token'; text: string }
  | { type: 'meta'; persona: string; personaLabel: string }
  | { type: 'done'; nextQuestion: unknown; updatedQueue: unknown[]; sessionComplete: boolean }
  | { type: 'error'; message: string }

export function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null
  try { return JSON.parse(line.slice(6)) as SSEEvent } catch { return null }
}

export async function* parseSSEStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        for (const line of part.split('\n')) {
          const event = parseSSELine(line)
          if (event) yield event
        }
      }
    }
    // 스트림이 \n\n 없이 종료된 경우 남은 버퍼 flush
    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        const event = parseSSELine(line)
        if (event) yield event
      }
    }
  } finally { reader.releaseLock() }
}
