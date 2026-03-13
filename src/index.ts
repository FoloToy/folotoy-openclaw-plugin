import type { OpenClawPluginApi, ChannelPlugin } from 'openclaw/plugin-sdk/core'
import { resolveCredentials, createMqttClient, buildInboundTopic, buildOutboundTopic } from './mqtt.js'
import { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT, flatToPluginConfig } from './config.js'
import type { FlatChannelConfig } from './config.js'
import type { MqttClient } from 'mqtt'

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

// Per-account MQTT clients and msgId counters
const activeClients = new Map<string, { client: MqttClient; toy_sn: string; nextMsgId: number }>()

const folotoyChannel: ChannelPlugin<FlatChannelConfig> = {
  id: 'folotoy',
  meta: {
    id: 'folotoy',
    label: 'FoloToy',
    selectionLabel: 'FoloToy',
    docsPath: '/channels/folotoy',
    blurb: 'Empower your FoloToy with OpenClaw AI capabilities.',
  },
  capabilities: {
    chatTypes: ['direct'],
  },
  configSchema: {
    schema: {
      type: 'object',
      properties: {
        flow: { type: 'string', enum: ['direct', 'api'], default: 'direct' },
        toy_sn: { type: 'string' },
        toy_key: { type: 'string' },
        api_url: { type: 'string', default: 'https://api.folotoy.cn' },
        api_key: { type: 'string' },
        mqtt_host: { type: 'string', default: DEFAULT_MQTT_HOST },
        mqtt_port: { type: 'number', default: DEFAULT_MQTT_PORT },
      },
    },
    uiHints: {
      flow: { label: 'Auth Flow' },
      toy_sn: { label: 'Toy SN' },
      toy_key: { label: 'Toy Key', sensitive: true },
      api_url: { label: 'API URL', placeholder: 'https://api.folotoy.com' },
      api_key: { label: 'API Key', sensitive: true },
      mqtt_host: { label: 'MQTT Host', placeholder: DEFAULT_MQTT_HOST },
      mqtt_port: { label: 'MQTT Port' },
    },
  },
  config: {
    listAccountIds: (cfg) => {
      const folotoy = (cfg as Record<string, unknown> & { channels?: { folotoy?: FlatChannelConfig } })
        .channels?.folotoy
      return folotoy ? ['default'] : []
    },
    resolveAccount: (cfg, _accountId) => {
      const folotoy = (cfg as Record<string, unknown> & { channels?: { folotoy?: FlatChannelConfig } })
        .channels?.folotoy
      return folotoy ?? ({} as FlatChannelConfig)
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const { account, cfg, accountId, abortSignal, channelRuntime, log } = ctx

      if (!channelRuntime) {
        log?.warn?.('channelRuntime not available — skipping MQTT connection')
        return
      }

      if (!account.toy_sn) {
        log?.warn?.('toy_sn not configured — skipping MQTT connection')
        return
      }

      const mqttConfig = flatToPluginConfig(account)
      const credentials = await resolveCredentials(mqttConfig)
      const client = await createMqttClient(mqttConfig, credentials)
      const inboundTopic = buildInboundTopic(credentials.toy_sn)
      const outboundTopic = buildOutboundTopic(credentials.toy_sn)

      activeClients.set(accountId, { client, toy_sn: credentials.toy_sn, nextMsgId: 1 })
      log?.info?.(`Connected to MQTT broker, subscribed to ${inboundTopic}`)

      client.subscribe(inboundTopic, (err) => {
        if (err) log?.error?.(`Failed to subscribe: ${err.message}`)
      })

      client.on('message', (_topic, payload) => {
        let msg: InboundMessage
        try {
          msg = JSON.parse(payload.toString()) as InboundMessage
        } catch {
          return
        }
        if (msg.identifier !== 'chat_input' || typeof msg.inputParams?.text !== 'string') return

        const { msgId, inputParams: { text, recording_id } } = msg
        let order = 0

        const inboundCtx = channelRuntime.reply.finalizeInboundContext({
          Body: text,
          From: credentials.toy_sn,
          To: credentials.toy_sn,
          SessionKey: `folotoy-${accountId}-${credentials.toy_sn}`,
          AccountId: accountId,
          Provider: 'folotoy',
        })

        // dispatch and send finish message when done
        void (async () => {
          try {
            await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg,
              dispatcherOptions: {
                deliver: async (replyPayload) => {
                  if (!replyPayload.text) return
                  order++
                  const outMsg: OutboundMessage = {
                    msgId,
                    identifier: 'chat_output',
                    outParams: { content: replyPayload.text, recording_id, order, is_finished: false },
                  }
                  client.publish(outboundTopic, JSON.stringify(outMsg))
                },
                onError: (err) => log?.error?.(`Dispatch error: ${String(err)}`),
              },
            })
          } finally {
            order++
            const finishMsg: OutboundMessage = {
              msgId,
              identifier: 'chat_output',
              outParams: { content: '', recording_id, order, is_finished: true },
            }
            client.publish(outboundTopic, JSON.stringify(finishMsg))
          }
        })()
      })

      // Keep the account alive until aborted
      return new Promise<void>((resolve) => {
        abortSignal.addEventListener('abort', () => {
          activeClients.delete(accountId)
          client.end()
          log?.info?.('MQTT client disconnected')
          resolve()
        })
      })
    },

    stopAccount: async (_ctx) => {
      // cleanup handled by abortSignal listener in startAccount
    },
  },

  outbound: {
    deliveryMode: 'direct',
    sendText: async ({ text, accountId }) => {
      const key = accountId ?? 'default'
      const entry = activeClients.get(key)
      if (!entry) throw new Error(`No active MQTT client for account "${key}"`)

      const outboundTopic = buildOutboundTopic(entry.toy_sn)
      const msgId = entry.nextMsgId++
      const outMsg: OutboundMessage = {
        msgId,
        identifier: 'chat_output',
        outParams: { content: text },
      }
      entry.client.publish(outboundTopic, JSON.stringify(outMsg))
      return { channel: 'folotoy', messageId: String(msgId) }
    },
  },
}

export default (api: OpenClawPluginApi) => {
  api.registerChannel({ plugin: folotoyChannel })
}
