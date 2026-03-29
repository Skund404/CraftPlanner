export interface Project {
  id: number
  name: string
  description: string
  status: string
  budget: number | null
  deadline: string | null
  completion_pct: number
  tags: string[]
  primitive_path: string | null
  notes: string
  cover_image: string
  items: ProjectItem[]
  created_at: string
  updated_at: string
}

export interface ProjectItem {
  id: number
  project_id: number
  name: string
  description: string
  item_type: 'buy' | 'make' | 'task'
  status: string
  estimated_cost: number | null
  actual_cost: number | null
  estimated_time_minutes: number | null
  actual_time_minutes: number
  quantity: number
  unit: string
  primitive_path: string | null
  sort_order: number
}

export interface ProjectProgress {
  total_items: number
  completed_items: number
  completion_pct: number
  estimated_cost: number
  actual_cost: number
  cost_spent: number
  estimated_time_minutes: number
  actual_time_minutes: number
}

export interface CostEntry {
  id: number
  project_id: number
  item_id: number | null
  category: string
  description: string
  amount: number
  currency: string
  is_estimate: number
  receipt_ref: string | null
  supplier_id: number | null
  supplier_name: string | null
  created_at: string
}

export interface CostData {
  project_id: number
  entries: CostEntry[]
  total_estimated: number
  total_actual: number
}

export interface TimeLog {
  id: number
  item_id: number
  project_id: number
  minutes: number
  note: string
  logged_at: string
  item_name?: string
}

export interface CraftEvent {
  id: number
  project_id: number | null
  name: string
  description: string
  event_date: string | null
  location: string
  rating: number | null
  notes: string
  tags: string[]
  created_at: string
}

export interface Supplier {
  id: number
  name: string
  website: string
  contact_email: string
  contact_phone: string
  address: string
  notes: string
  rating: number | null
  tags: string[]
  project_items?: { id: number; name: string }[]
  project_spent?: number
  created_at: string
  updated_at: string
}

export interface Photo {
  id: number
  project_id: number
  item_id: number | null
  caption: string
  file_path: string
  created_at: string
}

export interface NotesData {
  client: string
  construction: string
  lessons: string
  general: string
}
