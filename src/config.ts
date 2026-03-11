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

export const DEFAULT_MQTT_HOST = process.env.FOLOTOY_MQTT_HOST ?? '192.168.10.138'
export const DEFAULT_MQTT_PORT = 1883
