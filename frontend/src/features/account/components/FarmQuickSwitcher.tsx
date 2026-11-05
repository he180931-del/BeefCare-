import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFixtureSession } from '../../../app/fixtureSession'
import { farmRows } from '../data/accountFixtures'
import { fixtureRoleForFarm, landingForFarmRole, readFarmSelection, saveFarmSelection, type FarmRole } from '../data/farmSelectionStore'

type Props = { compact?: boolean; preferredRole?: FarmRole }

/** Fast farm switching is local-preview state today; its persistence boundary lives in farmSelectionStore. */
export function FarmQuickSwitcher({ compact = false, preferredRole }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = useFixtureSession()
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState(() => readFarmSelection(preferredRole))
  const activeFarms = farmRows.filter((farm) => farm.statusCode === 'ACTIVE')
  const selectFarm = (farm: typeof farmRows[number]) => {
    const next = { farm: farm.name, role: farm.role as FarmRole }
    saveFarmSelection(next)
    setSelection(next)
    session.dispatch({ type: 'set-role', role: fixtureRoleForFarm(next.role) })
    setOpen(false)
    navigate(landingForFarmRole(next.role), { state: { switchedFrom: location.pathname + location.search } })
  }
  const currentRole = selection.role
  return <div className="relative shrink-0">
    <button type="button" aria-label={`Đổi trang trại; hiện tại ${selection.farm}, vai trò ${currentRole}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className={compact ? 'grid size-10 cursor-pointer place-items-center rounded-md border border-field bg-white text-brand hover:border-brand hover:bg-ok-bg' : 'flex min-h-10 max-w-[250px] cursor-pointer items-center gap-2 rounded-md border border-field bg-white px-3 text-left text-sm font-bold text-brand-dark hover:border-brand hover:bg-ok-bg'}>
      {compact ? <span aria-hidden>⌂</span> : <><span className="min-w-0 truncate">{selection.farm}</span><span aria-hidden className="ml-auto text-xs text-subtle">{currentRole} · Đổi</span></>}
    </button>
    {open && <div role="menu" aria-label="Đổi trang trại nhanh" className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(22rem,calc(100vw-2rem))] border border-edge bg-white p-1 shadow-lg">
      <p className="m-0 px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-[.08em] text-subtle">Trang trại của bạn</p>
      {activeFarms.map((farm) => <button key={farm.name} type="button" role="menuitem" onClick={() => selectFarm(farm)} className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 border-t border-rule bg-transparent px-3 py-2 text-left hover:bg-ok-bg">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ok-bg text-xs font-bold text-brand">{farm.role === 'Kỹ thuật viên' ? 'KT' : farm.role === 'Quản lý' ? 'QL' : 'CT'}</span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-ink">{farm.name}</strong><span className="block truncate text-xs text-subtle">{farm.role} · {farm.herd}</span></span>
        {farm.name === selection.farm && <span className="text-xs font-semibold text-brand">Đang dùng</span>}
      </button>)}
      <button type="button" role="menuitem" onClick={() => { setOpen(false); navigate('/ui/scr-10', { state: { returnTo: location.pathname + location.search } }) }} className="mt-1 flex min-h-10 w-full cursor-pointer items-center px-3 text-left text-sm font-semibold text-brand hover:bg-page">Quản lý tất cả trang trại</button>
    </div>}
  </div>
}
