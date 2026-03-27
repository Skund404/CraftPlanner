import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Plus, Trash2, Calendar, Star } from 'lucide-react'

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

function CreateEventDialog({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (data: Record<string, unknown>) => void
}) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={e => {
          e.preventDefault()
          if (!name.trim()) return
          onCreate({
            name: name.trim(),
            description: description.trim(),
            event_date: date || null,
            location: location.trim(),
          })
        }}
        className="bg-surface border border-border rounded-lg p-6 w-full max-w-md shadow-xl"
      >
        <h2 className="text-lg font-medium text-text mb-4">New Event</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-muted block mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Location</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted block mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-text-muted hover:text-text">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-1.5 text-sm bg-accent text-bg rounded hover:bg-accent/90 disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}

export function EventsView() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['craftplanner', 'events'],
    queryFn: () => apiGet<CraftEvent[]>('/modules/craftplanner/events'),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/modules/craftplanner/events', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner'] })
      setShowCreate(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/events/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['craftplanner'] }),
  })

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-3xl mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
          >
            Events
          </h1>
          <p className="text-sm text-text-muted">Occasions where your projects were used or shown.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-bg rounded hover:bg-accent/90 transition-colors"
        >
          <Plus size={14} />
          New Event
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface rounded-lg animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-surface rounded-lg border border-border">
          <Calendar size={32} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted">No events recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <div
              key={event.id}
              className="bg-surface border border-border rounded-lg p-4 group hover:border-accent/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-text">{event.name}</span>
                    {event.rating && (
                      <span className="flex items-center gap-0.5 text-[10px] text-warning">
                        <Star size={10} fill="currentColor" />
                        {event.rating}
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <p className="text-xs text-text-muted mb-1">{event.description}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-text-faint">
                    {event.event_date && <span>{event.event_date}</span>}
                    {event.location && <span>{event.location}</span>}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${event.name}"?`)) {
                      deleteMutation.mutate(event.id)
                    }
                  }}
                  className="p-1 text-text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Delete event"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateEventDialog
          onClose={() => setShowCreate(false)}
          onCreate={data => createMutation.mutate(data)}
        />
      )}
    </div>
  )
}
