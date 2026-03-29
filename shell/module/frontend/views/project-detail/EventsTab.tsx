import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Plus, CalendarDays, MapPin, Star, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import type { CraftEvent } from './types'
import { formatDate } from './helpers'

export function EventsTab({ projectId }: { projectId: number }) {
  const [showLinkEvent, setShowLinkEvent] = useState(false)

  const { data: events, isLoading } = useQuery({
    queryKey: ['project-events', projectId],
    queryFn: () => apiGet<CraftEvent[]>('/modules/craftplanner/events', { project_id: String(projectId) }),
  })

  if (isLoading) {
    return <div className="py-10 text-center text-[12px] text-text-faint">Loading events...</div>
  }

  const eventList = events ?? []

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="text-label">Events ({eventList.length})</div>
        <Button variant="secondary" size="xs" onClick={() => setShowLinkEvent(true)}>
          <Plus size={10} /> Link Event
        </Button>
      </div>

      {eventList.length === 0 ? (
        <div className="text-center py-8">
          <CalendarDays size={22} className="mx-auto text-text-faint mb-2" />
          <p className="text-[12px] text-text-muted">No events linked yet.</p>
          <p className="text-[11px] text-text-faint mt-1">Link events where this project will be used or shown.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {eventList.map(event => (
            <div key={event.id} className="rounded border border-border bg-surface p-3 space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="text-[13px] font-medium text-text">{event.name}</h3>
                {event.rating != null && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={11}
                        className={i < event.rating! ? 'text-warning fill-warning' : 'text-text-faint'}
                      />
                    ))}
                  </div>
                )}
              </div>
              {event.description && (
                <p className="text-[11px] text-text-muted line-clamp-2">{event.description}</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-text-faint flex-wrap">
                {event.event_date && (
                  <span className="flex items-center gap-1"><CalendarDays size={9} /> {formatDate(event.event_date)}</span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1"><MapPin size={9} /> {event.location}</span>
                )}
                {event.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    <TagIcon size={9} />
                    {event.tags.join(', ')}
                  </span>
                )}
              </div>
              {event.notes && (
                <p className="text-[11px] text-text-muted italic">{event.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <LinkEventDialog projectId={projectId} open={showLinkEvent} onOpenChange={setShowLinkEvent} />
    </div>
  )
}

function LinkEventDialog({
  projectId, open, onOpenChange,
}: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/modules/craftplanner/events', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-events', projectId] })
      setName(''); setDescription(''); setEventDate(''); setLocation(''); setNotes('')
      onOpenChange(false)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate({
      project_id: projectId,
      name: name.trim(),
      description: description.trim(),
      event_date: eventDate || null,
      location: location.trim(),
      notes: notes.trim(),
      tags: [],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Link Event">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Event Name" value={name} onChange={e => setName(e.target.value)} placeholder="Convention, meetup, photoshoot..." required autoFocus />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, venue..." />
        </div>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes" rows={2} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Event'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
