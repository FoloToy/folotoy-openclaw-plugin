import { PluginConfig, DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT } from './config.js'
import { resolveCredentials, createMqttClient } from './mqtt.js'
import { FoloToyChannel } from './channel.js'

export default (api: any) => {
  api.registerChannel({
    id: 'folotoy',
    name: 'FoloToy',

    configSchema: {
      type: 'object',
      properties: {
        auth: {
          type: 'object',
          oneOf: [
            {
              title: 'Flow 1: HTTP API 登录',
              properties: {
                flow: { type: 'string', const: 'api' },
                api_url: { type: 'string', title: 'API URL' },
                api_key: { type: 'string', title: 'API Key' },
                toy_sn: { type: 'string', title: '玩具 SN' },
              },
              required: ['flow', 'api_url', 'api_key', 'toy_sn'],
            },
            {
              title: 'Flow 2: 直接配置 SN + Key',
              properties: {
                flow: { type: 'string', const: 'direct' },
                toy_sn: { type: 'string', title: '玩具 SN' },
                toy_key: { type: 'string', title: '玩具 Key' },
              },
              required: ['flow', 'toy_sn', 'toy_key'],
            },
          ],
          default: { flow: 'direct' },
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

    async connect(config: PluginConfig, sendToOpenClaw: (text: string) => void) {
      const mqttConfig = {
        ...config,
        mqtt: {
          host: config.mqtt?.host ?? DEFAULT_MQTT_HOST,
          port: config.mqtt?.port ?? DEFAULT_MQTT_PORT,
        },
      }

      const credentials = await resolveCredentials(mqttConfig)
      const client = await createMqttClient(mqttConfig, credentials)
      const channel = new FoloToyChannel(client, credentials, (_msgId, text) => sendToOpenClaw(text))
      channel.subscribe()
      return channel
    },
  })
}
