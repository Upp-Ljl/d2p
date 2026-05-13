// Detect deploy-target candidates from the demo repo + emit suggested
// commands. Used by session-summary and the Done UI to satisfy ABCD #C
// (具体部署目标达成). We do NOT auto-push — the user runs the commands once
// they're ready, since deploy needs credentials we don't carry.

import path from 'node:path';
import { stat, readFile } from 'node:fs/promises';

export interface DeployTarget {
  id: string;
  name: string;
  confidence: number;
  evidence: string[];
  recommendedCommand: string;
  docsUrl: string;
}

interface Probe {
  id: string;
  name: string;
  files: string[];
  packageScripts?: string[]; // any of these in scripts indicates this target
  command: string;
  docsUrl: string;
}

const PROBES: Probe[] = [
  {
    id: 'vercel',
    name: 'Vercel',
    files: ['vercel.json', 'next.config.js', 'next.config.ts'],
    packageScripts: [],
    command: 'npx vercel --prod',
    docsUrl: 'https://vercel.com/docs/cli',
  },
  {
    id: 'fly',
    name: 'Fly.io',
    files: ['fly.toml'],
    command: 'fly deploy',
    docsUrl: 'https://fly.io/docs/flyctl/deploy/',
  },
  {
    id: 'netlify',
    name: 'Netlify',
    files: ['netlify.toml', '_redirects'],
    command: 'npx netlify deploy --prod',
    docsUrl: 'https://docs.netlify.com/cli/get-started/',
  },
  {
    id: 'docker',
    name: 'Docker image',
    files: ['Dockerfile'],
    command: 'docker build -t <image-name> . && docker run -p 3000:3000 <image-name>',
    docsUrl: 'https://docs.docker.com/get-started/',
  },
  {
    id: 'heroku',
    name: 'Heroku',
    files: ['Procfile', 'app.json'],
    command: 'git push heroku main',
    docsUrl: 'https://devcenter.heroku.com/categories/deploying-with-git',
  },
  {
    id: 'cloudflare-pages',
    name: 'Cloudflare Pages',
    files: ['wrangler.toml'],
    command: 'npx wrangler pages deploy',
    docsUrl: 'https://developers.cloudflare.com/pages/',
  },
  {
    id: 'npm',
    name: 'npm publish',
    files: [],
    packageScripts: ['prepublishOnly'],
    command: 'npm publish --access public',
    docsUrl: 'https://docs.npmjs.com/cli/v10/commands/npm-publish',
  },
  {
    id: 'static',
    name: 'Static build',
    files: [],
    packageScripts: ['build', 'export'],
    command: 'npm run build && upload dist/ to your CDN / static host',
    docsUrl: 'https://vitejs.dev/guide/static-deploy.html',
  },
];

async function fileExists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

async function readPkgScripts(demoPath: string): Promise<Set<string>> {
  try {
    const raw = await readFile(path.join(demoPath, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return new Set(Object.keys(parsed.scripts ?? {}));
  } catch {
    return new Set();
  }
}

export async function detectDeployTargets(demoPath: string): Promise<DeployTarget[]> {
  const scripts = await readPkgScripts(demoPath);
  const out: DeployTarget[] = [];
  for (const probe of PROBES) {
    const evidence: string[] = [];
    let confidence = 0;
    for (const f of probe.files) {
      if (await fileExists(path.join(demoPath, f))) {
        evidence.push(`${f} present`);
        confidence += 0.6;
      }
    }
    for (const s of probe.packageScripts ?? []) {
      if (scripts.has(s)) {
        evidence.push(`npm script "${s}" present`);
        confidence += 0.3;
      }
    }
    if (evidence.length === 0) continue;
    out.push({
      id: probe.id,
      name: probe.name,
      confidence: Math.min(1, confidence),
      evidence,
      recommendedCommand: probe.command,
      docsUrl: probe.docsUrl,
    });
  }
  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}
