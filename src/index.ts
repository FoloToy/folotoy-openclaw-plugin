import type { OpenClawPluginApi, ChannelPlugin, PluginRuntime } from 'openclaw/plugin-sdk/core'
import { resolveCredentials, createMqttClient, buildInboundTopic, buildOutboundTopic, buildNotificationTopic } from './mqtt.js'
import { pickSoothingReply } from './soothing.js'
import { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT, DEFAULT_SUMMARY_ENABLED, DEFAULT_SUMMARY_MAX_CHARS, flatToPluginConfig } from './config.js'
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

type NotificationMessage = {
  msgId: number
  identifier: 'send_notification'
  outParams: { text: string }
}

// Per-account MQTT clients and msgId counters
const activeClients = new Map<string, { client: MqttClient; toy_sn: string; nextMsgId: number }>()

// Subagent reference, set at plugin registration
let subagent: PluginRuntime['subagent'] | undefined

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
        summary_enabled: { type: 'boolean', default: DEFAULT_SUMMARY_ENABLED },
        summary_max_chars: { type: 'number', default: DEFAULT_SUMMARY_MAX_CHARS },
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
      summary_enabled: { label: 'Enable Summary' },
      summary_max_chars: { label: 'Summary Max Characters' },
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
      log?.info?.(`Connecting to MQTT broker ${mqttConfig.mqtt.host}:${mqttConfig.mqtt.port}...`)
      const credentials = await resolveCredentials(mqttConfig)
      const client = await createMqttClient(mqttConfig, credentials)
      const inboundTopic = buildInboundTopic(credentials.toy_sn)
      const outboundTopic = buildOutboundTopic(credentials.toy_sn)

      activeClients.set(accountId, { client, toy_sn: credentials.toy_sn, nextMsgId: 1 })
      log?.info?.(`Connected to MQTT broker, subscribed to ${inboundTopic}`)

      client.subscribe(inboundTopic, (err) => {
        if (err) log?.error?.(`Failed to subscribe: ${err.message}`)
      })

      const summaryEnabled = account.summary_enabled ?? DEFAULT_SUMMARY_ENABLED
      const summaryMaxChars = account.summary_max_chars ?? DEFAULT_SUMMARY_MAX_CHARS

      client.on('message', (_topic, payload) => {
        let msg: InboundMessage
        try {
          msg = JSON.parse(payload.toString()) as InboundMessage
        } catch {
          return
        }
        if (msg.identifier !== 'chat_input' || typeof msg.inputParams?.text !== 'string') return

        const { msgId, inputParams: { text, recording_id } } = msg
        let order = 1

        // Send a quick soothing acknowledgment before AI processing (order=1).
        // AI replies continue from order=2.
        const ackMsg: OutboundMessage = {
          msgId,
          identifier: 'chat_output',
          outParams: { content: pickSoothingReply(text), recording_id, order, is_finished: false },
        }
        client.publish(outboundTopic, JSON.stringify(ackMsg))

        const inboundCtx = channelRuntime.reply.finalizeInboundContext({
          Body: text,
          From: credentials.toy_sn,
          To: credentials.toy_sn,
          SessionKey: `folotoy-${accountId}-${credentials.toy_sn}`,
          AccountId: accountId,
          Provider: 'folotoy',
        })

        // dispatch, optionally summarize, then send finish message
        void (async () => {
          const replyChunks: string[] = []
          try {
            await channelRuntime.reply.dispatchReplyWithBufferedBlockDispatcher({
              ctx: inboundCtx,
              cfg,
              dispatcherOptions: {
                deliver: async (replyPayload) => {
                  if (!replyPayload.text) return
                  replyChunks.push(replyPayload.text)
                },
                onError: (err) => log?.error?.(`Dispatch error: ${String(err)}`),
              },
            })

            let finalText = replyChunks.join('')

            // Summarize if enabled and text exceeds threshold
            if (summaryEnabled && subagent && finalText.length > summaryMaxChars) {
              try {
                const sessionKey = `folotoy-summary-${accountId}-${Date.now()}`
                const { runId } = await subagent.run({
                  sessionKey,
                  message: [
                    `You are an assistant that summarizes texts concisely while keeping the most important information.`,
                    `Summarize the text to approximately ${summaryMaxChars} characters.`,
                    `Maintain the original tone and style. Reply only with the summary, without additional explanations.`,
                    ``,
                    `<text_to_summarize>`,
                    finalText,
                    `</text_to_summarize>`,
                  ].join('\n'),
                  deliver: false,
                })
                const result = await subagent.waitForRun({ runId, timeoutMs: 30_000 })
                if (result.status === 'ok') {
                  const { messages } = await subagent.getSessionMessages({ sessionKey, limit: 1 })
                  const lastMsg = messages[messages.length - 1] as { content?: string; text?: string } | undefined
                  const summaryText = lastMsg?.content ?? lastMsg?.text
                  if (summaryText) finalText = summaryText
                }
                await subagent.deleteSession({ sessionKey }).catch(() => {})
              } catch (err) {
                log?.warn?.(`Summary failed, truncating text: ${String(err)}`)
                finalText = `${finalText.slice(0, summaryMaxChars - 3)}...`
              }
            }

            if (finalText) {
              order++
              const outMsg: OutboundMessage = {
                msgId,
                identifier: 'chat_output',
                outParams: { content: finalText, recording_id, order, is_finished: false },
              }
              client.publish(outboundTopic, JSON.stringify(outMsg))
            }
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
    resolveTarget: ({ accountId }) => {
      const key = accountId ?? 'default'
      const entry = activeClients.get(key)
      if (!entry) return { ok: false, error: new Error(`No active MQTT client for account "${key}"`) }
      return { ok: true, to: entry.toy_sn }
    },
    sendText: async ({ text, accountId }) => {
      const key = accountId ?? 'default'
      const entry = activeClients.get(key)
      if (!entry) throw new Error(`No active MQTT client for account "${key}"`)

      const notificationTopic = buildNotificationTopic(entry.toy_sn)
      const msgId = entry.nextMsgId++
      const notifMsg: NotificationMessage = {
        msgId,
        identifier: 'send_notification',
        outParams: { text },
      }
      entry.client.publish(notificationTopic, JSON.stringify(notifMsg))
      return { channel: 'folotoy', messageId: String(msgId) }
    },
  },
}

export function sendNotification({ text, accountId }: { text: string; accountId?: string }) {
  const key = accountId ?? 'default'
  const entry = activeClients.get(key)
  if (!entry) throw new Error(`No active MQTT client for account "${key}"`)

  const notificationTopic = buildNotificationTopic(entry.toy_sn)
  const msgId = entry.nextMsgId++
  const notifMsg: NotificationMessage = {
    msgId,
    identifier: 'send_notification',
    outParams: { text },
  }
  entry.client.publish(notificationTopic, JSON.stringify(notifMsg))
  return { channel: 'folotoy', messageId: String(msgId) }
}

export default (api: OpenClawPluginApi) => {
  subagent = api.runtime.subagent
  api.registerChannel({ plugin: folotoyChannel })
}
