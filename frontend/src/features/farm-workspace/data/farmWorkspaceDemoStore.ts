import type {
  ChangeMemberInput, CompleteOwnerProfileInput, FarmDetails, FarmInfoInput, FarmRegistrationInput,
  FarmRole, FarmWorkspaceProfile, Invitation, InvitationPreview, InviteMemberInput, Membership, UpdateProfileInput,
} from '../types'

export interface FarmWorkspaceDemoStore {
  getProfile(): Promise<FarmWorkspaceProfile>
  completeOwnerRegistration(input: CompleteOwnerProfileInput): Promise<FarmWorkspaceProfile>
  updateProfile(input: UpdateProfileInput): Promise<FarmWorkspaceProfile>
  listFarms(): Promise<FarmDetails[]>
  getFarm(farmId: number): Promise<FarmDetails>
  registerFarm(input: FarmRegistrationInput): Promise<FarmDetails>
  updateFarm(farmId: number, input: FarmUpdateInput): Promise<FarmDetails>
  listMembers(farmId: number): Promise<Membership[]>
  changeMember(farmId: number, memberId: number, input: ChangeMemberInput): Promise<Membership>
  listInvitations(farmId: number, status?: string): Promise<Invitation[]>
  inviteMember(farmId: number, input: InviteMemberInput): Promise<Invitation>
  resendInvitation(farmId: number, invitationId: number): Promise<Invitation>
  cancelInvitation(farmId: number, invitationId: number): Promise<Invitation>
  previewInvitation(token: string): Promise<InvitationPreview>
  acceptInvitation(token: string): Promise<Membership>
}

export type FarmUpdateInput = Omit<FarmInfoInput, 'expectedVersion' | 'mainBreedIds'> & Partial<Pick<FarmInfoInput, 'expectedVersion' | 'mainBreedIds'>>

const stamp = (date = new Date()) => date.toISOString()
const cloneFarm = (farm: FarmDetails): FarmDetails => ({ ...farm, mainBreedIds: [...farm.mainBreedIds], mainBreedCodes: [...farm.mainBreedCodes] })
const cloneMember = (member: Membership): Membership => ({ ...member })
const cloneInvitation = (invitation: Invitation): Invitation => ({ ...invitation })

function seedFarm(id = 1): FarmDetails {
  return {
    id, name: 'Trại bò Yên Bài – Ba Vì', role: 'OWNER', serviceStatus: 'ACTIVE', version: 1,
    province: 'Hà Nội', commune: 'Xã Yên Bài', detailedAddress: 'Ba Vì, Hà Nội',
    contactPerson: 'Nguyễn Văn Hùng', contactPhone: '0912345678', registrationCertificateInfo: '',
    expectedHerdSize: '150_300', timeZone: 'Asia/Ho_Chi_Minh', morningShiftStart: '06:00', operatingNotes: '',
    mainBreedIds: [1], mainBreedCodes: ['VANG'], serviceUntil: null, renewalOpensAt: null, activeCattleCount: 126,
  }
}

export function createFarmWorkspaceDemoStore(options: { profile?: Partial<FarmWorkspaceProfile> } = {}): FarmWorkspaceDemoStore {
  const defaultProfile: FarmWorkspaceProfile = {
    id: 1, email: 'owner@beefcare.local', fullName: 'Nguyễn Văn Hùng', phone: '0912345678', emailVerified: true,
    passwordSignInEnabled: true, googleSignInLinked: false, ownerRegistrationCompleted: true, platformRole: null,
    farms: [{ farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', role: 'OWNER', permissions: ['MANAGE_FARM_INFORMATION'] }],
  }
  let profile = { ...defaultProfile, ...options.profile, farms: options.profile?.farms ?? defaultProfile.farms }
  const farms = new Map<number, FarmDetails>([[1, seedFarm()]])
  const members = new Map<number, Membership[]>([[1, [
    { id: 1, userId: 1, fullName: profile.fullName, email: profile.email, role: 'OWNER', status: 'ACTIVE', effectiveDate: '2026-01-01', reason: '', version: 1, joinedAt: '2026-01-01' },
    { id: 2, userId: 2, fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', role: 'MANAGER', status: 'ACTIVE', effectiveDate: '2026-02-01', reason: '', version: 1, joinedAt: '2026-02-01' },
    { id: 3, userId: 3, fullName: 'Lê Minh Tâm', email: 'technician@beefcare.local', role: 'TECHNICIAN', status: 'ACTIVE', effectiveDate: '2026-03-01', reason: '', version: 1, joinedAt: '2026-03-01' },
  ]]])
  const invitations = new Map<number, Invitation[]>([[1, [
    { id: 1, email: 'tech.new@beefcare.local', role: 'TECHNICIAN', status: 'PENDING', createdAt: '2026-10-29T02:00:00.000Z', lastSentAt: '2026-10-29T02:00:00.000Z', expiresAt: '2026-11-05T02:00:00.000Z', validityDays: 7, version: 1, accountHint: 'HAS_ACCOUNT' },
  ]]])
  let nextFarmId = 2
  let nextMemberId = 4
  let nextInvitationId = 2
  const sampleToken = 'mock-invitation-token'
  const samplePreview: InvitationPreview = { farmName: 'Trại bò Yên Bài – Ba Vì', email: 'manager@beefcare.local', role: 'MANAGER', invitedAt: '2026-10-29T02:00:00.000Z', expiresAt: '2026-11-05T02:00:00.000Z', status: 'PENDING', invitedBy: 'Nguyễn Văn Hùng', farmId: 2 }
  let previewStatus: InvitationPreview['status'] = 'PENDING'

  const getFarm = (farmId: number) => {
    const farm = farms.get(farmId)
    if (!farm) throw new Error('Không tìm thấy trang trại.')
    return farm
  }
  const getMembers = (farmId: number) => {
    getFarm(farmId)
    return members.get(farmId) ?? []
  }
  const getInvitations = (farmId: number) => {
    getFarm(farmId)
    return invitations.get(farmId) ?? []
  }
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
    async getFarm(farmId) { return cloneFarm(getFarm(farmId)) },
    async registerFarm(input) {
      const id = nextFarmId++
      const farm: FarmDetails = {
        id, name: input.name.trim(), role: 'OWNER', serviceStatus: 'PENDING_PAYMENT', version: 1,
        province: input.province, commune: input.commune, detailedAddress: input.detailedAddress ?? '',
        contactPerson: input.contactPerson ?? profile.fullName, contactPhone: input.contactPhone ?? profile.phone,
        registrationCertificateInfo: input.registrationCertificateInfo ?? '', expectedHerdSize: input.expectedHerdSize,
        timeZone: 'Asia/Ho_Chi_Minh', morningShiftStart: '', operatingNotes: '', mainBreedIds: [], mainBreedCodes: [...(input.mainBreedCodes ?? [])],
        activeCattleCount: 0, serviceUntil: null, renewalOpensAt: null,
      }
      farms.set(id, farm)
      members.set(id, [{ id: nextMemberId++, userId: profile.id, fullName: profile.fullName, email: profile.email, role: 'OWNER', status: 'ACTIVE', effectiveDate: new Date().toISOString().slice(0, 10), reason: '', version: 1, joinedAt: stamp() }])
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
    async listMembers(farmId) { return getMembers(farmId).map(cloneMember) },
    async changeMember(farmId, memberId, input) {
      const rows = getMembers(farmId)
      const member = rows.find((row) => row.id === memberId)
      if (!member || member.role === 'OWNER') throw new Error('Không thể thay đổi thành viên chủ trại.')
      if (input.action === 'CHANGE_ROLE' && input.role === member.role) throw new Error('Thành viên đang có vai trò này.')
      const updated = { ...member, role: input.action === 'CHANGE_ROLE' ? input.role as Exclude<FarmRole, 'OWNER'> : member.role, status: input.action === 'DEACTIVATE' ? 'INACTIVE' : input.action === 'REACTIVATE' ? 'ACTIVE' : member.status, effectiveDate: input.effectiveDate, reason: input.reason, version: member.version + 1 }
      members.set(farmId, rows.map((row) => row.id === memberId ? updated : row))
      return cloneMember(updated)
    },
    async listInvitations(farmId, status) { return getInvitations(farmId).filter((row) => !status || status === 'ALL' || row.status === status).map(cloneInvitation) },
    async inviteMember(farmId, input) {
      const email = input.email.trim().toLowerCase()
      if (getMembers(farmId).some((member) => member.email.toLowerCase() === email && member.status === 'ACTIVE')) throw new Error('Email này đã là thành viên đang hoạt động.')
      if (getInvitations(farmId).some((invitation) => invitation.email.toLowerCase() === email && invitation.status === 'PENDING')) throw new Error('Đã có lời mời đang chờ cho email này.')
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
    async previewInvitation(token) {
      if (token !== sampleToken) throw new Error('Lời mời không còn hiệu lực.')
      return { ...samplePreview, status: previewStatus }
    },
    async acceptInvitation(token) {
      const preview = await this.previewInvitation(token)
      if (preview.status !== 'PENDING') throw new Error('Lời mời không còn hiệu lực.')
      if (profile.email.toLowerCase() !== preview.email.toLowerCase()) throw new Error('Email đăng nhập không khớp với email được mời.')
      const farmId = preview.farmId ?? 1
      const role = preview.role
      const created: Membership = { id: nextMemberId++, userId: profile.id, fullName: profile.fullName, email: profile.email, role, status: 'ACTIVE', effectiveDate: new Date().toISOString().slice(0, 10), reason: '', version: 1, joinedAt: stamp() }
      if (!farms.has(farmId)) {
        const invitedFarm = seedFarm(farmId)
        invitedFarm.name = preview.farmName
        invitedFarm.role = role
        farms.set(farmId, invitedFarm)
        members.set(farmId, [])
        invitations.set(farmId, [])
      }
      members.set(farmId, [...(members.get(farmId) ?? []), created])
      previewStatus = 'ACCEPTED'
      const farm = getFarm(farmId)
      profile = { ...profile, farms: [...profile.farms.filter((item) => item.farmId !== farmId), { farmId, farmName: farm.name, role, permissions: [] }] }
      return cloneMember(created)
    },
  }
}

export const farmWorkspaceDemoStore = createFarmWorkspaceDemoStore()
