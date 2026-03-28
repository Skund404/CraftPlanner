import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Save, Download } from 'lucide-react'

/* ---------- Types ---------- */

interface ThemeInfo {
  name: string
}

interface Preferences {
  [key: string]: unknown
}

/* ---------- Constants ---------- */

const THEMES = [
  { id: 'workshop-dark', label: 'Workshop Dark', desc: 'Warm earth tones on dark background' },
  { id: 'daylight', label: 'Daylight', desc: 'Light mode with warm accents' },
  { id: 'high-contrast', label: 'High Contrast', desc: 'Maximum readability' },
]

const PRIMITIVE_KEYS = [
  { key: 'materials', defaultLabel: 'Materials' },
  { key: 'tools', defaultLabel: 'Tools' },
  { key: 'techniques', defaultLabel: 'Techniques' },
  { key: 'workflows', defaultLabel: 'Workflows' },
  { key: 'projects', defaultLabel: 'Projects' },
  { key: 'events', defaultLabel: 'Events' },
]

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (\u20ac)' },
  { value: 'GBP', label: 'GBP (\u00a3)' },
  { value: 'CAD', label: 'CAD ($)' },
  { value: 'AUD', label: 'AUD ($)' },
  { value: 'JPY', label: 'JPY (\u00a5)' },
]

/* ========== Main Component ========== */

export function SettingsView() {
  const queryClient = useQueryClient()

  const { data: themeInfo } = useQuery({
    queryKey: ['theme'],
    queryFn: () => apiGet<ThemeInfo>('/api/settings/theme'),
  })

  const { data: prefs } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => apiGet<Preferences>('/api/settings/preferences'),
  })

  const themeMutation = useMutation({
    mutationFn: (name: string) => apiPut('/api/settings/theme', { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['theme'] })
      window.location.reload()
    },
  })

  const prefsMutation = useMutation({
    mutationFn: (data: Preferences) => apiPut('/api/settings/preferences', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['preferences'] })
    },
  })

  // Primitive labels state
  const savedLabels = (prefs?.primitive_labels ?? {}) as Record<string, string>
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [labelsSaved, setLabelsSaved] = useState(true)

  // Defaults state
  const [currency, setCurrency] = useState((prefs?.default_currency as string) ?? 'USD')

  function handleLabelChange(key: string, value: string) {
    setLabels(prev => ({ ...prev, [key]: value }))
    setLabelsSaved(false)
  }

  function handleSaveLabels() {
    const merged: Record<string, string> = {}
    for (const pk of PRIMITIVE_KEYS) {
      merged[pk.key] = labels[pk.key] ?? savedLabels[pk.key] ?? pk.defaultLabel
    }
    prefsMutation.mutate(
      { ...prefs, primitive_labels: merged },
      { onSuccess: () => setLabelsSaved(true) },
    )
  }

  function handleSaveCurrency() {
    prefsMutation.mutate({ ...prefs, default_currency: currency })
  }

  async function handleExport() {
    try {
      const data = await apiGet('/api/data/export')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `craftplanner-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Export failed silently
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1
        className="text-2xl mb-1"
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

      {/* Primitive Renaming */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-text mb-1">Primitive Names</h2>
        <p className="text-xs text-text-faint mb-3">
          Rename the six primitives to match your craft. Changes appear in the sidebar and throughout the app.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {PRIMITIVE_KEYS.map(pk => (
            <div key={pk.key}>
              <label className="text-[10px] uppercase tracking-wider text-text-faint mb-1 block">
                {pk.defaultLabel}
              </label>
              <input
                type="text"
                value={labels[pk.key] ?? savedLabels[pk.key] ?? pk.defaultLabel}
                onChange={e => handleLabelChange(pk.key, e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-surface border border-border rounded focus:outline-none focus:border-accent/50 text-text"
                placeholder={pk.defaultLabel}
              />
            </div>
          ))}
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSaveLabels}
          disabled={labelsSaved || prefsMutation.isPending}
        >
          <Save size={12} />
          {prefsMutation.isPending ? 'Saving...' : 'Save Names'}
        </Button>
      </section>

      {/* Defaults */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-text mb-3">Defaults</h2>
        <div className="flex items-end gap-3">
          <div className="w-48">
            <Select
              label="Default Currency"
              value={currency}
              onValueChange={v => setCurrency(v)}
              options={CURRENCY_OPTIONS}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveCurrency}>
            Save
          </Button>
        </div>
      </section>

      {/* Data Export */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-text mb-3">Data</h2>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download size={12} />
          Export All Data (JSON)
        </Button>
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
