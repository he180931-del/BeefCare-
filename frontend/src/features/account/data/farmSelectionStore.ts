import { loadOrders, loadSelectedFarmId, saveSelectedFarmId } from '../../subscription/subscriptionStore'
import { farmsForMember, type FarmMemberRole } from './accountFixtures'

export type FarmRole = FarmMemberRole
export type FarmSelection = { farm: string; role: FarmRole }

const DEMO_KEY = 'beefcare-ui-demo'

function readDemo() {
  if (typeof window === 'undefined') return {} as Record<string, unknown>
  try { return JSON.parse(window.localStorage.getItem(DEMO_KEY) || '{}') as Record<string, unknown> } catch { return {} as Record<string, unknown> }
}

function isFarmRole(value: unknown): value is FarmRole {
  return value === 'Chủ trại' || value === 'Quản lý' || value === 'Kỹ thuật viên'
}

export function selectableFarmsForRole(role: FarmRole) {
  return farmsForMember(role)
}

export function readFarmSelection(fallbackRole?: FarmRole): FarmSelection {
  const demo = readDemo()
  const account = demo.account && typeof demo.account === 'object' ? demo.account as Record<string, unknown> : {}
  const raw = account['farm-selection']
  const saved = raw && typeof raw === 'object' ? raw as Partial<FarmSelection> : undefined
  const selectedRole = fallbackRole ?? (isFarmRole(saved?.role) ? saved.role : 'Chủ trại')
  const candidates = selectableFarmsForRole(selectedRole)
  const savedFarm = typeof saved?.farm === 'string' ? candidates.find((farm) => farm.name === saved.farm) : undefined
  const selectedId = loadSelectedFarmId()
  const selected = loadOrders().find((farm) => farm.id === selectedId)
  const fixture = savedFarm
    ?? candidates.find((farm) => farm.name === selected?.name)
    ?? candidates.find((farm) => farm.statusCode === 'ACTIVE')
    ?? candidates[0]
  return { farm: fixture?.name ?? 'Trại bò Ba Vì', role: fixture?.role ?? selectedRole }
}

export function saveFarmSelection(selection: FarmSelection) {
  if (typeof window !== 'undefined') {
    try {
      const current = readDemo()
      const account = current.account && typeof current.account === 'object' ? current.account as Record<string, unknown> : {}
      window.localStorage.setItem(DEMO_KEY, JSON.stringify({ ...current, account: { ...account, 'farm-selection': selection } }))
    } catch { /* preview persistence is best effort */ }
  }
  const order = loadOrders().find((farm) => farm.name === selection.farm)
  if (order) saveSelectedFarmId(order.id)
}

export function fixtureRoleForFarm(role: FarmRole) {
  return role === 'Kỹ thuật viên' ? 'technician' : role === 'Quản lý' ? 'manager' : 'owner'
}

export function landingForFarmRole(role: FarmRole) {
  return role === 'Kỹ thuật viên' ? '/ui/scr-104' : '/ui/scr-77'
}
