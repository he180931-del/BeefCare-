import type { MemberAction, Membership } from '../types'

const collator = new Intl.Collator('vi', { sensitivity: 'accent' })

/**
 * SCR-13 name order (D29), same as A1: Vietnamese, letter case ignored; a member without a name is ordered by email;
 * then email and id keep equal names stable.
 */
export function compareMembers(a: Membership, b: Membership): number {
  const name = (row: Membership) => row.fullName.trim() || row.email
  return collator.compare(name(a), name(b)) || collator.compare(a.email, b.email) || a.id - b.id
}

/** The Owner's commands on a row now (GBR-18, D29): change role and reactivate need an ACTIVE farm; never on the Owner row. */
export function memberActions(row: Pick<Membership, 'role' | 'status'>, ownerViewer: boolean, farmActive: boolean): MemberAction[] {
  if (!ownerViewer || row.role === 'OWNER') return []
  if (row.status === 'ACTIVE') return farmActive ? ['CHANGE_ROLE', 'DEACTIVATE'] : ['DEACTIVATE']
  return farmActive ? ['REACTIVATE'] : []
}
