import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PRESET_WHITELIST = ['soothing_loop_enabled'] as const
export type PresetKey = (typeof PRESET_WHITELIST)[number]
export type Preset = Partial<Record<PresetKey, boolean>>

function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error('package.json not found while resolving preset directory')
    dir = parent
  }
}

function presetDir(): string {
  return join(findPackageRoot(), 'src', 'presets')
}

export function listPresets(dir: string = presetDir()): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort()
}

export function loadPreset(name: string, dir: string = presetDir()): Preset {
  const file = join(dir, `${name}.json`)
  if (!existsSync(file)) {
    const available = listPresets(dir)
    throw new Error(
      `Preset "${name}" not found. Available: ${available.length ? available.join(', ') : '(none)'}`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`Preset "${name}" is not valid JSON: ${(err as Error).message}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Preset "${name}" must be a JSON object`)
  }

  const allowed = PRESET_WHITELIST as readonly string[]
  const result: Preset = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!allowed.includes(key)) {
      throw new Error(`Preset "${name}" has unknown key "${key}". Allowed: ${PRESET_WHITELIST.join(', ')}`)
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Preset "${name}" key "${key}" must be a boolean (got ${typeof value})`)
    }
    result[key as PresetKey] = value
  }

  return result
}
