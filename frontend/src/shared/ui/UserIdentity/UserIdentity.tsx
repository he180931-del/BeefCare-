type UserIdentityProps = {
  name: string
  initials: string
  nameClassName?: string
}

/** Shared avatar/name pill used by the account page and authenticated app header. */
export function UserIdentity({ name, initials, nameClassName = '' }: UserIdentityProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-field bg-white py-1 pl-1 pr-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-dark text-xs font-bold text-white">{initials}</span>
      <span className={`min-w-0 truncate text-xs font-semibold text-ink ${nameClassName}`}>{name}</span>
    </span>
  )
}
