import { useState, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  FolderKanban,
  DollarSign,
  Clock,
  Plus,
  ArrowRight,
  Calendar,
  TrendingUp,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'

/* ---------- Types ---------- */

interface DashboardData {
  total_projects: number
  by_status: Record<string, number>
  total_budget: number
  total_spent: number
}

interface DashboardProject {
  id: number
  name: string
  status: string
  budget: number | null
  deadline: string | null
  completion_pct: number
  updated_at: string
}

interface Activity {
  activity_type: 'time_log' | 'cost_entry'
  activity_date: string
  project_name: string
  minutes?: number
  item_name?: string
  note?: string
  amount?: number
  description?: string
  category?: string
}

interface DashboardEvent {
  id: number
  name: string
  event_date: string | null
  location: string
}

/* ---------- Helpers ---------- */

function formatTime(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function todayString(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterday = new Date(todayStart)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= todayStart) return 'today'
  if (date >= yesterday) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function activityDay(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterday = new Date(todayStart)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= todayStart) return 'Today'
  if (date >= yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/* ---------- Sub-components ---------- */

function StatCard({
  icon,
  label,
  value,
  subtext,
}: {
  icon: ReactNode
  label: string
  value: string
  subtext?: string
}) {
  return (
    <div className="rounded border border-border bg-surface/50 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-faint mb-1">
        {icon}
        {label}
      </div>
      <div className="text-[20px] font-semibold font-display text-text leading-tight">{value}</div>
      {subtext && <div className="text-[10px] text-text-faint mt-0.5">{subtext}</div>}
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
    <div className="mb-5">
      <div className="flex gap-px h-2 rounded-full overflow-hidden mb-2">
        {statuses.map(s => {
          const count = byStatus[s.key] || 0
          if (count === 0) return null
          return (
            <div
              key={s.key}
              className={`${s.color} transition-all rounded-full`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${s.label}: ${count}`}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {statuses.map(s => {
          const count = byStatus[s.key] || 0
          if (count === 0) return null
          return (
            <div key={s.key} className="flex items-center gap-1.5 text-[10px] text-text-muted">
              <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
              <span>{s.label}</span>
              <span className="text-text-faint font-mono">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Create Project Dialog ---------- */

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreate,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: { name: string; description: string; budget?: number; deadline?: string }) => void
  isPending: boolean
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onCreate({
      name: name.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : undefined,
      deadline: deadline || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New Project">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Name" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="My New Project" />
        <Textarea label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this project about?" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Budget (optional)" type="number" step="0.01" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" />
          <Input label="Deadline (optional)" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={!name.trim() || isPending}>
            {isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ========== Main Component ========== */

export function DashboardView() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiGet<DashboardData>('/modules/craftplanner/projects/dashboard'),
  })

  const { data: activeProjects = [] } = useQuery({
    queryKey: ['active-projects'],
    queryFn: () => apiGet<DashboardProject[]>('/modules/craftplanner/projects', { status: 'active' }),
  })

  const { data: recentActivity = [] } = useQuery({
    queryKey: ['dashboard-activity'],
    queryFn: () => apiGet<Activity[]>('/modules/craftplanner/dashboard/activity', { limit: '15' }),
  })

  const { data: allEvents = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => apiGet<DashboardEvent[]>('/modules/craftplanner/events'),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; budget?: number; deadline?: string }) =>
      apiPost<{ id: number }>('/modules/craftplanner/projects', data),
    onSuccess: result => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['active-projects'] })
      setShowCreate(false)
      if (result?.id) navigate({ to: `/projects/${result.id}` as never })
    },
  })

  /* ---------- Derived ---------- */

  const stats = dashboard ?? { total_projects: 0, by_status: {}, total_budget: 0, total_spent: 0 }
  const activeCount = stats.by_status.active || 0
  const spentPct = stats.total_budget > 0 ? Math.round((stats.total_spent / stats.total_budget) * 100) : 0

  const today = new Date().toISOString().slice(0, 10)
  const upcomingEvents = allEvents
    .filter(e => e.event_date && e.event_date >= today)
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))

  const deadlineProjects = activeProjects
    .filter(p => p.deadline)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))

  const budgetProjects = activeProjects.filter(p => p.budget && p.budget > 0)

  // Group activity by day
  const activityGroups: { day: string; items: Activity[] }[] = []
  for (const entry of recentActivity) {
    const day = activityDay(entry.activity_date)
    const last = activityGroups[activityGroups.length - 1]
    if (last && last.day === day) {
      last.items.push(entry)
    } else {
      activityGroups.push({ day, items: [entry] })
    }
  }

  /* ---------- Loading ---------- */

  if (dashLoading) {
    return (
      <div className="p-5 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface rounded" />
          <div className="h-3 w-32 bg-surface rounded" />
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-surface rounded" />)}
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Render ---------- */

  return (
    <div className="p-5 max-w-5xl mx-auto">
      {/* Header + Quick Actions */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-display text-text leading-tight mb-0.5">Dashboard</h1>
          <p className="text-[11px] text-text-faint">{todayString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="primary" size="xs" onClick={() => setShowCreate(true)}>
            <Plus size={10} /> New Project
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <StatCard
          icon={<FolderKanban size={10} />}
          label="Active"
          value={String(activeCount)}
          subtext={`${stats.total_projects} total projects`}
        />
        <StatCard
          icon={<DollarSign size={10} />}
          label="Budget"
          value={formatCurrency(stats.total_budget)}
          subtext={`across ${stats.total_projects} project${stats.total_projects !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<TrendingUp size={10} />}
          label="Spent"
          value={formatCurrency(stats.total_spent)}
          subtext={stats.total_budget > 0 ? `${spentPct}% of total budget` : undefined}
        />
        <StatCard
          icon={<Target size={10} />}
          label="Completion"
          value={activeProjects.length > 0
            ? `${Math.round(activeProjects.reduce((s, p) => s + p.completion_pct, 0) / activeProjects.length)}%`
            : '--'
          }
          subtext="avg. active project"
        />
      </div>

      {/* Status Distribution Bar */}
      <StatusBar byStatus={stats.by_status} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column — 3/5 */}
        <div className="lg:col-span-3 space-y-4">
          {/* Active Projects */}
          <div className="rounded border border-border bg-surface/30 p-3.5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-label">Active Projects</div>
              <Link to="/projects" className="text-[10px] text-text-faint hover:text-accent transition-colors">
                View all <ArrowRight size={9} className="inline" />
              </Link>
            </div>
            {activeProjects.length === 0 ? (
              <p className="text-[12px] text-text-faint py-4 text-center">No active projects.</p>
            ) : (
              <div className="space-y-1.5">
                {activeProjects.map(project => {
                  const days = project.deadline ? daysUntil(project.deadline) : null
                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}` as never}
                      className="flex items-center gap-3 p-2.5 rounded border border-transparent hover:border-border hover:bg-surface transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] text-text group-hover:text-accent transition-colors truncate font-medium">
                            {project.name}
                          </span>
                          {days !== null && (
                            <span className={cn(
                              'text-[9px] font-mono shrink-0',
                              days < 0 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-text-faint',
                            )}>
                              {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'due today' : `${days}d`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${project.completion_pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-text-faint font-mono w-8 text-right">
                            {Math.round(project.completion_pct)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-faint">
                          {project.budget != null && (
                            <span className="font-mono">{formatCurrency(project.budget)}</span>
                          )}
                          <span>Updated {relativeDate(project.updated_at)}</span>
                        </div>
                      </div>
                      <ArrowRight
                        size={11}
                        className="text-text-faint opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      />
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="rounded border border-border bg-surface/30 p-3.5">
            <div className="text-label mb-3">Recent Activity</div>
            {recentActivity.length === 0 ? (
              <p className="text-[12px] text-text-faint py-4 text-center">No recent activity.</p>
            ) : (
              <div className="space-y-3">
                {activityGroups.map(group => (
                  <div key={group.day}>
                    <div className="text-[9px] uppercase tracking-wider text-text-faint mb-1.5 px-0.5">
                      {group.day}
                    </div>
                    <div className="space-y-1">
                      {group.items.map((entry, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface transition-colors">
                          <div
                            className={cn(
                              'w-5 h-5 rounded flex items-center justify-center shrink-0',
                              entry.activity_type === 'time_log'
                                ? 'bg-accent/10 text-accent'
                                : 'bg-warning/10 text-warning',
                            )}
                          >
                            {entry.activity_type === 'time_log' ? <Clock size={9} /> : <DollarSign size={9} />}
                          </div>
                          <div className="flex-1 min-w-0 text-[11px]">
                            {entry.activity_type === 'time_log' ? (
                              <span className="text-text">
                                <span className="font-medium font-mono">{formatTime(entry.minutes ?? 0)}</span>
                                {entry.item_name && <> on <span className="text-text-muted">{entry.item_name}</span></>}
                                {' \u00b7 '}
                                <span className="text-text-faint">{entry.project_name}</span>
                              </span>
                            ) : (
                              <span className="text-text">
                                <span className="font-medium font-mono">{formatCurrency(entry.amount ?? 0)}</span>
                                {entry.description && <> &middot; <span className="text-text-muted">{entry.description}</span></>}
                                {' \u00b7 '}
                                <span className="text-text-faint">{entry.project_name}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-text-faint shrink-0">{relativeDate(entry.activity_date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column — 2/5 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Upcoming Timeline */}
          <div className="rounded border border-border bg-surface/30 p-3.5">
            <div className="text-label mb-3">Upcoming</div>

            {/* Merged timeline: deadlines + events */}
            {(() => {
              const timeline: { date: string; type: 'deadline' | 'event'; label: string; id: number; sub?: string }[] = []
              for (const p of deadlineProjects) {
                timeline.push({ date: p.deadline!, type: 'deadline', label: p.name, id: p.id })
              }
              for (const e of upcomingEvents) {
                timeline.push({ date: e.event_date!, type: 'event', label: e.name, id: e.id, sub: e.location })
              }
              timeline.sort((a, b) => a.date.localeCompare(b.date))

              if (timeline.length === 0) {
                return <p className="text-[12px] text-text-faint py-4 text-center">Nothing upcoming.</p>
              }

              return (
                <div className="space-y-1">
                  {timeline.slice(0, 10).map((item, i) => {
                    const days = daysUntil(item.date)
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex items-center gap-2.5 py-1.5 px-2 rounded hover:bg-surface transition-colors"
                      >
                        <div className="w-12 text-right shrink-0">
                          <div className="text-[10px] font-mono text-text-faint">
                            {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          item.type === 'deadline'
                            ? days < 0 ? 'bg-danger' : days <= 7 ? 'bg-warning' : 'bg-accent'
                            : 'bg-violet-400'
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-text truncate">{item.label}</div>
                          {item.sub && <div className="text-[9px] text-text-faint truncate">{item.sub}</div>}
                        </div>
                        <Badge variant={item.type === 'deadline' ? 'warning' : 'accent'} size="sm" className="text-[8px]">
                          {item.type === 'deadline' ? 'due' : 'event'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>

          {/* Budget Health */}
          <div className="rounded border border-border bg-surface/30 p-3.5">
            <div className="text-label mb-3">Budget Health</div>
            {budgetProjects.length === 0 ? (
              <p className="text-[12px] text-text-faint py-4 text-center">No projects with budgets.</p>
            ) : (
              <div className="space-y-2.5">
                {budgetProjects.map(project => {
                  const budget = project.budget!
                  const estimatedSpent = (project.completion_pct / 100) * budget
                  const pct = Math.min(Math.round((estimatedSpent / budget) * 100), 100)

                  return (
                    <Link
                      key={project.id}
                      to={`/projects/${project.id}/budget` as never}
                      className="block hover:bg-surface rounded p-1.5 -m-1.5 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-text truncate">{project.name}</span>
                        <span className="text-[10px] text-text-faint font-mono shrink-0 ml-2">
                          {formatCurrency(budget)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            pct > 85 ? 'bg-danger' : pct > 60 ? 'bg-warning' : 'bg-success',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {stats.total_projects === 0 && (
        <div className="mt-8 text-center py-12 bg-surface rounded border border-border">
          <FolderKanban size={28} className="mx-auto text-text-faint mb-3" />
          <p className="text-[13px] text-text-muted mb-2">No projects yet.</p>
          <button onClick={() => setShowCreate(true)} className="text-[12px] text-accent hover:underline">
            Create your first project
          </button>
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={data => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />
    </div>
  )
}
