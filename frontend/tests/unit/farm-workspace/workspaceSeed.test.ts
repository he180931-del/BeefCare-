import { describe, expect, it } from 'vitest'
import { createFarmWorkspaceDemoStore } from '../../../src/features/farm-workspace/data/farmWorkspaceDemoStore'
import { EXPIRED_TOKEN, SAMPLE_TOKEN } from '../../../src/features/farm-workspace/data/farmWorkspaceSeed'
import { permissionRowsFor } from '../../../src/features/farm-workspace/domain/rolePermissions'

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
    const members = await store.listMembers(1)
    expect(members).toHaveLength(7)
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
    expect((await store.previewInvitation(EXPIRED_TOKEN)).status).toBe('EXPIRED')
    await expect(store.acceptInvitation(EXPIRED_TOKEN)).rejects.toThrow('không còn hiệu lực')
    await expect(store.previewInvitation('khong-co')).rejects.toThrow('không còn hiệu lực')
  })

  it('accepts with the signed-in session email, not the store profile', async () => {
    const store = createFarmWorkspaceDemoStore()
    await expect(store.acceptInvitation(SAMPLE_TOKEN, 'owner@beefcare.local')).rejects.toThrow('không khớp')
    const member = await store.acceptInvitation(SAMPLE_TOKEN, 'Technician@BeefCare.local')
    expect(member).toMatchObject({ role: 'TECHNICIAN', status: 'ACTIVE' })
    expect((await store.previewInvitation(SAMPLE_TOKEN)).status).toBe('ACCEPTED')
  })
})

describe('role permissions (Table III-2)', () => {
  it('gives the Manager ten areas, the Technician view-only access, and keeps Owner-only areas off both', () => {
    expect(permissionRowsFor('MANAGER')).toHaveLength(10)
    expect(permissionRowsFor('MANAGER').every((row) => row.level === 'full')).toBe(true)
    expect(permissionRowsFor('OWNER')).toHaveLength(14)
    const technician = permissionRowsFor('TECHNICIAN')
    expect(technician.find((row) => row.label === 'Tiêm phòng')?.level).toBe('view')
    expect(technician.find((row) => row.label === 'Báo cáo & tổng quan')?.level).toBe('none')
  })
})
