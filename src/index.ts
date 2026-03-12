import type { OpenClawPluginApi, ChannelPlugin } from 'openclaw/plugin-sdk/core'
import type { OutboundDeliveryResult } from '../node_modules/openclaw/dist/plugin-sdk/infra/outbound/deliver.js'
import type { MqttClient } from 'mqtt'
import { resolveCredentials, createMqttClient, buildTopic } from './mqtt.js'
import { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT } from './config.js'
import type { PluginConfig } from './config.js'

type FoloToyAccount = PluginConfig

type OutboundMessage = {
  msgId: number
  identifier: 'chat_output'
  outParams: { content: string }
}

type InboundMessage = {
  msgId: number
  identifier: 'chat_input'
  outParams: { text: string }
}

// Per-account MQTT clients for proactive (outbound) sends
const activeClients = new Map<string, { client: MqttClient; toy_sn: string }>()

const folotoyPlugin: ChannelPlugin<FoloToyAccount> = {
  id: 'folotoy',
  meta: {
    id: 'folotoy',
    label: 'FoloToy',
    selectionLabel: 'FoloToy',
    docsPath: '/channels/folotoy',
    blurb: 'Connect FoloToy smart toys via MQTT',
  },
  capabilities: {
    chatTypes: ['direct'],
  },
  configSchema: {
    schema: {
      type: 'object',
      properties: {
        auth: {
          type: 'object',
          oneOf: [
            {
              title: 'Flow 1: HTTP API 登录',
              properties: {
                flow: { type: 'string', const: 'api' },
                api_url: { type: 'string' },
                api_key: { type: 'string' },
                toy_sn: { type: 'string' },
              },
              required: ['flow', 'api_url', 'api_key', 'toy_sn'],
            },
            {
              title: 'Flow 2: 直接配置 SN + Key',
              properties: {
                flow: { type: 'string', const: 'direct' },
                toy_sn: { type: 'string' },
                toy_key: { type: 'string' },
              },
              required: ['flow', 'toy_sn', 'toy_key'],
              default: { flow: 'direct' },
            },
          ],
        },
        mqtt: {
          type: 'object',
          properties: {
            host: { type: 'string', default: DEFAULT_MQTT_HOST },
            port: { type: 'number', default: DEFAULT_MQTT_PORT },
          },
        },
      },
      required: ['auth'],
    },
    uiHints: {
      'auth.api_key': { sensitive: true, label: 'API Key' },
      'auth.toy_key': { sensitive: true, label: 'Toy Key' },
      'auth.toy_sn': { label: 'Toy SN' },
      'auth.api_url': { label: 'API URL', placeholder: 'https://api.folotoy.com' },
      'mqtt.host': { label: 'MQTT Host', placeholder: DEFAULT_MQTT_HOST },
      'mqtt.port': { label: 'MQTT Port' },
    },
  },
  config: {
    listAccountIds: (cfg) => {
      const accounts = (cfg as any).channels?.folotoy?.accounts ?? {}
      return Object.keys(accounts)
    },
    resolveAccount: (cfg, accountId) => {
      const accounts = (cfg as any).channels?.folotoy?.accounts ?? {}
      return accounts[accountId ?? 'default'] ?? {}
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { account, cfg, accountId, abortSignal, channelRuntime } = ctx

      if (!channelRuntime) {
        ctx.log?.warn?.('channelRuntime not available — skipping MQTT connection')
        return
      }

      const mqttConfig: PluginConfig = {
        auth: account.auth,
        mqtt: {
          host: account.mqtt?.host ?? DEFAULT_MQTT_HOST,
          port: account.mqtt?.port ?? DEFAULT_MQTT_PORT,
        },
      }

      const credentials = await resolveCredentials(mqttConfig)
      const client = await createMqttClient(mqttConfig, credentials)
      const topic = buildTopic(credentials.toy_sn)

      activeClients.set(accountId, { client, toy_sn: credentials.toy_sn })

      client.subscribe(topic, (err) => {
        if (err) ctx.log?.error?.(`Failed to subscribe to ${topic}: ${err.message}`)
        else ctx.log?.info?.(`Subscribed to ${topic}`)
      })

      client.on('message', async (_topic, payload) => {
        let msg: InboundMessage
        try {
          msg = JSON.parse(payload.toString()) as InboundMessage
        } catch {
          return
        }

        if (msg.identifier !== 'chat_input' || typeof msg.outParams?.text !== 'string') return

        const { msgId, outParams: { text } } = msg

        const inboundCtx = channelRuntime.reply.finalizeInboundContext({
          Body: text,
          From: credentials.toy_sn,
          To: credentials.toy_sn,
          SessionKey: `folotoy-${accountId}-${credentials.toy_sn}`,
          AccountId: accountId,
          Provider: 'folotoy',
        })

        try {
          await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: inboundCtx,
            cfg,
            dispatcherOptions: {
              deliver: async (replyPayload) => {
                if (!replyPayload.text) return
                const outMsg: OutboundMessage = {
                  msgId,
                  identifier: 'chat_output',
                  outParams: { content: replyPayload.text },
                }
                client.publish(topic, JSON.stringify(outMsg))
              },
            },
          })
        } catch (err) {
          ctx.log?.error?.(`Failed to dispatch reply: ${String(err)}`)
        }
      })

      abortSignal.addEventListener('abort', () => {
        activeClients.delete(accountId)
        client.end()
        ctx.log?.info?.('MQTT client disconnected')
      })
    },

    stopAccount: async (ctx) => {
      // cleanup is handled by abortSignal in startAccount
    },
  },

  outbound: {
    deliveryMode: 'direct',
    sendText: async ({ text, accountId }) => {
      const key = accountId ?? 'default'
      const entry = activeClients.get(key)
      if (!entry) throw new Error(`No active MQTT client for account ${key}`)

      const topic = buildTopic(entry.toy_sn)
      const msgId = Date.now()
      const outMsg: OutboundMessage = {
        msgId,
        identifier: 'chat_output',
        outParams: { content: text },
      }
      entry.client.publish(topic, JSON.stringify(outMsg))
      return { channel: 'folotoy', messageId: String(msgId) }
    },
  },
}

export default (api: OpenClawPluginApi) => {
  api.registerChannel({ plugin: folotoyPlugin })
}
