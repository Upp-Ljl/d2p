import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { OpenAICompatEngine } from './openai-compat.js';

let server: http.Server | null = null;
let nextContent = '';

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    server = http.createServer((req, res) => {
      req.on('data', () => {});
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          choices: [{ message: { content: nextContent } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }));
      });
    });
    server.listen(0, '127.0.0.1', () => resolve());
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

function engine() {
  const a = server!.address() as AddressInfo;
  return new OpenAICompatEngine({
    kind: 'openai-compat',
    baseUrl: `http://127.0.0.1:${a.port}/v1`,
    apiKey: 'k',
    models: { haiku: 'h', sonnet: 's', opus: 'o' },
  });
}

describe('openai-compat tryParseJsonLoose — thinking / reasoning models', () => {
  it('strips <think>...</think> before parsing', async () => {
    nextContent =
      '<think>\nLet me consider the JSON object {"fake": true} the user mentioned…\n</think>\n\n{"ok": true}';
    const r = await engine().call({ role: 'differ', model: 'sonnet', prompt: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.json).toEqual({ ok: true });
  });

  it('strips <thinking>...</thinking>', async () => {
    nextContent = '<thinking>brainstorming</thinking>{"verdict":"APPROVE"}';
    const r = await engine().call({ role: 'behavioral', model: 'sonnet', prompt: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.json).toEqual({ verdict: 'APPROVE' });
  });

  it('extracts last balanced JSON when text contains earlier JSON-shaped strings', async () => {
    nextContent =
      'Note: the schema requires {"slug":"...","title":"..."} for each gap. Here is the result:\n{"gaps":[{"slug":"x","title":"y"}]}';
    const r = await engine().call({ role: 'differ', model: 'sonnet', prompt: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.json).toEqual({ gaps: [{ slug: 'x', title: 'y' }] });
  });

  it('handles JSON arrays at the top level', async () => {
    nextContent = '<think>let me list...</think>[1,2,3]';
    const r = await engine().call({ role: 'differ', model: 'sonnet', prompt: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.json).toEqual([1, 2, 3]);
  });

  it('handles fenced ```json blocks after thinking', async () => {
    nextContent = '<think>ok</think>\nHere it is:\n```json\n{"x":42}\n```\nDone.';
    const r = await engine().call({ role: 'alignment', model: 'haiku', prompt: 'x' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.json).toEqual({ x: 42 });
  });
});
