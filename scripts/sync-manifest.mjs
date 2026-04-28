#!/usr/bin/env node
/**
 * Sync openclaw.plugin.json's channelConfigs.<channel>.schema from the
 * canonical zod schema in src/config-schema.ts.
 *
 * Why this exists: OpenClaw 2026.4.x's web UI reads channel config schema
 * exclusively from the plugin manifest's `channelConfigs.<id>.schema`
 * field. The runtime ChannelPlugin's `configSchema` is NOT used for UI
 * rendering — only for runtime validation. Without this static field, the
 * UI shows "Unsupported type: . Use Raw mode." for the whole panel.
 *
 * The zod schema is the source of truth (used at runtime for parsing). This
 * script generates the JSON Schema form for the static manifest file. Run
 * automatically as part of `npm run build`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(repoRoot, 'openclaw.plugin.json')

// Import the compiled JS form. Build order: tsc must run first to produce
// dist/config-schema.js; this script then reads from there. Wired into
// package.json scripts as: "build": "tsc && node scripts/sync-manifest.mjs".
const compiledSchemaPath = join(repoRoot, 'dist', 'config-schema.js')
const { FolotoyConfigSchema } = await import(compiledSchemaPath)

const channelSchema = FolotoyConfigSchema.toJSONSchema({
  target: 'draft-07',
  unrepresentable: 'any',
})

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.channelConfigs = {
  folotoy: {
    label: 'FoloToy',
    description: 'FoloToy smart toy channel — bridges toys to OpenClaw via MQTT.',
    schema: channelSchema,
  },
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(
  `[sync-manifest] wrote channelConfigs.folotoy.schema (${Object.keys(channelSchema.properties).length} properties) to openclaw.plugin.json`,
)
