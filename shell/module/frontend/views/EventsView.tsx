import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Link } from '@tanstack/react-router'
import {
  Plus,
  Trash2,
  Calendar,
  Star,
  MapPin,
  Pencil,
  ArrowRight,
  Search,
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

function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number | null
  onChange?: (v: number) => void
  readonly?: boolean
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
          <Star size={14} fill={i <= (value ?? 0) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  )
}

/* ---------- Event Dialog (Create / Edit) ---------- */

function EventDialog({
  open,
  onOpenChange,
  event,
  projects,
  onSubmit,
  isPending,
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
        <Input
          label="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Event name"
          required
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
          />
          <Input
            label="Location"
            value={location}
            onChange={e => setLocation(e.target.value)}
            placeholder="Location"
          />
        </div>
        <Select
          label="Linked Project"
          value={projectId}
          onValueChange={setProjectId}
          options={projectOptions}
        />
        <div>
          <label className="text-xs text-text-muted block mb-1.5">Rating</label>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <Textarea
          label="Notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Event notes"
          rows={2}
        />
        <Input
          label="Tags (comma-separated)"
          value={tags}
          onChange={e => setTags(e.target.value)}
          placeholder="convention, craft-show"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
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
  event,
  projectName,
  onEdit,
  onDelete,
}: {
  event: CraftEvent
  projectName?: string
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 group hover:border-accent/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-medium text-text">{event.name}</span>
            {event.rating != null && event.rating > 0 && (
              <StarRating value={event.rating} readonly />
            )}
          </div>
          {event.description && (
            <p className="text-xs text-text-muted mb-1.5 line-clamp-2">{event.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-text-faint flex-wrap">
            {event.event_date && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {formatDate(event.event_date)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin size={10} />
                {event.location}
              </span>
            )}
            {projectName && (
              <Link
                to={`/projects/${event.project_id}` as never}
                className="flex items-center gap-1 text-accent hover:text-accent/80 transition-colors"
              >
                {projectName}
                <ArrowRight size={10} />
              </Link>
            )}
          </div>
          {event.notes && (
            <p className="text-xs text-text-muted mt-2 italic line-clamp-2">&ldquo;{event.notes}&rdquo;</p>
          )}
          {event.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {event.tags.map(tag => (
                <Badge key={tag} variant="default" className="text-[10px] py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2">
          <button
            onClick={onEdit}
            className="p-1 text-text-faint hover:text-text transition-colors"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-text-faint hover:text-danger transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
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

  /* ---------- Queries ---------- */

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['craftplanner', 'events'],
    queryFn: () => apiGet<CraftEvent[]>('/modules/craftplanner/events'),
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['craftplanner', 'projects-list'],
    queryFn: () => apiGet<ProjectOption[]>('/modules/craftplanner/projects'),
  })

  /* ---------- Mutations ---------- */

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

  /* ---------- Derived ---------- */

  const projectMap = useMemo(
    () => new Map(projects.map(p => [p.id, p.name])),
    [projects],
  )

  const filtered = useMemo(() => {
    let list = [...events]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q),
      )
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

  const upcoming = filtered
    .filter(e => isUpcoming(e.event_date))
    .sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? ''))

  const past = filtered
    .filter(e => !isUpcoming(e.event_date))
    .sort((a, b) => (b.event_date ?? '').localeCompare(a.event_date ?? ''))

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

  /* ---------- Render ---------- */

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Events
          </h1>
          <p className="text-sm text-text-muted">
            Occasions where your projects were used or shown.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={12} />
          New Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[160px] max-w-[260px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search events..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-surface border border-border rounded focus:outline-none focus:border-accent/50 text-text placeholder:text-text-faint"
          />
        </div>
        <Select
          value={projectFilter}
          onValueChange={setProjectFilter}
          options={projectFilterOptions}
        />
        <Select
          value={ratingFilter}
          onValueChange={setRatingFilter}
          options={ratingOptions}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <Calendar size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted">
            {events.length === 0
              ? 'No events recorded yet.'
              : 'No events match your filters.'}
          </p>
          {events.length === 0 && (
            <p className="text-xs text-text-faint mt-1">
              Create an event to track where your projects are used or shown.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming section */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-[10px] uppercase tracking-wider text-text-faint mb-2 px-1">
                Upcoming
              </h2>
              <div className="space-y-2">
                {upcoming.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    projectName={event.project_id != null ? projectMap.get(event.project_id) : undefined}
                    onEdit={() => setEditingEvent(event)}
                    onDelete={() => {
                      if (confirm(`Delete "${event.name}"?`)) {
                        deleteMutation.mutate(event.id)
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past section */}
          {past.length > 0 && (
            <div>
              <h2 className="text-[10px] uppercase tracking-wider text-text-faint mb-2 px-1">
                Past
              </h2>
              <div className="space-y-2">
                {past.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    projectName={event.project_id != null ? projectMap.get(event.project_id) : undefined}
                    onEdit={() => setEditingEvent(event)}
                    onDelete={() => {
                      if (confirm(`Delete "${event.name}"?`)) {
                        deleteMutation.mutate(event.id)
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <EventDialog
          open={showCreate}
          onOpenChange={setShowCreate}
          projects={projects}
          onSubmit={data => createMutation.mutate(data)}
          isPending={createMutation.isPending}
        />
      )}

      {/* Edit Dialog */}
      {editingEvent && (
        <EventDialog
          open={!!editingEvent}
          onOpenChange={o => { if (!o) setEditingEvent(null) }}
          event={editingEvent}
          projects={projects}
          onSubmit={data => updateMutation.mutate({ id: editingEvent.id, data })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  )
}
