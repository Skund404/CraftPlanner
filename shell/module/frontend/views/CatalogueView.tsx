/**
 * CatalogueView — wraps the shell's existing catalogue routes.
 *
 * In app mode, the catalogue (materials, tools, techniques, workflows, etc.)
 * is accessed via the sidebar. This view simply renders the shell's CatalogueIndex
 * component directly.
 */
import { CatalogueIndex } from '@/routes/catalogue/index'

export function CatalogueView() {
  return <CatalogueIndex initialType="" />
}
