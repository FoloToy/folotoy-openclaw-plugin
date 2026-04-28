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

# MQTT 集成测试（需要 .env 配置）
node --env-file=.env src/__tests__/test-message.mjs chat "你好"
node --env-file=.env src/__tests__/test-message.mjs reminder
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
    ├── index.ts           # 插件入口，注册 channel，消息处理与摘要逻辑
    ├── mqtt.ts            # MQTT 连接、认证与指数回退重连
    ├── config.ts          # 配置 schema 定义
    ├── soothing.ts        # 安抚回复（收到消息后立即发送的过渡语，支持不重复 picker）
    ├── strip-markdown.ts  # Markdown 格式清理（流式 chunk 安全）
    └── cli/
        └── install.ts     # 交互式安装脚本（扫码配对 → 写入配置 → 重启 gateway）
```

## Architecture

```
FoloToy 玩具  <──MQTT──>  FoloToy MQTT Broker  <──MQTT──>  This Plugin  <──>  OpenClaw
```

插件作为双向桥接：
- **上行（Inbound）**: 订阅 topic → 接收玩具消息 → 转发给 OpenClaw
- **下行（Outbound）**: 接收 OpenClaw 响应 → 按标点分句流式发送 → 超长时自动摘要 → 发布到 topic

### OpenClaw 集成

`src/index.ts` 默认导出一个 `ChannelPlugin<FlatChannelConfig>` 对象，由 OpenClaw 插件 SDK 加载：

- `id: 'folotoy'` — channel id，配置写在 `openclaw.json` 的 `channels.folotoy` 下
- `configSchema.schema` — JSON Schema，决定哪些字段会出现在 OpenClaw UI；`uiHints` 提供字段标签和 `sensitive: true` 标记
- `config.listAccountIds` / `resolveAccount` / `resolveAllowFrom` — 账户解析（当前固定单账户 `'default'`，allowFrom 为 toy_sn）
- `gateway.startAccount(ctx)` — 生命周期入口：建立 MQTT 连接、订阅上行 topic、对每条 `chat_input` 调用 `channelRuntime.reply.finalizeInboundContext` + `dispatchReplyFromConfig`，把 LLM chunk 流式发回玩具
- `outbound.sendText` — OpenClaw 主动通知入口：通过 `openclaw agent --deliver --reply-channel folotoy --reply-to <sn>` 触发，发布到 `event/post` topic

每个账户在 `activeClients` Map 中持有 `{ client, toy_sn, nextMsgId }`；`msgId` 单调递增、按账户隔离。

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

**Step 2**: 用返回的凭证连接 MQTT Broker，`clientId` 使用 `openapi:` 前缀以与玩具本身的连接区分：

```
MQTT clientId: openapi:{toy_sn}
MQTT username: {username}
MQTT password: {password}
```

### Flow 2: 直接配置 SN + Key（默认）
1. 直接配置玩具 SN 和 key（无需调用 HTTP API）
2. 插件连接 MQTT Broker，`clientId` 使用 `openapi:` 前缀：

```
MQTT clientId: openapi:{toy_sn}
MQTT username: {toy_sn}
MQTT password: {toy_key}
```

## MQTT Topics

上行和下行使用不同的 topic：

```
上行（Toy → Plugin）:  /openapi/folotoy/{sn}/thing/command/call
下行（Plugin → Toy）:  /openapi/folotoy/{sn}/thing/command/callAck
通知（Plugin → Toy）:  /openapi/folotoy/{sn}/thing/event/post
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

回复按标点符号（`！。？；!.?;~`）分句流式发送，每个句子作为独立的 `chat_output` 消息。`order` 从 1 开始自增（order=1 为安抚回复），最后发送 `is_finished: true` 的结束消息。

#### 分句策略

- **第 1 句**：遇到标点即切分，保证最快首句响应
- **第 2 句起**：要求最小长度 20 字，之后每句 +10 字（20 → 30 → 40 → ...），上限 100 字
- 无标点长文本兜底：buffer 超过 200 字仍无标点时强制切分，优先在空格或逗号处断开
- 在最后一个标点之后的剩余文本作为最后一条内容消息发送
- 可通过 `sentence_split_enabled` 关闭分句，回退为整段发送；`sentence_split_delimiters` 可自定义分句标点

#### 安抚回复

- 收到玩具消息后**立即**发送一条安抚语（order=1），这条**无条件发送**，不受 `soothing_loop_enabled` 控制
- `soothing_loop_enabled=true` 时，在等待 LLM 首个 chunk 期间每隔 `soothing_loop_interval_ms`（默认 8000ms）补发一条安抚语，LLM 一旦开始返回内容立即停止；**没有最大次数限制**
- `soothing_loop_enabled=false` 时只发那条 order=1 的安抚语，等待期不再补发
- 同一消息内安抚语不重复（shuffle 后顺序选取，用完才 reshuffle）
- 安抚语根据用户输入意图匹配（如难过、故事、笑话等），无匹配时使用默认候选

#### Markdown 清理

所有发送给玩具的文本（下行回复和通知）均经过 markdown 格式清理，去除标题、加粗、斜体、代码块、链接、列表标记、HTML 标签、URL 等，确保 TTS 只读纯文本。同时在 agent prompt 中提示 LLM 使用纯文本回复。

#### 摘要

当总回复长度超过 `summary_max_chars` 时，对最后一个标点之后的剩余文本调用摘要。已流式发送的句子不受影响。

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

### 插件 → 玩具（主动通知）

插件主动推送消息给玩具（如定时提醒），使用 `event/post` topic：

```json
{
  "msgId": 1,
  "identifier": "send_notification",
  "outParams": {
    "text": "该喝水啦"
  }
}
```

## Tech Stack

- **Language**: TypeScript
- **Package manager**: pnpm
- **Test framework**: vitest
- **MQTT client**: mqtt.js（纯 JS，无 native 依赖，符合 OpenClaw 插件要求）
- **Runtime loader**: jiti（支持直接运行 `.ts`）

> 插件依赖必须是纯 JS/TS，不能有 postinstall 构建步骤（OpenClaw 用 `npm install --ignore-scripts` 安装插件）

## CLI Install

交互式安装脚本，通过 `npx @folotoy/folotoy-openclaw-plugin install` 运行：

1. 生成配对二维码，用户用 FoloToy App 扫码
2. 轮询配对 API 等待确认
3. 获取玩具 SN 和 Key，写入 OpenClaw 配置
4. 自动执行 `openclaw gateway restart` 重启网关服务
5. 重启失败时打印警告，不中断安装流程

配对 API 默认地址：`https://pair.folotoy.com`，可通过 `PAIR_API_BASE` 环境变量覆盖（用于本地测试）。

### `--preset <name>`

`npx ... install --preset <name>` 选择一份随包发布的命名预设，把额外的字段写进 `channels.folotoy.*`。预设 JSON 放在 `src/presets/`，运行时通过 `findPackageRoot()` 从 `package.json` 反查根目录加载（兼容 src/dist 两种运行模式）。

- 当前白名单只有 `soothing_loop_enabled`（boolean）；未知 key 或类型错都 fail-fast，扫码前就退出
- 已发布预设：`single-soothing`（关闭安抚语循环补发，只发 order=1 那条初始安抚语）
- `parsePresetArg` 同时支持 `--preset name` 和 `--preset=name`
- 不传 `--preset` 时行为与历史完全一致——不写任何 soothing 字段，沿用 `DEFAULT_*`

## Reply Summary

当 AI 回复总长度超过配置的字符上限时，插件会对最后一段剩余文本（最后一个标点之后的部分）调用 primary 模型生成摘要，已流式发送的句子不受影响。

- 摘要 prompt 与 OpenClaw 内置 TTS `summarizeText` 保持一致
- 摘要失败时回退为截断（`text.slice(0, maxChars - 3) + "..."`）
- 可通过配置关闭摘要功能

## MQTT Reconnection

连接 MQTT Broker 失败时使用指数回退策略重连：

- 初始间隔：1 秒
- 每次失败翻倍，上限 60 秒
- 连接成功后重置为初始间隔

## Configuration Reference

```yaml
# 认证 — 选择其中一种流程
auth:
  # Flow 1: HTTP API 登录
  api_url: ""          # FoloToy HTTP API base URL，e.g. https://api.folotoy.com
  api_key: ""          # Bearer token，用于换取 MQTT 凭证
  toy_sn: ""           # 玩具 SN，同时作为请求 body 和 topic 中的 {sn}

  # Flow 2: 直接配置 SN + Key
  # toy_sn: ""    # 作为 MQTT username
  # toy_key: ""   # 作为 MQTT password

# MQTT broker
mqtt:
  host: ""             # 见下方环境说明
  port: 1883

# 回复摘要
summary:
  summary_enabled: true   # 是否开启摘要（默认 true）
  summary_max_chars: 200  # 触发摘要的字符上限（默认 200）

# 分句流式发送
sentence:
  sentence_split_enabled: true         # 是否启用标点分句（默认 true）
  sentence_split_delimiters: "！。？；!.?;~"  # 分句标点符号集合

# 循环安抚语（仅控制等待 LLM 期间的补发；初始那条 order=1 安抚语始终发送）
soothing:
  soothing_loop_enabled: true          # 是否启用循环安抚语（默认 true）
  soothing_loop_interval_ms: 8000      # 等待期补发间隔，毫秒（默认 8000）
```

## Environments

| 环境 | MQTT host | port |
|------|-----------|------|
| 开发 | 198.19.249.25 | 1883 |
| 测试 | f.qrc92.cn | 1883 |
| 正式 | f.folotoy.cn | 1883 |

打包时通过环境变量或构建参数切换 `mqtt.host`，默认指向开发环境。

## 测试通知

通过 OpenClaw CLI 向玩具发送主动通知：

```bash
openclaw agent --agent main \
  --message "你的通知内容" \
  --deliver \
  --reply-channel folotoy \
  --reply-account default \
  --reply-to <toy_sn>
```

这会触发插件的 `outbound.sendText`，将 `send_notification` 消息发布到 `event/post` MQTT topic。

