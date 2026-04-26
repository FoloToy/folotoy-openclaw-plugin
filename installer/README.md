# @folotoy/folotoy-openclaw-installer

Interactive installer for [`@folotoy/folotoy-openclaw-plugin`](https://www.npmjs.com/package/@folotoy/folotoy-openclaw-plugin) — generates a pairing QR code, writes the OpenClaw config, restarts the gateway.

```bash
npx -y @folotoy/folotoy-openclaw-installer install [--preset <name>]
```

## Why a separate package

OpenClaw's plugin security scanner (2026.4.x+) rejects packages that contain `child_process` execution or `process.env` access combined with `fetch()` — patterns that any interactive installer legitimately needs. Splitting the installer out keeps the runtime plugin package (`@folotoy/folotoy-openclaw-plugin`) clean and scanner-passing, while the installer is only ever fetched via `npx` (never via `openclaw plugins install`).

The installer's `installPlugin()` step internally runs `openclaw plugins install @folotoy/folotoy-openclaw-plugin@<version>` to register the runtime plugin.

## Presets

Use `--preset <name>` to bake customer-specific defaults into `channels.folotoy.*` after pairing. Currently shipped:

| Preset | Effect |
|--------|--------|
| `single-soothing` | Sets `soothing_loop_enabled = false` so only the initial `order=1` soothing reply is sent; no further soothing replies are emitted while waiting for the LLM. |

Preset JSON files live in `src/presets/`. Whitelist is restricted to `soothing_loop_enabled` (boolean only) — unknown keys cause a fail-fast exit before the QR pairing step.

## Pairing API

The installer talks to `pair.folotoy.cn` to create a pairing session and poll for completion. Override the base URL with `PAIR_API_BASE` for local testing:

```bash
PAIR_API_BASE=http://localhost:18888 node bin/folotoy.mjs install
```

## Development

```bash
npm install              # at the repo root
npm test                 # runs both runtime + installer tests
cd installer && npx tsc  # builds installer/dist/
```

The installer's runtime version is read from its own `package.json` `version` field; the runtime plugin npm name is read from `package.json` `folotoy.runtimePackage`. Both packages release in lockstep with matching versions.

## License

MIT
