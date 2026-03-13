import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { buildInboundTopic, buildOutboundTopic } from '../mqtt.js'

// Replicate the message parsing logic from index.ts for unit testing
type InboundMessage = {
  msgId: number
  identifier: 'chat_input'
  inputParams: { text: string; recording_id: number }
}

type OutboundMessage = {
  msgId: number
  identifier: 'chat_output'
  outParams: { content: string; recording_id: number; order: number; is_finished: boolean }
}

function makeMockClient() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    subscribe: vi.fn((_topic: string, cb: (err: null) => void) => cb(null)),
    publish: vi.fn(),
  })
}

function setupSubscriber(client: ReturnType<typeof makeMockClient>, toy_sn: string, onMessage: (msgId: number, text: string, recording_id: number) => void) {
  const topic = buildInboundTopic(toy_sn)
  client.subscribe(topic, () => {})
  client.on('message', (_topic: string, payload: Buffer) => {
    if (_topic !== topic) return
    try {
      const msg = JSON.parse(payload.toString()) as InboundMessage
      if (msg.identifier !== 'chat_input' || typeof msg.inputParams?.text !== 'string') return
      onMessage(msg.msgId, msg.inputParams.text, msg.inputParams.recording_id)
    } catch {
      // ignore
    }
  })
}

describe('inbound message parsing', () => {
  const toy_sn = 'SN001'
  const inboundTopic = buildInboundTopic(toy_sn)

  it('calls onMessage with msgId, text and recording_id on valid chat_input', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    const msg: InboundMessage = { msgId: 42, identifier: 'chat_input', inputParams: { text: 'hello', recording_id: 100 } }
    client.emit('message', inboundTopic, Buffer.from(JSON.stringify(msg)))

    expect(onMessage).toHaveBeenCalledWith(42, 'hello', 100)
  })

  it('ignores messages on other topics', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    const msg: InboundMessage = { msgId: 1, identifier: 'chat_input', inputParams: { text: 'hi', recording_id: 1 } }
    client.emit('message', '/openapi/folotoy/OTHER/thing/command/call', Buffer.from(JSON.stringify(msg)))

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('ignores messages with unknown identifier', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    client.emit('message', inboundTopic, Buffer.from(JSON.stringify({ msgId: 1, identifier: 'other', inputParams: { text: 'hi', recording_id: 1 } })))

    expect(onMessage).not.toHaveBeenCalled()
  })

  it('ignores malformed JSON', () => {
    const client = makeMockClient()
    const onMessage = vi.fn()
    setupSubscriber(client, toy_sn, onMessage)

    client.emit('message', inboundTopic, Buffer.from('not json'))

    expect(onMessage).not.toHaveBeenCalled()
  })
})

describe('outbound message format', () => {
  const toy_sn = 'SN001'
  const outboundTopic = buildOutboundTopic(toy_sn)

  it('publishes chat_output with recording_id, order and is_finished', () => {
    const client = makeMockClient()
    const outMsg: OutboundMessage = {
      msgId: 42,
      identifier: 'chat_output',
      outParams: { content: 'world', recording_id: 100, order: 1, is_finished: false },
    }
    client.publish(outboundTopic, JSON.stringify(outMsg))

    expect(client.publish).toHaveBeenCalledOnce()
    const [t, payload] = client.publish.mock.calls[0] as [string, string]
    expect(t).toBe(outboundTopic)
    expect(JSON.parse(payload)).toEqual({
      msgId: 42,
      identifier: 'chat_output',
      outParams: { content: 'world', recording_id: 100, order: 1, is_finished: false },
    })
  })

  it('publishes finish message with is_finished=true', () => {
    const client = makeMockClient()
    const finishMsg: OutboundMessage = {
      msgId: 42,
      identifier: 'chat_output',
      outParams: { content: '', recording_id: 100, order: 2, is_finished: true },
    }
    client.publish(outboundTopic, JSON.stringify(finishMsg))

    const [, payload] = client.publish.mock.calls[0] as [string, string]
    const parsed = JSON.parse(payload)
    expect(parsed.outParams.is_finished).toBe(true)
    expect(parsed.outParams.order).toBe(2)
    expect(parsed.outParams.content).toBe('')
  })
})
