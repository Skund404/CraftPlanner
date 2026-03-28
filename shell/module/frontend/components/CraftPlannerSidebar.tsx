/**
 * CraftPlannerSidebar — custom sidebar replacing the generic ModuleAppSidebar.
 *
 * Provides structured navigation sections (Overview, Catalogue, Occasions),
 * a QuickLogWidget for time tracking, and pinned Settings at the bottom.
 */
import {
  ArrowLeft,
  LayoutDashboard,
  FolderKanban,
  ShoppingCart,
  Hammer,
  Box,
  BookOpen,
  GitFork,
  Calendar,
  Settings,
} from 'lucide-react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { AppModeConfig } from '@/modules/app-registry'
import { QuickLogWidget } from './QuickLogWidget'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CraftPlannerSidebarProps {
  config: AppModeConfig
}

interface NavEntry {
  id: string
  label: string
  icon: React.ReactNode
  route: string
  /** For catalogue items: match against `?type=` search param */
  catalogueType?: string
}

/* ------------------------------------------------------------------ */
/*  Nav data                                                           */
/* ------------------------------------------------------------------ */

const OVERVIEW: NavEntry[] = [
  { id: 'dashboard',     label: 'Dashboard',     icon: <LayoutDashboard size={14} />, route: '/dashboard' },
  { id: 'projects',      label: 'Projects',      icon: <FolderKanban size={14} />,    route: '/projects' },
  { id: 'shopping-list', label: 'Shopping List',  icon: <ShoppingCart size={14} />,    route: '/shopping-list' },
]

const CATALOGUE: NavEntry[] = [
  { id: 'materials',  label: 'Materials',  icon: <Box size={14} />,       route: '/catalogue', catalogueType: 'material' },
  { id: 'tools',      label: 'Tools',      icon: <Hammer size={14} />,    route: '/catalogue', catalogueType: 'tool' },
  { id: 'techniques', label: 'Techniques', icon: <BookOpen size={14} />,   route: '/catalogue', catalogueType: 'technique' },
  { id: 'workflows',  label: 'Workflows',  icon: <GitFork size={14} />,   route: '/catalogue', catalogueType: 'workflow' },
]

const OCCASIONS: NavEntry[] = [
  { id: 'events', label: 'Events', icon: <Calendar size={14} />, route: '/events' },
]

/* ------------------------------------------------------------------ */
/*  NavItem                                                            */
/* ------------------------------------------------------------------ */

function NavItem({ entry }: { entry: NavEntry }) {
  const loc = useLocation()

  const isActive = (() => {
    if (entry.catalogueType) {
      // Catalogue items: pathname must be /catalogue and ?type must match
      if (loc.pathname !== '/catalogue' && !loc.pathname.startsWith('/catalogue/')) return false
      const params = new URLSearchParams(loc.search)
      return params.get('type') === entry.catalogueType
    }
    return loc.pathname === entry.route || loc.pathname.startsWith(entry.route + '/')
  })()

  const to = entry.catalogueType ? `${entry.route}?type=${entry.catalogueType}` : entry.route

  return (
    <Link to={to as never} className="block">
      <span
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors w-full',
        )}
        style={{
          backgroundColor: isActive ? 'rgba(212,145,92,0.15)' : 'transparent',
          color: isActive ? '#e8ddd0' : 'rgba(255,255,255,0.45)',
        }}
      >
        {entry.icon}
        <span className="flex-1 truncate">{entry.label}</span>
      </span>
    </Link>
  )
}

/* ------------------------------------------------------------------ */
/*  SectionLabel                                                       */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[9px] uppercase font-medium px-3.5 pt-4 pb-1.5"
      style={{ letterSpacing: '0.15em', color: 'var(--color-text-faint, rgba(255,255,255,0.25))' }}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

export function CraftPlannerSidebar({ config }: CraftPlannerSidebarProps) {
  const navigate = useNavigate()

  // Retrieve the originating workshop from sessionStorage
  const workshopId = (() => {
    try { return sessionStorage.getItem('app-mode-workshop-id') ?? '' } catch { return '' }
  })()
  const workshopName = (() => {
    try { return sessionStorage.getItem('app-mode-workshop-name') ?? 'Workshop' } catch { return 'Workshop' }
  })()

  const handleBack = () => {
    if (workshopId) {
      void navigate({ to: '/workshop/$id', params: { id: workshopId } })
    } else {
      void navigate({ to: '/workshops' })
    }
  }

  const { theme } = config

  return (
    <aside
      className="shrink-0 h-full flex flex-col"
      style={{
        width: 240,
        backgroundColor: theme?.sidebar_bg || '#15100b',
      }}
    >
      {/* Back link */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] cursor-pointer border-b transition-colors"
        style={{
          color: 'rgba(255,255,255,0.3)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <ArrowLeft size={11} />
        <span className="truncate">{workshopName}</span>
      </button>

      {/* Branding */}
      <div className="px-3.5 pt-4 pb-3" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
        <div
          className="text-[23px] leading-none"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: theme?.sidebar_text || '#eddec8',
            letterSpacing: '0.02em',
          }}
        >
          CraftPlanner
        </div>
        <div
          className="text-[10px] mt-1"
          style={{
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          Project Management
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-1.5">
        <SectionLabel>Overview</SectionLabel>
        <div className="space-y-0.5">
          {OVERVIEW.map((entry) => (
            <NavItem key={entry.id} entry={entry} />
          ))}
        </div>

        <SectionLabel>Catalogue</SectionLabel>
        <div className="space-y-0.5">
          {CATALOGUE.map((entry) => (
            <NavItem key={entry.id} entry={entry} />
          ))}
        </div>

        <SectionLabel>Occasions</SectionLabel>
        <div className="space-y-0.5">
          {OCCASIONS.map((entry) => (
            <NavItem key={entry.id} entry={entry} />
          ))}
        </div>
      </nav>

      {/* Divider + QuickLogWidget */}
      <QuickLogWidget />

      {/* Settings — pinned to bottom */}
      <div className="px-1.5 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Link to={'/settings' as never} className="block mt-1.5">
          <span
            className="flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors w-full"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            <Settings size={14} />
            <span className="flex-1 truncate">Settings</span>
          </span>
        </Link>
      </div>
    </aside>
  )
}
