import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiUpload, apiDelete } from '@/lib/api'
import { Plus, ImageIcon, X, ChevronLeft, ChevronRight, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import type { Photo } from './types'
import { formatDate } from './helpers'

export function GalleryTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')

  const { data: photos, isLoading } = useQuery({
    queryKey: ['project-photos', projectId],
    queryFn: () => apiGet<Photo[]>('/modules/craftplanner/photos', { project_id: String(projectId) }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/modules/craftplanner/photos/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] })
      setLightboxIdx(null)
    },
  })

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('project_id', String(projectId))
        if (caption.trim()) formData.append('caption', caption.trim())
        await apiUpload('/modules/craftplanner/photos', formData)
      }
      void queryClient.invalidateQueries({ queryKey: ['project-photos', projectId] })
      setCaption('')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (isLoading) {
    return <div className="py-10 text-center text-[12px] text-text-faint">Loading gallery...</div>
  }

  const list = photos ?? []

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center justify-between px-0.5">
        <div className="text-label">Gallery ({list.length})</div>
        <div className="flex items-center gap-2">
          <Input
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="h-6 text-[11px] w-36"
          />
          <Button
            variant="secondary"
            size="xs"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <span className="animate-pulse">Uploading...</span>
            ) : (
              <><Upload size={10} /> Upload</>
            )}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {list.length === 0 ? (
        <div className="text-center py-8">
          <ImageIcon size={22} className="mx-auto text-text-faint mb-2" />
          <p className="text-[12px] text-text-muted">No photos yet.</p>
          <p className="text-[11px] text-text-faint mt-1">Capture your progress — upload photos of your work.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-1.5">
          {list.map((photo, idx) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIdx(idx)}
              className="relative aspect-square rounded overflow-hidden border border-border hover:border-accent/30 transition-colors group"
            >
              <img
                src={`/api/modules/craftplanner/photos/file/${photo.file_path.split('/').pop()}`}
                alt={photo.caption || ''}
                className="w-full h-full object-cover"
              />
              {photo.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[9px] text-white line-clamp-2">{photo.caption}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && list[lightboxIdx] && (
        <LightboxDialog
          photos={list}
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onDelete={id => deleteMutation.mutate(id)}
        />
      )}
    </div>
  )
}

function LightboxDialog({
  photos, index, onIndexChange, onClose, onDelete,
}: {
  photos: Photo[]
  index: number
  onIndexChange: (idx: number) => void
  onClose: () => void
  onDelete: (id: number) => void
}) {
  const photo = photos[index]
  if (!photo) return null

  function prev() {
    onIndexChange(index > 0 ? index - 1 : photos.length - 1)
  }
  function next() {
    onIndexChange(index < photos.length - 1 ? index + 1 : 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') prev()
    else if (e.key === 'ArrowRight') next()
    else if (e.key === 'Escape') onClose()
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose() }} title="">
      <div
        className="flex flex-col items-center gap-3 -mt-4"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="relative w-full max-h-[60vh] flex items-center justify-center">
          <img
            src={`/api/modules/craftplanner/photos/file/${photo.file_path.split('/').pop()}`}
            alt={photo.caption || ''}
            className="max-w-full max-h-[60vh] object-contain rounded"
          />

          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={next}
                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between w-full text-[11px]">
          <div className="flex-1 min-w-0">
            {photo.caption && <p className="text-text">{photo.caption}</p>}
            <p className="text-[10px] text-text-faint">{formatDate(photo.created_at)} &middot; {index + 1}/{photos.length}</p>
          </div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onDelete(photo.id)}
            className="text-danger hover:text-danger"
          >
            <Trash2 size={10} /> Delete
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
