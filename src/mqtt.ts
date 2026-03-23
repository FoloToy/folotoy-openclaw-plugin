import mqtt, { MqttClient } from 'mqtt'
import { AuthFlow1Config, AuthFlow2Config, PluginConfig } from './config.js'

export type MqttCredentials = {
  username: string
  password: string
  toy_sn: string
}

async function fetchCredentials(auth: AuthFlow1Config): Promise<MqttCredentials> {
  const res = await fetch(`${auth.api_url}/v1/openapi/create_mqtt_token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ toy_sn: auth.toy_sn }),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch MQTT token: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { username: string; password: string }
  return {
    username: data.username,
    password: data.password,
    toy_sn: auth.toy_sn,
  }
}

function directCredentials(auth: AuthFlow2Config): MqttCredentials {
  return {
    username: auth.toy_sn,
    password: auth.toy_key,
    toy_sn: auth.toy_sn,
  }
}

export async function resolveCredentials(config: PluginConfig): Promise<MqttCredentials> {
  if (config.auth.flow === 'api') {
    return fetchCredentials(config.auth)
  }
  return directCredentials(config.auth)
}

export function buildInboundTopic(toy_sn: string): string {
  return `/openapi/folotoy/${toy_sn}/thing/command/call`
}

export function buildOutboundTopic(toy_sn: string): string {
  return `/openapi/folotoy/${toy_sn}/thing/command/callAck`
}

export function buildNotificationTopic(toy_sn: string): string {
  return `/openapi/folotoy/${toy_sn}/thing/event/post`
}

const INITIAL_RECONNECT_MS = 1000
const MAX_RECONNECT_MS = 60000

export async function createMqttClient(config: PluginConfig, credentials: MqttCredentials): Promise<MqttClient> {
  const { host, port } = config.mqtt
  const { username, password } = credentials

  return new Promise((resolve, reject) => {
    const clientId = `openapi:${credentials.toy_sn}`
    const client = mqtt.connect(`mqtt://${host}:${port}`, {
      clientId,
      username,
      password,
      clean: true,
      reconnectPeriod: INITIAL_RECONNECT_MS,
    })

    // Exponential backoff: increase reconnectPeriod on each failed attempt,
    // reset on successful connection.
    client.on('reconnect', () => {
      const current = client.options.reconnectPeriod ?? INITIAL_RECONNECT_MS
      client.options.reconnectPeriod = Math.min(current * 2, MAX_RECONNECT_MS)
    })

    client.on('connect', () => {
      client.options.reconnectPeriod = INITIAL_RECONNECT_MS
    })

    client.once('connect', () => resolve(client))
    client.once('error', reject)
  })
}
