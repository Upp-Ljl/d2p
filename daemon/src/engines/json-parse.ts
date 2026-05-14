// Forgiving JSON extraction shared across engines. Models in the wild often
// wrap their JSON answer in markdown fences, reasoning blocks, or chatty
// preamble. Real Claude (sonnet/opus, even when system-told "JSON only") and
// thinking models (MiniMax-M2.x, DeepSeek-R1, Qwen-QwQ) all need this.

export function stripThinking(s: string): string {
  return s
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
}

/** Walk back from end of string to find the last balanced {…} or […]. Robust
 *  against reasoning text that mentions JSON-shaped examples earlier. */
export function extractLastBalancedJson(s: string): string | null {
  for (let end = s.length - 1; end >= 0; end--) {
    const ch = s[end];
    if (ch !== '}' && ch !== ']') continue;
    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = end; i >= 0; i--) {
      const c = s[i];
      if (inStr) {
        if (escaped) { escaped = false; continue; }
        if (c === '\\') { escaped = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === '}' || c === ']') depth++;
      else if (c === '{' || c === '[') {
        depth--;
        if (depth === 0) return s.slice(i, end + 1);
      }
    }
  }
  return null;
}

export function tryParseJsonLoose(s: string): unknown {
  const cleaned = stripThinking(s).trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }
  const balanced = extractLastBalancedJson(cleaned);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch {
      // fall through
    }
  }
  throw new Error('no parseable JSON in response');
}
