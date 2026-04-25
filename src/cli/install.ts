import { execSync } from 'node:child_process'
import qrcode from 'qrcode-terminal'
import { DEFAULT_MQTT_HOST, DEFAULT_MQTT_PORT } from '../config.js'
import { loadPreset, listPresets, type Preset } from './preset.js'

const PAIR_API_BASE = process.env.PAIR_API_BASE ?? 'https://pair.folotoy.cn'
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 300_000 // 5 minutes

// ── Types ──────────────────────────────────────────────

type CreateSessionResponse = {
  session_id: string
  pair_url: string
  expires_at: string
}

type PollResponse =
  | { status: 'pending' }
  | { status: 'completed'; toy_sn: string; toy_key: string; mqtt_host?: string; mqtt_port?: number }
  | { status: 'expired' }

// ── Helpers ────────────────────────────────────────────

function checkOpenClaw(): void {
  try {
    execSync('openclaw --version', { stdio: 'pipe' })
  } catch {
    console.error('Error: openclaw is not installed or not in PATH.')
    console.error('Install it first: npm i -g openclaw')
    process.exit(1)
  }
}

function installPlugin(): void {
  try {
    const list = execSync('openclaw plugins list', { stdio: 'pipe' }).toString()
    if (list.includes('folotoy-openclaw-plugin')) {
      return // already installed
    }
  } catch {
    // ignore
  }
  console.log('Installing FoloToy plugin...')
  execSync('openclaw plugins install @folotoy/folotoy-openclaw-plugin', { stdio: 'inherit' })
}

async function createSession(): Promise<CreateSessionResponse> {
  const res = await fetch(`${PAIR_API_BASE}/api/pair`, { method: 'POST' })
  if (!res.ok) throw new Error(`Failed to create pairing session (HTTP ${res.status})`)
  return res.json() as Promise<CreateSessionResponse>
}

function displayQR(url: string): void {
  qrcode.generate(url, { small: true }, (qr: string) => {
    console.log(qr)
  })
  console.log(`Or open this URL on your phone: ${url}\n`)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function pollSession(sessionId: string): Promise<PollResponse & { status: 'completed' }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0

  while (Date.now() < deadline) {
    process.stdout.write(`\r${frames[i++ % frames.length]} Waiting for pairing...`)

    const res = await fetch(`${PAIR_API_BASE}/api/pair/${sessionId}`)
    if (!res.ok) throw new Error(`Poll failed (HTTP ${res.status})`)
    const data = (await res.json()) as PollResponse

    if (data.status === 'completed') {
      process.stdout.write('\r\x1b[32m✓\x1b[0m Paired successfully!        \n')
      return data as PollResponse & { status: 'completed' }
    }
    if (data.status === 'expired') {
      process.stdout.write('\r')
      throw new Error('Pairing session expired. Please try again.')
    }

    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error('Pairing timed out after 5 minutes.')
}

function restartGateway(): void {
  try {
    execSync('openclaw gateway restart', { stdio: 'inherit' })
  } catch {
    console.warn('⚠ Failed to restart gateway. You can restart manually: openclaw gateway restart')
  }
}

function writeConfig(
  result: { toy_sn: string; toy_key: string; mqtt_host?: string; mqtt_port?: number },
  preset: Preset = {},
): void {
  execSync(`openclaw config set channels.folotoy.flow direct`, { stdio: 'pipe' })
  execSync(`openclaw config set channels.folotoy.toy_sn ${result.toy_sn}`, { stdio: 'pipe' })
  execSync(`openclaw config set channels.folotoy.toy_key ${result.toy_key}`, { stdio: 'pipe' })

  const mqttHost = result.mqtt_host ?? DEFAULT_MQTT_HOST
  const mqttPort = result.mqtt_port ?? DEFAULT_MQTT_PORT
  execSync(`openclaw config set channels.folotoy.mqtt_host ${mqttHost}`, { stdio: 'pipe' })
  execSync(`openclaw config set channels.folotoy.mqtt_port ${mqttPort}`, { stdio: 'pipe' })

  for (const [key, value] of Object.entries(preset)) {
    execSync(`openclaw config set channels.folotoy.${key} ${value}`, { stdio: 'pipe' })
  }
}

function parsePresetArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--preset') {
      const value = argv[i + 1]
      if (!value || value.startsWith('--')) {
        throw new Error('--preset requires a name (e.g. --preset single-soothing)')
      }
      return value
    }
    if (arg && arg.startsWith('--preset=')) {
      return arg.slice('--preset='.length)
    }
  }
  return undefined
}

// ── Main ───────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const command = argv[0]

  if (command !== 'install') {
    const presets = listPresets()
    console.log('Usage: npx @folotoy/folotoy-openclaw-plugin install [--preset <name>]')
    if (presets.length) console.log(`Available presets: ${presets.join(', ')}`)
    process.exit(command ? 1 : 0)
  }

  // Resolve preset before any side effects (pairing, plugin install) so a bad
  // preset name fails fast without making the user scan a QR.
  const presetName = parsePresetArg(argv.slice(1))
  const preset: Preset = presetName ? loadPreset(presetName) : {}

  console.log('🧸 FoloToy OpenClaw Plugin Installer\n')
  if (presetName) {
    console.log(`Using preset: ${presetName} → ${JSON.stringify(preset)}\n`)
  }

  // Step 1: check prerequisites
  console.log('Checking openclaw...')
  checkOpenClaw()
  console.log('✓ openclaw found\n')

  // Step 2: install plugin if not present
  installPlugin()

  // Step 3: create pairing session
  console.log('Creating pairing session...\n')
  const session = await createSession()

  // Step 4: display QR code
  console.log('Scan this QR code with your phone,')
  console.log('then scan your toy\'s QR code on the phone:\n')
  displayQR(session.pair_url)

  // Step 5: poll for result
  const result = await pollSession(session.session_id)

  // Step 6: write config
  console.log('\nWriting configuration...')
  writeConfig(result, preset)

  // Step 7: restart gateway
  console.log('\nRestarting gateway...')
  restartGateway()

  // Step 8: done
  console.log('\n\x1b[32m✓ FoloToy plugin installed and configured!\x1b[0m')
  console.log(`  Toy SN:    ${result.toy_sn}`)
}

main().catch((err) => {
  console.error(`\n\x1b[31mError:\x1b[0m ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
