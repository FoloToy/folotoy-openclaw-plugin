---
name: release
description: Release a new version of the FoloToy OpenClaw plugin. Bumps versions across package.json, installer/package.json, openclaw.plugin.json, and package-lock.json; commits; tags; pushes. The GitHub Release workflow (.github/workflows/release.yml) then publishes both npm packages and creates a GitHub Release. Trigger when the user says "release", "publish a new version", "bump and release", or "cut a release".
disable-model-invocation: true
user-invocable: true
argument-hint: <patch|minor|major|X.Y.Z>
---

# Release a new version

This project ships **two npm packages** that release in lockstep with matching versions:
- `@folotoy/folotoy-openclaw-plugin` (root `package.json`)
- `@folotoy/folotoy-openclaw-installer` (`installer/package.json`)

Plus the OpenClaw plugin manifest at `openclaw.plugin.json` carries the same version string.

The **`.github/workflows/release.yml`** workflow does all the actual publishing — it triggers on `v*.*.*` tag push. Your job here is purely the version-bump-and-tag dance.

## Argument

`$0` — one of:
- `patch` / `minor` / `major` — auto-compute next version from current
- explicit version like `0.9.0` (no `v` prefix)

If `$0` is empty, ask the user which kind of bump they want.

## Step 1: Verify clean state

Make sure the working tree is clean and you're on `main`:

```bash
git status --porcelain && git rev-parse --abbrev-ref HEAD
```

If dirty or not on main, stop and tell the user. Don't try to stash or switch automatically.

Also check that all three version files agree (they should — if they don't, something is wrong with prior state):

```bash
node -e "console.log([require('./package.json').version, require('./installer/package.json').version, require('./openclaw.plugin.json').version].join(' '))"
```

If the three values aren't identical, stop and report.

## Step 2: Compute the new version

Read current version from `package.json`. Then:

- `patch`: bump Z in X.Y.Z
- `minor`: bump Y, reset Z to 0
- `major`: bump X, reset Y and Z to 0
- explicit `A.B.C`: use as-is (validate it parses as semver, X.Y.Z digits only)

Sanity-check that the new version is greater than the current version. If equal or smaller, stop.

Tell the user the planned version (e.g. "Bumping 0.8.1 → 0.8.2"). Proceed.

## Step 3: Edit the four files

Use the Edit tool on each, replacing only the version line:

1. `package.json` — `"version": "X.Y.Z"`
2. `installer/package.json` — `"version": "X.Y.Z"`
3. `openclaw.plugin.json` — `"version": "X.Y.Z"`
4. `package-lock.json` — **two** occurrences at the top:
   - line ~3: top-level `"version"`
   - line ~9: under `"packages": { "": { ... "version" ... } }`

For `package-lock.json` use a single Edit with both lines as one block to avoid ambiguity:

```
old:
  "name": "@folotoy/folotoy-openclaw-plugin",
  "version": "<OLD>",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "@folotoy/folotoy-openclaw-plugin",
      "version": "<OLD>",
new:
  "name": "@folotoy/folotoy-openclaw-plugin",
  "version": "<NEW>",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "@folotoy/folotoy-openclaw-plugin",
      "version": "<NEW>",
```

**Do not run `npm install` to refresh the lockfile** — it pulls in unrelated platform-specific changes that pollute the diff. Only the two `version` strings need to change.

## Step 4: Commit, tag, push

```bash
git add package.json package-lock.json installer/package.json openclaw.plugin.json
git commit -m "chore: bump version to X.Y.Z

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git tag vX.Y.Z
git push origin main vX.Y.Z
```

Note: project convention is **Conventional Commits** (`chore:`, `feat:`, `fix:`). Always use `chore: bump version to X.Y.Z` for the bump commit.

## Step 5: Watch the workflow

The push triggers `.github/workflows/release.yml`. Watch it complete:

```bash
sleep 8 && gh run list --workflow=release.yml --limit 1
# then:
gh run watch <run-id> --exit-status
```

The workflow:
1. Verifies all three version files match the tag
2. Publishes installer to npm (skipped if already published — idempotent)
3. Waits for installer to propagate on the npm registry (up to 5 min)
4. Installs root deps, runs tests
5. Publishes root plugin to npm (skipped if already published — idempotent)
6. Creates a GitHub Release with auto-generated notes

If any step fails, diagnose:

- **`Verify package.json versions match tag` fails** — one of the four files wasn't updated. Fix and re-tag (see "Re-tagging" below).
- **`npm publish` fails with auth** — the `NPM_TOKEN` secret in repo settings is missing or expired. Tell the user to regenerate at https://www.npmjs.com/settings/lewangx/tokens (must be Granular Token with **Bypass 2FA** checked).
- **`Wait for installer to be available` times out** — npm CDN propagation issue, just re-run the failed job in the GitHub UI; the publish step is idempotent.
- **Tests fail** — fix the bug, push fix, re-tag.

## Step 6: Verify and report

Confirm both packages and the release exist:

```bash
curl -fsS https://registry.npmjs.org/@folotoy/folotoy-openclaw-plugin/X.Y.Z | head -c 100
curl -fsS https://registry.npmjs.org/@folotoy/folotoy-openclaw-installer/X.Y.Z | head -c 100
gh release view vX.Y.Z --json tagName,url
```

Report to the user with the GitHub Release URL.

## Re-tagging (recovery)

If you need to re-trigger the workflow on the same version (e.g. after fixing the workflow itself):

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git tag vX.Y.Z HEAD
git push origin vX.Y.Z
```

Because the publish steps are idempotent, this is safe even if the previous run already published one of the packages.

## Constraints

- **Never** publish manually with `npm publish` from your machine. The workflow is the only path that produces provenance-signed releases tied to the git tag. Manual publishes break that chain.
- **Never** skip or amend the version-bump commit. Each release version must have a corresponding `chore: bump version to X.Y.Z` commit on `main`.
- **Never** delete a tag that has already triggered a successful release. (Re-tagging is only for recovering from a failed workflow run.)
