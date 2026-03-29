import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api'
import { Plus, Store, Star, Globe, Mail, Phone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import type { Supplier } from './types'
import { formatCurrency } from './helpers'

export function SuppliersTab({ projectId }: { projectId: number }) {
  const [showAdd, setShowAdd] = useState(false)

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['project-suppliers', projectId],
    queryFn: () => apiGet<Supplier[]>(`/modules/craftplanner/projects/${projectId}/suppliers`),
  })

  if (isLoading) {
    return <div className="py-10 text-center text-[12px] text-text-faint">Loading suppliers...</div>
  }

  const list = suppliers ?? []

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="text-label">Suppliers ({list.length})</div>
        <Button variant="secondary" size="xs" onClick={() => setShowAdd(true)}>
          <Plus size={10} /> Add Supplier
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-8">
          <Store size={22} className="mx-auto text-text-faint mb-2" />
          <p className="text-[12px] text-text-muted">No suppliers linked yet.</p>
          <p className="text-[11px] text-text-faint mt-1">Add suppliers from the Items tab or link one here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {list.map(supplier => (
            <SupplierCard key={supplier.id} supplier={supplier} />
          ))}
        </div>
      )}

      <AddSupplierToProjectDialog projectId={projectId} open={showAdd} onOpenChange={setShowAdd} />
    </div>
  )
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <div className="rounded border border-border bg-surface p-3 space-y-2">
      <div className="flex items-start justify-between">
        <h3 className="text-[13px] font-medium text-text">{supplier.name}</h3>
        {supplier.rating != null && supplier.rating > 0 && (
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={10}
                className={i < supplier.rating! ? 'text-warning fill-warning' : 'text-text-faint'}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 text-[10px] text-text-faint">
        {supplier.website && (
          <a
            href={supplier.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-accent transition-colors truncate"
          >
            <Globe size={9} /> {supplier.website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {supplier.contact_email && (
          <span className="flex items-center gap-1"><Mail size={9} /> {supplier.contact_email}</span>
        )}
        {supplier.contact_phone && (
          <span className="flex items-center gap-1"><Phone size={9} /> {supplier.contact_phone}</span>
        )}
      </div>

      {supplier.tags && supplier.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {supplier.tags.map(tag => (
            <Badge key={tag} variant="default" size="sm" className="text-[9px]">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Project-specific context */}
      <div className="flex items-center gap-3 pt-1 border-t border-border/50 text-[10px] text-text-muted">
        {supplier.project_items != null && (
          <span>{supplier.project_items} item{supplier.project_items !== 1 ? 's' : ''}</span>
        )}
        {supplier.project_spent != null && supplier.project_spent > 0 && (
          <span className="font-mono">{formatCurrency(supplier.project_spent)} spent</span>
        )}
      </div>
    </div>
  )
}

function AddSupplierToProjectDialog({
  projectId, open, onOpenChange,
}: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'select' | 'create'>('select')

  // Existing suppliers
  const { data: allSuppliers } = useQuery({
    queryKey: ['craftplanner', 'suppliers'],
    queryFn: () => apiGet<Supplier[]>('/modules/craftplanner/suppliers'),
    enabled: open,
  })

  // Create form state
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(0)

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost<Supplier>('/modules/craftplanner/suppliers', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-suppliers', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['craftplanner', 'suppliers'] })
      resetForm()
      onOpenChange(false)
    },
  })

  function resetForm() {
    setName(''); setWebsite(''); setEmail(''); setPhone(''); setNotes(''); setRating(0)
    setMode('select')
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate({
      name: name.trim(),
      website: website.trim() || null,
      contact_email: email.trim() || null,
      contact_phone: phone.trim() || null,
      notes: notes.trim() || null,
      rating: rating || null,
      tags: [],
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); onOpenChange(v) }} title="Add Supplier">
      <div className="space-y-3">
        {/* Mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setMode('select')}
            className={`px-2.5 h-6 rounded text-[10px] font-medium border transition-colors ${
              mode === 'select'
                ? 'bg-accent-dim text-accent border-accent/25'
                : 'bg-transparent text-text-faint border-border hover:text-text-muted'
            }`}
          >
            Existing
          </button>
          <button
            onClick={() => setMode('create')}
            className={`px-2.5 h-6 rounded text-[10px] font-medium border transition-colors ${
              mode === 'create'
                ? 'bg-accent-dim text-accent border-accent/25'
                : 'bg-transparent text-text-faint border-border hover:text-text-muted'
            }`}
          >
            Create New
          </button>
        </div>

        {mode === 'select' ? (
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {(allSuppliers ?? []).length === 0 ? (
              <p className="text-[11px] text-text-faint py-4 text-center">No suppliers yet. Create one first.</p>
            ) : (
              (allSuppliers ?? []).map(s => (
                <button
                  key={s.id}
                  className="w-full text-left px-2.5 py-2 rounded border border-border hover:border-accent/30 hover:bg-surface transition-colors flex items-center gap-2"
                  onClick={() => {
                    // For now, just close — supplier linking is primarily through items
                    onOpenChange(false)
                  }}
                >
                  <Store size={12} className="text-text-faint shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-text truncate">{s.name}</div>
                    {s.website && <div className="text-[10px] text-text-faint truncate">{s.website}</div>}
                  </div>
                  {s.rating != null && s.rating > 0 && (
                    <div className="flex gap-px">
                      {Array.from({ length: s.rating }, (_, i) => (
                        <Star key={i} size={8} className="text-warning fill-warning" />
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Supplier name" required autoFocus />
            <Input label="Website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@..." />
              <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1..." />
            </div>
            <div>
              <label className="text-label mb-1 block">Rating</label>
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i + 1 === rating ? 0 : i + 1)}
                    className="p-0.5"
                  >
                    <Star
                      size={14}
                      className={i < rating ? 'text-warning fill-warning' : 'text-text-faint hover:text-warning/50'}
                    />
                  </button>
                ))}
              </div>
            </div>
            <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes about this supplier" rows={2} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Supplier'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  )
}
