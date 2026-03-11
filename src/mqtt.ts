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

export function buildTopic(toy_sn: string): string {
  return `/openapi/folotoy/${toy_sn}/thing/data/post`
}

export async function createMqttClient(config: PluginConfig, credentials: MqttCredentials): Promise<MqttClient> {
  const { host, port } = config.mqtt
  const { username, password } = credentials

  return new Promise((resolve, reject) => {
    const client = mqtt.connect(`mqtt://${host}:${port}`, {
      username: `openapi:${username}`,
      password,
      clean: true,
    })

    client.once('connect', () => resolve(client))
    client.once('error', reject)
  })
}
