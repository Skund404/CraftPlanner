import { Link } from '@tanstack/react-router'
import {
  ArrowLeft, Pencil, Play, Pause, Archive, CheckCircle2,
  Package, DollarSign, Clock, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { Project, ProjectProgress } from './types'
import { formatTime, formatCurrency, formatDate, daysUntil, deadlineColor, statusLabel, statusVariant } from './helpers'

export function ProjectHeader({
  project,
  progress,
  onEdit,
  onChangeStatus,
  isStatusPending,
}: {
  project: Project
  progress: ProjectProgress | null
  onEdit: () => void
  onChangeStatus: (s: string) => void
  isStatusPending: boolean
}) {
  const days = daysUntil(project.deadline)
  const itemsPct = progress ? progress.completion_pct : project.completion_pct
  const costPct = progress && progress.estimated_cost > 0
    ? Math.round((progress.cost_spent / progress.estimated_cost) * 100)
    : 0

  return (
    <div className="px-5 pt-5 pb-4 border-b border-border bg-bg-secondary/50">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <Link
          to="/projects"
          className="flex items-center gap-1.5 text-[11px] text-text-faint hover:text-text-muted transition-colors"
        >
          <ArrowLeft size={11} />
          Projects
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="xs" onClick={onEdit}>
            <Pencil size={11} />
            Edit
          </Button>
          <StatusActions status={project.status} onChangeStatus={onChangeStatus} isPending={isStatusPending} />
        </div>
      </div>

      {/* Name + status */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-[22px] font-medium text-text font-display leading-tight">
          {project.name}
        </h1>
        <Badge variant={statusVariant(project.status)} size="sm">
          {statusLabel(project.status)}
        </Badge>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-[12px] text-text-muted line-clamp-2 mb-2 max-w-2xl leading-relaxed">
          {project.description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-text-faint flex-wrap mb-4">
        {project.created_at && <span>Started {formatDate(project.created_at)}</span>}
        {project.deadline && (
          <span className={cn('flex items-center gap-1', deadlineColor(days))}>
            <CalendarDays size={10} />
            Due {formatDate(project.deadline)}
            {days !== null && (
              <span className="font-mono text-[10px]">
                {days > 0 ? `${days}d` : days === 0 ? 'today' : `${Math.abs(days)}d late`}
              </span>
            )}
          </span>
        )}
        {project.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {project.tags.map(tag => (
              <Badge key={tag} variant="default" size="sm">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Progress stats */}
      {progress && (
        <div className="grid grid-cols-5 gap-2">
          <StatCell
            label="Items"
            value={`${progress.completed_items}/${progress.total_items}`}
            pct={itemsPct}
          />
          <StatCell
            label="Budget"
            value={project.budget != null
              ? `${formatCurrency(progress.cost_spent)} / ${formatCurrency(project.budget)}`
              : formatCurrency(progress.cost_spent)
            }
            pct={project.budget && project.budget > 0
              ? Math.round((progress.cost_spent / project.budget) * 100)
              : costPct
            }
            warn={costPct > 85}
          />
          <StatCell
            label="Time"
            value={formatTime(progress.actual_time_minutes)}
            sub={progress.estimated_time_minutes > 0
              ? `of ${formatTime(progress.estimated_time_minutes)}`
              : 'logged'
            }
          />
          <StatCell
            label="Deadline"
            value={days !== null ? (days > 0 ? `${days}d` : days === 0 ? 'Today' : `${Math.abs(days)}d late`) : '--'}
            color={deadlineColor(days)}
          />
          <StatCell
            label="Completion"
            value={`${Math.round(itemsPct)}%`}
            pct={itemsPct}
          />
        </div>
      )}
    </div>
  )
}

function StatCell({
  label, value, sub, pct, warn, color,
}: {
  label: string
  value: string
  sub?: string
  pct?: number
  warn?: boolean
  color?: string
}) {
  return (
    <div className="rounded border border-border bg-surface/50 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wider text-text-faint mb-0.5">{label}</div>
      <div className={cn('text-[14px] font-semibold font-display leading-tight', color || 'text-text')}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-text-faint mt-0.5">{sub}</div>}
      {pct != null && (
        <div className="h-1 rounded-full bg-surface-el mt-1.5 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', warn ? 'bg-danger' : 'bg-accent')}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

function StatusActions({
  status, onChangeStatus, isPending,
}: {
  status: string
  onChangeStatus: (s: string) => void
  isPending: boolean
}) {
  switch (status) {
    case 'planning':
      return (
        <Button variant="primary" size="xs" onClick={() => onChangeStatus('active')} disabled={isPending}>
          <Play size={10} /> Start
        </Button>
      )
    case 'active':
      return (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="xs" onClick={() => onChangeStatus('paused')} disabled={isPending}>
            <Pause size={10} /> Pause
          </Button>
          <Button variant="primary" size="xs" onClick={() => onChangeStatus('completed')} disabled={isPending}>
            <CheckCircle2 size={10} /> Complete
          </Button>
        </div>
      )
    case 'paused':
      return (
        <Button variant="primary" size="xs" onClick={() => onChangeStatus('active')} disabled={isPending}>
          <Play size={10} /> Resume
        </Button>
      )
    case 'completed':
      return (
        <Button variant="ghost" size="xs" onClick={() => onChangeStatus('archived')} disabled={isPending}>
          <Archive size={10} /> Archive
        </Button>
      )
    default:
      return null
  }
}
