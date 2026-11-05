import { loadOrders, loadSelectedFarmId, saveSelectedFarmId } from '../../subscription/subscriptionStore'
import { farmRows } from './accountFixtures'

export type FarmRole = 'Chủ trại' | 'Quản lý' | 'Kỹ thuật viên'
export type FarmSelection = { farm: string; role: FarmRole }

const DEMO_KEY = 'beefcare-ui-demo'

function readDemo() {
  if (typeof window === 'undefined') return {} as Record<string, unknown>
  try { return JSON.parse(window.localStorage.getItem(DEMO_KEY) || '{}') as Record<string, unknown> } catch { return {} as Record<string, unknown> }
}

export function readFarmSelection(fallbackRole?: FarmRole): FarmSelection {
  const demo = readDemo()
  const account = demo.account && typeof demo.account === 'object' ? demo.account as Record<string, unknown> : {}
  const raw = account['farm-selection']
  if (raw && typeof raw === 'object') {
    const saved = raw as Partial<FarmSelection>
    if (typeof saved.farm === 'string' && typeof saved.role === 'string') return saved as FarmSelection
  }
  const selectedId = loadSelectedFarmId()
  const selected = loadOrders().find((farm) => farm.id === selectedId)
  const fixture = farmRows.find((farm) => farm.name === selected?.name)
    ?? farmRows.find((farm) => farm.statusCode === 'ACTIVE' && farm.role === fallbackRole)
    ?? farmRows[0]
  return { farm: fixture.name, role: fixture.role as FarmRole }
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
