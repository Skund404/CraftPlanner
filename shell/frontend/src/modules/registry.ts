/**
 * Module registry — CraftPlanner ships a single inline module.
 *
 * The shell's main.tsx calls registerAllModules() before first render.
 */

import { registerCraftPlannerModule } from '@craftplanner-module'

export function registerAllModules(): void {
  registerCraftPlannerModule()
}
