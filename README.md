# Lobster MCP Server v3.0

Custom Remote MCP Server for Perplexity Connector.
Windows / Linux / Docker / Railway compatible.

## Architecture (Windows Solo)

```
Perplexity (Comet/Computer/Council)
        |
        v
[Custom Remote Connector] --HTTPS/SSE--> [This MCP Server]
        |                                      |
        v                                      v
  Browser automation              shell_execute / file_read / http_request
  (Comet built-in)                (your Windows PC or cloud VM)
```

## Reality Check (2026-04 verified)

| Feature | Status | Platform |
|---------|--------|----------|
| Personal Computer | Mac mini only, waitlist | macOS |
| Local MCP | Mac App only | macOS |
| Custom Remote MCP | LIVE for Pro/Max/Enterprise | Any (HTTPS) |
| Comet browser agent | LIVE | Any |
| Model Council | LIVE | Any |

**For Windows users: Custom Remote MCP is YOUR path.**
Local MCP and Personal Computer are Mac-only.
This server gives you the same power via HTTPS.

## Quick Start

### Option 1: Windows local (no Docker)
```bash
git clone https://github.com/icanforyouthebest-bot/lobster-mcp-server.git
cd lobster-mcp-server
npm install
set BEARER_TOKEN=your-secret
node src/mcp-server.js
```

### Option 2: Docker
```bash
docker build -t lobster-mcp .
docker run -p 8080:8080 -e BEARER_TOKEN=your-secret lobster-mcp
```

### Option 3: Railway (one-click cloud)
1. Fork this repo
2. Go to railway.com > New Project > Deploy from GitHub
3. Set env: `BEARER_TOKEN=your-secret`
4. Railway gives you `https://xxx.up.railway.app`
5. Use that URL in Perplexity Connector

## Connect to Perplexity

1. Perplexity Settings > Connectors > Add Connector
2. Select **Remote**
3. Name: `Lobster MCP`
4. MCP Server URL: `https://your-domain.com/sse`
5. Auth: **API Key** > paste your BEARER_TOKEN
6. Save > toggle ON in Sources

## Available Tools

| Tool | Description |
|------|-------------|
| `shell_execute` | Run any shell command (cmd/bash) |
| `file_read` | Read files from server |
| `file_write` | Write files to server |
| `http_request` | Make HTTP calls (webhooks, APIs) |
| `system_info` | Get OS, memory, CPU info |
| `health_check` | Server health status |

## Endpoints

- `GET /sse` - MCP SSE stream (Perplexity connects here)
- `POST /message?clientId=xxx` - MCP JSON-RPC messages
- `GET /health` - Health check

## Security

- Bearer token auth on all MCP endpoints
- Set `BEARER_TOKEN` env var (required for production)
- `ALLOWED_ORIGINS` for CORS control

## v3.0 Council Prompt Template

```
You are Enterprise Max + Remote MCP committee.
Project: [codename]

Output JSON Action List.
Each step must specify:
- execution_layer: "comet" | "remote_mcp" | "manual"
- For remote_mcp: include mcp_tool + mcp_params
- Risk assessment + approval_required flag
```

## License
MIT
