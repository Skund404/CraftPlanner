import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPut, apiDelete } from '@/lib/api'
import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Textarea } from '@/components/ui/Input'
import type { Project } from './types'

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [budget, setBudget] = useState(project.budget != null ? String(project.budget) : '')
  const [deadline, setDeadline] = useState(project.deadline ?? '')
  const [tags, setTags] = useState(project.tags.join(', '))

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiPut(`/modules/craftplanner/projects/${project.id}`, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      onOpenChange(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/modules/craftplanner/projects/${project.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', project.id] })
      navigate({ to: '/projects' })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      budget: budget ? parseFloat(budget) : null,
      deadline: deadline || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  function handleDelete() {
    if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
      deleteMutation.mutate()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit Project">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
        <Textarea label="Description" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Budget" type="number" step="0.01" min="0" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00" />
          <Input label="Deadline" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </div>
        <Input label="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)} placeholder="cosplay, armor, wip" />
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={12} /> Delete Project
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" disabled={!name.trim() || updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
