import type { OpenClawPluginApi, ChannelPlugin, PluginRuntime } from 'openclaw/plugin-sdk/core'
import { resolveCredentials, createMqttClient, buildInboundTopic, buildOutboundTopic, buildNotificationTopic } from './mqtt.js'
import { createSoothingPicker } from './soothing.js'
import { stripMarkdown } from './strip-markdown.js'
import { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT, DEFAULT_SUMMARY_ENABLED, DEFAULT_SUMMARY_MAX_CHARS, DEFAULT_SENTENCE_SPLIT_ENABLED, DEFAULT_SENTENCE_SPLIT_DELIMITERS, DEFAULT_SOOTHING_LOOP_ENABLED, DEFAULT_SOOTHING_LOOP_INTERVAL_MS, DEFAULT_SOOTHING_LOOP_MAX_COUNT, flatToPluginConfig } from './config.js'
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
        sentence_split_enabled: { type: 'boolean', default: DEFAULT_SENTENCE_SPLIT_ENABLED },
        sentence_split_delimiters: { type: 'string', default: DEFAULT_SENTENCE_SPLIT_DELIMITERS },
        soothing_loop_enabled: { type: 'boolean', default: DEFAULT_SOOTHING_LOOP_ENABLED },
        soothing_loop_interval_ms: { type: 'number', default: DEFAULT_SOOTHING_LOOP_INTERVAL_MS },
        soothing_loop_max_count: { type: 'number', default: DEFAULT_SOOTHING_LOOP_MAX_COUNT },
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
      sentence_split_enabled: { label: 'Enable Sentence Splitting' },
      sentence_split_delimiters: { label: 'Sentence Delimiters' },
      soothing_loop_enabled: { label: 'Enable Soothing Loop' },
      soothing_loop_interval_ms: { label: 'Soothing Loop Interval (ms)' },
      soothing_loop_max_count: { label: 'Soothing Loop Max Count' },
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
    resolveAllowFrom: ({ cfg }) => {
      const sn = (cfg as Record<string, unknown> & { channels?: { folotoy?: FlatChannelConfig } })
        ?.channels?.folotoy?.toy_sn
      return sn ? [sn] : undefined
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
      const sentenceSplitEnabled = account.sentence_split_enabled ?? DEFAULT_SENTENCE_SPLIT_ENABLED
      const sentenceSplitDelimiters = account.sentence_split_delimiters ?? DEFAULT_SENTENCE_SPLIT_DELIMITERS
      const soothingLoopEnabled = account.soothing_loop_enabled ?? DEFAULT_SOOTHING_LOOP_ENABLED
      const soothingLoopIntervalMs = account.soothing_loop_interval_ms ?? DEFAULT_SOOTHING_LOOP_INTERVAL_MS
      const soothingLoopMaxCount = account.soothing_loop_max_count ?? DEFAULT_SOOTHING_LOOP_MAX_COUNT

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

        // Create a per-message picker that cycles through candidates without repeats
        const soothingPick = createSoothingPicker(text)

        // Send a quick soothing acknowledgment before AI processing (order=1).
        // AI replies continue from order=2.
        const ackMsg: OutboundMessage = {
          msgId,
          identifier: 'chat_output',
          outParams: { content: soothingPick(), recording_id, order, is_finished: false },
        }
        client.publish(outboundTopic, JSON.stringify(ackMsg))

        const peer = { kind: 'direct' as const, id: credentials.toy_sn }
        const sessionKey = channelRuntime.routing.buildAgentSessionKey({
          agentId: 'main',
          channel: 'folotoy',
          accountId,
          peer,
          dmScope: 'per-channel-peer',
        })

        const inboundCtx = channelRuntime.reply.finalizeInboundContext({
          Body: text,
          From: credentials.toy_sn,
          To: credentials.toy_sn,
          SessionKey: sessionKey,
          AccountId: accountId,
          Provider: 'folotoy',
          Surface: 'folotoy',
          OriginatingChannel: 'folotoy',
          OriginatingTo: credentials.toy_sn,
        })

        // dispatch using dispatchReplyFromConfig (full agent capabilities including tools)
        void (async () => {
          // Sentence-level streaming: buffer incoming text and flush complete
          // sentences (delimited by punctuation) to the toy immediately.
          const sentenceDelimiterRe = sentenceSplitEnabled
            ? new RegExp(`[${sentenceSplitDelimiters.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')}]`)
            : null
          let sentenceBuffer = ''
          let totalSentChars = 0
          let firstSentenceFlushed = false
          let llmStarted = false

          // Send soothing replies while waiting for the LLM to start responding.
          // Once any LLM chunk arrives, stop immediately. Max 5 soothing messages.
          let soothingTimer: ReturnType<typeof setTimeout> | null = null
          let soothingCount = 0
          const stopSoothingLoop = () => {
            if (soothingTimer) { clearTimeout(soothingTimer); soothingTimer = null }
          }
          const resetSoothingTimer = () => {
            if (!soothingLoopEnabled || llmStarted || soothingCount >= soothingLoopMaxCount) return
            if (soothingTimer) clearTimeout(soothingTimer)
            soothingTimer = setTimeout(() => {
              if (llmStarted || soothingCount >= soothingLoopMaxCount) return
              soothingCount++
              order++
              const extraAck: OutboundMessage = {
                msgId,
                identifier: 'chat_output',
                outParams: { content: soothingPick(), recording_id, order, is_finished: false },
              }
              client.publish(outboundTopic, JSON.stringify(extraAck))
              // Restart timer in case LLM stays silent even longer
              resetSoothingTimer()
            }, soothingLoopIntervalMs)
          }
          resetSoothingTimer()

          // First sentence: split purely by punctuation (fast first response).
          // Subsequent sentences: require a minimum length that grows with each
          // sentence (base 20 chars, +10 per sentence), so later chunks are longer.
          let sentenceCount = 0
          const minLenForSentence = () => {
            if (sentenceCount === 0) return 0 // first sentence: no minimum
            return Math.min(100, 20 + (sentenceCount - 1) * 10)
          }

          const FORCE_FLUSH_LEN = 200 // force flush if buffer has no delimiter for this many chars

          const publishSentence = (sentence: string) => {
            sentenceCount++
            if (!firstSentenceFlushed) firstSentenceFlushed = true
            order++
            totalSentChars += sentence.length
            const outMsg: OutboundMessage = {
              msgId,
              identifier: 'chat_output',
              outParams: { content: sentence, recording_id, order, is_finished: false },
            }
            client.publish(outboundTopic, JSON.stringify(outMsg))
          }

          const flushSentences = () => {
            if (!sentenceDelimiterRe) return
            while (true) {
              const minLen = minLenForSentence()
              // Search for a delimiter that is at or beyond the minimum length
              let idx = -1
              const searchFrom = Math.max(0, minLen - 1)
              if (searchFrom < sentenceBuffer.length) {
                const sub = sentenceBuffer.slice(searchFrom)
                const match = sub.search(sentenceDelimiterRe)
                if (match !== -1) idx = searchFrom + match
              }
              if (idx !== -1) {
                const sentence = sentenceBuffer.slice(0, idx + 1).trim()
                sentenceBuffer = sentenceBuffer.slice(idx + 1)
                if (sentence) publishSentence(sentence)
                continue
              }
              // No delimiter found — force flush if buffer exceeds limit
              if (sentenceBuffer.length >= FORCE_FLUSH_LEN) {
                // Try to break at the last space/comma for a cleaner cut
                let cutIdx = FORCE_FLUSH_LEN
                const lastSpace = sentenceBuffer.lastIndexOf(' ', FORCE_FLUSH_LEN)
                const lastComma = sentenceBuffer.lastIndexOf('，', FORCE_FLUSH_LEN)
                const lastBreak = Math.max(lastSpace, lastComma)
                if (lastBreak > FORCE_FLUSH_LEN / 2) cutIdx = lastBreak + 1
                const sentence = sentenceBuffer.slice(0, cutIdx).trim()
                sentenceBuffer = sentenceBuffer.slice(cutIdx)
                if (sentence) publishSentence(sentence)
                continue
              }
              break
            }
          }

          const dispatcher = {
            sendToolResult: () => true,
            sendBlockReply: () => true,
            sendFinalReply: (payload: { text?: string }) => {
              if (payload.text) {
                if (!llmStarted) {
                  llmStarted = true
                  stopSoothingLoop()
                }
                sentenceBuffer += stripMarkdown(payload.text)
                flushSentences()
              }
              return true
            },
            waitForIdle: async () => {},
            getQueuedCounts: () => ({ tool: 0, block: 0, final: 0 }),
            markComplete: () => {},
          }
          try {
            await channelRuntime.reply.withReplyDispatcher({
              dispatcher,
              run: () =>
                channelRuntime.reply.dispatchReplyFromConfig({
                  ctx: inboundCtx,
                  cfg,
                  dispatcher,
                }),
            })

            // Flush remaining buffer (text after the last punctuation)
            let remaining = sentenceBuffer.trim()
            if (remaining) {
              // Summarize remaining text if enabled and total response exceeds threshold
              if (summaryEnabled && subagent && (totalSentChars + remaining.length) > summaryMaxChars) {
                try {
                  const summarySessionKey = `folotoy-summary-${accountId}-${Date.now()}`
                  const { runId } = await subagent.run({
                    sessionKey: summarySessionKey,
                    message: [
                      `You are an assistant that summarizes texts concisely while keeping the most important information.`,
                      `Summarize the text to approximately ${Math.max(50, summaryMaxChars - totalSentChars)} characters.`,
                      `Maintain the original tone and style. Reply only with the summary, without additional explanations.`,
                      ``,
                      `<text_to_summarize>`,
                      remaining,
                      `</text_to_summarize>`,
                    ].join('\n'),
                    deliver: false,
                  })
                  const result = await subagent.waitForRun({ runId, timeoutMs: 30_000 })
                  if (result.status === 'ok') {
                    const { messages } = await subagent.getSessionMessages({ sessionKey: summarySessionKey, limit: 1 })
                    const lastMsg = messages[messages.length - 1] as { content?: string; text?: string } | undefined
                    const summaryText = lastMsg?.content ?? lastMsg?.text
                    if (summaryText) remaining = summaryText
                  }
                  await subagent.deleteSession({ sessionKey: summarySessionKey }).catch(() => {})
                } catch (err) {
                  log?.warn?.(`Summary failed, truncating text: ${String(err)}`)
                  const maxRemaining = Math.max(50, summaryMaxChars - totalSentChars)
                  remaining = `${remaining.slice(0, maxRemaining - 3)}...`
                }
              }

              order++
              const outMsg: OutboundMessage = {
                msgId,
                identifier: 'chat_output',
                outParams: { content: remaining, recording_id, order, is_finished: false },
              }
              client.publish(outboundTopic, JSON.stringify(outMsg))
            }
          } finally {
            if (soothingTimer) { clearTimeout(soothingTimer); soothingTimer = null }
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

  agentPrompt: {
    messageToolHints: ({ cfg }) => {
      const folotoy = (cfg as Record<string, unknown> & { channels?: { folotoy?: FlatChannelConfig } })
        ?.channels?.folotoy
      const sn = folotoy?.toy_sn ?? '<toy_sn>'
      const now = new Date()
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const tzOffsetMin = -now.getTimezoneOffset()
      const tzSign = tzOffsetMin >= 0 ? '+' : '-'
      const tzH = String(Math.floor(Math.abs(tzOffsetMin) / 60)).padStart(2, '0')
      const tzM = String(Math.abs(tzOffsetMin) % 60).padStart(2, '0')
      const tzSuffix = `${tzSign}${tzH}:${tzM}`
      const pad = (n: number) => String(n).padStart(2, '0')
      const nowLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${tzSuffix}`
      return [
        `[FoloToy] This message is from a FoloToy toy (SN: ${sn}). Current time: ${nowLocal} (${tz}). IMPORTANT: Your reply will be converted to speech (TTS). Use plain text only — no markdown, no bullet points, no numbered lists, no code blocks, no URLs. Write in a natural, conversational tone.`,
        [
          `To set reminders/timers, use the cron tool with action="add". IMPORTANT:`,
          `- schedule.at MUST use the same timezone offset as current time (${tzSuffix}), NEVER use "Z"`,
          `- For "N分钟后" reminders, add N minutes to current time ${nowLocal}`,
          `- payload.kind MUST be "systemEvent" with a "text" field containing the reminder message`,
          `- sessionTarget MUST be "isolated"`,
          `- delivery MUST be: {"mode":"announce","channel":"folotoy","to":"${sn}","accountId":"default"}`,
          `Example: {"action":"add","job":{"name":"喝水提醒","schedule":{"kind":"at","at":"2026-03-27T21:03:00${tzSuffix}"},"payload":{"kind":"systemEvent","text":"时间到啦，该喝水了！"},"sessionTarget":"isolated","delivery":{"mode":"announce","channel":"folotoy","to":"${sn}","accountId":"default"},"enabled":true}}`,
        ].join('\n'),
      ]
    },
  },

  messaging: {
    targetResolver: {
      looksLikeId: () => true,
      hint: 'FoloToy toy SN (e.g. 1051db8d0d0c)',
    },
  },


  outbound: {
    deliveryMode: 'direct',
    resolveTarget: ({ to, cfg }) => {
      if (to) return { ok: true, to }
      const folotoy = (cfg as Record<string, unknown> & { channels?: { folotoy?: FlatChannelConfig } })
        ?.channels?.folotoy
      if (folotoy?.toy_sn) return { ok: true, to: folotoy.toy_sn }
      return { ok: false, error: new Error('No toy_sn configured for FoloToy') }
    },
    sendText: async ({ text, accountId }) => {
      const key = accountId ?? 'default'
      const entry = activeClients.get(key) ?? activeClients.values().next().value
      if (!entry) throw new Error(`No active MQTT client for account "${key}"`)

      const notificationTopic = buildNotificationTopic(entry.toy_sn)
      const msgId = entry.nextMsgId++
      const notifMsg: NotificationMessage = {
        msgId,
        identifier: 'send_notification',
        outParams: { text: stripMarkdown(text) },
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
    outParams: { text: stripMarkdown(text) },
  }
  entry.client.publish(notificationTopic, JSON.stringify(notifMsg))
  return { channel: 'folotoy', messageId: String(msgId) }
}

export default (api: OpenClawPluginApi) => {
  subagent = api.runtime.subagent
  api.registerChannel({ plugin: folotoyChannel })
}
