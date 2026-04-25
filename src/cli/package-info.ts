import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (true) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error('package.json not found while resolving package root')
    dir = parent
  }
}

type PackageInfo = { name: string; version: string }

let cached: PackageInfo | undefined

function readPackageInfo(): PackageInfo {
  if (cached) return cached
  const pkg = JSON.parse(
    readFileSync(join(findPackageRoot(), 'package.json'), 'utf8'),
  ) as { name?: unknown; version?: unknown }
  if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') {
    throw new Error('package.json is missing name or version')
  }
  cached = { name: pkg.name, version: pkg.version }
  return cached
}

export function getPluginName(): string {
  return readPackageInfo().name
}

export function getPluginVersion(): string {
  return readPackageInfo().version
}

/**
 * Returns the npm spec string `<name>@<version>` to pass to
 * `openclaw plugins install`. Pinning the exact version prevents OpenClaw
 * from rejecting the install when `latest` happens to point at a prerelease
 * — without this, `openclaw plugins install <bare-name>` resolves through
 * the `latest` dist-tag and refuses prereleases for safety.
 */
export function getInstallSpec(): string {
  return `${getPluginName()}@${getPluginVersion()}`
}
