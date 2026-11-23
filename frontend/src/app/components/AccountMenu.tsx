import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../session/sessionContext'
import { Icon, UserIdentity } from '../../shared/ui'

const initialsOf = (fullName: string) => {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return ''
  const first = words[0].charAt(0)
  return (words.length > 1 ? first + words[words.length - 1].charAt(0) : first).toLocaleUpperCase('vi')
}

export function AccountMenu({ fallbackName, fallbackInitials, fallbackRole }: {
  fallbackName?: string
  fallbackInitials?: string
  fallbackRole?: string
}) {
  const session = useSession()
  const [open, setOpen] = useState(false)
  const name = session?.fullName ?? fallbackName ?? ''
  const initials = (session ? initialsOf(session.fullName) : fallbackInitials) || ''
  const role = fallbackRole ?? session?.role ?? ''

  if (!name) return null

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}${role ? `, ${role}` : ''}`}
        onClick={() => setOpen((value) => !value)}
        className="max-w-[220px] cursor-pointer border-0 bg-transparent p-0 text-left shadow-none"
      >
        <UserIdentity initials={initials} name={name} nameClassName="font-bold" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[52px] z-40 w-[200px] rounded-md border border-edge bg-white py-1 text-xs shadow-md">
          <Link role="menuitem" to="/tai-khoan" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-ink no-underline hover:bg-page">
            <Icon name="user-circle" />Hồ sơ của tôi
          </Link>
          {session && (
            <button role="menuitem" type="button" onClick={() => { setOpen(false); void session.logout() }} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-err-fg hover:bg-page">
              <Icon name="logout" />Đăng xuất
            </button>
          )}
        </div>
      )}
    </div>
  )
}
