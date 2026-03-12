# @folotoy/folotoy-openclaw-plugin

Empower your FoloToy with OpenClaw AI capabilities.

An [OpenClaw](https://openclaw.ai) channel plugin that bridges FoloToy smart toys with OpenClaw via MQTT.

```
FoloToy Toy  <──MQTT──>  FoloToy MQTT Broker  <──MQTT──>  Plugin  <──>  OpenClaw
```

## Installation

```bash
openclaw plugins install @folotoy/folotoy-openclaw-plugin
```

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
      "mqtt_host": "198.19.249.25"
    }
  }
}
```

## MQTT

Both inbound and outbound messages use the same topic:

```
/openapi/folotoy/{sn}/thing/data/post
```

The plugin connects with an `openapi:` prefix on the username to distinguish itself from the toy's own connection:

```
username: openapi:{toy_sn}
password: {toy_key}
```

## Message Format

**Toy → Plugin (inbound)**

```json
{
  "msgId": 1,
  "identifier": "chat_input",
  "outParams": {
    "text": "hello"
  }
}
```

**Plugin → Toy (outbound)**

```json
{
  "msgId": 1,
  "identifier": "chat_output",
  "outParams": {
    "content": "hello"
  }
}
```

`msgId` starts at 1 per session and auto-increments.

## Environments

| Environment | MQTT Host | Port |
|-------------|-----------|------|
| Development | `198.19.249.25` | 1883 |
| Testing | `f.qrc92.cn` | 1883 |
| Production | `f.folotoy.cn` | 1883 |

Switch environments via the `FOLOTOY_MQTT_HOST` environment variable or `mqtt_host` config field.

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT
