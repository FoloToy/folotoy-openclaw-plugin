import { MqttClient } from 'mqtt'
import { MqttCredentials, buildTopic } from './mqtt.js'

type InboundMessage = {
  msgId: number
  identifier: 'chat_input'
  outParams: {
    text: string
  }
}

type OutboundMessage = {
  msgId: number
  identifier: 'chat_output'
  outParams: {
    content: string
  }
}

export class FoloToyChannel {
  private client: MqttClient
  private credentials: MqttCredentials
  private topic: string
  private onMessage: (msgId: number, text: string) => void

  constructor(
    client: MqttClient,
    credentials: MqttCredentials,
    onMessage: (msgId: number, text: string) => void,
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
        if (msg.identifier === 'chat_input' && typeof msg.outParams?.text === 'string') {
          this.onMessage(msg.msgId, msg.outParams.text)
        }
      } catch {
        // ignore malformed messages
      }
    })
  }

  sendResponse(msgId: number, content: string): void {
    const message: OutboundMessage = {
      msgId,
      identifier: 'chat_output',
      outParams: { content },
    }
    this.client.publish(this.topic, JSON.stringify(message))
  }
}
