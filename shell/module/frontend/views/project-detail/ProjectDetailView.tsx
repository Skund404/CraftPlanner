import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
import { useParams, useNavigate } from '@tanstack/react-router'
import { Tabs, TabContent } from '@/components/ui/Tabs'
import type { Project, ProjectProgress } from './types'

import { ProjectHeader } from './ProjectHeader'
import { ActionBar } from './ActionBar'
import { ItemsTab } from './ItemsTab'
import { TasksTab } from './TasksTab'
import { BudgetTab } from './BudgetTab'
import { TimeLogTab } from './TimeLogTab'
import { EventsTab } from './EventsTab'
import { SuppliersTab } from './SuppliersTab'
import { GalleryTab } from './GalleryTab'
import { NotesTab } from './NotesTab'
import { AddItemDialog } from './AddItemDialog'
import { EditProjectDialog } from './EditProjectDialog'

const TABS = [
  { value: 'items', label: 'Items' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'budget', label: 'Budget' },
  { value: 'timelog', label: 'Time Log' },
  { value: 'events', label: 'Events' },
  { value: 'suppliers', label: 'Suppliers' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'notes', label: 'Notes' },
]

export function ProjectDetailView({ id }: { id: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const projectId = parseInt(id)

  const params = useParams({ strict: false }) as Record<string, string | undefined>
  const currentTab = params.tab ?? 'items'

  // Dialog state
  const [showAddItem, setShowAddItem] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)

  /* ---------- Queries ---------- */

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiGet<Project>(`/modules/craftplanner/projects/${projectId}`),
  })

  const { data: progress } = useQuery({
    queryKey: ['project-progress', projectId],
    queryFn: () => apiGet<ProjectProgress>(`/modules/craftplanner/projects/${projectId}/progress`),
  })

  /* ---------- Mutations ---------- */

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      apiPut(`/modules/craftplanner/projects/${projectId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
    },
  })

  const toggleItem = useMutation({
    mutationFn: ({ itemId, status }: { itemId: number; status: string }) =>
      apiPut(`/modules/craftplanner/items/${itemId}`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
    },
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => apiDelete(`/modules/craftplanner/items/${itemId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      void queryClient.invalidateQueries({ queryKey: ['project-progress', projectId] })
    },
  })

  /* ---------- Handlers ---------- */

  function handleToggleItem(itemId: number, currentStatus: string) {
    toggleItem.mutate({ itemId, status: currentStatus === 'completed' ? 'pending' : 'completed' })
  }

  function handleDeleteItem(itemId: number) {
    deleteItem.mutate(itemId)
  }

  function handleTabChange(tab: string) {
    navigate({ to: `/projects/${id}/${tab}` as never })
  }

  /* ---------- Loading ---------- */

  if (isLoading || !project) {
    return (
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 bg-surface rounded" />
          <div className="h-8 w-64 bg-surface rounded" />
          <div className="h-4 w-96 bg-surface rounded" />
          <div className="flex gap-3 mt-6">
            <div className="flex-1 h-20 bg-surface rounded-lg" />
            <div className="flex-1 h-20 bg-surface rounded-lg" />
            <div className="flex-1 h-20 bg-surface rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Render ---------- */

  return (
    <div className="max-w-5xl mx-auto flex flex-col min-h-full">
      <ProjectHeader
        project={project}
        progress={progress ?? null}
        onEdit={() => setShowEditProject(true)}
        onChangeStatus={s => updateStatus.mutate(s)}
        isStatusPending={updateStatus.isPending}
      />

      <div className="flex-1 flex flex-col min-h-0 px-6">
        <Tabs tabs={TABS} value={currentTab} onValueChange={handleTabChange}>
          <TabContent value="items" className="flex-1 overflow-y-auto focus:outline-none">
            <ItemsTab
              items={project.items}
              projectId={projectId}
              onToggleItem={handleToggleItem}
              onDeleteItem={handleDeleteItem}
            />
          </TabContent>
          <TabContent value="tasks" className="flex-1 overflow-y-auto focus:outline-none">
            <TasksTab
              items={project.items}
              onToggleItem={handleToggleItem}
              onDeleteItem={handleDeleteItem}
            />
          </TabContent>
          <TabContent value="budget" className="flex-1 overflow-y-auto focus:outline-none">
            <BudgetTab projectId={projectId} budget={project.budget} />
          </TabContent>
          <TabContent value="timelog" className="flex-1 overflow-y-auto focus:outline-none">
            <TimeLogTab projectId={projectId} items={project.items} />
          </TabContent>
          <TabContent value="events" className="flex-1 overflow-y-auto focus:outline-none">
            <EventsTab projectId={projectId} />
          </TabContent>
          <TabContent value="suppliers" className="flex-1 overflow-y-auto focus:outline-none">
            <SuppliersTab projectId={projectId} />
          </TabContent>
          <TabContent value="gallery" className="flex-1 overflow-y-auto focus:outline-none">
            <GalleryTab projectId={projectId} />
          </TabContent>
          <TabContent value="notes" className="flex-1 overflow-y-auto focus:outline-none">
            <NotesTab projectId={projectId} notes={project.notes ?? null} />
          </TabContent>
        </Tabs>
      </div>

      <ActionBar
        projectId={projectId}
        onAddItem={() => setShowAddItem(true)}
        onLogTime={() => handleTabChange('timelog')}
        onAddCost={() => handleTabChange('budget')}
      />

      <AddItemDialog projectId={projectId} open={showAddItem} onOpenChange={setShowAddItem} />
      {showEditProject && (
        <EditProjectDialog project={project} open={showEditProject} onOpenChange={setShowEditProject} />
      )}
    </div>
  )
}
