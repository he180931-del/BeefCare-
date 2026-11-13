import { describe, expect, it } from 'vitest'
import { createFarmWorkspaceDemoStore } from '../../../src/features/farm-workspace/data/farmWorkspaceDemoStore'
import { EXPIRED_TOKEN, SAMPLE_TOKEN } from '../../../src/features/farm-workspace/data/farmWorkspaceSeed'
import { PERMISSION_AREAS, permissionRowsFor } from '../../../src/features/farm-workspace/domain/rolePermissions'

describe('farm workspace seed data (Figma frames)', () => {
  it('lists the four farms of the Select Farm frame with their service states and roles', async () => {
    const farms = await createFarmWorkspaceDemoStore().listFarms()
    expect(farms.map((farm) => [farm.name, farm.role, farm.serviceStatus, farm.activeCattleCount])).toEqual([
      ['Trại bò Yên Bài – Ba Vì', 'OWNER', 'ACTIVE', 248],
      ['Trại Tản Lĩnh', 'OWNER', 'PENDING_PAYMENT', 0],
      ['Trại Cẩm Lĩnh', 'MANAGER', 'ACTIVE', 132],
      ['Trại Suối Hai', 'OWNER', 'SUSPENDED', 61],
    ])
  })

  it('has seven members (one inactive) and invitations in every status', async () => {
    const store = createFarmWorkspaceDemoStore()
    const { items: members, counts: memberCounts } = await store.listMembers(1)
    expect(members).toHaveLength(7)
    // D29 Q3: Technicians counts ACTIVE technicians only; the inactive one is in Inactive
    expect(memberCounts).toEqual({ all: 7, managers: 2, technicians: 3, inactive: 1 })
    expect(members.filter((member) => member.status === 'INACTIVE').map((member) => member.fullName)).toEqual(['Bùi Văn Khoa'])
    const counts = Object.fromEntries(await Promise.all((['PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED'] as const).map(async (status) => [status, (await store.listInvitations(1, { status })).total])))
    expect(counts).toEqual({ PENDING: 2, ACCEPTED: 6, EXPIRED: 1, CANCELLED: 1 })
  })

  it('numbers a newly registered farm after the seeded ones', async () => {
    const store = createFarmWorkspaceDemoStore()
    const farm = await store.registerFarm({ name: 'Trại mới', province: 'Hà Nội', commune: 'Xã A', expectedHerdSize: '50_149' })
    expect(farm.id).toBe(5)
    expect(await store.listFarms()).toHaveLength(5)
  })
})

describe('invitation tokens', () => {
  it('previews the expired sample without accepting it', async () => {
    const store = createFarmWorkspaceDemoStore({ profile: { email: 'technician@beefcare.local' } })
    await expect(store.previewInvitation(EXPIRED_TOKEN)).rejects.toMatchObject({ code: 'MSG-FE03-08', params: { status: 'EXPIRED' } })
    await expect(store.acceptInvitation(EXPIRED_TOKEN)).rejects.toThrow('không còn hiệu lực')
    await expect(store.previewInvitation('khong-co')).rejects.toMatchObject({ code: 'MSG-FE03-08', params: { status: 'INVALID' } })
  })

  it('accepts with the signed-in session email, not the store profile', async () => {
    const store = createFarmWorkspaceDemoStore()
    await expect(store.acceptInvitation(SAMPLE_TOKEN, 'owner@beefcare.local')).rejects.toThrow('không khớp')
    const member = await store.acceptInvitation(SAMPLE_TOKEN, 'Technician@BeefCare.local')
    expect(member).toMatchObject({ role: 'TECHNICIAN' })
    // AF2: reopening shows the same membership; accepting again returns it (D28)
    expect(await store.previewInvitation(SAMPLE_TOKEN, 'technician@beefcare.local')).toMatchObject({ status: 'ACCEPTED', membershipId: member.membershipId })
    expect(await store.acceptInvitation(SAMPLE_TOKEN, 'technician@beefcare.local')).toEqual(member)
  })
})

describe('role permissions (Table III-2)', () => {
  it('lists the 17 SRS areas for the three roles, with the SRS wording and the same levels as SCR-08 (D29)', () => {
    expect(PERMISSION_AREAS).toHaveLength(17)
    // Same FULL / RESTRICTED / NO matrix as the SCR-08 backend (AccountResource#permissionEntries)
    const backend: Record<string, [string, string, string]> = {
      CATTLE_PROFILE_QR: ['FULL', 'FULL', 'RESTRICTED'], PENS_AND_MOVES: ['FULL', 'FULL', 'RESTRICTED'], HERD_ENTRY_AND_PAYMENTS: ['FULL', 'FULL', 'NO'],
      GROWTH_BCS: ['RESTRICTED', 'FULL', 'RESTRICTED'], VACCINATION: ['RESTRICTED', 'FULL', 'RESTRICTED'], HEALTH_AND_TREATMENT: ['RESTRICTED', 'FULL', 'RESTRICTED'],
      REPRODUCTION: ['RESTRICTED', 'FULL', 'RESTRICTED'], CATALOGUES_AND_PARAMETERS: ['RESTRICTED', 'FULL', 'RESTRICTED'], FARM_ANNOUNCEMENTS: ['FULL', 'FULL', 'RESTRICTED'],
      REMINDERS: ['RESTRICTED', 'RESTRICTED', 'RESTRICTED'], DASHBOARD_AND_REPORTS: ['RESTRICTED', 'RESTRICTED', 'NO'], MEMBERS_ROLES: ['FULL', 'RESTRICTED', 'NO'],
      HERD_EXIT_AND_COLLECTIONS: ['FULL', 'RESTRICTED', 'NO'], FEED_STOCK_AND_CATALOGUE: ['FULL', 'FULL', 'RESTRICTED'], FEEDING_LOG: ['RESTRICTED', 'FULL', 'RESTRICTED'],
      SUBSCRIPTION_AND_PAYMENT: ['FULL', 'NO', 'NO'], FARM_INFORMATION: ['FULL', 'NO', 'NO'],
    }
    const code = { full: 'FULL', view: 'RESTRICTED', none: 'NO' } as const
    expect(Object.fromEntries(PERMISSION_AREAS.map((area) => [area.code, (['OWNER', 'MANAGER', 'TECHNICIAN'] as const).map((role) => code[area.access[role].level])]))).toEqual(backend)
    // "—" exactly where the role has no access
    PERMISSION_AREAS.forEach((area) => (['OWNER', 'MANAGER', 'TECHNICIAN'] as const).forEach((role) => expect(area.access[role].text === null).toBe(area.access[role].level === 'none')))
    const members = PERMISSION_AREAS.find((area) => area.code === 'MEMBERS_ROLES')!
    expect([members.access.OWNER.text, members.access.MANAGER.text, members.access.TECHNICIAN.text]).toEqual(['Quản lý', 'Xem danh sách', null])
    expect(permissionRowsFor('OWNER')).toHaveLength(17)
    expect(permissionRowsFor('MANAGER').map((row) => row.label)).not.toContain('Gói dịch vụ & thanh toán')
    expect(permissionRowsFor('TECHNICIAN')).toHaveLength(15)
  })
})
