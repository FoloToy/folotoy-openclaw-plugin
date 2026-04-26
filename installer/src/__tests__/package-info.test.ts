import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  findPackageRoot,
  getInstallSpec,
  getPluginName,
  getPluginVersion,
  getRuntimePluginName,
} from '../cli/package-info.js'

describe('package-info', () => {
  it('findPackageRoot resolves to a directory containing package.json', () => {
    const root = findPackageRoot()
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(typeof pkg.name).toBe('string')
    expect(typeof pkg.version).toBe('string')
  })

  it('getPluginName matches the installer package.json name', () => {
    const root = findPackageRoot()
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(getPluginName()).toBe(pkg.name)
  })

  it('getPluginVersion matches the installer package.json version', () => {
    const root = findPackageRoot()
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(getPluginVersion()).toBe(pkg.version)
  })

  it('getRuntimePluginName matches package.json folotoy.runtimePackage', () => {
    const root = findPackageRoot()
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(getRuntimePluginName()).toBe(pkg.folotoy.runtimePackage)
  })

  it('getInstallSpec is "<runtime-name>@<installer-version>" — pins the exact version so OpenClaw will install prereleases', () => {
    expect(getInstallSpec()).toBe(`${getRuntimePluginName()}@${getPluginVersion()}`)
    // Sanity: must contain an `@` separator after the scope's leading `@`.
    const spec = getInstallSpec()
    const lastAt = spec.lastIndexOf('@')
    expect(lastAt).toBeGreaterThan(0)
    expect(spec.slice(lastAt + 1)).toMatch(/^\d+\.\d+\.\d+/)
  })
})
