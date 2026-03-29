/**
 * QuickLogWidget — compact timer widget for the CraftPlanner sidebar.
 *
 * Lets you select a recent item and log time against it via the API.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Play, Square, Clock, X, Check, ChevronDown } from 'lucide-react'

interface RecentItem {
  id: number
  name: string
  project_name: string
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function QuickLogWidget() {
  const queryClient = useQueryClient()
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Fetch recent items (active projects' items)
  const { data: recentItems } = useQuery({
    queryKey: ['quicklog-items'],
    queryFn: () => apiGet<RecentItem[]>('/modules/craftplanner/dashboard/recent-items'),
    staleTime: 60000,
  })

  const logMutation = useMutation({
    mutationFn: (data: { itemId: number; minutes: number }) =>
      apiPost(`/modules/craftplanner/items/${data.itemId}/log-time`, { minutes: data.minutes, note: '' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] })
      void queryClient.invalidateQueries({ queryKey: ['project-time-logs'] })
      handleDismiss()
    },
  })

  const tick = useCallback(() => {
    if (startTimeRef.current !== null) {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }
  }, [])

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isRunning, tick])

  const selectedItem = recentItems?.find(i => i.id === selectedItemId) ?? null

  const handleStart = () => {
    startTimeRef.current = Date.now()
    setElapsedSeconds(0)
    setShowSummary(false)
    setIsRunning(true)
  }

  const handleStop = () => {
    setIsRunning(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (startTimeRef.current !== null) {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }
    setShowSummary(true)
  }

  const handleDismiss = () => {
    setShowSummary(false)
    setElapsedSeconds(0)
    startTimeRef.current = null
  }

  const handleLog = () => {
    if (!selectedItemId) return
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60))
    logMutation.mutate({ itemId: selectedItemId, minutes })
  }

  const items = recentItems ?? []

  return (
    <div className="px-3.5 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Section label */}
      <div className="flex items-center justify-between pb-2">
        <span
          className="text-[9px] uppercase font-medium"
          style={{ letterSpacing: '0.15em', color: 'var(--color-text-faint, rgba(255,255,255,0.25))' }}
        >
          Quick Log
        </span>
        <Clock size={11} style={{ color: 'rgba(255,255,255,0.25)' }} />
      </div>

      {/* Item selector */}
      {items.length > 0 && (
        <div className="relative mb-2">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-1 w-full px-2 py-1 rounded text-[10px] transition-colors truncate"
            style={{
              color: selectedItem ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.04)',
            }}
          >
            <span className="flex-1 truncate text-left">
              {selectedItem ? selectedItem.name : 'Select item...'}
            </span>
            <ChevronDown size={9} />
          </button>
          {showPicker && (
            <div
              className="absolute left-0 right-0 bottom-full mb-1 rounded border shadow-lg max-h-40 overflow-y-auto z-50"
              style={{
                backgroundColor: '#1a1510',
                borderColor: 'rgba(255,255,255,0.1)',
              }}
            >
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setSelectedItemId(item.id); setShowPicker(false) }}
                  className="flex flex-col w-full px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                >
                  <span className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {item.name}
                  </span>
                  <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {item.project_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timer display */}
      <div
        className="font-mono text-lg leading-none pb-2"
        style={{ color: isRunning ? '#e8ddd0' : 'rgba(255,255,255,0.45)' }}
      >
        {formatTime(elapsedSeconds)}
      </div>

      {/* Controls */}
      {!isRunning && !showSummary && (
        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] cursor-pointer transition-colors"
          style={{
            color: 'rgba(255,255,255,0.5)',
            backgroundColor: 'rgba(255,255,255,0.04)',
          }}
        >
          <Play size={11} />
          <span>Start</span>
        </button>
      )}

      {isRunning && (
        <button
          onClick={handleStop}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] cursor-pointer transition-colors"
          style={{
            color: '#d4915c',
            backgroundColor: 'rgba(212,145,92,0.1)',
          }}
        >
          <Square size={11} />
          <span>Stop</span>
        </button>
      )}

      {!isRunning && showSummary && (
        <div className="space-y-1.5">
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {formatTime(elapsedSeconds)} elapsed
            {selectedItem && <> on <span style={{ color: 'rgba(255,255,255,0.5)' }}>{selectedItem.name}</span></>}
          </div>
          <div className="flex gap-1">
            {selectedItemId && (
              <button
                onClick={handleLog}
                disabled={logMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors"
                style={{
                  color: '#d4915c',
                  backgroundColor: 'rgba(212,145,92,0.1)',
                }}
              >
                <Check size={9} />
                <span>{logMutation.isPending ? 'Logging...' : 'Log'}</span>
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer transition-colors"
              style={{
                color: 'rgba(255,255,255,0.35)',
                backgroundColor: 'rgba(255,255,255,0.04)',
              }}
            >
              <X size={9} />
              <span>Dismiss</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
