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
  summary_enabled?: boolean
  summary_max_chars?: number
  sentence_split_enabled?: boolean
  sentence_split_delimiters?: string
  soothing_loop_enabled?: boolean
  soothing_loop_interval_ms?: number
}

export const DEFAULT_API_URL = 'https://api.folotoy.cn'
export const DEFAULT_MQTT_HOST = process.env.FOLOTOY_MQTT_HOST ?? 'f.folotoy.cn'
export const DEFAULT_MQTT_PORT = 1883
export const DEFAULT_SUMMARY_ENABLED = true
export const DEFAULT_SUMMARY_MAX_CHARS = 200
export const DEFAULT_SENTENCE_SPLIT_ENABLED = true
export const DEFAULT_SENTENCE_SPLIT_DELIMITERS = '！。？；!.?;~'
export const DEFAULT_SOOTHING_LOOP_ENABLED = true
export const DEFAULT_SOOTHING_LOOP_INTERVAL_MS = 8000

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
