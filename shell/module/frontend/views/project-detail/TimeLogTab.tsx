import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Plus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { ProjectItem, TimeLog } from './types'
import { formatTime } from './helpers'

export function TimeLogTab({ projectId, items }: { projectId: number; items: ProjectItem[] }) {
  const [showLogTime, setShowLogTime] = useState(false)

  const { data: timeLogs, isLoading } = useQuery({
    queryKey: ['project-time-logs', projectId],
    queryFn: () => apiGet<TimeLog[]>('/modules/craftplanner/time-logs', { project_id: String(projectId) }),
  })

  if (isLoading) {
    return <div className="py-10 text-center text-[12px] text-text-faint">Loading time logs...</div>
  }

  const logs = timeLogs ?? []
  const totalMinutes = logs.reduce((sum, l) => sum + l.minutes, 0)

  // This week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const weekMinutes = logs
    .filter(l => new Date(l.logged_at) >= startOfWeek)
    .reduce((sum, l) => sum + l.minutes, 0)

  // Estimated total
  const estimatedMinutes = items.reduce((sum, i) => sum + (i.estimated_time_minutes ?? 0), 0)

  // Per-item breakdown
  const itemTotals: Record<number, { name: string; minutes: number }> = {}
  for (const log of logs) {
    if (!itemTotals[log.item_id]) {
      itemTotals[log.item_id] = { name: log.item_name ?? `Item #${log.item_id}`, minutes: 0 }
    }
    itemTotals[log.item_id].minutes += log.minutes
  }
  const itemBreakdown = Object.values(itemTotals).sort((a, b) => b.minutes - a.minutes)
  const maxItemMinutes = Math.max(...itemBreakdown.map(i => i.minutes), 1)

  // Group by day
  const dayGroups: Record<string, TimeLog[]> = {}
  for (const log of [...logs].sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())) {
    const day = new Date(log.logged_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!dayGroups[day]) dayGroups[day] = []
    dayGroups[day].push(log)
  }

  return (
    <div className="py-3 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Logged', value: formatTime(totalMinutes) },
          { label: 'This Week', value: formatTime(weekMinutes) },
          { label: 'Estimated', value: estimatedMinutes > 0 ? formatTime(estimatedMinutes) : '--' },
        ].map(card => (
          <div key={card.label} className="rounded border border-border bg-surface/50 px-2.5 py-2">
            <div className="text-[9px] uppercase tracking-wider text-text-faint mb-0.5">{card.label}</div>
            <div className="text-[16px] font-semibold font-display text-text">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Per-item breakdown */}
      {itemBreakdown.length > 0 && (
        <div>
          <div className="text-label mb-2 px-0.5">By Item</div>
          <div className="space-y-1.5">
            {itemBreakdown.map(item => {
              const pct = (item.minutes / maxItemMinutes) * 100
              return (
                <div key={item.name} className="flex items-center gap-2.5">
                  <span className="text-[11px] text-text-muted w-36 truncate">{item.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-el overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-text-faint font-mono w-14 text-right">{formatTime(item.minutes)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="text-label">Timeline</div>
          <Button variant="secondary" size="xs" onClick={() => setShowLogTime(true)}>
            <Plus size={10} /> Log Time
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={22} className="mx-auto text-text-faint mb-2" />
            <p className="text-[12px] text-text-muted">No time logged yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(dayGroups).map(([day, dayLogs]) => (
              <div key={day}>
                <div className="text-[10px] font-medium text-text-muted mb-1 px-0.5">{day}</div>
                <div className="space-y-0.5">
                  {dayLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface border border-border rounded text-[11px]">
                      <Clock size={10} className="text-text-faint shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-text">{log.item_name ?? `Item #${log.item_id}`}</span>
                        {log.note && <p className="text-[10px] text-text-faint line-clamp-1 mt-0.5">{log.note}</p>}
                      </div>
                      <span className="font-mono font-medium text-text">{formatTime(log.minutes)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <LogTimeDialog projectId={projectId} items={items} open={showLogTime} onOpenChange={setShowLogTime} />
    </div>
  )
}

function LogTimeDialog({
  projectId, items, open, onOpenChange,
}: {
  projectId: number
  items: ProjectItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [itemId, setItemId] = useState('')
  const [minutes, setMinutes] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: { itemId: number; minutes: number; note: string }) =>
      apiPost(`/modules/craftplanner/items/${data.itemId}/log-time`, { minutes: data.minutes, note: data.note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-time-logs', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
      setItemId(''); setMinutes(''); setNote(''); setError('')
      onOpenChange(false)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemId) { setError('Select an item'); return }
    if (!minutes || parseInt(minutes) <= 0) return
    setError('')
    mutation.mutate({ itemId: parseInt(itemId), minutes: parseInt(minutes), note: note.trim() })
  }

  const itemOptions = [
    { value: '', label: 'Select an item...' },
    ...items.map(i => ({ value: String(i.id), label: i.name })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Log Time">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select label="Item" value={itemId} onValueChange={v => { setItemId(v); setError('') }} options={itemOptions} />
        {error && <p className="text-[11px] text-danger">{error}</p>}
        <Input label="Minutes" type="number" min="1" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder="30" required autoFocus />
        <Textarea label="Note" value={note} onChange={e => setNote(e.target.value)} placeholder="What did you work on?" rows={2} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Logging...' : 'Log Time'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
