export type AuthFlow1Config = {
  flow: 'api'
  api_url: string
  api_key: string
  toy_sn: string
}

export type AuthFlow2Config = {
  flow: 'direct'
  toy_sn: string
  toy_key: string
}

export type PluginConfig = {
  auth: AuthFlow1Config | AuthFlow2Config
  mqtt: {
    host: string
    port: number
  }
}

/** Flat config as stored in openclaw.json channels.folotoy */
export type FlatChannelConfig = {
  flow?: string
  toy_sn?: string
  toy_key?: string
  api_url?: string
  api_key?: string
  mqtt_host?: string
  mqtt_port?: number
}

export const DEFAULT_API_URL = 'https://api.folotoy.cn'
export const DEFAULT_MQTT_HOST = process.env.FOLOTOY_MQTT_HOST ?? '198.19.249.25'
export const DEFAULT_MQTT_PORT = 1883

export function flatToPluginConfig(flat: FlatChannelConfig): PluginConfig {
  const flow = flat.flow ?? 'direct'
  const auth = flow === 'api'
    ? { flow: 'api' as const, api_url: flat.api_url ?? DEFAULT_API_URL, api_key: flat.api_key ?? '', toy_sn: flat.toy_sn ?? '' }
    : { flow: 'direct' as const, toy_sn: flat.toy_sn ?? '', toy_key: flat.toy_key ?? '' }

  return {
    auth,
    mqtt: {
      host: flat.mqtt_host ?? DEFAULT_MQTT_HOST,
      port: flat.mqtt_port ?? DEFAULT_MQTT_PORT,
    },
  }
}
