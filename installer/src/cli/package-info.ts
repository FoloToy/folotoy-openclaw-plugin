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

type PackageInfo = { name: string; version: string; runtimePackage: string }

let cached: PackageInfo | undefined

function readPackageInfo(): PackageInfo {
  if (cached) return cached
  const pkg = JSON.parse(
    readFileSync(join(findPackageRoot(), 'package.json'), 'utf8'),
  ) as { name?: unknown; version?: unknown; folotoy?: { runtimePackage?: unknown } }
  if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string') {
    throw new Error('package.json is missing name or version')
  }
  const runtimePackage = pkg.folotoy?.runtimePackage
  if (typeof runtimePackage !== 'string' || !runtimePackage) {
    throw new Error(
      'package.json is missing folotoy.runtimePackage — installer needs to know which runtime plugin npm package to install',
    )
  }
  cached = { name: pkg.name, version: pkg.version, runtimePackage }
  return cached
}

/** Returns the installer package's own name (e.g. `@folotoy/folotoy-openclaw-installer`). */
export function getPluginName(): string {
  return readPackageInfo().name
}

/** Returns the installer package's own version. */
export function getPluginVersion(): string {
  return readPackageInfo().version
}

/**
 * Returns the runtime plugin's npm package name (e.g.
 * `@folotoy/folotoy-openclaw-plugin`), read from this installer's
 * `package.json` `folotoy.runtimePackage` field. Centralising this in
 * package.json keeps scope renames (e.g. `@folotoy` ↔ `@firstsky` for
 * customer-specific RC builds) to a single edit.
 */
export function getRuntimePluginName(): string {
  return readPackageInfo().runtimePackage
}

/**
 * Returns `<runtime-name>@<this-installer-version>` — the spec to pass to
 * `openclaw plugins install`. The runtime and installer ship in lockstep
 * (same version number), so the installer's own version is used as the
 * pinned runtime version. Pinning the exact version prevents OpenClaw
 * from rejecting the install when `latest` happens to point at a
 * prerelease.
 */
export function getInstallSpec(): string {
  return `${getRuntimePluginName()}@${getPluginVersion()}`
}
