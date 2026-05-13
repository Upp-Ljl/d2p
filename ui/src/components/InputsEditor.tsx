import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Button } from './Button.js';
import { ErrorBanner } from './ErrorBanner.js';

/**
 * Lets the user attach non-code inputs (PRD / API spec / mockup notes) to the
 * current session. Stored at <demo>/.d2p/inputs/<name>; the vision elicitor
 * reads them in as background material.
 */
export function InputsEditor() {
  const [inputs, setInputs] = useState<{ name: string; size: number; modifiedAt: number }[]>([]);
  const [name, setName] = useState('prd.md');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await api.listInputs().catch(() => ({ inputs: [] }));
    setInputs(r.inputs);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSave() {
    setError(null);
    if (!name.trim()) {
      setError('需要文件名');
      return;
    }
    if (!body.trim()) {
      setError('内容是空的');
      return;
    }
    setBusy(true);
    try {
      await api.saveInput(name.trim(), body);
      setBody('');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">
        附加非代码材料（PRD / API spec / mockup 笔记…）。vision 提问时会读这些做背景。
      </div>
      {inputs.length > 0 && (
        <ul className="text-xs space-y-1">
          {inputs.map((i) => (
            <li key={i.name} className="flex items-center justify-between">
              <code className="text-slate-700">{i.name}</code>
              <span className="text-slate-400">{i.size} 字节</span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例如 prd.md"
          className="w-full text-sm font-mono px-2 py-1 border rounded"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="贴一段 PRD / API spec / mockup 描述…"
          rows={5}
          className="w-full text-sm font-mono px-2 py-1 border rounded"
        />
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <div className="flex justify-end">
          <Button onClick={() => void onSave()} disabled={busy} variant="secondary">
            {busy ? '保存中…' : '保存附件'}
          </Button>
        </div>
      </div>
    </div>
  );
}
