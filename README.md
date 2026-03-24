# @folotoy/folotoy-openclaw-plugin

Empower your FoloToy with OpenClaw AI capabilities.

An [OpenClaw](https://openclaw.ai) channel plugin that bridges FoloToy smart toys with OpenClaw via MQTT.

```
FoloToy Toy  <──MQTT──>  FoloToy MQTT Broker  <──MQTT──>  Plugin  <──>  OpenClaw
```

## Installation

Interactive install (scan QR code to pair your toy):

```bash
npx @folotoy/folotoy-openclaw-plugin install
```

Or install manually:

```bash
openclaw plugins install @folotoy/folotoy-openclaw-plugin
```

The interactive installer will pair your toy, write the config, and automatically restart the OpenClaw gateway.

For local development:

```bash
openclaw plugins install -l .
```

## Configuration

The plugin supports two authentication flows. All fields are configured as flat key-value pairs in `openclaw.json` under `channels.folotoy`.

### Flow 2: Direct SN + Key (Default)

| Field | Description |
|-------|-------------|
| `flow` | `"direct"` |
| `toy_sn` | Toy serial number |
| `toy_key` | Toy key (used as MQTT password) |
| `mqtt_host` | MQTT broker host (default: `198.19.249.25`) |
| `mqtt_port` | MQTT broker port (default: `1883`) |
| `summary_enabled` | Enable reply summarization (default: `true`) |
| `summary_max_chars` | Character threshold for summarization (default: `200`) |

### Flow 1: HTTP API Login

Exchange an API key for MQTT credentials via the FoloToy API:

| Field | Description |
|-------|-------------|
| `flow` | `"api"` |
| `toy_sn` | Toy serial number |
| `api_url` | FoloToy API base URL (default: `https://api.folotoy.cn`) |
| `api_key` | Bearer token |
| `mqtt_host` | MQTT broker host |
| `mqtt_port` | MQTT broker port (default: `1883`) |

Example `openclaw.json`:

```json
{
  "channels": {
    "folotoy": {
      "flow": "direct",
      "toy_sn": "your-toy-sn",
      "toy_key": "your-toy-key",
      "mqtt_host": "198.19.249.25",
      "summary_enabled": true,
      "summary_max_chars": 200
    }
  }
}
```

## MQTT

Inbound and outbound use separate topics:

```
Inbound      (Toy → Plugin):  /openapi/folotoy/{sn}/thing/command/call
Outbound     (Plugin → Toy):  /openapi/folotoy/{sn}/thing/command/callAck
Notification (Plugin → Toy):  /openapi/folotoy/{sn}/thing/event/post
```

The plugin connects with an `openapi:` prefix on the `clientId` to distinguish itself from the toy's own connection:

```
clientId: openapi:{toy_sn}
username: {toy_sn}
password: {toy_key}
```

Connection failures trigger exponential backoff reconnection (1s → 2s → 4s → ... → 60s max), resetting on successful connect.

## Message Format

**Toy → Plugin (inbound)**

```json
{
  "msgId": 1,
  "identifier": "chat_input",
  "inputParams": {
    "text": "hello",
    "recording_id": 100
  }
}
```

**Plugin → Toy (outbound)**

Reply is buffered, then summarized if it exceeds `summary_max_chars`. Sent as a single message with auto-incrementing `order`, followed by a finish message:

```json
{
  "msgId": 1,
  "identifier": "chat_output",
  "outParams": {
    "content": "hello",
    "recording_id": 100,
    "order": 1,
    "is_finished": false
  }
}
```

Finish message (`is_finished: true`, empty content):

```json
{
  "msgId": 1,
  "identifier": "chat_output",
  "outParams": {
    "content": "",
    "recording_id": 100,
    "order": 2,
    "is_finished": true
  }
}
```

`msgId` starts at 1 per session and auto-increments. `recording_id` is passed through from the inbound message.

## Environments

| Environment | MQTT Host | Port |
|-------------|-----------|------|
| Development | `198.19.249.25` | 1883 |
| Testing | `f.qrc92.cn` | 1883 |
| Production | `f.folotoy.cn` | 1883 |

Switch environments via the `FOLOTOY_MQTT_HOST` environment variable or `mqtt_host` config field.

## Features

### Reply Summarization

When AI reply exceeds `summary_max_chars` (default 200), the plugin uses the primary model to generate a concise summary before sending to the toy. This avoids excessively long voice playback. Falls back to truncation on failure. Disable with `summary_enabled: false`.

### Soothing Acknowledgment

Immediately sends a transitional reply (e.g., "Let me think...") upon receiving a message, providing instant feedback while the AI processes.

### Exponential Backoff Reconnection

MQTT connection failures trigger automatic reconnection with exponential backoff (1s → 60s cap), resetting on success.

### Auto-restart Gateway

After interactive installation (`npx @folotoy/folotoy-openclaw-plugin install`), the plugin automatically restarts the OpenClaw gateway so changes take effect immediately.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## License

MIT
