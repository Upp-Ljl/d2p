import { mockProjects, type ProjectSummary } from '../mock/agentGamePlatform.js';

function fmtRelative(ts: number): string {
  const diffMs = Date.now() - ts;
  const d = Math.floor(diffMs / 86_400_000);
  if (d === 0) return '今天';
  if (d === 1) return '昨天';
  return `${d} 天前`;
}

const TYPE_LABEL: Record<string, string> = {
  'saas-web':    'SaaS Web',
  'api-service': 'API Service',
  'cli-tool':    'CLI Tool',
  'library':     'Library',
  'static-site': 'Static Site',
  'mobile':      'Mobile App',
  'desktop-app': 'Desktop App',
  'ml-script':   'ML Script',
  'unknown':     '未知',
};

interface ProjectCardProps {
  project: ProjectSummary;
  pinned?: boolean;
}

function ProjectCard({ project, pinned }: ProjectCardProps) {
  const typeLabel = TYPE_LABEL[project.inferredType] ?? project.inferredType;
  return (
    <div
      className={`bg-cream rounded-xl shadow-card ring-1 px-5 py-4 lift-on-hover ${
        pinned ? 'ring-coral/30 border-coral/20' : 'ring-warmline/60'
      }`}
      data-testid={`project-card-${project.id}`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-medium text-ink truncate">{project.name}</span>
            {pinned && (
              <span className="text-[10px] bg-coral/10 text-coral px-1.5 py-0.5 rounded font-sans uppercase tracking-wider flex-shrink-0">
                活跃
              </span>
            )}
          </div>
          <div className="font-mono text-[10px] text-muted/60 truncate mt-0.5">{project.path}</div>
        </div>
        <span className="text-[10px] bg-warmline/50 text-muted px-2 py-0.5 rounded font-sans flex-shrink-0">
          {typeLabel}
        </span>
      </div>

      <p className="text-xs text-muted/80 leading-relaxed mb-3 line-clamp-2">{project.description}</p>

      <div className="text-[11px] text-muted/70 mb-3 line-clamp-1 font-mono">
        {project.lastCommitSha} · {project.lastCommitMsg}
      </div>

      <div className="flex items-center gap-3 text-[11px] font-sans flex-wrap">
        <span className="text-muted/60">{fmtRelative(project.lastCommitAt)}</span>
        <span className="text-muted/40">·</span>
        <span className="text-muted/60">{project.totalCommits} commits</span>
        {project.githubRepo && (
          <>
            <span className="text-muted/40">·</span>
            <span className="text-sage-600 font-mono">{project.githubRepo}</span>
          </>
        )}
        <span className="flex-1" />
        {project.activeSessions > 0 ? (
          <span className="text-forest flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-forest" />
            {project.activeSessions} 个 session
          </span>
        ) : (
          <span className="text-muted/40">无活跃 session</span>
        )}
        <span className="text-muted/60">${project.estimatedCostUsd.toFixed(2)} 预估</span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="text-xs px-3 py-1.5 bg-ink text-cream rounded-lg hover:bg-ink/80 transition-colors font-sans font-medium"
        >
          打开
        </button>
        <button
          type="button"
          className="text-xs px-3 py-1.5 text-muted hover:text-ink hover:bg-paper rounded-lg transition-colors font-sans"
        >
          设置
        </button>
      </div>
    </div>
  );
}

/** Projects home — lists all demos, agent-game-platform pinned first. */
export function ProjectsHome() {
  const projects: ProjectSummary[] = mockProjects;

  return (
    <div className="h-full overflow-y-auto p-6" data-testid="projects-home">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium text-ink">所有项目</h2>
          <button
            type="button"
            className="text-xs text-coral hover:text-coral/80 font-sans"
          >
            + 添加项目
          </button>
        </div>

        <div className="space-y-4">
          {projects.map((p, idx) => (
            <ProjectCard key={p.id} project={p} pinned={idx === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
