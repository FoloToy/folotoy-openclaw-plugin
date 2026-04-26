import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listPresets, loadPreset, PRESET_WHITELIST } from '../cli/preset.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'preset-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writePreset(name: string, body: unknown): void {
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(body))
}

describe('loadPreset', () => {
  it('returns parsed preset for whitelisted boolean key', () => {
    writePreset('single-soothing', { soothing_loop_enabled: false })
    expect(loadPreset('single-soothing', dir)).toEqual({ soothing_loop_enabled: false })
  })

  it('throws when preset file does not exist, listing available presets', () => {
    writePreset('alpha', { soothing_loop_enabled: true })
    writePreset('beta', { soothing_loop_enabled: false })
    expect(() => loadPreset('missing', dir)).toThrow(/Preset "missing" not found.*alpha, beta/)
  })

  it('throws when preset has unknown key', () => {
    writePreset('bad', { soothing_loop_enabled: false, summary_enabled: true })
    expect(() => loadPreset('bad', dir)).toThrow(/unknown key "summary_enabled"/)
  })

  it('throws when whitelisted key has wrong type', () => {
    writePreset('bad', { soothing_loop_enabled: 'false' })
    expect(() => loadPreset('bad', dir)).toThrow(/must be a boolean \(got string\)/)
  })

  it('throws when JSON is not an object', () => {
    writeFileSync(join(dir, 'arr.json'), '[1, 2, 3]')
    expect(() => loadPreset('arr', dir)).toThrow(/must be a JSON object/)
  })

  it('throws when JSON is malformed', () => {
    writeFileSync(join(dir, 'bad.json'), '{ not json')
    expect(() => loadPreset('bad', dir)).toThrow(/not valid JSON/)
  })

  it('whitelist contains only soothing_loop_enabled (current scope)', () => {
    expect(PRESET_WHITELIST).toEqual(['soothing_loop_enabled'])
  })
})

describe('shipped presets', () => {
  it('single-soothing resolves from default package presets dir and disables the soothing loop', () => {
    expect(loadPreset('single-soothing')).toEqual({ soothing_loop_enabled: false })
  })

  it('lists single-soothing among the default presets', () => {
    expect(listPresets()).toContain('single-soothing')
  })
})

describe('listPresets', () => {
  it('returns sorted preset names without .json extension', () => {
    writePreset('zeta', {})
    writePreset('alpha', {})
    writePreset('beta', {})
    expect(listPresets(dir)).toEqual(['alpha', 'beta', 'zeta'])
  })

  it('returns empty array for nonexistent directory', () => {
    expect(listPresets(join(dir, 'does-not-exist'))).toEqual([])
  })

  it('ignores non-json files', () => {
    writePreset('valid', {})
    writeFileSync(join(dir, 'README.md'), 'hi')
    expect(listPresets(dir)).toEqual(['valid'])
  })
})
