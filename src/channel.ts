import { MqttClient } from 'mqtt'
import { MqttCredentials, buildTopic } from './mqtt.js'

type InboundMessage = {
  text: string
}

type OutboundChunk = {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: { content?: string }
    finish_reason: string | null
  }>
}

export class FoloToyChannel {
  private client: MqttClient
  private credentials: MqttCredentials
  private topic: string
  private onMessage: (text: string) => void

  constructor(
    client: MqttClient,
    credentials: MqttCredentials,
    onMessage: (text: string) => void,
  ) {
    this.client = client
    this.credentials = credentials
    this.topic = buildTopic(credentials.toy_sn)
    this.onMessage = onMessage
  }

  subscribe(): void {
    this.client.subscribe(this.topic, (err) => {
      if (err) throw new Error(`Failed to subscribe to ${this.topic}: ${err.message}`)
    })

    this.client.on('message', (topic, payload) => {
      if (topic !== this.topic) return
      try {
        const msg = JSON.parse(payload.toString()) as InboundMessage
        if (typeof msg.text === 'string') {
          this.onMessage(msg.text)
        }
      } catch {
        // ignore malformed messages
      }
    })
  }

  sendChunk(content: string, id: string, model: string): void {
    const chunk: OutboundChunk = {
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: { content }, finish_reason: null }],
    }
    this.client.publish(this.topic, JSON.stringify(chunk))
  }

  sendDone(id: string, model: string): void {
    const stopChunk: OutboundChunk = {
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    }
    this.client.publish(this.topic, JSON.stringify(stopChunk))
    this.client.publish(this.topic, '[DONE]')
  }
}
