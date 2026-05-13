#!/usr/bin/env node
// HTTP stub that speaks the OpenAI Chat Completions wire format. Used by
// smoke-engines.mjs to test the `openai-compat` engine end-to-end without
// burning real LLM credits. The Anthropic Messages format is also accepted
// at /v1/messages so the same server can stand in for `anthropic-api`.
//
// Listens on the port given as the first CLI arg (or 0 for random). Prints
// the chosen port to stdout as `PORT=NNNN`.

import http from 'node:http';
import { respond } from './fake-llm-core.mjs';

const portArg = parseInt(process.argv[2] ?? '0', 10);

function jsonResponse(res, status, obj) {
  const body = JSON.stringify(obj);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const body = await readBody(req);
      const userMsg = (body.messages ?? []).find((m) => m.role === 'user');
      const prompt = userMsg?.content ?? '';
      const { json, usage } = respond(prompt);
      jsonResponse(res, 200, {
        id: 'chatcmpl-fake',
        choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(json) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: usage.input, completion_tokens: usage.output, total_tokens: usage.input + usage.output },
      });
      return;
    }
    if (req.method === 'POST' && req.url === '/v1/messages') {
      const body = await readBody(req);
      const userMsg = (body.messages ?? []).find((m) => m.role === 'user');
      const prompt = userMsg?.content ?? '';
      const { json, usage } = respond(prompt);
      jsonResponse(res, 200, {
        id: 'msg-fake',
        content: [{ type: 'text', text: JSON.stringify(json) }],
        usage: { input_tokens: usage.input, output_tokens: usage.output },
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/v1/models') {
      jsonResponse(res, 200, { data: [{ id: 'fake-haiku' }, { id: 'fake-sonnet' }, { id: 'fake-opus' }] });
      return;
    }
    res.statusCode = 404;
    res.end('not found');
  } catch (e) {
    process.stderr.write(`[fake-llm-server] ${e.message}\n`);
    jsonResponse(res, 500, { error: { message: e.message } });
  }
});

server.listen(portArg, '127.0.0.1', () => {
  const addr = server.address();
  // eslint-disable-next-line no-console
  console.log(`PORT=${addr.port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
