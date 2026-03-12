import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { buildTopic } from '../mqtt.js'

// Replicate the message parsing logic from index.ts for unit testing
type InboundMessage = {
  msgId: number
  identifier: 'chat_input'
  outParams: { text: string }
}

type OutboundMessage = {
  msgId: number
  identifier: 'chat_output'
  outParams: { content: string }
}

function makeMockClient() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    subscribe: vi.fn((_topic: string, cb: (err: null) => void) => cb(null)),
    publish: vi.fn(),
  })
}

function setupSubscriber(client: ReturnType<typeof makeMockClient>, toy_sn: string, onMessage: (msgId: number, text: string) => void) {
  const topic = buildTopic(toy_sn)
  client.subscribe(topic, () => {})
  client.on('message', (_topic: string, payload: Buffer) => {
    if (_topic !== topic) return
    try {
      const msg = JSON.parse(payload.toString()) as InboundMessage
      if (msg.identifier !== 'chat_input' || typeof msg.outParams?.text !== 'string') return
      onMessage(msg.msgId, msg.outParams.text)
    } catch {
      // ignore
    }
  })
}

describe('inbound message parsing', () => {
  const toy_sn = 'SN001'
  const topic = buildTopic(toy_sn)

  it('calls onMessage with msgId and text on valid chat_input', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    const msg: InboundMessage = { msgId: 42, identifier: 'chat_input', outParams: { text: 'hello' } }
    client.emit('message', topic, Buffer.from(JSON.stringify(msg)))

    expect(onMessage).toHaveBeenCalledWith(42, 'hello')
  })

  it('ignores messages on other topics', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    const msg: InboundMessage = { msgId: 1, identifier: 'chat_input', outParams: { text: 'hi' } }
    client.emit('message', '/openapi/folotoy/OTHER/thing/data/post', Buffer.from(JSON.stringify(msg)))

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('ignores messages with unknown identifier', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    client.emit('message', topic, Buffer.from(JSON.stringify({ msgId: 1, identifier: 'other', outParams: { text: 'hi' } })))

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('ignores malformed JSON', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    client.emit('message', topic, Buffer.from('not json'))

    expect(onMessage).not.toHaveBeenCalled()
  })
})

describe('outbound message format', () => {
  const toy_sn = 'SN001'
  const topic = buildTopic(toy_sn)

  it('publishes chat_output with correct msgId and content', () => {
    const client = makeMockClient()
    const msgId = 42
    const content = 'world'
    const outMsg: OutboundMessage = {
      msgId,
      identifier: 'chat_output',
      outParams: { content },
    }
    client.publish(topic, JSON.stringify(outMsg))

    expect(client.publish).toHaveBeenCalledOnce()
    const [t, payload] = client.publish.mock.calls[0] as [string, string]
    expect(t).toBe(topic)
    expect(JSON.parse(payload)).toEqual({ msgId: 42, identifier: 'chat_output', outParams: { content: 'world' } })
  })
})
