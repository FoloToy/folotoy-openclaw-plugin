/**
 * MQTT integration test — simulates a FoloToy toy.
 *
 * Modes:
 *   chat     — send a message, verify outbound reply format (soothing + reply + finish)
 *   reminder — send a reminder request, verify reply, wait for notification delivery
 *
 * Configuration (via .env or environment variables):
 *   FOLOTOY_TOY_SN    — toy serial number
 *   FOLOTOY_TOY_KEY   — toy key (MQTT password)
 *   FOLOTOY_MQTT_HOST — MQTT broker host
 *   FOLOTOY_MQTT_PORT           — MQTT broker port (default 1883)
 *   FOLOTOY_TEST_MQTT_USERNAME  — MQTT username for test client (default: FOLOTOY_TOY_SN)
 *   FOLOTOY_TEST_MQTT_PASSWORD  — MQTT password for test client (default: FOLOTOY_TOY_KEY)
 *
 * Usage:
 *   node --env-file=.env test-mqtt.mjs chat "你好"
 *   node --env-file=.env test-mqtt.mjs reminder
 *   node --env-file=.env test-mqtt.mjs          # defaults to: chat "你好"
 */
import mqtt from 'mqtt'

const SN = process.env.FOLOTOY_TOY_SN
const KEY = process.env.FOLOTOY_TOY_KEY
const HOST = process.env.FOLOTOY_MQTT_HOST
const PORT = Number(process.env.FOLOTOY_MQTT_PORT || 1883)

if (!SN || !HOST) {
  console.error('Missing FOLOTOY_TOY_SN or FOLOTOY_MQTT_HOST. Set them in .env or as env vars.')
  process.exit(1)
}

// Parse args
const args = process.argv.slice(2)
let mode = 'chat'
let message = '你好'

if (args[0] === 'chat') {
  mode = 'chat'
  message = args[1] || '你好'
} else if (args[0] === 'reminder') {
  mode = 'reminder'
  message = args[1] || '1分钟后提醒我站起来'
} else if (args[0]) {
  message = args[0]
}

const inboundTopic = `/openapi/folotoy/${SN}/thing/command/call`
const outboundTopic = `/openapi/folotoy/${SN}/thing/command/callAck`
const notificationTopic = `/openapi/folotoy/${SN}/thing/event/post`

// ── Validation state ──
const errors = []
let gotSoothing = false
let gotReply = false
let gotFinish = false
let gotNotification = false

function validateOutboundMessage(msg) {
  if (msg.identifier !== 'chat_output') {
    errors.push(`Expected identifier "chat_output", got "${msg.identifier}"`)
  }
  const p = msg.outParams
  if (typeof p?.recording_id !== 'number') {
    errors.push(`Missing or invalid recording_id in outbound message (order=${p?.order})`)
  }
  if (typeof p?.order !== 'number') {
    errors.push('Missing or invalid order in outbound message')
  }
  if (typeof p?.is_finished !== 'boolean') {
    errors.push(`Missing or invalid is_finished in outbound message (order=${p?.order})`)
  }
}

function validateNotificationMessage(msg) {
  if (msg.identifier !== 'send_notification') {
    errors.push(`Expected notification identifier "send_notification", got "${msg.identifier}"`)
  }
  if (typeof msg.outParams?.text !== 'string' || !msg.outParams.text) {
    errors.push('Notification missing outParams.text')
  }
  if ('recording_id' in (msg.outParams || {})) {
    errors.push('Notification should not contain recording_id')
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60))
  console.log(`TEST SUMMARY (mode: ${mode})`)
  console.log('='.repeat(60))

  const checks = [
    ['Soothing ack (order=1)', gotSoothing],
    ['AI reply (order=2+)', gotReply],
    ['Finish message (is_finished=true)', gotFinish],
  ]

  for (const [label, ok] of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}`)
  }

  if (mode === 'reminder') {
    console.log(`  ${gotNotification ? '✅' : 'ℹ️ '} Notification on event/post${gotNotification ? '' : ' (not received within timeout — may arrive later)'}`)
  }

  if (errors.length > 0) {
    console.log('\nErrors:')
    for (const e of errors) console.log(`  ❌ ${e}`)
  }

  const allPassed = checks.every(([, ok]) => ok) && errors.length === 0
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`)
  return allPassed
}

function done() {
  const passed = printSummary()
  client.end()
  process.exit(passed ? 0 : 1)
}

// ── MQTT ──
const MQTT_USERNAME = process.env.FOLOTOY_TEST_MQTT_USERNAME || SN
const MQTT_PASSWORD = process.env.FOLOTOY_TEST_MQTT_PASSWORD || KEY

const client = mqtt.connect(`mqtt://${HOST}:${PORT}`, {
  clientId: `test-toy-${Date.now()}`,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
})

client.on('connect', () => {
  console.log(`[connected] ${HOST}:${PORT} as ${SN}`)
  console.log(`[mode] ${mode}`)
  console.log(`[message] ${message}`)

  client.subscribe([outboundTopic, notificationTopic], (err) => {
    if (err) {
      console.error('[subscribe error]', err.message)
      process.exit(1)
    }

    const msg = {
      msgId: 1,
      identifier: 'chat_input',
      inputParams: { text: message, recording_id: 999 },
    }
    console.log(`\n[publish] ${inboundTopic}`)
    console.log(JSON.stringify(msg, null, 2))
    client.publish(inboundTopic, JSON.stringify(msg))
  })
})

client.on('message', (topic, payload) => {
  let msg
  try { msg = JSON.parse(payload.toString()) } catch { return }

  if (topic === outboundTopic) {
    const p = msg.outParams
    const label = p?.is_finished ? 'FINISH' : `REPLY(order=${p?.order})`
    console.log(`\n[OUTBOUND ${label}] ${p?.content || '(empty)'}`)
    validateOutboundMessage(msg)

    if (p?.order === 1 && !p?.is_finished) gotSoothing = true
    if (p?.order >= 2 && !p?.is_finished && p?.content) gotReply = true
    if (p?.is_finished) {
      gotFinish = true
      if (mode === 'chat') {
        setTimeout(done, 500)
      } else {
        console.log('\n[waiting up to 90s for notification on event/post topic...]')
      }
    }
  }

  if (topic === notificationTopic) {
    console.log(`\n[NOTIFICATION] ${msg.outParams?.text || JSON.stringify(msg)}`)
    validateNotificationMessage(msg)
    gotNotification = true
    setTimeout(done, 500)
  }
})

client.on('error', (err) => {
  console.error('[mqtt error]', err.message)
})

// Timeout: chat 30s, reminder 120s
const timeoutMs = mode === 'reminder' ? 120_000 : 30_000
setTimeout(done, timeoutMs)
