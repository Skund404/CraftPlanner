import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import type { PanelProps } from '@/modules/panel-registry'

interface Project {
  id: number
  name: string
  status: string
  completion_pct: number
}

export function ActiveProjectsPanel(_props: PanelProps) {
  const { data: projects = [] } = useQuery({
    queryKey: ['craftplanner', 'projects', { status: 'active' }],
    queryFn: () => apiGet<Project[]>('/modules/craftplanner/projects', { status: 'active' }),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-2">
      {projects.length === 0 ? (
        <p className="text-xs text-text-faint py-2">No active projects.</p>
      ) : (
        projects.slice(0, 5).map(p => (
          <Link
            key={p.id}
            to={`/projects/${p.id}` as never}
            className="flex items-center gap-3 p-2 rounded hover:bg-accent/5 transition-colors"
          >
            <span className="flex-1 text-xs text-text truncate">{p.name}</span>
            <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${p.completion_pct}%` }} />
            </div>
            <span className="text-[9px] text-text-faint w-6 text-right">{Math.round(p.completion_pct)}%</span>
          </Link>
        ))
      )}
    </div>
  )
}
