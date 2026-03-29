import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { Plus, Store, Star, Globe, Mail, Phone, Search, Trash2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'

interface Supplier {
  id: number
  name: string
  website: string | null
  contact_email: string | null
  contact_phone: string | null
  address: string | null
  notes: string | null
  rating: number | null
  tags: string[]
  created_at: string
  updated_at: string
}

export function SuppliersView() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['craftplanner', 'suppliers'],
    queryFn: () => apiGet<Supplier[]>('/modules/craftplanner/suppliers'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/suppliers/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner', 'suppliers'] })
    },
  })

  const list = (suppliers ?? []).filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
      || s.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display text-text">Suppliers</h1>
        <Button variant="primary" size="xs" onClick={() => setShowCreate(true)}>
          <Plus size={10} /> New Supplier
        </Button>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search suppliers..."
          className="w-full h-8 pl-8 pr-3 rounded border border-border bg-surface text-[12px] text-text placeholder:text-text-faint/50 focus:outline-none focus:border-accent/40"
        />
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-[12px] text-text-faint">Loading suppliers...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <Store size={28} className="mx-auto text-text-faint mb-3" />
          <p className="text-[13px] text-text-muted">
            {search ? 'No suppliers match your search.' : 'No suppliers yet.'}
          </p>
          {!search && (
            <p className="text-[11px] text-text-faint mt-1">Add suppliers to track where you buy materials and tools.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {list.map(supplier => (
            <div
              key={supplier.id}
              className="rounded border border-border bg-surface p-4 space-y-2.5 hover:border-border-bright transition-colors group"
            >
              <div className="flex items-start justify-between">
                <h3 className="text-[14px] font-medium text-text">{supplier.name}</h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(supplier)}
                    className="p-1 text-text-faint hover:text-text-muted"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${supplier.name}"?`)) deleteMutation.mutate(supplier.id)
                    }}
                    className="p-1 text-text-faint hover:text-danger"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              {supplier.rating != null && supplier.rating > 0 && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={11}
                      className={i < supplier.rating! ? 'text-warning fill-warning' : 'text-text-faint'}
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1 text-[11px] text-text-faint">
                {supplier.website && (
                  <a
                    href={supplier.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 hover:text-accent transition-colors truncate"
                  >
                    <Globe size={10} /> {supplier.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {supplier.contact_email && (
                  <span className="flex items-center gap-1"><Mail size={10} /> {supplier.contact_email}</span>
                )}
                {supplier.contact_phone && (
                  <span className="flex items-center gap-1"><Phone size={10} /> {supplier.contact_phone}</span>
                )}
                {supplier.address && (
                  <span className="text-text-faint">{supplier.address}</span>
                )}
              </div>

              {supplier.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {supplier.tags.map(tag => (
                    <Badge key={tag} variant="default" size="sm" className="text-[9px]">{tag}</Badge>
                  ))}
                </div>
              )}

              {supplier.notes && (
                <p className="text-[11px] text-text-muted line-clamp-2 italic">{supplier.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <SupplierFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="New Supplier"
      />
      {editing && (
        <SupplierFormDialog
          open={!!editing}
          onOpenChange={v => { if (!v) setEditing(null) }}
          title="Edit Supplier"
          supplier={editing}
        />
      )}
    </div>
  )
}

function SupplierFormDialog({
  open, onOpenChange, title, supplier,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  supplier?: Supplier
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(supplier?.name ?? '')
  const [website, setWebsite] = useState(supplier?.website ?? '')
  const [email, setEmail] = useState(supplier?.contact_email ?? '')
  const [phone, setPhone] = useState(supplier?.contact_phone ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [tags, setTags] = useState(supplier?.tags.join(', ') ?? '')
  const [rating, setRating] = useState(supplier?.rating ?? 0)

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      supplier
        ? apiPut(`/modules/craftplanner/suppliers/${supplier.id}`, data)
        : apiPost('/modules/craftplanner/suppliers', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['craftplanner', 'suppliers'] })
      onOpenChange(false)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate({
      name: name.trim(),
      website: website.trim() || null,
      contact_email: email.trim() || null,
      contact_phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      rating: rating || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Supplier name" required autoFocus />
        <Input label="Website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..." />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@..." />
          <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1..." />
        </div>
        <Input label="Address" value={address} onChange={e => setAddress(e.target.value)} placeholder="City, state..." />
        <Input label="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} placeholder="leather, hardware, fabric" />
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
                  size={16}
                  className={i < rating ? 'text-warning fill-warning' : 'text-text-faint hover:text-warning/50'}
                />
              </button>
            ))}
          </div>
        </div>
        <Textarea label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes about this supplier" rows={2} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Saving...' : supplier ? 'Save Changes' : 'Create Supplier'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
