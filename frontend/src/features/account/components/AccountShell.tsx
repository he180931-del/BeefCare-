import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../../app/session/sessionContext'
import logo from '../../../shared/assets/logo.png'
import wave from '../../../shared/assets/wave.png'
import { Icon } from '../../../shared/ui'
import { AccountMenu } from '../../../app/components/AccountMenu'

export function AccountShell({ active, children }: { active: 'profile' | 'permissions'; children: ReactNode }) {
  const session = useSession()
  const needsFarm = session != null && ['OWNER', 'MANAGER', 'TECHNICIAN'].includes(session.role) && session.farmId == null
  const navClass = (selected: boolean) => `flex min-w-max items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold no-underline md:min-w-0 md:w-full ${selected ? 'bg-side-active text-white' : 'text-side-text hover:bg-white/10 hover:text-white'}`

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f8f5] text-[#173629]">
      <img src={wave} alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[360px] w-full object-cover opacity-65" />
      <header className="relative z-10 border-b border-white/60 bg-white/85 backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-base font-bold text-brand-dark no-underline">
            <img src={logo} alt="" className="size-10 rounded-[10px] object-cover" />
            BeefCare
          </Link>
          <div className="flex-1" />
          <Link to={needsFarm ? '/chon-trai' : '/'} className="hidden rounded-lg px-3 py-2 text-sm font-bold text-brand no-underline hover:bg-page sm:inline-flex">
            {needsFarm ? 'Về trại' : 'Về ứng dụng'}
          </Link>
          <AccountMenu />
        </div>
      </header>
      <main className="relative z-[1] px-4 py-8 sm:px-6 sm:py-12 md:h-[calc(100vh-73px)] md:overflow-hidden md:py-0">
        <div className="mx-auto max-w-[1240px] md:grid md:h-full md:grid-cols-[220px_minmax(0,1fr)] md:items-stretch md:gap-8 lg:gap-10">
          <aside className="mb-6 min-w-0 md:mb-0 md:h-full md:py-12">
            <nav aria-label="Tài khoản" className="flex gap-2 overflow-x-auto rounded-2xl border border-side-active bg-side p-2 shadow-sm md:h-full md:w-[220px] md:flex-col md:overflow-visible md:px-3 md:pb-3 md:pt-2">
              <h2 className="hidden px-3.5 pb-2 pt-1 text-base font-bold leading-6 text-white md:block">Tài khoản &amp; phân quyền</h2>
              <Link to="/tai-khoan" aria-current={active === 'profile' ? 'page' : undefined} className={navClass(active === 'profile')}>
                <Icon name="user-circle" size={18} />
                Hồ sơ
              </Link>
              <Link to="/quyen-theo-vai-tro" aria-current={active === 'permissions' ? 'page' : undefined} className={navClass(active === 'permissions')}>
                <Icon name="shield-lock" size={18} />
                Quyền theo vai trò
              </Link>
            </nav>
          </aside>
          <div className="min-w-0 md:h-full md:overflow-y-auto md:py-12 md:pr-2">{children}</div>
        </div>
      </main>
    </div>
  )
}
