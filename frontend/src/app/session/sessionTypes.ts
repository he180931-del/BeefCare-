/** Facts supplied by the authenticated profile; authorization owns policies that interpret them. */
export type FarmRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type PlatformRole = 'CS' | 'PM' | 'SA'
export type AppRole = FarmRole | PlatformRole

export interface SessionFarm {
  id: number
  name: string
  role: FarmRole
  serviceStatus: string
}

export interface SessionUser {
  /** ID tài khoản do backend cấp; dùng cho các kiểm tra quyền theo người được giao. */
  id?: number
  role: AppRole
  fullName: string
  email: string
  farmId: number | null
  farmName: string | null
  /** Server-authoritative onboarding and membership facts used only for initial routing. */
  ownerRegistrationCompleted?: boolean
  googleSignInLinked?: boolean
  termsAccepted?: boolean
  platformRole?: PlatformRole | null
  activeFarmCount?: number
  /** Every farm the account belongs to, whatever its service status. */
  farmCount?: number
  /** The account's role in each of its farms, by farm id. */
  farmRoles?: Readonly<Record<number, AppRole>>
  /** Farms returned by the account profile, used by the header farm switcher. */
  farms?: readonly SessionFarm[]
}

export type Session = SessionUser & { logout: () => Promise<void> }
