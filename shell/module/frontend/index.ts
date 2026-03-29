/**
 * CraftPlanner module frontend — registration entry point.
 *
 * Called by registerAllModules() in main.tsx before first render.
 * Registers views, panels, and app mode for the standalone PM experience.
 */
import { registerView } from '@/modules/view-registry'
import { registerPanel } from '@/modules/panel-registry'
import { registerAppMode } from '@/modules/app-registry'

import { DashboardView } from './views/DashboardView'
import { ProjectsView } from './views/ProjectsView'
import { ProjectDetailView } from './views/project-detail'
import { EventsView } from './views/EventsView'
import { SettingsView } from './views/SettingsView'
import { CatalogueView } from './views/CatalogueView'
import { ShoppingListView } from './views/ShoppingListView'
import { SuppliersView } from './views/SuppliersView'

import { ActiveProjectsPanel } from './components/ActiveProjectsPanel'
import { UpcomingEventsPanel } from './components/UpcomingEventsPanel'
import { CraftPlannerSidebar } from './components/CraftPlannerSidebar'

export function registerCraftPlannerModule(): void {
  // Views
  registerView('/dashboard', DashboardView)
  registerView('/projects', ProjectsView)
  registerView('/projects/:id', ProjectDetailView)
  registerView('/projects/:id/:tab', ProjectDetailView)
  registerView('/events', EventsView)
  registerView('/settings', SettingsView)
  registerView('/catalogue', CatalogueView)
  registerView('/shopping-list', ShoppingListView)
  registerView('/suppliers', SuppliersView)

  // Panels
  registerPanel('craftplanner-active-projects', ActiveProjectsPanel)
  registerPanel('craftplanner-upcoming-events', UpcomingEventsPanel)

  // App mode — always active, this IS the app
  registerAppMode({
    module_name: 'craftplanner',
    title: 'CraftPlanner',
    subtitle: 'Project Management',
    sidebar_width: 240,
    home_route: '/dashboard',
    nav_items: [
      { id: 'craftplanner-dashboard', label: 'Dashboard', icon: 'LayoutDashboard', route: '/dashboard' },
      { id: 'craftplanner-projects', label: 'Projects', icon: 'FolderKanban', route: '/projects' },
      { id: 'craftplanner-shopping-list', label: 'Shopping List', icon: 'ShoppingCart', route: '/shopping-list' },
      { id: 'craftplanner-catalogue', label: 'Catalogue', icon: 'Library', route: '/catalogue' },
      { id: 'craftplanner-suppliers', label: 'Suppliers', icon: 'Store', route: '/suppliers' },
      { id: 'craftplanner-events', label: 'Events', icon: 'Calendar', route: '/events' },
      { id: 'craftplanner-settings', label: 'Settings', icon: 'Settings', route: '/settings' },
    ],
    theme: {
      sidebar_bg: '#110e0a',
      sidebar_text: '#e8ddd0',
      sidebar_active_bg: 'rgba(212, 145, 92, 0.15)',
      accent: '#d4915c',
    },
    custom_sidebar: CraftPlannerSidebar,
  })
}
