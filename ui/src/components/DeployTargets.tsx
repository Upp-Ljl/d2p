import { useEffect, useState } from 'react';
import { api } from '../api.js';

interface Target {
  id: string;
  name: string;
  confidence: number;
  evidence: string[];
  recommendedCommand: string;
  docsUrl: string;
}

export function DeployTargets() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void api
      .deployTargets()
      .then((r) => {
        if (!cancelled) {
          setTargets(r.targets);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return <div className="text-sm text-slate-500">扫描部署目标…</div>;
  if (targets.length === 0) {
    return (
      <div className="text-sm text-slate-500">
        没找到现成的部署配置。可以让下一轮 loop 帮你加（在 vision 里加上"部署到 Vercel/Fly/etc."）。
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500">检测到这些可能的部署目标。d2p 不会自动 push — 你拿着命令自己跑。</div>
      <ul className="space-y-2">
        {targets.map((t) => (
          <li key={t.id} className="border rounded p-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-slate-500 ml-2">
                  confidence {(t.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <a
                href={t.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-brand hover:underline"
              >
                docs ↗
              </a>
            </div>
            <ul className="mt-1 text-xs text-slate-600 list-disc pl-5">
              {t.evidence.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <code className="block mt-2 text-xs bg-white px-2 py-1 rounded border break-all font-mono">
              {t.recommendedCommand}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}
