import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { useState, useEffect } from 'react'

interface ThemeInfo {
  name: string
}

const THEMES = [
  { id: 'workshop-dark', label: 'Workshop Dark', desc: 'Warm earth tones on dark background' },
  { id: 'daylight', label: 'Daylight', desc: 'Light mode with warm accents' },
  { id: 'high-contrast', label: 'High Contrast', desc: 'Maximum readability' },
]

export function SettingsView() {
  const queryClient = useQueryClient()

  const { data: themeInfo } = useQuery({
    queryKey: ['theme'],
    queryFn: () => apiGet<ThemeInfo>('/api/settings/theme'),
  })

  const themeMutation = useMutation({
    mutationFn: (name: string) => apiPut('/api/settings/theme', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['theme'] })
      // Reload theme CSS
      window.location.reload()
    },
  })

  return (
    <div className="p-6 max-w-3xl">
      <h1
        className="text-3xl mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
      >
        Settings
      </h1>
      <p className="text-sm text-text-muted mb-8">Customize your CraftPlanner experience.</p>

      {/* Theme */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-text mb-3">Theme</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => themeMutation.mutate(theme.id)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                themeInfo?.name === theme.id
                  ? 'border-accent bg-accent/5'
                  : 'border-border bg-surface hover:border-accent/30'
              }`}
            >
              <div className="text-sm font-medium text-text mb-0.5">{theme.label}</div>
              <div className="text-xs text-text-muted">{theme.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* About */}
      <section>
        <h2 className="text-sm font-medium text-text mb-3">About</h2>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm text-text mb-1">CraftPlanner</div>
          <div className="text-xs text-text-muted">
            Domain-agnostic project management for makers.
            Built on the makestack engine.
          </div>
        </div>
      </section>
    </div>
  )
}
