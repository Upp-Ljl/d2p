// Lightweight i18n — no react-i18next / no runtime deps. The dict lives here
// (one source of truth), the hook lives in useLocale.ts, and `t(key)` returns
// the string for the active locale, falling back to the key itself if a key
// is unknown so missing translations are visible (not silently empty).

export type Locale = 'zh' | 'en';

export const LOCALES: { id: Locale; label: string; native: string }[] = [
  { id: 'zh', label: 'Chinese', native: '中文' },
  { id: 'en', label: 'English', native: 'English' },
];

export const DEFAULT_LOCALE: Locale = 'zh';

// Dict is an object keyed by string id. Add keys here when you i18n-ize a
// new component. Missing en falls back to zh; missing both falls back to key.
type Dict = Record<string, { zh: string; en: string }>;

export const dict: Dict = {
  // ── App-wide ────────────────────────────────────────────────────────
  'app.title':            { zh: 'd2p',                                    en: 'd2p' },
  'app.tagline':          { zh: '把每个 demo 推到 product。',              en: 'Push every demo to product.' },
  'app.tagline.long':     { zh: '你给一个本地 demo + 一句愿景，d2p 派 Claude 自动迭代，4 层 reviewer 把关，preset 与 vision 双绿才停手。', en: 'Give d2p a local demo + one sentence of vision. It dispatches Claude to iterate, a 4-stage reviewer gates each fix, and stops only when the preset checklist and vision are both green.' },
  'app.daemonDown':       { zh: '连不上 daemon（{detail}）。先在终端跑 d2p start 或 npm run dev。', en: "Can't reach daemon ({detail}). Run `d2p start` or `npm run dev` in your terminal first." },
  'app.cliMissing':       { zh: '没找到 claude CLI。装 Claude Code 并 claude login，或在设置里换成 OpenAI-compat / Anthropic-API。', en: "claude CLI not found. Install Claude Code and run `claude login`, or pick OpenAI-compat / Anthropic-API in Settings." },

  // ── ProjectsHome ────────────────────────────────────────────────────
  'home.summary.projects':  { zh: '个项目',         en: 'projects' },
  'home.summary.running':   { zh: '在跑',           en: 'running' },
  'home.summary.cost':      { zh: '累计花费',       en: 'spent so far' },
  'home.filter.all':        { zh: '全部',           en: 'All' },
  'home.filter.active':     { zh: '活跃',           en: 'Active' },
  'home.filter.done':       { zh: '已完工',         en: 'Done' },
  'home.empty':             { zh: '这个分类下没有项目', en: 'No projects in this filter' },
  'home.tryDemo':           { zh: '试看 multi-turn 演示 →', en: 'Try multi-turn demo →' },
  'home.newProject':        { zh: '+ 新建项目',     en: '+ New project' },
  'home.addProjectHint':    { zh: '给个文件夹路径，d2p 接手', en: 'Point to a folder, d2p takes over' },
  'home.modal.title':       { zh: '新建项目',       en: 'New project' },
  'home.modal.desc':        { zh: '给个本地文件夹路径，d2p 自动 init git、识别项目类型、问你 vision，然后接手。', en: 'Give a local folder path. d2p will init git, infer project type, ask you for the vision, then take over.' },
  'home.modal.label':       { zh: 'Demo 文件夹（绝对路径）', en: 'Demo folder (absolute path)' },
  'home.modal.placeholder': { zh: 'D:\\demos\\my-saas',  en: '/Users/me/demos/my-saas' },
  'home.modal.start':       { zh: '开始 →',         en: 'Start →' },
  'home.modal.busy':        { zh: '新建 session 中…', en: 'Starting session…' },
  'home.modal.cancel':      { zh: '取消',           en: 'Cancel' },
  'home.modal.emptyPath':   { zh: '请填一个绝对路径', en: 'Please enter an absolute path' },

  // Card chips
  'card.status.looping':    { zh: '正在跑',         en: 'Running' },
  'card.status.paused':     { zh: '已暂停',         en: 'Paused' },
  'card.status.done':       { zh: '已完工',         en: 'Done' },
  'card.status.setup':      { zh: '配置中',         en: 'Setup' },
  'card.status.idle':       { zh: '空闲',           en: 'Idle' },
  'card.status.error':      { zh: '需介入',         en: 'Needs attention' },
  'card.verdict.yes':       { zh: 'vision ✓',       en: 'vision ✓' },
  'card.verdict.partial':   { zh: 'vision 部分',    en: 'vision partial' },
  'card.verdict.no':        { zh: 'vision ✗',       en: 'vision ✗' },
  'card.verdict.pending':   { zh: 'vision 未定',    en: 'vision pending' },
  'card.checklist':         { zh: '验收清单',       en: 'Checklist' },
  'card.agentRunning':      { zh: 'agent 在跑',     en: 'agent running' },
  'card.latest':            { zh: '最新：',         en: 'Latest:' },

  // ── Workspace ───────────────────────────────────────────────────────
  'workspace.backToProjects': { zh: '← 项目列表',     en: '← Projects' },
  'workspace.pause':          { zh: 'Pause ⏸',       en: 'Pause ⏸' },
  'workspace.pausing':        { zh: 'Pausing…',      en: 'Pausing…' },
  'workspace.resume':         { zh: 'Resume ▶',     en: 'Resume ▶' },
  'workspace.settings':       { zh: '⚙ 设置 / 切引擎', en: '⚙ Settings / engine' },
  'workspace.endSession':     { zh: '结束会话',       en: 'End session' },
  'workspace.demoBanner':     { zh: '演示模式 · multi-turn 是 mock 数据驱动 · 真任务跑起来形态一样 · 点「退出演示」回去', en: 'Demo mode · multi-turn driven by mock data · real runs look the same · click "Exit demo" to return' },
  'workspace.exitDemo':       { zh: '退出演示',       en: 'Exit demo' },
  'workspace.tryMultiTurn':   { zh: '试看 multi-turn 主视面 →', en: 'Try multi-turn fullscreen →' },
  'workspace.backToQueue':    { zh: '返回自治视图 →',   en: 'Back to autonomous view →' },

  // ── Settings ────────────────────────────────────────────────────────
  'settings.title':           { zh: '设置',           en: 'Settings' },
  'settings.close':           { zh: '关闭',           en: 'Close' },
  'settings.section.language':{ zh: '语言 / Language', en: 'Language / 语言' },
  'settings.section.engine':  { zh: 'LLM 引擎',       en: 'LLM engine' },
  'settings.section.github':  { zh: 'GitHub 集成',    en: 'GitHub integration' },
  'settings.languageHint':    { zh: '切换 UI 语言，立即生效，本地保存', en: 'Switch UI language — takes effect immediately, saved locally' },
  'settings.save':            { zh: '保存',           en: 'Save' },
  'settings.saved':           { zh: '已保存',         en: 'Saved' },
  'settings.engineKind':      { zh: '引擎类型',       en: 'Engine kind' },
  'settings.cliBin':          { zh: 'claude 可执行路径（留空走 PATH）', en: 'claude binary path (empty → PATH)' },
  'settings.apiKey':          { zh: 'API Key',        en: 'API Key' },
  'settings.baseUrl':         { zh: 'Base URL',       en: 'Base URL' },
  'settings.models':          { zh: '模型映射',       en: 'Model mapping' },
  'settings.extraHeaders':    { zh: '额外 HTTP Headers (JSON)', en: 'Extra HTTP headers (JSON)' },
  'settings.githubToken':     { zh: 'GitHub token (repo scope)', en: 'GitHub token (repo scope)' },
  'settings.githubBase':      { zh: '默认 base branch', en: 'Default base branch' },
};

/** Translate `key` into `locale`. Falls back to zh, then to the key itself
 *  so missing translations are visible during development. */
export function translate(key: string, locale: Locale, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  let s: string;
  if (!entry) {
    s = key;
  } else {
    s = entry[locale] || entry.zh || key;
  }
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
  }
  return s;
}
