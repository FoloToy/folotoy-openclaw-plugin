import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { FoloToyChannel } from '../channel.js'

function makeMockClient() {
  const emitter = new EventEmitter()
  return Object.assign(emitter, {
    subscribe: vi.fn((_topic: string, cb: (err: null) => void) => cb(null)),
    publish: vi.fn(),
  })
}

describe('FoloToyChannel', () => {
  const credentials = { username: 'u', password: 'p', toy_sn: 'SN001' }

  describe('subscribe', () => {
    it('calls onMessage with msgId and text on valid chat_input', () => {
      const client = makeMockClient()
      const onMessage = vi.fn()
      const channel = new FoloToyChannel(client as any, credentials, onMessage)
      channel.subscribe()

      const msg = { msgId: 42, identifier: 'chat_input', outParams: { text: 'hello' } }
      client.emit('message', '/openapi/folotoy/SN001/thing/data/post', Buffer.from(JSON.stringify(msg)))

      expect(onMessage).toHaveBeenCalledWith(42, 'hello')
    })

    it('ignores messages on other topics', () => {
      const client = makeMockClient()
      const onMessage = vi.fn()
      const channel = new FoloToyChannel(client as any, credentials, onMessage)
      channel.subscribe()

      const msg = { msgId: 1, identifier: 'chat_input', outParams: { text: 'hi' } }
      client.emit('message', '/openapi/folotoy/OTHER/thing/data/post', Buffer.from(JSON.stringify(msg)))

      expect(onMessage).not.toHaveBeenCalled()
    })

    it('ignores messages with unknown identifier', () => {
      const client = makeMockClient()
      const onMessage = vi.fn()
      const channel = new FoloToyChannel(client as any, credentials, onMessage)
      channel.subscribe()

      const msg = { msgId: 1, identifier: 'other_event', outParams: { text: 'hi' } }
      client.emit('message', '/openapi/folotoy/SN001/thing/data/post', Buffer.from(JSON.stringify(msg)))

      expect(onMessage).not.toHaveBeenCalled()
    })

    it('ignores malformed JSON', () => {
      const client = makeMockClient()
      const onMessage = vi.fn()
      const channel = new FoloToyChannel(client as any, credentials, onMessage)
      channel.subscribe()

      client.emit('message', '/openapi/folotoy/SN001/thing/data/post', Buffer.from('not json'))

      expect(onMessage).not.toHaveBeenCalled()
    })
  })

  describe('sendResponse', () => {
    it('publishes chat_output with correct msgId and content', () => {
      const client = makeMockClient()
      const channel = new FoloToyChannel(client as any, credentials, vi.fn())
      channel.sendResponse(42, 'world')

      expect(client.publish).toHaveBeenCalledOnce()
      const [topic, payload] = client.publish.mock.calls[0]
      expect(topic).toBe('/openapi/folotoy/SN001/thing/data/post')
      const msg = JSON.parse(payload)
      expect(msg).toEqual({
        msgId: 42,
        identifier: 'chat_output',
        outParams: { content: 'world' },
      })
    })
  })
})
