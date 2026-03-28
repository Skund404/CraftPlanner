/**
 * QuickLogWidget — compact timer widget for the CraftPlanner sidebar.
 *
 * Purely local state for now; API integration comes later with LogTimeDialog.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Square, Clock, X } from 'lucide-react'

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function QuickLogWidget() {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [showSummary, setShowSummary] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

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
    // Final elapsed calculation
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
            Logged {formatTime(elapsedSeconds)}
          </div>
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
      )}
    </div>
  )
}
