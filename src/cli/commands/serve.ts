/**
 * `verdict serve` command — OpenAI-compatible HTTP proxy with smart routing.
 */

import http from 'http'
import chalk from 'chalk'
import { getDb, initSchema } from '../../db/client.js'
import { selectModel } from '../../router/selector.js'
import { callModel, callModelMultiTurn } from '../../providers/compat.js'
import type { ModelConfig } from '../../types/index.js'
import type Database from 'better-sqlite3'

interface ServeCommandOpts {
  port?: string
}

/** Parse the "model" field from the request to determine routing. */
function parseAutoModel(model: string): { isAuto: boolean; taskType?: string } {
  if (model === 'auto') return { isAuto: true }
  if (model.startsWith('auto:')) return { isAuto: true, taskType: model.slice(5) }
  return { isAuto: false }
}

/** Build a minimal ModelConfig for a selected model. */
function buildModelConfig(modelId: string, provider: string): ModelConfig {
  const config: ModelConfig = {
    id: modelId,
    model: modelId,
    api_key: 'none',
    tags: [],
    port: 8080,
    timeout_ms: 120_000,
    max_tokens: 4096,
  }

  switch (provider) {
    case 'ollama': {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      config.base_url = host.endsWith('/v1') ? host : `${host}/v1`
      break
    }
    case 'mlx': {
      const port = process.env.MLX_PORT ?? '8080'
      config.base_url = `http://localhost:${port}/v1`
      break
    }
    case 'openrouter':
      config.base_url = 'https://openrouter.ai/api/v1'
      config.api_key = process.env.OPENROUTER_API_KEY ?? 'none'
      break
    case 'openai':
      config.base_url = 'https://api.openai.com/v1'
      config.api_key = process.env.OPENAI_API_KEY ?? 'none'
      break
    default: {
      const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434'
      config.base_url = host.endsWith('/v1') ? host : `${host}/v1`
      break
    }
  }

  return config
}

/** Read the full request body as a string. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

/** Send a JSON response. */
function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(json)
}

/** Handle POST /v1/chat/completions */
async function handleChatCompletions(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  db: Database.Database
): Promise<void> {
  const bodyStr = await readBody(req)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(bodyStr)
  } catch {
    sendJson(res, 400, { error: { message: 'Invalid JSON body', type: 'invalid_request_error' } })
    return
  }

  const requestedModel = (body.model as string) ?? 'auto'
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? []

  if (messages.length === 0) {
    sendJson(res, 400, { error: { message: 'messages array is required', type: 'invalid_request_error' } })
    return
  }

  const { isAuto, taskType } = parseAutoModel(requestedModel)

  let modelConfig: ModelConfig

  if (isAuto) {
    const selected = selectModel(db, {
      taskType,
      preferLocal: true,
    })

    if (!selected) {
      sendJson(res, 503, { error: { message: 'No models available. Run `verdict run` first.', type: 'server_error' } })
      return
    }

    modelConfig = buildModelConfig(selected.modelId, selected.provider)
  } else {
    // Look up model in registry to get provider info
    const row = db.prepare('SELECT provider FROM models_registry WHERE model_id = ?').get(requestedModel) as { provider: string } | undefined
    const provider = row?.provider ?? 'ollama'
    modelConfig = buildModelConfig(requestedModel, provider)
  }

  // Apply max_tokens from request if specified
  if (typeof body.max_tokens === 'number') {
    modelConfig.max_tokens = body.max_tokens
  }

  try {
    let response
    if (messages.length === 1 && messages[0].role === 'user') {
      response = await callModel(modelConfig, messages[0].content)
    } else {
      response = await callModelMultiTurn(modelConfig, messages)
    }

    if (response.error) {
      sendJson(res, 502, { error: { message: response.error, type: 'upstream_error' } })
      return
    }

    // Return OpenAI-compatible response
    const responseBody = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelConfig.id,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: response.text,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: response.input_tokens,
        completion_tokens: response.output_tokens,
        total_tokens: response.input_tokens + response.output_tokens,
      },
    }

    sendJson(res, 200, responseBody)
  } catch (err) {
    sendJson(res, 500, { error: { message: err instanceof Error ? err.message : String(err), type: 'server_error' } })
  }
}

/** Handle GET /v1/models */
function handleListModels(res: http.ServerResponse, db: Database.Database): void {
  const rows = db.prepare('SELECT model_id, provider, first_seen FROM models_registry ORDER BY model_id').all() as Array<{ model_id: string; provider: string; first_seen: string }>

  const models = rows.map(row => ({
    id: row.model_id,
    object: 'model',
    created: Math.floor(new Date(row.first_seen).getTime() / 1000),
    owned_by: row.provider ?? 'unknown',
  }))

  sendJson(res, 200, {
    object: 'list',
    data: models,
  })
}

export async function serveCommand(opts: ServeCommandOpts): Promise<void> {
  const port = parseInt(opts.port ?? '4000', 10)

  let db: Database.Database
  try {
    db = getDb()
    initSchema(db)
  } catch (err) {
    console.error(chalk.red(`  Failed to open database: ${err instanceof Error ? err.message : err}`))
    process.exit(1)
  }

  // Count models by provider
  const modelRows = db.prepare('SELECT model_id, provider FROM models_registry').all() as Array<{ model_id: string; provider: string | null }>
  const providerCounts: Record<string, number> = {}
  for (const row of modelRows) {
    const p = row.provider ?? 'unknown'
    providerCounts[p] = (providerCounts[p] ?? 0) + 1
  }

  const localCount = (providerCounts['ollama'] ?? 0) + (providerCounts['mlx'] ?? 0)
  const providerBreakdown = Object.entries(providerCounts)
    .filter(([p]) => p === 'ollama' || p === 'mlx')
    .map(([p, c]) => `${c} ${p}`)
    .join(', ')

  const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://localhost:${port}`)

    try {
      if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
        await handleChatCompletions(req, res, db)
      } else if (req.method === 'GET' && url.pathname === '/v1/models') {
        handleListModels(res, db)
      } else {
        sendJson(res, 404, { error: { message: 'Not found', type: 'invalid_request_error' } })
      }
    } catch (err) {
      sendJson(res, 500, { error: { message: 'Internal server error', type: 'server_error' } })
    }
  })

  server.listen(port, () => {
    console.log()
    console.log(chalk.bold(`  verdict serve`) + chalk.dim(` running on http://localhost:${port}`))
    if (localCount > 0) {
      console.log(chalk.dim(`  → ${localCount} local models available (${providerBreakdown})`))
    }
    console.log(chalk.dim(`  → ${modelRows.length} total models in registry`))
    console.log(chalk.dim(`  → routing: prefer local, fallback cloud`))
    console.log(chalk.dim(`  → /v1/chat/completions  (OpenAI-compatible)`))
    console.log(chalk.dim(`  → /v1/models`))
    console.log()
  })

  // Graceful shutdown
  process.on('SIGINT', () => {
    server.close()
    db.close()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    server.close()
    db.close()
    process.exit(0)
  })
}
