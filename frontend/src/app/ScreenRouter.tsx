import type { ScreenDefinition, ScreenRole } from './screenManifest'
import { screenById } from './screenManifest'

export function screenOwner(screen: ScreenDefinition): ScreenDefinition {
  if (!screen.parentId) return screen
  const parent = screenById(screen.parentId)
  return parent ? screenOwner(parent) : screen
}

export function routeForScreen(screen: ScreenDefinition, _role?: ScreenRole): string {
  return screen.route || screenOwner(screen).route
}

export function reviewPath(screen: ScreenDefinition): string {
  return `/ui/${screen.id.toLowerCase()}`
}
