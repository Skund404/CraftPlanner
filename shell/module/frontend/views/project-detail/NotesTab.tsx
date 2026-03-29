import { useState, useCallback, useRef, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPut } from '@/lib/api'
import { ChevronDown, ChevronRight, FileText, Users, Wrench, Lightbulb, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NotesData } from './types'
import { parseNotes, serializeNotes } from './helpers'

const SECTIONS = [
  { key: 'client' as const, label: 'Client Notes', icon: Users, description: 'Requirements, preferences, communication with client' },
  { key: 'construction' as const, label: 'Construction Notes', icon: Wrench, description: 'Technical decisions, measurements, materials chosen' },
  { key: 'lessons' as const, label: 'Lessons Learned', icon: Lightbulb, description: 'What to do differently next time' },
  { key: 'general' as const, label: 'General', icon: StickyNote, description: 'Freeform notes and thoughts' },
]

export function NotesTab({
  projectId,
  notes,
}: {
  projectId: number
  notes: string | null
}) {
  const queryClient = useQueryClient()
  const [data, setData] = useState<NotesData>(() => parseNotes(notes))
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    // Auto-expand sections that have content, or all if none have content
    const parsed = parseNotes(notes)
    const hasAny = Object.values(parsed).some(v => v.trim())
    if (!hasAny) return { general: true }
    const result: Record<string, boolean> = {}
    for (const s of SECTIONS) {
      if (parsed[s.key].trim()) result[s.key] = true
    }
    return result
  })

  const saveMutation = useMutation({
    mutationFn: (notesJson: string) =>
      apiPut(`/modules/craftplanner/projects/${projectId}`, { notes: notesJson }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  // Debounced save
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const save = useCallback((updated: NotesData) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      saveMutation.mutate(serializeNotes(updated))
    }, 1500)
  }, [saveMutation])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function updateSection(key: keyof NotesData, value: string) {
    const updated = { ...data, [key]: value }
    setData(updated)
    save(updated)
  }

  function toggleSection(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // Word count
  const totalWords = Object.values(data).join(' ').split(/\s+/).filter(Boolean).length

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="text-label flex items-center gap-2">
          <FileText size={11} /> Notes
        </div>
        <div className="flex items-center gap-2 text-[10px] text-text-faint">
          {saveMutation.isPending && <span className="animate-pulse">Saving...</span>}
          {totalWords > 0 && <span>{totalWords} words</span>}
        </div>
      </div>

      <div className="space-y-1">
        {SECTIONS.map(section => {
          const isExpanded = expanded[section.key] ?? false
          const hasContent = data[section.key].trim().length > 0
          const Icon = section.icon

          return (
            <div
              key={section.key}
              className={cn(
                'rounded border transition-colors',
                isExpanded ? 'border-accent/20 bg-surface' : 'border-border hover:border-border-bright',
              )}
            >
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              >
                {isExpanded ? <ChevronDown size={11} className="text-text-faint" /> : <ChevronRight size={11} className="text-text-faint" />}
                <Icon size={12} className="text-text-faint shrink-0" />
                <span className="text-[12px] font-medium text-text flex-1">{section.label}</span>
                {hasContent && !isExpanded && (
                  <span className="text-[10px] text-text-faint truncate max-w-48">
                    {data[section.key].slice(0, 60)}{data[section.key].length > 60 ? '...' : ''}
                  </span>
                )}
                {hasContent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-1.5">
                  <p className="text-[10px] text-text-faint">{section.description}</p>
                  <textarea
                    value={data[section.key]}
                    onChange={e => updateSection(section.key, e.target.value)}
                    placeholder={`Add ${section.label.toLowerCase()}...`}
                    rows={6}
                    className="w-full bg-bg border border-border rounded px-2.5 py-2 text-[12px] text-text placeholder:text-text-faint/50 resize-y focus:outline-none focus:border-accent/40 transition-colors leading-relaxed"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
