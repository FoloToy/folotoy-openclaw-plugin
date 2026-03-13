# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install          # 安装依赖
pnpm build            # TypeScript 编译
pnpm test             # 运行测试（vitest）
pnpm test -- --run <file>  # 运行单个测试文件

# 本地安装到 OpenClaw
openclaw plugins install -l .
```

## Project Overview

这是一个 **OpenClaw channel 插件**，通过 MQTT 将 FoloToy 玩具与 OpenClaw 连接起来。玩具和插件都连接到 FoloToy MQTT Broker，用户通过玩具与 OpenClaw 交互。

## Project Structure

```
folotoy-openclaw-plugin/
├── openclaw.plugin.json   # 插件 manifest（必须）
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           # 插件入口，注册 channel
    ├── channel.ts         # ChannelPlugin 实现
    ├── mqtt.ts            # MQTT 连接与认证逻辑
    └── config.ts          # 配置 schema 定义
```

## Architecture

```
FoloToy 玩具  <──MQTT──>  FoloToy MQTT Broker  <──MQTT──>  This Plugin  <──>  OpenClaw
```

插件作为双向桥接：
- **上行（Inbound）**: 订阅 topic → 接收玩具消息 → 转发给 OpenClaw
- **下行（Outbound）**: 接收 OpenClaw 响应 → 流式发布到 topic（OpenAI chunk 格式）

## Authentication

支持两种认证流程，**默认使用 Flow 2**：

### Flow 1: HTTP API 登录

**Step 1**: 用 API Key 换取 MQTT 凭证

```
POST {api_url}/v1/openapi/create_mqtt_token
Authorization: Bearer {api_key}
Content-Type: application/json

{"toy_sn": "xxx"}
```

响应：
```json
{"username": "xxx", "password": "xxxx"}
```

**Step 2**: 用返回的凭证连接 MQTT Broker，username 加 `openapi:` 前缀以与玩具本身的连接区分：

```
MQTT username: openapi:{username}
MQTT password: {password}
```

### Flow 2: 直接配置 SN + Key（默认）
1. 直接配置玩具 SN 和 key（无需调用 HTTP API）
2. 插件连接 MQTT Broker，username 加 `openapi:` 前缀：

```
MQTT username: openapi:{toy_sn}
MQTT password: {toy_key}
```

## MQTT Topics

上行和下行使用不同的 topic：

```
上行（Toy → Plugin）: /openapi/folotoy/{sn}/thing/command/call
下行（Plugin → Toy）: /openapi/folotoy/{sn}/thing/command/callAck
```

## Message Formats

### 玩具 → 插件（上行）

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

### 插件 → 玩具（下行）

多条回复，`order` 从 1 开始自增，最后发送 `is_finished: true` 的结束消息：

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

结束消息：

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

`msgId` 每个会话从 1 开始自增。`recording_id` 从上行消息透传。

## Tech Stack

- **Language**: TypeScript
- **Package manager**: pnpm
- **Test framework**: vitest
- **MQTT client**: mqtt.js（纯 JS，无 native 依赖，符合 OpenClaw 插件要求）
- **Runtime loader**: jiti（支持直接运行 `.ts`）

> 插件依赖必须是纯 JS/TS，不能有 postinstall 构建步骤（OpenClaw 用 `npm install --ignore-scripts` 安装插件）

## Configuration Reference

```yaml
# 认证 — 选择其中一种流程
auth:
  # Flow 1: HTTP API 登录
  api_url: ""          # FoloToy HTTP API base URL，e.g. https://api.folotoy.com
  api_key: ""          # Bearer token，用于换取 MQTT 凭证
  toy_sn: ""           # 玩具 SN，同时作为请求 body 和 topic 中的 {sn}

  # Flow 2: 直接配置 SN + Key
  # toy_sn: ""    # 拼接为 MQTT username: openapi:{toy_sn}
  # toy_key: ""   # 作为 MQTT password

# MQTT broker
mqtt:
  host: ""             # 见下方环境说明
  port: 1883
```

## Environments

| 环境 | MQTT host | port |
|------|-----------|------|
| 开发 | 198.19.249.25 | 1883 |
| 测试 | f.qrc92.cn | 1883 |
| 正式 | f.folotoy.cn | 1883 |

打包时通过环境变量或构建参数切换 `mqtt.host`，默认指向开发环境。

