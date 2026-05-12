#!/usr/bin/env node
// Smoke-only fake claude CLI. Detects role by prompt signature words and
// emits canned JSON. Spawned with cwd = worktree path for implementer role,
// so it can shell out git inside the worktree.

import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const pIdx = args.indexOf('-p');
const prompt = pIdx >= 0 ? args[pIdx + 1] ?? '' : '';

const cwd = process.cwd();

function gitInWorktree(...gitArgs) {
  return spawnSync('git', gitArgs, { cwd, encoding: 'utf8' });
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.stdout.write('\nUSAGE: input=100 output=50\n');
  process.exit(0);
}

if (prompt.includes('You analyze a code repository and identify its product type')) {
  emit({
    type: 'cli-tool',
    confidence: 0.85,
    evidence: ['index.js entry', 'commander dep', 'minimal tree'],
    preset_candidates: ['cli-tool', 'library'],
    inferred_check_commands: { build: '', test: '', typecheck: '' },
  });
}

if (prompt.includes('You are eliciting a product vision')) {
  emit({
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
  });
}

if (prompt.includes('You summarize a repository for downstream agents')) {
  emit({
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
  });
}

if (prompt.includes('You diff a code repository against a vision')) {
  const histMatch = /<history-begin>([\s\S]*?)<history-end>/.exec(prompt);
  const histPart = histMatch ? histMatch[1] : '';
  if (/add-version-flag/.test(histPart) || /\[DONE\]/.test(histPart)) {
    emit({
      gaps: [],
      preset_status: [
        { item: 'cli-help', status: 'done', note: null },
        { item: 'cli-version', status: 'done', note: null },
      ],
    });
  }
  emit({
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
  });
}

if (prompt.includes('You are an implementer')) {
  // Create VERSION.txt + commit
  writeFileSync('VERSION.txt', '0.1.0\n');
  const add = gitInWorktree('add', 'VERSION.txt');
  if (add.status !== 0) {
    process.stderr.write(`fake-claude impl: git add failed: ${add.stderr}`);
    process.exit(1);
  }
  const commit = gitInWorktree(
    '-c',
    'user.email=d2p-fake@local',
    '-c',
    'user.name=d2p-fake',
    'commit',
    '-q',
    '-m',
    'feat(cli): add VERSION.txt placeholder for --version flag',
  );
  if (commit.status !== 0) {
    process.stderr.write(`fake-claude impl: git commit failed: ${commit.stderr}`);
    process.exit(1);
  }
  const sha = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
  emit({
    files_changed: ['VERSION.txt'],
    commands_run: ['git add VERSION.txt', 'git commit'],
    test_output_excerpt: '',
    commit_sha: sha,
    residual_risks: ['VERSION.txt not wired into commander program.version() yet'],
    confidence: 0.75,
  });
}

if (prompt.includes('You score how well a code change')) {
  emit({
    alignment: 0.9,
    addresses_gap: true,
    scope_creep: false,
    concerns: [],
  });
}

if (prompt.includes('You are an independent code reviewer')) {
  emit({
    verdict: 'APPROVE',
    confidence: 0.9,
    reason_code: 'OK',
    rationale: 'VERSION.txt added with correct content; commit format is conventional.',
    hints: [],
    split_into: null,
    difficulty: 1,
  });
}

if (prompt.includes('You are a security/QA adversary')) {
  emit({
    attempts: [
      { vector: 'race condition', scenario: 'concurrent writes', broke: false, evidence: 'irrelevant for static file' },
      { vector: 'path traversal', scenario: '../escape', broke: false, evidence: 'static asset only' },
      { vector: 'encoding', scenario: 'BOM marker', broke: false, evidence: 'ASCII content' },
    ],
    any_break: false,
  });
}

if (prompt.includes('You judge whether a product vision')) {
  // After 1 gap merged, declare done
  emit({
    vision_satisfied: true,
    rationale: 'Smoke fixture vision satisfied: --version flag placeholder added.',
    remaining_themes: [],
  });
}

process.stderr.write(`fake-claude: unrecognized role; prompt head: ${prompt.slice(0, 80)}\n`);
process.exit(2);
