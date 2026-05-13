// Shared canned-response logic for fake-claude (CLI mode) and the OpenAI-compat
// stub server (HTTP mode). Inspects prompt → emits canned JSON.
//
// Implementer is special: it must perform a real `git commit` so the
// orchestrator can merge a real fix branch. In CLI mode the cwd is already
// the worktree; in HTTP mode we extract the worktree path from the prompt.

import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const FAKE_USAGE = { input: 100, output: 50 };

function gitIn(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

export function detectRole(prompt) {
  if (prompt.includes('You analyze a code repository and identify its product type')) return 'detector';
  if (prompt.includes('You are eliciting a product vision')) return 'vision';
  if (prompt.includes('You summarize a repository for downstream agents')) return 'repo-summary';
  if (prompt.includes('You diff a code repository against a vision')) return 'differ';
  if (prompt.includes('You are an implementer')) return 'implementer';
  if (prompt.includes('You score how well a code change')) return 'alignment';
  if (prompt.includes('You are an independent code reviewer')) return 'behavioral';
  if (prompt.includes('You are a security/QA adversary')) return 'adversarial';
  if (prompt.includes('You judge whether a product vision')) return 'done-check';
  return 'unknown';
}

function extractWorktreePath(prompt) {
  const m = /Working directory:\s*([^\n]+)/.exec(prompt);
  return m ? m[1].trim() : null;
}

/**
 * Returns { json: object, usage: { input, output } } for the matched role.
 * `opts.worktreePath` overrides path extraction (set in CLI mode = process.cwd()).
 * Throws on unknown role so callers can decide how to surface.
 */
export function respond(prompt, opts = {}) {
  const role = detectRole(prompt);

  if (role === 'detector') {
    return {
      json: {
        type: 'cli-tool',
        confidence: 0.85,
        evidence: ['index.js entry', 'commander dep', 'minimal tree'],
        preset_candidates: ['cli-tool', 'library'],
        inferred_check_commands: { build: '', test: '', typecheck: '' },
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'vision') {
    return {
      json: {
        done: true,
        vision_md: [
          '## 产品定位',
          'd2p smoke 测试用的最小 CLI demo。',
          '',
          '## 目标用户',
          'd2p 自己的开发者。',
          '',
          '## 核心场景',
          '`hello` 命令打印问候 + `--version` flag 输出版本。',
          '',
          '## 商业模式',
          '不收钱。',
          '',
          '## KPI',
          'smoke 通过。',
          '',
          '## 明确不做',
          '真生产部署。',
          '',
        ].join('\n'),
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'repo-summary') {
    return {
      json: {
        entry_points: ['index.js'],
        frameworks: [],
        test_present: false,
        auth_present: false,
        db_present: 'none',
        deploy_config_present: false,
        ci_present: false,
        license_present: false,
        readme_quality: 'minimal',
        notable_deps: ['commander'],
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'differ') {
    const histMatch = /<history-begin>([\s\S]*?)<history-end>/.exec(prompt);
    const histPart = histMatch ? histMatch[1] : '';
    if (/add-version-flag/.test(histPart) || /\[DONE\]/.test(histPart)) {
      return {
        json: {
          gaps: [],
          preset_status: [
            { item: 'cli-help', status: 'done', note: null },
            { item: 'cli-version', status: 'done', note: null },
          ],
        },
        usage: FAKE_USAGE,
      };
    }
    return {
      json: {
        gaps: [
          {
            slug: 'add-version-flag',
            title: 'CLI 缺少 --version flag',
            body: '当前 CLI 没有 --version 输出，加一行 program.version() 即可，并新建 VERSION.txt 记录版本号。',
            category: 'docs',
            severity: 'P2',
            source: 'preset',
            suggested_approach: 'Write VERSION.txt = 0.1.0 in the worktree and commit.',
            expected_files_changed: ['VERSION.txt'],
          },
        ],
        preset_status: [
          { item: 'cli-help', status: 'done', note: null },
          { item: 'cli-version', status: 'missing', note: null },
        ],
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'implementer') {
    const wt = opts.worktreePath ?? extractWorktreePath(prompt);
    if (!wt) throw new Error('implementer needs worktreePath (CLI cwd or parsed from prompt)');
    writeFileSync(`${wt}/VERSION.txt`, '0.1.0\n');
    const add = gitIn(wt, 'add', 'VERSION.txt');
    if (add.status !== 0) throw new Error(`git add failed: ${add.stderr}`);
    const commit = gitIn(
      wt,
      '-c', 'user.email=d2p-fake@local',
      '-c', 'user.name=d2p-fake',
      'commit', '-q',
      '-m', 'feat(cli): add VERSION.txt placeholder for --version flag',
    );
    if (commit.status !== 0) throw new Error(`git commit failed: ${commit.stderr}`);
    const sha = execSync('git rev-parse HEAD', { cwd: wt, encoding: 'utf8' }).trim();
    return {
      json: {
        files_changed: ['VERSION.txt'],
        commands_run: ['git add VERSION.txt', 'git commit'],
        test_output_excerpt: '',
        commit_sha: sha,
        residual_risks: ['VERSION.txt not wired into commander program.version() yet'],
        confidence: 0.75,
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'alignment') {
    return {
      json: { alignment: 0.9, addresses_gap: true, scope_creep: false, concerns: [] },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'behavioral') {
    return {
      json: {
        verdict: 'APPROVE',
        confidence: 0.9,
        reason_code: 'OK',
        rationale: 'VERSION.txt added with correct content; commit format is conventional.',
        hints: [],
        split_into: null,
        difficulty: 1,
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'adversarial') {
    return {
      json: {
        attempts: [
          { vector: 'race condition', scenario: 'concurrent writes', broke: false, evidence: 'irrelevant for static file' },
          { vector: 'path traversal', scenario: '../escape', broke: false, evidence: 'static asset only' },
          { vector: 'encoding', scenario: 'BOM marker', broke: false, evidence: 'ASCII content' },
        ],
        any_break: false,
      },
      usage: FAKE_USAGE,
    };
  }

  if (role === 'done-check') {
    return {
      json: {
        vision_satisfied: true,
        rationale: 'Smoke fixture vision satisfied: --version flag placeholder added.',
        remaining_themes: [],
      },
      usage: FAKE_USAGE,
    };
  }

  throw new Error(`fake-llm-core: unrecognized role; prompt head: ${prompt.slice(0, 80)}`);
}
