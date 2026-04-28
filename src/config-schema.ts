import { z } from 'zod'

import {
  DEFAULT_API_URL,
  DEFAULT_MQTT_HOST,
  DEFAULT_MQTT_PORT,
  DEFAULT_SENTENCE_SPLIT_DELIMITERS,
  DEFAULT_SENTENCE_SPLIT_ENABLED,
  DEFAULT_SOOTHING_LOOP_ENABLED,
  DEFAULT_SOOTHING_LOOP_INTERVAL_MS,
  DEFAULT_SUMMARY_ENABLED,
  DEFAULT_SUMMARY_MAX_CHARS,
} from './config.js'

/**
 * Top-level zod schema for `channels.folotoy.*` config.
 *
 * Used both as runtime input validation (via openclaw plugin SDK's
 * `buildChannelConfigSchema()`) and as the source of the JSON Schema that
 * OpenClaw's web UI renders. OpenClaw 2026.4.x's UI requires a zod-derived
 * schema for form rendering — a raw JSON Schema in the old shape causes
 * "Unsupported type" / "Use Raw mode" fallback.
 *
 * Field set matches the flat config currently consumed by index.ts:
 * `account.<field> ?? DEFAULT_*`.
 */
export const FolotoyConfigSchema = z.object({
  flow: z.enum(['direct', 'api']).default('direct').describe('Auth flow'),

  toy_sn: z.string().optional().describe('Toy serial number'),
  toy_key: z.string().optional().describe('Toy key (used as MQTT password in direct flow)'),

  api_url: z.string().default(DEFAULT_API_URL).describe('FoloToy API base URL (api flow)'),
  api_key: z.string().optional().describe('FoloToy API key (api flow)'),

  mqtt_host: z.string().default(DEFAULT_MQTT_HOST).describe('MQTT broker host'),
  mqtt_port: z.number().int().default(DEFAULT_MQTT_PORT).describe('MQTT broker port'),

  summary_enabled: z
    .boolean()
    .default(DEFAULT_SUMMARY_ENABLED)
    .describe('Enable reply summarization for over-long replies'),
  summary_max_chars: z
    .number()
    .int()
    .default(DEFAULT_SUMMARY_MAX_CHARS)
    .describe('Character threshold that triggers summarization'),

  sentence_split_enabled: z
    .boolean()
    .default(DEFAULT_SENTENCE_SPLIT_ENABLED)
    .describe('Stream replies sentence-by-sentence for faster TTS'),
  sentence_split_delimiters: z
    .string()
    .default(DEFAULT_SENTENCE_SPLIT_DELIMITERS)
    .describe('Punctuation characters that split sentences'),

  soothing_loop_enabled: z
    .boolean()
    .default(DEFAULT_SOOTHING_LOOP_ENABLED)
    .describe(
      'Repeat soothing replies while waiting for the LLM. Disable to send only the initial order=1 reply.',
    ),
  soothing_loop_interval_ms: z
    .number()
    .int()
    .default(DEFAULT_SOOTHING_LOOP_INTERVAL_MS)
    .describe('Interval (ms) between soothing replies during the LLM wait'),
})

export type FolotoyConfig = z.infer<typeof FolotoyConfigSchema>
