import { Film, FolderOpen, Plus, Trash2 } from 'lucide-react';
import type { LocalProjectSummary } from '../persistence/localProjectRepository';

interface ProjectHomeProps {
  projects: readonly LocalProjectSummary[];
  loading: boolean;
  error: string | null;
  onCreate: () => void;
  onOpen: (projectId: string) => void;
  onDelete: (project: LocalProjectSummary) => void;
}

const formatUpdatedAt = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export function ProjectHome({
  projects,
  loading,
  error,
  onCreate,
  onOpen,
  onDelete,
}: ProjectHomeProps) {
  return (
    <main className="project-home">
      <section className="project-home__panel" aria-labelledby="local-projects-heading">
        <div className="project-home__intro">
          <div>
            <span className="status-chip"><Film size={14} /> AIM Video · Local Project</span>
            <h1 id="local-projects-heading">Create a complete property video from photographs.</h1>
            <p>
              Arrange 15–30 photos in a guided storyboard, preview the complete 16:9 video,
              then export a real MP4 entirely on this computer.
            </p>
          </div>
          <button type="button" className="button button--primary button--large" onClick={onCreate}>
            <Plus size={18} /> Create local project
          </button>
        </div>
        <div className="project-home__list">
          <div className="project-home__list-header">
            <h2>Local projects</h2>
            <span className="status-chip">No cloud sync</span>
          </div>
          {error ? <div className="issue issue--error" role="alert">{error}</div> : null}
          {loading ? <div className="empty-projects">Checking this browser for saved projects…</div> : null}
          {!loading && projects.length === 0 ? (
            <div className="empty-projects">No local projects yet. Create one to begin.</div>
          ) : null}
          {!loading && projects.map((project) => (
            <article className="local-project-row" key={`${project.id}:${String(project.storageKey)}`}>
              <div>
                <div className="local-project-row__name">{project.name}</div>
                <div className="local-project-row__meta">
                  {[project.address, `${project.photoCount} photos`, `Updated ${formatUpdatedAt(project.updatedAt)}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {project.problem ? <div className="issue issue--warning">{project.problem}</div> : null}
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className="button"
                  disabled={project.status !== 'ready'}
                  onClick={() => onOpen(project.id)}
                >
                  <FolderOpen size={15} /> Open
                </button>
                <button
                  type="button"
                  className="button button--quiet button--danger"
                  aria-label={`Delete ${project.name}`}
                  onClick={() => onDelete(project)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
