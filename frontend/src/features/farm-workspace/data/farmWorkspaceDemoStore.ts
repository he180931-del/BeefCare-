import { BackendError } from '../../../api/backendClient'
import type {
  AcceptedInvitation, ChangeMemberInput, CompleteOwnerProfileInput, FarmDetails, FarmInfoInput, FarmRegistrationInput,
  FarmRole, FarmSummary, FarmWorkspaceProfile, Invitation, InvitationPreview, InvitationListQuery, InvitationPage, InvitationStatus, InviteMemberInput, MemberList, Membership, MemberCommandOptions, RequestKeyOptions, UpdateProfileInput,
} from '../types'
import { compareMembers, memberActions } from '../domain/members'
import { EXPIRED_TOKEN, FIRST_NEW_FARM_ID, INVITED_FARM_ID, SAMPLE_TOKEN, samplePreview, seedFarms, seedYenBaiInvitations, seedYenBaiMembers, YEN_BAI } from './farmWorkspaceSeed'

export interface FarmWorkspaceDemoStore {
  getProfile(): Promise<FarmWorkspaceProfile>
  completeOwnerRegistration(input: CompleteOwnerProfileInput): Promise<FarmWorkspaceProfile>
  updateProfile(input: UpdateProfileInput): Promise<FarmWorkspaceProfile>
  listFarms(): Promise<FarmDetails[]>
  /**
   * UC-FE02-02 step 4, same rule as `GET /api/farms/{id}/context`: every member enters an ACTIVE farm; otherwise only
   * the Owner (GBR-14), and a Manager or Technician gets MSG-FE02-04 (AF3).
   */
  selectFarm(farmId: number): Promise<FarmSummary>
  getFarm(farmId: number): Promise<FarmDetails>
  /** UC-FE02-01. Cùng `idempotencyKey` + cùng dữ liệu → trả lại trại đã tạo; cùng khóa, khác dữ liệu → lỗi (R-02-02). */
  registerFarm(input: FarmRegistrationInput, options?: RequestKeyOptions): Promise<FarmDetails>
  /** UC-FE02-03. `options` mirrors the backend call; the demo store has no request-key replay for this save. */
  updateFarm(farmId: number, input: FarmUpdateInput, options?: RequestKeyOptions): Promise<FarmDetails>
  /** A1 (D29): same rows, counts and actions as the backend for the viewer's role; a Technician is refused. */
  listMembers(farmId: number, viewer?: FarmRole): Promise<MemberList>
  changeMember(farmId: number, memberId: number, input: ChangeMemberInput, options?: MemberCommandOptions): Promise<Membership>
  listInvitations(farmId: number, query?: InvitationListQuery): Promise<InvitationPage>
  inviteMember(farmId: number, input: InviteMemberInput, options?: RequestKeyOptions): Promise<Invitation>
  resendInvitation(farmId: number, invitationId: number, options?: MemberCommandOptions): Promise<Invitation>
  cancelInvitation(farmId: number, invitationId: number, options?: MemberCommandOptions): Promise<Invitation>
  /** `signedInEmail`: thư điện tử của phiên đang đăng nhập (chế độ mô phỏng); mặc định là hồ sơ của kho. Lỗi giống backend (D28). */
  previewInvitation(token: string, signedInEmail?: string): Promise<InvitationPreview>
  acceptInvitation(token: string, signedInEmail?: string): Promise<AcceptedInvitation>
}

export type FarmUpdateInput = Omit<FarmInfoInput, 'expectedVersion' | 'mainBreedIds'> & Partial<Pick<FarmInfoInput, 'expectedVersion' | 'mainBreedIds'>>

const stamp = (date = new Date()) => date.toISOString()
const cloneFarm = (farm: FarmDetails): FarmDetails => ({ ...farm, mainBreedIds: [...farm.mainBreedIds], mainBreedCodes: [...farm.mainBreedCodes] })
const cloneMember = (member: Membership): Membership => ({ ...member, actions: [...member.actions] })
const cloneInvitation = (invitation: Invitation): Invitation => ({ ...invitation })
/** Demo errors carry the backend code/params so SCR-15 handles both modes alike (D28). */
const invitationError = (status: number, code: string, params: Record<string, unknown>, message: string) => new BackendError(status, { code, params, message })

export function createFarmWorkspaceDemoStore(options: { profile?: Partial<FarmWorkspaceProfile> } = {}): FarmWorkspaceDemoStore {
  const defaultProfile: FarmWorkspaceProfile = {
    id: 1, email: 'owner@beefcare.local', fullName: 'Nguyễn Văn Hùng', phone: '0912 345 678', emailVerified: true,
    passwordSignInEnabled: true, googleSignInLinked: true, ownerRegistrationCompleted: true, platformRole: null,
    farms: seedFarms().map((farm) => ({ farmId: farm.id, farmName: farm.name, role: farm.role, permissions: [] })),
  }
  let profile = { ...defaultProfile, ...options.profile, farms: options.profile?.farms ?? defaultProfile.farms }
  const farms = new Map<number, FarmDetails>(seedFarms().map((farm) => [farm.id, farm]))
  const members = new Map<number, Membership[]>([[1, seedYenBaiMembers()]])
  const invitations = new Map<number, Invitation[]>([[1, seedYenBaiInvitations()]])
  let nextFarmId = FIRST_NEW_FARM_ID
  const registrations = new Map<string, { request: string; farmId: number }>()
  let nextMemberId = 100
  let nextInvitationId = 100
  let previewStatus: InvitationPreview['status'] = 'PENDING'
  let acceptedMembershipId: number | undefined

  const getFarm = (farmId: number) => {
    const farm = farms.get(farmId)
    if (!farm) throw new Error('Không tìm thấy trang trại.')
    return farm
  }
  const getMembers = (farmId: number) => { getFarm(farmId); return members.get(farmId) ?? [] }
  const getInvitations = (farmId: number) => { getFarm(farmId); return invitations.get(farmId) ?? [] }
  const getInvitation = (farmId: number, invitationId: number) => {
    const invitation = getInvitations(farmId).find((item) => item.id === invitationId)
    if (!invitation) throw new Error('Không tìm thấy lời mời.')
    return invitation
  }

  return {
    async getProfile() { return { ...profile, farms: profile.farms.map((farm) => ({ ...farm, permissions: [...farm.permissions] })) } },
    async completeOwnerRegistration(input) {
      if (!input.termsAccepted) throw new Error('Bạn cần đồng ý với điều khoản.')
      profile = { ...profile, fullName: input.fullName.trim(), phone: input.phone.trim(), ownerRegistrationCompleted: true }
      return this.getProfile()
    },
    async updateProfile(input) {
      profile = { ...profile, fullName: input.fullName.trim(), phone: input.phone.trim() }
      return this.getProfile()
    },
    async listFarms() { return [...farms.values()].map(cloneFarm) },
    async selectFarm(farmId) {
      const farm = getFarm(farmId)
      if (farm.serviceStatus !== 'ACTIVE' && farm.role !== 'OWNER') {
        throw new BackendError(403, { code: 'MSG-FE02-04', params: { farm: farm.name, status: farm.serviceStatus } })
      }
      return cloneFarm(farm)
    },
    async getFarm(farmId) { return cloneFarm(getFarm(farmId)) },
    async registerFarm(input, options) {
      const request = JSON.stringify(input)
      const replay = options?.idempotencyKey ? registrations.get(options.idempotencyKey) : undefined
      if (replay) {
        if (replay.request !== request) throw new Error('Khóa yêu cầu đã dùng cho dữ liệu khác. Tải lại trang rồi thử lại.')
        return cloneFarm(getFarm(replay.farmId))
      }
      const id = nextFarmId++
      if (options?.idempotencyKey) registrations.set(options.idempotencyKey, { request, farmId: id })
      const farm: FarmDetails = {
        id, name: input.name.trim(), role: 'OWNER', serviceStatus: 'PENDING_PAYMENT', version: 1,
        province: input.province, commune: input.commune, detailedAddress: input.detailedAddress ?? '',
        contactPerson: input.contactPerson ?? profile.fullName, contactPhone: input.contactPhone ?? profile.phone,
        registrationCertificateInfo: input.registrationCertificateInfo ?? '', expectedHerdSize: input.expectedHerdSize ?? '',
        timeZone: 'Asia/Ho_Chi_Minh', morningShiftStart: '', operatingNotes: '', mainBreedIds: [], mainBreedCodes: [...(input.mainBreedCodes ?? [])],
        activeCattleCount: 0, serviceUntil: null, renewalOpensAt: null, ownerName: profile.fullName, ownerEmail: profile.email,
      }
      farms.set(id, farm)
      members.set(id, [{ id: nextMemberId++, userId: profile.id, fullName: profile.fullName, email: profile.email, role: 'OWNER', status: 'ACTIVE', joinedAt: stamp(), version: 1, actions: [] }])
      invitations.set(id, [])
      profile = { ...profile, farms: [...profile.farms, { farmId: id, farmName: farm.name, role: 'OWNER', permissions: ['MANAGE_FARM_INFORMATION'] }] }
      return cloneFarm(farm)
    },
    async updateFarm(farmId, input) {
      const current = getFarm(farmId)
      if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) throw new Error('Thông tin trại đã thay đổi ở phiên khác. Tải lại rồi thử lại.')
      const updated: FarmDetails = { ...current, ...input, mainBreedIds: input.mainBreedIds ?? current.mainBreedIds, mainBreedCodes: current.mainBreedCodes, name: input.name.trim(), version: current.version + 1 }
      farms.set(farmId, updated)
      profile = { ...profile, farms: profile.farms.map((farm) => farm.farmId === farmId ? { ...farm, farmName: updated.name } : farm) }
      return cloneFarm(updated)
    },
    async listMembers(farmId, viewer = 'OWNER') {
      const farm = getFarm(farmId)
      if (viewer === 'TECHNICIAN') throw invitationError(403, 'MSG-COM-01', {}, 'Bạn không có quyền thực hiện thao tác này.')
      const owner = viewer === 'OWNER'
      const active = farm.serviceStatus === 'ACTIVE'
      const rows = getMembers(farmId).filter((row) => owner || row.status === 'ACTIVE').sort(compareMembers)
      const activeOf = (role: FarmRole) => rows.filter((row) => row.status === 'ACTIVE' && row.role === role).length
      return {
        farmName: farm.name, timeZone: farm.timeZone, serviceStatus: farm.serviceStatus,
        counts: { all: rows.length, managers: activeOf('MANAGER'), technicians: activeOf('TECHNICIAN'), ...(owner ? { inactive: rows.filter((row) => row.status === 'INACTIVE').length } : {}) },
        items: rows.map((row) => ({ ...cloneMember(row), actions: memberActions(row, owner, active) })),
      }
    },
    async changeMember(farmId, memberId, input) {
      const rows = getMembers(farmId)
      const member = rows.find((row) => row.id === memberId)
      if (!member || member.role === 'OWNER') throw new Error('Không thể thay đổi thành viên chủ trại.')
      if (input.action === 'CHANGE_ROLE' && input.role === member.role) throw new Error('Thành viên đang có vai trò này.')
      const updated = { ...member, role: input.action === 'CHANGE_ROLE' ? input.role as Exclude<FarmRole, 'OWNER'> : member.role, status: input.action === 'DEACTIVATE' ? 'INACTIVE' : input.action === 'REACTIVATE' ? 'ACTIVE' : member.status, version: member.version + 1 } as Membership
      members.set(farmId, rows.map((row) => row.id === memberId ? updated : row))
      return { ...cloneMember(updated), actions: memberActions(updated, true, getFarm(farmId).serviceStatus === 'ACTIVE') }
    },
    async listInvitations(farmId, query = {}) {
      // The local demo retains the historical Figma fixture states; backend reads own live expiry.
      const all = getInvitations(farmId)
      const counts: Record<InvitationStatus, number> = { PENDING: 0, ACCEPTED: 0, EXPIRED: 0, CANCELLED: 0 }
      all.forEach(row => { counts[row.status]++ })
      const rows = all.filter(row => (!query.status || row.status === query.status) && (query.invitationId == null || row.id === query.invitationId))
        .sort((a, b) => (Date.parse(a.lastSentAt) - Date.parse(b.lastSentAt)) * (query.dir === 'asc' ? 1 : -1) || b.id - a.id)
      const page = query.page ?? 0; const size = query.size ?? 20
      return { items: rows.slice(page * size, (page + 1) * size).map(cloneInvitation), total: rows.length, page, size, counts, asOf: stamp() }
    },
    async inviteMember(farmId, input) {
      const email = input.email.trim().toLowerCase()
      const member = getMembers(farmId).find((row) => row.email.toLowerCase() === email)
      if (member?.status === 'ACTIVE') throw new BackendError(409, { code: 'MSG-FE03-02' })
      if (member) throw new BackendError(409, { code: 'MSG-FE03-21', params: { membershipId: member.id, email } })
      const pending = getInvitations(farmId).find((row) => row.email.toLowerCase() === email && row.status === 'PENDING')
      if (pending) throw new BackendError(409, { code: 'MSG-FE03-03', params: { invitationId: pending.id, email } })
      const created = new Date()
      const invitation: Invitation = { id: nextInvitationId++, email, role: input.role, status: 'PENDING', createdAt: stamp(created), lastSentAt: stamp(created), expiresAt: stamp(new Date(created.getTime() + input.validityDays * 86_400_000)), validityDays: input.validityDays, version: 1, accountHint: 'NO_ACCOUNT' }
      invitations.set(farmId, [...getInvitations(farmId), invitation])
      return cloneInvitation(invitation)
    },
    async resendInvitation(farmId, invitationId) {
      const invitation = getInvitation(farmId, invitationId)
      if (invitation.status !== 'PENDING') throw new Error('Lời mời không còn ở trạng thái chờ.')
      const now = new Date()
      const updated = { ...invitation, lastSentAt: stamp(now), expiresAt: stamp(new Date(now.getTime() + invitation.validityDays * 86_400_000)), version: invitation.version + 1 }
      invitations.set(farmId, getInvitations(farmId).map((row) => row.id === invitationId ? updated : row))
      return cloneInvitation(updated)
    },
    async cancelInvitation(farmId, invitationId) {
      const invitation = getInvitation(farmId, invitationId)
      if (invitation.status !== 'PENDING') throw new Error('Lời mời không còn ở trạng thái chờ.')
      const updated = { ...invitation, status: 'CANCELLED' as const, version: invitation.version + 1 }
      invitations.set(farmId, getInvitations(farmId).map((row) => row.id === invitationId ? updated : row))
      return cloneInvitation(updated)
    },
    async previewInvitation(token, signedInEmail) {
      // Same order and codes as A7 (D28): unknown link, then another e-mail (E2), then the invitation's own state.
      if (token !== SAMPLE_TOKEN && token !== EXPIRED_TOKEN) throw invitationError(400, 'MSG-FE03-08', { status: 'INVALID' }, 'Lời mời không còn hiệu lực.')
      if ((signedInEmail ?? profile.email).toLowerCase() !== samplePreview.email.toLowerCase()) throw invitationError(403, 'MSG-FE03-09', {}, 'Email đăng nhập không khớp với email được mời.')
      if (token === EXPIRED_TOKEN) throw invitationError(400, 'MSG-FE03-08', { status: 'EXPIRED', expiresAt: samplePreview.expiresAt }, 'Lời mời không còn hiệu lực.')
      return { ...samplePreview, status: previewStatus, membershipId: acceptedMembershipId }
    },
    async acceptInvitation(token, signedInEmail) {
      const preview = await this.previewInvitation(token, signedInEmail)
      const email = signedInEmail ?? profile.email
      if (preview.status === 'ACCEPTED') return { membershipId: acceptedMembershipId!, farmId: preview.farmId, farmName: preview.farmName, role: preview.role }
      const farmId = preview.farmId ?? INVITED_FARM_ID
      const role = preview.role
      const created: Membership = { id: nextMemberId++, userId: profile.id, fullName: profile.fullName, email, role, status: 'ACTIVE', joinedAt: stamp(), version: 1, actions: [] }
      if (!farms.has(farmId)) {
        const invitedFarm = cloneFarm(farms.get(1)!)
        Object.assign(invitedFarm, { id: farmId, name: preview.farmName || YEN_BAI, role, ownerEmail: undefined })
        farms.set(farmId, invitedFarm)
        members.set(farmId, [])
        invitations.set(farmId, [])
      }
      members.set(farmId, [...(members.get(farmId) ?? []), created])
      previewStatus = 'ACCEPTED'
      acceptedMembershipId = created.id
      const farm = getFarm(farmId)
      profile = { ...profile, farms: [...profile.farms.filter((item) => item.farmId !== farmId), { farmId, farmName: farm.name, role, permissions: [] }] }
      return { membershipId: created.id, farmId, farmName: farm.name, role }
    },
  }
}

export const farmWorkspaceDemoStore = createFarmWorkspaceDemoStore()
