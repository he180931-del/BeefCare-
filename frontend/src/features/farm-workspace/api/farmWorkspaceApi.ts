import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, nullableNumber, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import type {
  AcceptedInvitation, ChangeMemberInput, CompleteOwnerProfileInput, ExpectedHerdSize, FarmDetails,
  FarmRegistrationInput, FarmRole, FarmServiceStatus, FarmSummary, FarmWorkspaceProfile,
  Invitation, InvitationPreview, InvitationPage, InvitationListQuery, InvitationStatus, InviteMemberInput, Membership, MemberStatus,
  MemberCommandOptions, RequestKeyOptions, UpdateProfileInput,
} from '../types'
import { compactPhone } from '../validation'
import { farmWorkspaceDemoStore, type FarmUpdateInput, type FarmWorkspaceDemoStore } from '../data/farmWorkspaceDemoStore'

const oneOf = <T extends string>(value: unknown, values: readonly T[], fallback: T): T =>
  typeof value === 'string' && values.includes(value as T) ? value as T : fallback
const requiredOneOf = <T extends string>(value: unknown, values: readonly T[], field: string): T => {
  if (typeof value === 'string' && values.includes(value as T)) return value as T
  throw new Error(`Dữ liệu máy chủ không có ${field} hợp lệ.`)
}
/** IDs used to open a farm or a membership must come from the server; never default them to 0 (D28). */
const requiredId = (value: unknown, field: string): number => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  throw new Error(`Dữ liệu máy chủ không có ${field} hợp lệ.`)
}
const requiredText = (value: unknown, field: string): string => {
  if (typeof value === 'string' && value.trim()) return value
  throw new Error(`Dữ liệu máy chủ không có ${field} hợp lệ.`)
}
const invitedRoles = ['MANAGER', 'TECHNICIAN'] as const
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
    ownerName: typeof row.ownerName === 'string' ? row.ownerName : undefined,
    ownerEmail: typeof row.ownerEmail === 'string' ? row.ownerEmail : undefined,
  }
}

function profile(value: unknown): FarmWorkspaceProfile {
  const row = asRecord(value)
  const farmRows = Array.isArray(row.farms) ? asRows(row.farms) : []
  return {
    id: numberValue(row.id), email: textValue(row.email), fullName: textValue(row.fullName), phone: textValue(row.contactPhone ?? row.phone),
    emailVerified: row.emailVerified === true, passwordSignInEnabled: row.passwordSignInEnabled === true,
    googleSignInLinked: row.googleSignInLinked === true, ownerRegistrationCompleted: row.ownerRegistrationCompleted === true,
    termsAccepted: row.termsAccepted === true,
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
    ...(typeof row.hasAccount === 'boolean' ? { accountHint: row.hasAccount ? 'HAS_ACCOUNT' as const : 'NO_ACCOUNT' as const }
      : row.accountHint === 'HAS_ACCOUNT' || row.accountHint === 'NO_ACCOUNT' ? { accountHint: row.accountHint } : {}),
  }
}

function invitationPage(value: unknown): InvitationPage {
  const row = asRecord(value)
  const counts = asRecord(row.counts)
  const nonnegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  if (!Array.isArray(row.items) || !nonnegativeInteger(row.total) || !nonnegativeInteger(row.page)
    || !nonnegativeInteger(row.size) || row.size < 1 || row.size > 100 || row.items.length > row.size
    || !row.items.every(value => {
      const item = asRecord(value)
      return nonnegativeInteger(item.id) && item.id > 0 && nonnegativeInteger(item.version)
        && typeof item.hasAccount === 'boolean' && typeof item.email === 'string' && item.email.length > 0
        && ['MANAGER', 'TECHNICIAN'].includes(String(item.role)) && invitationStatuses.includes(item.status as InvitationStatus)
        && [3, 7, 14].includes(item.validityDays as number)
        && ['createdAt', 'lastSentAt', 'expiresAt'].every(field => typeof item[field] === 'string' && Number.isFinite(Date.parse(item[field] as string)))
    })
    || !invitationStatuses.every(status => nonnegativeInteger(counts[status]))
    || typeof row.asOf !== 'string' || !Number.isFinite(Date.parse(row.asOf))) {
    throw new Error('Dữ liệu danh sách lời mời từ máy chủ không hợp lệ.')
  }
  return {
    items: row.items.map(invitation), total: row.total, page: row.page, size: row.size,
    counts: Object.fromEntries(invitationStatuses.map(status => [status, counts[status]])) as Record<InvitationStatus, number>, asOf: row.asOf,
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
      const result = asRecord(await command('/api/account/owner-registration', {
        fullName: input.fullName,
        contactPhone: compactPhone(input.phone),
        termsAccepted: input.termsAccepted,
      }, 'POST'))
      return profile({ ...result, ownerRegistrationCompleted: result.completed === true, farms: [] })
    },
    updateProfile: async (input: UpdateProfileInput) => mode === 'backend'
      ? profile(await command('/api/account/profile', { fullName: input.fullName, contactPhone: compactPhone(input.phone) }, 'POST'))
      : demoStore.updateProfile(input),
    listFarms: async () => mode === 'backend'
      ? asRows(await transport.get('/api/farms')).map(farmSummary)
      : (await demoStore.listFarms()).map(({ id, name, role, serviceStatus, version, province, commune, detailedAddress, activeCattleCount, serviceUntil, renewalOpensAt, ownerEmail }) => ({ id, name, role, serviceStatus, version, province, commune, detailedAddress, activeCattleCount, serviceUntil, renewalOpensAt, ownerEmail })),
    // UC-FE02-02 step 4: rechecks membership, role and service status right before the farm becomes current (GBR-09).
    selectFarm: async (id: number) => mode === 'backend'
      ? farmSummary(await transport.get(path(id, '/context')))
      : demoStore.selectFarm(id),
    getFarm: async (id: number) => {
      if (mode !== 'backend') return demoStore.getFarm(id)
      const [details, context] = await Promise.all([transport.get(path(id, '')), transport.get(path(id, '/context'))])
      return farmDetails(details, farmSummary(context).role)
    },
    // UC-FE02-01: the page holds the request key so a retry or reload re-sends the same key (R-02-02, GBR-88).
    registerFarm: async (input: FarmRegistrationInput, options?: RequestKeyOptions) => {
      if (mode !== 'backend') return demoStore.registerFarm(input, options)
      const body = { ...input, contactPhone: compactPhone(input.contactPhone ?? '') || null, expectedHerdSize: input.expectedHerdSize || null }
      const key = options?.idempotencyKey
      return farmDetails(await transport.command('/api/farms', body, key ? { method: 'POST', key } : { method: 'POST' }), 'OWNER')
    },
    // UC-FE02-03: SCR-11 has no main-breed field, so the save never sends main breeds and they stay as they are; the
    // page holds the request key so a retry re-sends the same key (GBR-88). Only the Owner can save (GBR-07).
    updateFarm: async (id: number, input: FarmUpdateInput, options?: RequestKeyOptions) => {
      if (mode !== 'backend') return demoStore.updateFarm(id, input, options)
      if (input.expectedVersion == null) throw new Error('Thiếu phiên bản để lưu thông tin trại. Tải lại trang rồi thử lại.')
      const body = {
        name: input.name, province: input.province, commune: input.commune, detailedAddress: input.detailedAddress ?? '',
        contactPerson: input.contactPerson ?? '', contactPhone: compactPhone(input.contactPhone ?? '') || null,
        registrationCertificateInfo: input.registrationCertificateInfo ?? '', timeZone: input.timeZone,
        morningShiftStart: input.morningShiftStart || null, operatingNotes: input.operatingNotes ?? '', expectedVersion: input.expectedVersion,
      }
      const key = options?.idempotencyKey
      return farmDetails(await transport.command(path(id, ''), body, key ? { method: 'PUT', key } : { method: 'PUT' }), 'OWNER')
    },
    listMembers: async (id: number) => mode === 'backend'
      ? asRows(await transport.get(path(id, '/members'))).map(member)
      : demoStore.listMembers(id),
    changeMember: async (id: number, memberId: number, input: ChangeMemberInput, options?: MemberCommandOptions) => {
      if (mode !== 'backend') return demoStore.changeMember(id, memberId, input, options)
      if (options?.expectedVersion == null) throw new Error('Thiếu phiên bản thành viên. Tải lại danh sách trước khi thử lại.')
      return member(await transport.command(path(id, `/members/${memberId}`), { ...input, expectedVersion: options.expectedVersion }, { method: 'PUT', key: options.idempotencyKey }))
    },
    listInvitations: async (id: number, input: InvitationListQuery = {}) => {
      if (mode !== 'backend') return demoStore.listInvitations(id, input)
      const query = new URLSearchParams()
      for (const field of ['status', 'page', 'size', 'sort', 'dir', 'invitationId'] as const) {
        if (input[field] != null) query.set(field, String(input[field]))
      }
      return invitationPage(await transport.get(path(id, `/invitations${query.size ? `?${query}` : ''}`)))
    },
    inviteMember: async (id: number, input: InviteMemberInput, options?: RequestKeyOptions) => mode === 'backend'
      ? invitation(await transport.command(path(id, '/invitations'), input, { method: 'POST', key: options?.idempotencyKey }))
      : demoStore.inviteMember(id, input, options),
    resendInvitation: async (id: number, invitationId: number, options?: MemberCommandOptions) => {
      if (mode !== 'backend') return demoStore.resendInvitation(id, invitationId, options)
      if (options?.expectedVersion == null) throw new Error('Thiếu phiên bản lời mời. Tải lại danh sách trước khi thử lại.')
      return invitation(await transport.command(path(id, `/invitations/${invitationId}/resend`), { expectedVersion: options.expectedVersion }, { method: 'POST', key: options.idempotencyKey }))
    },
    cancelInvitation: async (id: number, invitationId: number, options?: MemberCommandOptions) => {
      if (mode !== 'backend') return demoStore.cancelInvitation(id, invitationId, options)
      if (options?.expectedVersion == null) throw new Error('Thiếu phiên bản lời mời. Tải lại danh sách trước khi thử lại.')
      return invitation(await transport.command(path(id, `/invitations/${invitationId}/cancel`), { expectedVersion: options.expectedVersion }, { method: 'POST', key: options.idempotencyKey }))
    },
    // A7 (D28): PENDING or the caller's ACCEPTED membership; other states arrive as MSG-FE03-04/08/09 errors.
    previewInvitation: async (token: string, signedInEmail?: string): Promise<InvitationPreview> => {
      if (mode !== 'backend') return demoStore.previewInvitation(token, signedInEmail)
      const value = asRecord(await transport.get(`/api/invitations/accept?token=${encodeURIComponent(token)}`))
      const status = requiredOneOf(value.status, ['PENDING', 'ACCEPTED'] as const, 'trạng thái lời mời')
      return {
        status, farmId: requiredId(value.farmId, 'mã trại'), farmName: requiredText(value.farmName, 'tên trại'),
        timeZone: typeof value.timeZone === 'string' && value.timeZone ? value.timeZone : undefined,
        email: requiredText(value.email, 'email được mời'), role: requiredOneOf(value.role, invitedRoles, 'vai trò trong lời mời'),
        invitedBy: typeof value.invitedBy === 'string' && value.invitedBy ? value.invitedBy : undefined,
        sentAt: requiredText(value.sentAt, 'thời điểm gửi'), expiresAt: requiredText(value.expiresAt, 'thời điểm hết hạn'),
        membershipId: status === 'ACCEPTED' ? requiredId(value.membershipId, 'mã thành viên') : undefined,
      }
    },
    // A8 (D28): no Idempotency-Key; the link token is the intent and a repeat returns the same membership.
    acceptInvitation: async (token: string, signedInEmail?: string): Promise<AcceptedInvitation> => {
      if (mode !== 'backend') return demoStore.acceptInvitation(token, signedInEmail)
      const value = asRecord(await command('/api/invitations/accept', { token }, 'POST'))
      return {
        membershipId: requiredId(value.membershipId, 'mã thành viên'), farmId: requiredId(value.farmId, 'mã trại'),
        farmName: requiredText(value.farmName, 'tên trại'), role: requiredOneOf(value.role, invitedRoles, 'vai trò trong trại'),
      }
    },
  }
}

export const farmWorkspaceApi = createFarmWorkspaceApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })
