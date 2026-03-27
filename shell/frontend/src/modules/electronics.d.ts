/**
 * Type declarations for the @electronics-frontend module alias.
 *
 * The alias is resolved by Vite at build/dev time (see vite.config.ts).
 * This file tells TypeScript the module's public surface so registry.ts
 * can import from it without errors.
 */
declare module '@electronics-frontend' {
  export function registerElectronicsModule(): void
}
