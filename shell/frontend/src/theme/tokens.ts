/**
 * TypeScript types for the CraftPlanner theme structure.
 * Matches the ThemeData response from GET /api/settings/theme/data.
 */

export interface ThemeData {
  name: string
  variables: Record<string, string>
}

export const THEME_NAMES = ['workshop-dark', 'daylight', 'high-contrast'] as const
export type ThemeName = typeof THEME_NAMES[number]
