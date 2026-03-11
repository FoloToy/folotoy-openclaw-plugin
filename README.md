# @folotoy/folotoy-openclaw-plugin

FoloToy channel plugin for [OpenClaw](https://openclaw.ai). Bridges FoloToy smart toys with OpenClaw via MQTT, allowing users to interact with OpenClaw through their FoloToy devices.

```
FoloToy 玩具  <──MQTT──>  FoloToy MQTT Broker  <──MQTT──>  This Plugin  <──>  OpenClaw
```

## Installation

```bash
openclaw plugins install @folotoy/folotoy-openclaw-plugin
```

Or install locally for development:

```bash
openclaw plugins install -l .
```

## Configuration

The plugin supports two authentication flows.

### Flow 2: Direct SN + Key (Default)

Configure your toy SN and key directly:

| Field | Description |
|-------|-------------|
| `auth.flow` | `"direct"` |
| `auth.toy_sn` | Toy serial number |
| `auth.toy_key` | Toy key (used as MQTT password) |
| `mqtt.host` | MQTT broker host (default: `192.168.10.138`) |
| `mqtt.port` | MQTT broker port (default: `1883`) |

### Flow 1: HTTP API Login

Exchange an API key for MQTT credentials via the FoloToy API:

| Field | Description |
|-------|-------------|
| `auth.flow` | `"api"` |
| `auth.api_url` | FoloToy API base URL, e.g. `https://api.folotoy.com` |
| `auth.api_key` | Bearer token |
| `auth.toy_sn` | Toy serial number |
| `mqtt.host` | MQTT broker host |
| `mqtt.port` | MQTT broker port (default: `1883`) |

## MQTT

Both inbound and outbound messages use the same topic:

```
/openapi/folotoy/{sn}/thing/data/post
```

The plugin connects to the MQTT broker with an `openapi:` prefix on the username to distinguish itself from the toy's own connection:

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

Single response message with `msgId` matching the inbound request:

```json
{
  "msgId": 1,
  "identifier": "chat_output",
  "outParams": {
    "content": "hello"
  }
}
```

## Environments

| Environment | MQTT Host | Port |
|-------------|-----------|------|
| Development | `192.168.10.138` | 1883 |
| Testing | `f.qrc92.cn` | 1883 |
| Production | `f.folotoy.cn` | 1883 |

Switch environments via the `FOLOTOY_MQTT_HOST` environment variable.

## Development

```bash
npm install
npm run build
npm test
```
