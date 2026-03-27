import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'
import { Calendar } from 'lucide-react'
import type { PanelProps } from '@/modules/panel-registry'

interface CraftEvent {
  id: number
  name: string
  event_date: string | null
  location: string
}

export function UpcomingEventsPanel(_props: PanelProps) {
  const { data: events = [] } = useQuery({
    queryKey: ['craftplanner', 'events'],
    queryFn: () => apiGet<CraftEvent[]>('/modules/craftplanner/events'),
    staleTime: 30_000,
  })

  // Show only future events (or events without dates)
  const now = new Date().toISOString().split('T')[0]
  const upcoming = events
    .filter(e => !e.event_date || e.event_date >= now)
    .slice(0, 5)

  return (
    <div className="space-y-2">
      {upcoming.length === 0 ? (
        <p className="text-xs text-text-faint py-2">No upcoming events.</p>
      ) : (
        upcoming.map(e => (
          <div key={e.id} className="flex items-center gap-2 p-2 rounded">
            <Calendar size={12} className="text-text-faint shrink-0" />
            <span className="flex-1 text-xs text-text truncate">{e.name}</span>
            {e.event_date && (
              <span className="text-[9px] text-text-faint">{e.event_date}</span>
            )}
          </div>
        ))
      )}
    </div>
  )
}
