import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, nullableNumber, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import type {
  ChangeMemberInput, CompleteOwnerProfileInput, ExpectedHerdSize, FarmDetails,
  FarmRegistrationInput, FarmRole, FarmServiceStatus, FarmSummary, FarmWorkspaceProfile,
  Invitation, InvitationPreview, InvitationStatus, InviteMemberInput, Membership, MemberStatus,
  UpdateProfileInput,
} from '../types'
import { compactPhone } from '../validation'
import { farmWorkspaceDemoStore, type FarmUpdateInput, type FarmWorkspaceDemoStore } from '../data/farmWorkspaceDemoStore'

const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
  typeof value === 'string' && values.includes(value as T) ? value as T : fallback
const requiredOneOf = <T extends string>(value: unknown, values: readonly T[], field: string): T => {
  if (typeof value === 'string' && values.includes(value as T)) return value as T
  throw new Error(`Dữ liệu máy chủ không có ${field} hợp lệ.`)
}
const roles = ['OWNER', 'MANAGER', 'TECHNICIAN'] as const satisfies readonly FarmRole[]
const serviceStatuses = ['ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED'] as const satisfies readonly FarmServiceStatus[]
const invitationStatuses = ['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'] as const satisfies readonly InvitationStatus[]
const memberStatuses = ['ACTIVE', 'INACTIVE'] as const satisfies readonly MemberStatus[]
const breeds = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const ids = (value: unknown) => Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)) : []

function farmSummary(value: unknown): FarmSummary {
  const row = asRecord(value)
  return {
    id: numberValue(row.id), name: textValue(row.name), role: requiredOneOf(row.role, roles, 'vai trò trại'),
    serviceStatus: requiredOneOf(row.serviceStatus, serviceStatuses, 'trạng thái dịch vụ'), version: numberValue(row.version),
    province: typeof row.province === 'string' ? row.province : undefined,
    commune: typeof row.commune === 'string' ? row.commune : undefined,
    detailedAddress: typeof row.detailedAddress === 'string' ? row.detailedAddress : undefined,
    activeCattleCount: nullableNumber(row.activeCattleCount),
    serviceUntil: typeof row.serviceUntil === 'string' ? row.serviceUntil : typeof row.currentPeriodUntil === 'string' ? row.currentPeriodUntil : null,
    renewalOpensAt: typeof row.renewalOpensAt === 'string' ? row.renewalOpensAt : null,
    ownerEmail: typeof row.ownerEmail === 'string' ? row.ownerEmail : undefined,
  }
}

function farmDetails(value: unknown, role?: FarmRole): FarmDetails {
  const row = asRecord(value)
  const base = farmSummary({ ...row, role: role ?? row.role })
  const serviceUntil = row.serviceUntil ?? row.currentPeriodUntil
  return {
    ...base,
    province: textValue(row.province) || undefined,
    commune: textValue(row.commune) || undefined,
    detailedAddress: textValue(row.detailedAddress) || undefined,
    contactPerson: textValue(row.contactPerson), contactPhone: textValue(row.contactPhone),
    registrationCertificateInfo: textValue(row.registrationCertificateInfo),
    expectedHerdSize: oneOf(row.expectedHerdSize, ['UNDER_50', '50_149', '150_300', 'OVER_300'] as const, '') as ExpectedHerdSize | '',
    timeZone: textValue(row.timeZone), morningShiftStart: textValue(row.morningShiftStart), operatingNotes: textValue(row.operatingNotes),
    mainBreedIds: ids(row.mainBreedIds), mainBreedCodes: breeds(row.mainBreedCodes),
    suspendedAt: typeof row.suspendedAt === 'string' ? row.suspendedAt : null,
    daysRemaining: nullableNumber(row.daysRemaining),
    serviceUntil: typeof serviceUntil === 'string' ? serviceUntil : null,
    renewalOpensAt: typeof row.renewalOpensAt === 'string' ? row.renewalOpensAt : null,
    activeCattleCount: nullableNumber(row.activeCattleCount),
    ownerEmail: typeof row.ownerEmail === 'string' ? row.ownerEmail : undefined,
  }
}

function profile(value: unknown): FarmWorkspaceProfile {
  const row = asRecord(value)
  const farmRows = Array.isArray(row.farms) ? asRows(row.farms) : []
  return {
    id: numberValue(row.id), email: textValue(row.email), fullName: textValue(row.fullName), phone: textValue(row.phone),
    emailVerified: row.emailVerified === true, passwordSignInEnabled: row.passwordSignInEnabled === true,
    googleSignInLinked: row.googleSignInLinked === true, ownerRegistrationCompleted: row.ownerRegistrationCompleted === true,
    platformRole: typeof row.platformRole === 'string' ? row.platformRole : null,
    farms: farmRows.map((farm) => ({ farmId: numberValue(farm.farmId), farmName: textValue(farm.farmName), role: requiredOneOf(farm.role, roles, 'vai trò trại'), permissions: breeds(farm.permissions) })),
  }
}

function member(value: unknown): Membership {
  const row = asRecord(value)
  const effectiveDate = textValue(row.effectiveDate)
  return {
    id: numberValue(row.id), userId: numberValue(row.userId), fullName: textValue(row.fullName), email: textValue(row.email),
    role: requiredOneOf(row.role, roles, 'vai trò thành viên'), status: requiredOneOf(row.status, memberStatuses, 'trạng thái thành viên'),
    effectiveDate, reason: textValue(row.reason), version: numberValue(row.version),
    // Current BE MemberView has no joinedAt; keep that gap empty rather than present effectiveDate as a join date.
    joinedAt: textValue(row.joinedAt),
  }
}

function invitation(value: unknown): Invitation {
  const row = asRecord(value)
  return {
    id: numberValue(row.id), email: textValue(row.email), role: requiredOneOf(row.role, ['MANAGER', 'TECHNICIAN'] as const, 'vai trò trong lời mời'),
    status: requiredOneOf(row.status, invitationStatuses, 'trạng thái lời mời'), createdAt: textValue(row.createdAt),
    lastSentAt: textValue(row.lastSentAt), expiresAt: textValue(row.expiresAt),
    validityDays: row.validityDays === 3 || row.validityDays === 7 || row.validityDays === 14 ? row.validityDays : 7, version: numberValue(row.version),
    ...(row.accountHint === 'HAS_ACCOUNT' || row.accountHint === 'NO_ACCOUNT' ? { accountHint: row.accountHint } : {}),
  }
}

export type FarmWorkspaceApi = Omit<FarmWorkspaceDemoStore, 'listFarms'> & { listFarms(): Promise<FarmSummary[]> }

export function createFarmWorkspaceApi({ mode, transport, demoStore = farmWorkspaceDemoStore }: {
  mode: BackendMode; farmId: string | number; transport: BackendTransport; demoStore?: FarmWorkspaceDemoStore
}): FarmWorkspaceApi {
  const path = (id: number, suffix: string) => transport.farmPath(id, suffix)
  const command = (url: string, body: unknown, method: string) => transport.command(url, body, { method })
  return {
    getProfile: async () => mode === 'backend' ? profile(await transport.get('/api/account/profile')) : demoStore.getProfile(),
    completeOwnerRegistration: async (input: CompleteOwnerProfileInput) => {
      if (mode !== 'backend') return demoStore.completeOwnerRegistration(input)
      const result = asRecord(await command('/api/account/owner-registration', { ...input, phone: compactPhone(input.phone) }, 'POST'))
      return profile({ ...result, ownerRegistrationCompleted: result.completed === true, farms: [] })
    },
    updateProfile: async (input: UpdateProfileInput) => mode === 'backend'
      ? profile(await command('/api/account/profile', { ...input, phone: compactPhone(input.phone) }, 'POST'))
      : demoStore.updateProfile(input),
    listFarms: async () => mode === 'backend'
      ? asRows(await transport.get('/api/farms')).map(farmSummary)
      : (await demoStore.listFarms()).map(({ id, name, role, serviceStatus, version, province, commune, detailedAddress, activeCattleCount, serviceUntil, renewalOpensAt, ownerEmail }) => ({ id, name, role, serviceStatus, version, province, commune, detailedAddress, activeCattleCount, serviceUntil, renewalOpensAt, ownerEmail })),
    getFarm: async (id: number) => {
      if (mode !== 'backend') return demoStore.getFarm(id)
      const [details, context] = await Promise.all([transport.get(path(id, '')), transport.get(path(id, '/context'))])
      return farmDetails(details, farmSummary(context).role)
    },
    registerFarm: async (input: FarmRegistrationInput) => mode === 'backend'
      ? farmDetails(await command('/api/farms', { ...input, contactPhone: compactPhone(input.contactPhone ?? '') }, 'POST'), 'OWNER')
      : demoStore.registerFarm(input),
    updateFarm: async (id: number, input: FarmUpdateInput) => {
      if (mode !== 'backend') return demoStore.updateFarm(id, input)
      if (input.expectedVersion == null || !input.mainBreedIds) throw new Error('Thiếu phiên bản hoặc danh sách giống để lưu thông tin trại.')
      const context = await transport.get(path(id, '/context'))
      const role = farmSummary(context).role
      const updated = await command(path(id, ''), { ...input, contactPhone: compactPhone(input.contactPhone ?? '') }, 'PUT')
      return farmDetails(updated, role)
    },
    listMembers: async (id: number) => mode === 'backend'
      ? asRows(await transport.get(path(id, '/members'))).map(member)
      : demoStore.listMembers(id),
    changeMember: async (id: number, memberId: number, input: ChangeMemberInput) => mode === 'backend'
      ? member(await command(path(id, `/members/${memberId}`), { ...input, expectedVersion: await versionForMember(id, memberId, transport) }, 'PUT'))
      : demoStore.changeMember(id, memberId, input),
    listInvitations: async (id: number, status?: string) => {
      if (mode !== 'backend') return demoStore.listInvitations(id, status)
      const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : ''
      return asRows(await transport.get(path(id, `/invitations${query}`))).map(invitation)
    },
    inviteMember: async (id: number, input: InviteMemberInput) => mode === 'backend'
      ? invitation(await command(path(id, '/invitations'), input, 'POST'))
      : demoStore.inviteMember(id, input),
    resendInvitation: async (id: number, invitationId: number) => mode === 'backend'
      ? invitation(await command(path(id, `/invitations/${invitationId}/resend`), { expectedVersion: await versionForInvitation(id, invitationId, transport) }, 'POST'))
      : demoStore.resendInvitation(id, invitationId),
    cancelInvitation: async (id: number, invitationId: number) => mode === 'backend'
      ? invitation(await command(path(id, `/invitations/${invitationId}/cancel`), { expectedVersion: await versionForInvitation(id, invitationId, transport) }, 'POST'))
      : demoStore.cancelInvitation(id, invitationId),
    previewInvitation: async (token: string) => {
      if (mode !== 'backend') return demoStore.previewInvitation(token)
      const value = asRecord(await transport.get(`/api/invitations/accept?token=${encodeURIComponent(token)}`))
      return {
        farmName: textValue(value.farmName), email: textValue(value.email),
        role: requiredOneOf(value.role, ['MANAGER', 'TECHNICIAN'] as const, 'vai trò trong lời mời'),
        invitedAt: textValue(value.invitedAt), expiresAt: textValue(value.expiresAt), status: 'PENDING',
        // BE InvitationAcceptance currently omits invitedBy and farmId (tracked as a contract gap).
        invitedBy: typeof value.invitedBy === 'string' ? value.invitedBy : undefined,
        farmId: typeof value.farmId === 'number' ? value.farmId : undefined,
      }
    },
    acceptInvitation: async (token: string, signedInEmail?: string) => mode === 'backend'
      ? member(await command('/api/invitations/accept', { token }, 'POST'))
      : demoStore.acceptInvitation(token, signedInEmail),
  }
}

async function versionForInvitation(farmId: number, invitationId: number, transport: BackendTransport) {
  const rows = asRows(await transport.get(transport.farmPath(farmId, '/invitations')))
  const row = rows.find((item) => numberValue(item.id) === invitationId)
  if (!row) throw new Error('Không tìm thấy lời mời hoặc dữ liệu đã thay đổi. Tải lại danh sách.')
  if (typeof row.version !== 'number') throw new Error('Máy chủ chưa trả phiên bản lời mời. Tải lại danh sách trước khi thử lại.')
  return row.version
}

async function versionForMember(farmId: number, memberId: number, transport: BackendTransport) {
  const rows = asRows(await transport.get(transport.farmPath(farmId, '/members')))
  const row = rows.find((item) => numberValue(item.id) === memberId)
  if (!row || typeof row.version !== 'number') throw new Error('Không tìm thấy thành viên hoặc phiên bản đã thay đổi. Tải lại danh sách.')
  return row.version
}

export const farmWorkspaceApi = createFarmWorkspaceApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })
