<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/TypeScript-5.6+-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License">
</p>

<h1 align="center">⚡ OllaFlow</h1>

<p align="center">
  <strong>自托管 Ollama Cloud 反向代理网关</strong>
</p>

<p align="center">
  多账号轮询 · 流量代理 · 用量统计 · 管理面板 · 完全兼容 Ollama Cloud API
</p>

---

## 功能特性

- **🔄 多账号轮询** — 支持多个 Ollama Cloud 账号自动轮询分配，单账号失败自动切换，3 次失败自动禁用
- **🌐 HTTP 代理** — 每个账号可独立配置 HTTP 代理，支持代理认证（用户名:密码）
- **🔐 API Key 加密** — AES-256-GCM 加密存储所有 Ollama Cloud API Key
- **📊 用量统计** — 实时统计 Token 用量、请求数、模型分布，支持按小时/天聚合
- **📝 请求日志** — 完整记录每个代理请求，支持按状态码、方法筛选，可导出 CSV
- **👥 代理用户** — 创建多个代理用户，每个用户独立 API Key，支持速率限制
- **🖥️ 管理面板** — 深色/浅色主题，响应式设计，中文界面
- **🎯 完全兼容** — 透明代理所有 Ollama Cloud API 端点，包括流式、工具调用、思考模式、图片、Logprobs

## 兼容的 API 端点

### Ollama 原生 API

| 端点 | 方法 | 说明 | 流式 |
|---|---|---|---|
| `/api/chat` | POST | 聊天补全 | NDJSON |
| `/api/generate` | POST | 文本生成 | NDJSON |
| `/api/embed` | POST | 文本嵌入 | 否 |
| `/api/embeddings` | POST | 嵌入（已弃用） | 否 |
| `/api/tags` | GET | 模型列表 | 否 |
| `/api/show` | POST | 模型详情 | 否 |
| `/api/ps` | GET | 运行中模型 | 否 |
| `/api/copy` | POST | 复制模型 | 否 |
| `/api/delete` | DELETE | 删除模型 | 否 |
| `/api/pull` | POST | 拉取模型 | NDJSON |
| `/api/push` | POST | 推送模型 | NDJSON |
| `/api/create` | POST | 创建模型 | NDJSON |
| `/api/version` | GET | 版本信息 | 否 |
| `/api/blobs/:digest` | HEAD/POST | Blob 操作 | 否 |

### OpenAI 兼容 API

| 端点 | 方法 | 说明 | 流式 |
|---|---|---|---|
| `/v1/chat/completions` | POST | 聊天补全 | SSE |
| `/v1/completions` | POST | 文本补全 | SSE |
| `/v1/embeddings` | POST | 嵌入 | 否 |
| `/v1/models` | GET | 模型列表 | 否 |
| `/v1/models/:model` | GET | 模型详情 | 否 |
| `/v1/images/generations` | POST | 图片生成 | 否 |
| `/v1/responses` | POST | Responses API | SSE |

支持的高级参数：`think` / `reasoning_effort`、`tools`（工具调用）、`format`（结构化输出）、`logprobs`、`stream_options.include_usage`、`images`（多模态）等全部透传。

## 快速开始

### Docker 部署（推荐）

```bash
# 克隆仓库
git clone https://github.com/pei-lin-001/OllaFlow.git
cd OllaFlow

# 一键部署
bash install.sh
```

部署完成后访问：

- 管理面板：`http://localhost:3000/admin`
- 代理 API：`http://localhost:3000/api` / `http://localhost:3000/v1`

默认管理员账号：`admin` / `admin`（**请立即修改**）

### 手动部署

<details>
<summary>展开查看手动部署步骤</summary>

```bash
# 1. 克隆仓库
git clone https://github.com/pei-lin-001/OllaFlow.git
cd OllaFlow

# 2. 安装依赖
npm install
cd frontend && npm install && cd ..

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，至少修改 ENCRYPTION_KEY、JWT_SECRET、ADMIN_PASSWORD

# 4. 初始化数据库
npx prisma migrate deploy

# 5. 构建前端
cd frontend && npm run build && cd ..

# 6. 构建后端
npx tsc

# 7. 启动
npm start
```

</details>

## 配置说明

所有配置通过环境变量（`.env` 文件）管理：

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `PORT` | 否 | `3000` | 服务端口 |
| `NODE_ENV` | 否 | `development` | 运行环境 |
| `DATABASE_URL` | 否 | `file:./data/app.db` | SQLite 数据库路径 |
| `ENCRYPTION_KEY` | **是** | — | API Key 加密密钥（≥32 字符） |
| `JWT_SECRET` | **是** | — | 管理后台 JWT 密钥（≥16 字符） |
| `OLLAMA_CLOUD_HOST` | 否 | `https://ollama.com` | Ollama Cloud 上游地址 |
| `ADMIN_USERNAME` | 否 | `admin` | 管理员用户名 |
| `ADMIN_PASSWORD` | 否 | `admin` | 管理员密码 |
| `LOG_RETENTION_DAYS` | 否 | `30` | 日志保留天数 |
| `SAVE_REQUEST_BODIES` | 否 | `false` | 是否保存请求体 |
| `SAVE_RESPONSE_BODIES` | 否 | `false` | 是否保存响应体 |

## 使用方法

### 客户端配置

只需将 Ollama Cloud 的地址替换为 OllaFlow 的地址，并使用代理用户 API Key 即可：

```bash
# Ollama 原生 API
curl http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_PROXY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"hello"}]}'

# OpenAI 兼容 API
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_PROXY_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-oss:20b","messages":[{"role":"user","content":"hello"}]}'
```

### Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="YOUR_PROXY_KEY"
)

response = client.chat.completions.create(
    model="gpt-oss:20b",
    messages=[{"role": "user", "content": "hello"}]
)
```

### Ollama CLI

```bash
# 设置环境变量指向代理
OLLAMA_HOST=http://localhost:3000 OLLAMA_API_KEY=YOUR_PROXY_KEY ollama run gpt-oss:20b
```

## 管理面板

| 页面 | 功能 |
|---|---|
| 仪表盘 | 请求数、Token 用量、活跃账号、模型分布图表 |
| 账号管理 | 添加/编辑/删除 Ollama Cloud 账号，测试连通性，配置代理 |
| 代理用户 | 创建代理用户，管理 API Key，设置速率限制 |
| 用量统计 | Token 用量趋势、模型分布、按时间聚合、CSV 导出 |
| 请求日志 | 完整请求记录，按状态码/方法筛选，可展开详情 |
| 系统设置 | 安全配置、日志维护、危险操作 |

## 架构

```
┌──────────┐     ┌──────────────────────────────────┐     ┌──────────────┐
│  Client   │────▶│          OllaFlow Proxy          │────▶│ Ollama Cloud │
│ (SDK/CLI) │     │                                  │     │              │
└──────────┘     │  ┌──────┐  ┌──────┐  ┌─────────┐ │     └──────────────┘
                 │  │Auth  │  │Rate  │  │Account  │ │
                 │  │Check │  │Limit │  │Selector │ │
                 │  └──────┘  └──────┘  └─────────┘ │
                 │                                  │
                 │  ┌──────────────────────────────┐ │
                 │  │       Stream Interceptor      │ │
                 │  │  NDJSON │ SSE │ Non-Streaming  │ │
                 │  └──────────────────────────────┘ │
                 │                                  │
                 │  ┌──────┐  ┌──────┐  ┌─────────┐ │
                 │  │Usage │  │Req   │  │ SQLite  │ │
                 │  │Track │  │Log   │  │ (Prisma)│ │
                 │  └──────┘  └──────┘  └─────────┘ │
                 └──────────────────────────────────┘
```

## 技术栈

**后端：** Node.js 20+ · TypeScript · Express · Prisma (SQLite) · undici

**前端：** React 18 · Vite 5 · Tailwind CSS 3 · shadcn/ui · TanStack Query · Recharts

**部署：** Docker · Docker Compose · SQLite

## 许可证

[MIT License](LICENSE)