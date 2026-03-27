import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import { FolderKanban, Calendar, DollarSign, Clock } from 'lucide-react'

interface DashboardData {
  total_projects: number
  by_status: Record<string, number>
  total_budget: number
  total_spent: number
}

function StatCard({ label, value, icon: Icon, accent = false }: {
  label: string
  value: string | number
  icon: typeof FolderKanban
  accent?: boolean
}) {
  return (
    <div className="bg-surface rounded-lg p-4 border border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md ${accent ? 'bg-accent/10 text-accent' : 'bg-secondary/10 text-secondary'}`}>
          <Icon size={18} />
        </div>
        <div>
          <div className="text-2xl font-semibold text-text">{value}</div>
          <div className="text-xs text-text-muted">{label}</div>
        </div>
      </div>
    </div>
  )
}

function StatusBar({ byStatus }: { byStatus: Record<string, number> }) {
  const statuses = [
    { key: 'planning', label: 'Planning', color: 'bg-text-muted' },
    { key: 'active', label: 'Active', color: 'bg-accent' },
    { key: 'paused', label: 'Paused', color: 'bg-warning' },
    { key: 'completed', label: 'Completed', color: 'bg-success' },
    { key: 'archived', label: 'Archived', color: 'bg-text-faint' },
  ]
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="bg-surface rounded-lg p-4 border border-border">
      <div className="text-xs font-medium text-text-muted mb-3">Project Status</div>
      <div className="flex gap-1 h-2 rounded-full overflow-hidden mb-3">
        {statuses.map(s => {
          const count = byStatus[s.key] || 0
          if (count === 0) return null
          return (
            <div
              key={s.key}
              className={`${s.color} transition-all`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {statuses.map(s => {
          const count = byStatus[s.key] || 0
          if (count === 0) return null
          return (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-text-muted">
              <div className={`w-2 h-2 rounded-full ${s.color}`} />
              <span>{s.label}</span>
              <span className="text-text-faint">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function DashboardView() {
  const { data, isLoading } = useQuery({
    queryKey: ['craftplanner', 'dashboard'],
    queryFn: () => apiGet<DashboardData>('/modules/craftplanner/projects/dashboard'),
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-surface rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  const dashboard = data ?? { total_projects: 0, by_status: {}, total_budget: 0, total_spent: 0 }
  const active = dashboard.by_status.active || 0

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1
          className="text-3xl mb-1"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Dashboard
        </h1>
        <p className="text-sm text-text-muted">Your projects at a glance.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Projects" value={dashboard.total_projects} icon={FolderKanban} />
        <StatCard label="Active" value={active} icon={Clock} accent />
        <StatCard label="Budget" value={`$${dashboard.total_budget.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Spent" value={`$${dashboard.total_spent.toLocaleString()}`} icon={DollarSign} />
      </div>

      <StatusBar byStatus={dashboard.by_status} />

      {dashboard.total_projects === 0 && (
        <div className="mt-8 text-center py-12 bg-surface rounded-lg border border-border">
          <FolderKanban size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted mb-2">No projects yet.</p>
          <Link
            to="/projects"
            className="text-sm text-accent hover:underline"
          >
            Create your first project
          </Link>
        </div>
      )}
    </div>
  )
}
