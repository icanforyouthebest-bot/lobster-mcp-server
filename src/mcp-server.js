/**
 * Lobster v3.0 MCP Server
 * Custom Remote MCP for Perplexity Connector
 * Windows + Railway + Docker compatible
 * 
 * Protocol: MCP (Model Context Protocol) over SSE
 * Auth: Bearer token
 */

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 8080;
const BEARER_TOKEN = process.env.BEARER_TOKEN || 'lobster-secret-change-me';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',');

// --- Middleware ---
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (BEARER_TOKEN !== 'lobster-secret-change-me' && 
      (!auth || auth !== `Bearer ${BEARER_TOKEN}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- MCP Tool Registry ---
const tools = [
  {
    name: 'shell_execute',
    description: 'Execute a shell command on the server (Windows cmd or Linux bash)',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
        timeout: { type: 'number', description: 'Timeout in ms (default 30000)', default: 30000 }
      },
      required: ['command']
    }
  },
  {
    name: 'file_read',
    description: 'Read a file from the server filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'Absolute or relative file path' }
      },
      required: ['filepath']
    }
  },
  {
    name: 'file_write',
    description: 'Write content to a file on the server',
    inputSchema: {
      type: 'object',
      properties: {
        filepath: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' }
      },
      required: ['filepath', 'content']
    }
  },
  {
    name: 'http_request',
    description: 'Make an HTTP request to any URL (webhook, API call)',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL' },
        method: { type: 'string', enum: ['GET','POST','PUT','DELETE','PATCH'], default: 'GET' },
        headers: { type: 'object', description: 'HTTP headers' },
        body: { type: 'string', description: 'Request body (JSON string)' }
      },
      required: ['url']
    }
  },
  {
    name: 'system_info',
    description: 'Get server system info (OS, uptime, memory, hostname)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'health_check',
    description: 'Check if MCP server and connected services are healthy',
    inputSchema: { type: 'object', properties: {} }
  }
];

// --- Tool Handlers ---
async function handleTool(name, params) {
  switch (name) {
    case 'shell_execute': {
      const timeout = params.timeout || 30000;
      try {
        const { stdout, stderr } = await execAsync(params.command, { timeout });
        return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
      } catch (e) {
        return { success: false, error: e.message, stderr: e.stderr?.trim() };
      }
    }
    case 'file_read': {
      const content = await fs.readFile(params.filepath, 'utf-8');
      return { success: true, content, size: content.length };
    }
    case 'file_write': {
      await fs.mkdir(path.dirname(params.filepath), { recursive: true });
      await fs.writeFile(params.filepath, params.content, 'utf-8');
      return { success: true, filepath: params.filepath, written: params.content.length };
    }
    case 'http_request': {
      const resp = await fetch(params.url, {
        method: params.method || 'GET',
        headers: params.headers || {},
        body: params.body || undefined
      });
      const text = await resp.text();
      return { success: true, status: resp.status, body: text.substring(0, 5000) };
    }
    case 'system_info': {
      const os = await import('os');
      return {
        success: true,
        platform: os.default.platform(),
        hostname: os.default.hostname(),
        uptime: os.default.uptime(),
        totalMemory: Math.round(os.default.totalmem() / 1024 / 1024) + 'MB',
        freeMemory: Math.round(os.default.freemem() / 1024 / 1024) + 'MB',
        cpus: os.default.cpus().length
      };
    }
    case 'health_check': {
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        tools: tools.map(t => t.name)
      };
    }
    default:
      return { success: false, error: `Unknown tool: ${name}` };
  }
}

// --- MCP SSE Endpoint (Perplexity Remote Connector) ---
const sseClients = new Map();

app.get('/sse', authMiddleware, (req, res) => {
  const clientId = randomUUID();
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  // Send endpoint info
  res.write(`data: ${JSON.stringify({
    jsonrpc: '2.0',
    method: 'endpoint',
    params: { uri: `/message?clientId=${clientId}` }
  })}\n\n`);

  sseClients.set(clientId, res);
  req.on('close', () => sseClients.delete(clientId));
});

app.post('/message', authMiddleware, async (req, res) => {
  const clientId = req.query.clientId;
  const sseRes = sseClients.get(clientId);
  const { id, method, params } = req.body;

  let result;
  switch (method) {
    case 'initialize':
      result = {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'lobster-mcp-server', version: '3.0.0' }
      };
      break;
    case 'tools/list':
      result = { tools };
      break;
    case 'tools/call':
      try {
        const toolResult = await handleTool(params.name, params.arguments || {});
        result = {
          content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }]
        };
      } catch (e) {
        result = {
          content: [{ type: 'text', text: JSON.stringify({ error: e.message }) }],
          isError: true
        };
      }
      break;
    default:
      result = { error: { code: -32601, message: `Method not found: ${method}` } };
  }

  const response = { jsonrpc: '2.0', id, result };
  if (sseRes) sseRes.write(`data: ${JSON.stringify(response)}\n\n`);
  res.json({ ok: true });
});

// --- REST Health Endpoint ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', tools: tools.length, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Lobster MCP Server v3.0 running on port ${PORT}`);
  console.log(`SSE endpoint: /sse`);
  console.log(`Health: /health`);
});
