import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { Supplier } from './types'

const ITEM_TYPE_OPTIONS = [
  { value: 'make', label: 'Make' },
  { value: 'buy', label: 'Buy' },
  { value: 'task', label: 'Task' },
]

export function AddItemDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [itemType, setItemType] = useState('make')
  const [description, setDescription] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [estimatedTime, setEstimatedTime] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('')
  const [supplierId, setSupplierId] = useState('')

  const { data: suppliers } = useQuery({
    queryKey: ['craftplanner', 'suppliers'],
    queryFn: () => apiGet<Supplier[]>('/modules/craftplanner/suppliers'),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPost('/modules/craftplanner/items', data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
      resetForm()
      onOpenChange(false)
    },
  })

  function resetForm() {
    setName(''); setItemType('make'); setDescription(''); setEstimatedCost('')
    setEstimatedTime(''); setQuantity('1'); setUnit(''); setSupplierId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    mutation.mutate({
      project_id: projectId,
      name: name.trim(),
      item_type: itemType,
      description: description.trim(),
      estimated_cost: estimatedCost ? parseFloat(estimatedCost) : null,
      estimated_time_minutes: estimatedTime ? parseInt(estimatedTime) : null,
      quantity: quantity ? parseInt(quantity) : 1,
      unit: unit.trim(),
      supplier_id: supplierId ? parseInt(supplierId) : null,
    })
  }

  const supplierOptions = [
    { value: '', label: 'No supplier' },
    ...(suppliers ?? []).map(s => ({ value: String(s.id), label: s.name })),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add Item">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Item name" required autoFocus />
        <Select label="Type" value={itemType} onValueChange={setItemType} options={ITEM_TYPE_OPTIONS} />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Estimated Cost" type="number" step="0.01" min="0" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} placeholder="0.00" />
          <Input label="Estimated Time (min)" type="number" min="0" value={estimatedTime} onChange={e => setEstimatedTime(e.target.value)} placeholder="0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
          <Input label="Unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="pcs, yards, etc." />
        </div>
        {itemType === 'buy' && (
          <Select label="Supplier" value={supplierId} onValueChange={setSupplierId} options={supplierOptions} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending ? 'Adding...' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
