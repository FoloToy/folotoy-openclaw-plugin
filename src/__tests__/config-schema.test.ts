import { describe, expect, it } from 'vitest'
import { FolotoyConfigSchema } from '../config-schema.js'
import {
  DEFAULT_MQTT_HOST,
  DEFAULT_MQTT_PORT,
  DEFAULT_SOOTHING_LOOP_ENABLED,
  DEFAULT_SOOTHING_LOOP_INTERVAL_MS,
} from '../config.js'

describe('FolotoyConfigSchema', () => {
  it('accepts an empty object and applies defaults for all fields', () => {
    const result = FolotoyConfigSchema.parse({})
    expect(result.flow).toBe('direct')
    expect(result.mqtt_host).toBe(DEFAULT_MQTT_HOST)
    expect(result.mqtt_port).toBe(DEFAULT_MQTT_PORT)
    expect(result.soothing_loop_enabled).toBe(DEFAULT_SOOTHING_LOOP_ENABLED)
    expect(result.soothing_loop_interval_ms).toBe(DEFAULT_SOOTHING_LOOP_INTERVAL_MS)
  })

  it('rejects unknown flow values', () => {
    expect(() => FolotoyConfigSchema.parse({ flow: 'oauth' })).toThrow()
  })

  it('round-trips a fully-populated config', () => {
    const input = {
      flow: 'direct' as const,
      toy_sn: 'd0cf13edc9f8',
      toy_key: 'OSHnaD1qUX94',
      mqtt_host: '127.0.0.1',
      mqtt_port: 1883,
      soothing_loop_enabled: false,
      summary_enabled: true,
      summary_max_chars: 200,
    }
    const result = FolotoyConfigSchema.parse(input)
    expect(result.toy_sn).toBe('d0cf13edc9f8')
    expect(result.toy_key).toBe('OSHnaD1qUX94')
    expect(result.soothing_loop_enabled).toBe(false)
  })

  it('exposes a toJSONSchema method that buildChannelConfigSchema needs', () => {
    // OpenClaw's `buildChannelConfigSchema(schema)` calls
    // `schema.toJSONSchema(...)`. Verify zod gives us this method.
    expect(typeof (FolotoyConfigSchema as { toJSONSchema?: unknown }).toJSONSchema).toBe(
      'function',
    )
    const json = (FolotoyConfigSchema as { toJSONSchema: (opts: object) => unknown }).toJSONSchema(
      { target: 'draft-07', unrepresentable: 'any' },
    ) as { type: string; properties: Record<string, { type: string }> }
    expect(json.type).toBe('object')
    // Spot-check a few fields land in the JSON Schema
    expect(json.properties.flow).toBeDefined()
    expect(json.properties.soothing_loop_enabled.type).toBe('boolean')
    expect(json.properties.mqtt_port.type).toBe('integer')
  })
})
