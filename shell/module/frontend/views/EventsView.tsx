import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import {
  Plus, Trash2, Calendar, Star, MapPin, Pencil, ArrowRight, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

/* ---------- Types ---------- */

interface CraftEvent {
  id: number
  name: string
  project_id: number | null
  description: string
  event_date: string | null
  location: string
  rating: number | null
  notes: string
  tags: string[]
  created_at: string
}

interface ProjectOption {
  id: number
  name: string
}

/* ---------- Helpers ---------- */

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isUpcoming(d: string | null): boolean {
  if (!d) return false
  return new Date(d) >= new Date(new Date().toDateString())
}

function daysUntil(dateStr: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function StarRating({
  value, onChange, readonly, size = 12,
}: {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
  size?: number
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(i === value ? 0 : i)}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:text-warning',
            i <= (value ?? 0) ? 'text-warning' : 'text-text-faint',
          )}
        >
          <Star size={size} fill={i <= (value ?? 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

/* ---------- Event Dialog (Create / Edit) ---------- */

function EventDialog({
  open, onOpenChange, event, projects, onSubmit, isPending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  event?: CraftEvent
  projects: ProjectOption[]
  onSubmit: (data: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [name, setName] = useState(event?.name ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [eventDate, setEventDate] = useState(event?.event_date ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [projectId, setProjectId] = useState(event?.project_id != null ? String(event.project_id) : '')
  const [rating, setRating] = useState<number | null>(event?.rating ?? null)
  const [notes, setNotes] = useState(event?.notes ?? '')
  const [tags, setTags] = useState(event?.tags?.join(', ') ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      event_date: eventDate || null,
      location: location.trim(),
      project_id: projectId ? parseInt(projectId) : null,
      rating: rating || null,
      notes: notes.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  const projectOptions = [
    { value: '', label: 'No project' },
    ...projects.map(p => ({ value: String(p.id), label: p.name })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={event ? 'Edit Event' : 'New Event'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Event name" required autoFocus />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Location" />
        </div>
        <Select label="Linked Project" value={projectId} onValueChange={setProjectId} options={projectOptions} />
        <div>
          <label className="text-label mb-1 block">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Event notes" rows={2} />
        <Input label="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} placeholder="convention, craft-show" />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || isPending}>
            {isPending ? 'Saving...' : event ? 'Save' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/* ---------- Event Card ---------- */

function EventCard({
  event, projectName, onEdit, onDelete,
}: {
  event: CraftEvent
  projectName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const upcoming = event.event_date ? isUpcoming(event.event_date) : false
  const days = event.event_date ? daysUntil(event.event_date) : null

  return (
    <div className="bg-surface border border-border rounded p-3.5 group hover:border-accent/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[13px] font-medium text-text">{event.name}</span>
            {event.rating != null && event.rating > 0 && (
              <StarRating value={event.rating} readonly size={10} />
            )}
            {upcoming && days !== null && (
              <Badge
                variant={days <= 7 ? 'warning' : 'accent'}
                size="sm"
                className="text-[8px]"
              >
                {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days}d`}
              </Badge>
            )}
          </div>
          {event.description && (
            <p className="text-[11px] text-text-muted mb-1.5 line-clamp-2">{event.description}</p>
          )}
          <div className="flex items-center gap-3 text-[10px] text-text-faint flex-wrap">
            {event.event_date && (
              <span className="flex items-center gap-1">
                <Calendar size={9} />
                {formatDate(event.event_date)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin size={9} />
                {event.location}
              </span>
            )}
            {projectName && (
              <Link
                to={`/projects/${event.project_id}` as never}
                className="flex items-center gap-0.5 text-accent hover:text-accent/80 transition-colors"
              >
                {projectName}
                <ArrowRight size={8} />
              </Link>
            )}
          </div>
          {event.notes && (
            <p className="text-[10px] text-text-muted mt-1.5 italic line-clamp-2">&ldquo;{event.notes}&rdquo;</p>
          )}
          {event.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              {event.tags.map(tag => (
                <Badge key={tag} variant="default" size="sm" className="text-[9px]">{tag}</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2">
          <button onClick={onEdit} className="p-1 text-text-faint hover:text-text transition-colors"><Pencil size={11} /></button>
          <button onClick={onDelete} className="p-1 text-text-faint hover:text-danger transition-colors"><Trash2 size={11} /></button>
        </div>
      </div>
    </div>
  )
}

/* ========== Main Component ========== */

export function EventsView() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CraftEvent | null>(null)
  const [search, setSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['craftplanner', 'events'],
    queryFn: () => apiGet<CraftEvent[]>('/modules/craftplanner/events'),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['craftplanner', 'projects-list'],
    queryFn: () => apiGet<ProjectOption[]>('/modules/craftplanner/projects'),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/modules/craftplanner/events', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      setShowCreate(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiPut(`/modules/craftplanner/events/${id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      setEditingEvent(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/events/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p.name])), [projects])

  const filtered = useMemo(() => {
    let list = [...events]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q))
    }
    if (projectFilter) {
      const pid = parseInt(projectFilter)
      list = list.filter(e => e.project_id === pid)
    }
    if (ratingFilter) {
      const r = parseInt(ratingFilter)
      list = list.filter(e => e.rating != null && e.rating >= r)
    }
    return list
  }, [events, search, projectFilter, ratingFilter])

  const upcoming = filtered.filter(e => isUpcoming(e.event_date)).sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))
  const past = filtered.filter(e => !isUpcoming(e.event_date)).sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))

  const projectFilterOptions = [
    { value: '', label: 'All projects' },
    ...projects.map(p => ({ value: String(p.id), label: p.name })),
  ]

  const ratingOptions = [
    { value: '', label: 'Any rating' },
    { value: '1', label: '1+ stars' },
    { value: '2', label: '2+ stars' },
    { value: '3', label: '3+ stars' },
    { value: '4', label: '4+ stars' },
    { value: '5', label: '5 stars' },
  ]

  return (
    <div className="p-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-display text-text leading-tight mb-0.5">Events</h1>
          <p className="text-[11px] text-text-faint">Occasions where your projects are used or shown.</p>
        </div>
        <Button variant="primary" size="xs" onClick={() => setShowCreate(true)}>
          <Plus size={10} /> New Event
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[140px] max-w-[220px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-7 pr-3 h-7 text-[11px] bg-surface border border-border rounded focus:outline-none focus:border-accent/50 text-text placeholder:text-text-faint"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter} options={projectFilterOptions} />
        <Select value={ratingFilter} onValueChange={setRatingFilter} options={ratingOptions} />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-18 bg-surface rounded animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded border border-border">
          <Calendar size={28} className="mx-auto text-text-faint mb-3" />
          <p className="text-[13px] text-text-muted">
            {events.length === 0 ? 'No events recorded yet.' : 'No events match your filters.'}
          </p>
          {events.length === 0 && (
            <p className="text-[11px] text-text-faint mt-1">Create an event to track where your projects are used or shown.</p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {upcoming.length > 0 && (
            <div>
              <div className="text-label mb-2 px-0.5 flex items-center gap-2">
                Upcoming
                <Badge variant="accent" size="sm" className="text-[8px]">{upcoming.length}</Badge>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-1.5">
                {upcoming.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    projectName={event.project_id != null ? projectMap.get(event.project_id) : undefined}
                    onEdit={() => setEditingEvent(event)}
                    onDelete={() => { if (confirm(`Delete "${event.name}"?`)) deleteMutation.mutate(event.id) }}
                  />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <div className="text-label mb-2 px-0.5 flex items-center gap-2">
                Past
                <span className="text-text-faint font-normal">{past.length}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-1.5">
                {past.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    projectName={event.project_id != null ? projectMap.get(event.project_id) : undefined}
                    onEdit={() => setEditingEvent(event)}
                    onDelete={() => { if (confirm(`Delete "${event.name}"?`)) deleteMutation.mutate(event.id) }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <EventDialog open={showCreate} onOpenChange={setShowCreate} projects={projects} onSubmit={data => createMutation.mutate(data)} isPending={createMutation.isPending} />
      )}
      {editingEvent && (
        <EventDialog open={!!editingEvent} onOpenChange={o => { if (!o) setEditingEvent(null) }} event={editingEvent} projects={projects} onSubmit={data => updateMutation.mutate({ id: editingEvent.id, data })} isPending={updateMutation.isPending} />
      )}
    </div>
  )
}
