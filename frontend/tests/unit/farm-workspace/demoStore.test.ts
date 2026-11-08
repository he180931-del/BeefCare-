import { describe, expect, it } from 'vitest'
import { createFarmWorkspaceDemoStore } from '../../../src/features/farm-workspace/data/farmWorkspaceDemoStore'

const registration = {
  name: 'Trại bò Thung Mây', province: 'Phú Thọ', commune: 'Xã Minh Đài', detailedAddress: '', contactPerson: 'Nguyễn Văn Hùng',
  contactPhone: '0912345678', registrationCertificateInfo: '', expectedHerdSize: '150_300' as const, mainBreedCodes: ['VANG'],
}

describe('farm workspace local demo store', () => {
  it('completes Owner onboarding and creates a farm with the default service state', async () => {
    const store = createFarmWorkspaceDemoStore()
    const profile = await store.completeOwnerRegistration({ fullName: 'Nguyễn Văn An', phone: '0912345678', termsAccepted: true })
    expect(profile.ownerRegistrationCompleted).toBe(true)
    expect(profile.fullName).toBe('Nguyễn Văn An')

    const farm = await store.registerFarm(registration)
    expect(farm.serviceStatus).toBe('PENDING_PAYMENT')
    expect(farm.timeZone).toBe('Asia/Ho_Chi_Minh')
    expect(farm.name).toBe('Trại bò Thung Mây')
    expect((await store.listMembers(farm.id)).filter((member) => member.role === 'OWNER')).toHaveLength(1)
  })

  it('R-02-02 returns the farm already created for a repeated request key and rejects that key with other data', async () => {
    const store = createFarmWorkspaceDemoStore()
    const first = await store.registerFarm(registration, { idempotencyKey: 'key-1' })
    const again = await store.registerFarm(registration, { idempotencyKey: 'key-1' })
    expect(again.id).toBe(first.id)
    expect((await store.listFarms()).filter((farm) => farm.name === registration.name)).toHaveLength(1)
    await expect(store.registerFarm({ ...registration, name: 'Trại khác' }, { idempotencyKey: 'key-1' })).rejects.toThrow()
    // TC-02-05: the same name with a new key is a second farm
    expect((await store.registerFarm(registration, { idempotencyKey: 'key-2' })).id).not.toBe(first.id)
  })

  it('stores a blank expected herd size as not provided', async () => {
    const store = createFarmWorkspaceDemoStore()
    expect((await store.registerFarm({ ...registration, expectedHerdSize: '' })).expectedHerdSize).toBe('')
  })

  it('supports invitation status changes and member role lifecycle', async () => {
    const store = createFarmWorkspaceDemoStore()
    const farm = (await store.listFarms())[0]
    const invitation = await store.inviteMember(farm.id, { email: 'new.manager@beefcare.vn', role: 'MANAGER', validityDays: 7 })
    expect(invitation.status).toBe('PENDING')
    expect((await store.listInvitations(farm.id, 'PENDING')).some((item) => item.id === invitation.id)).toBe(true)

    const resent = await store.resendInvitation(farm.id, invitation.id)
    expect(resent.version).toBe(invitation.version + 1)
    expect((await store.cancelInvitation(farm.id, invitation.id)).status).toBe('CANCELLED')

    const manager = (await store.listMembers(farm.id)).find((member) => member.role === 'MANAGER')!
    const deactivated = await store.changeMember(farm.id, manager.id, { action: 'DEACTIVATE', effectiveDate: '2026-11-01', reason: 'Thay đổi nhân sự' })
    expect(deactivated.status).toBe('INACTIVE')
    const reactivated = await store.changeMember(farm.id, manager.id, { action: 'REACTIVATE', effectiveDate: '2026-11-01', reason: 'Quay lại làm việc' })
    expect(reactivated.status).toBe('ACTIVE')
  })

  it('blocks a mismatched invitation email and accepts a matching one', async () => {
    const token = 'mock-invitation-token'
    const owner = createFarmWorkspaceDemoStore()
    const preview = await owner.previewInvitation(token)
    expect(preview.farmName).toBe('Trại bò Yên Bài – Ba Vì')
    await expect(owner.acceptInvitation(token)).rejects.toThrow('Email đăng nhập không khớp')

    const invitee = createFarmWorkspaceDemoStore({ profile: { email: 'technician@beefcare.local' } })
    const accepted = await invitee.acceptInvitation(token)
    expect(accepted.status).toBe('ACTIVE')
    expect((await invitee.listFarms()).some((farm) => farm.name === 'Trại bò Yên Bài – Ba Vì' && farm.role === 'TECHNICIAN')).toBe(true)
  })

  it('updates farm information without changing service or owner status', async () => {
    const store = createFarmWorkspaceDemoStore()
    const farm = (await store.listFarms())[0]
    const updated = await store.updateFarm(farm.id, { ...registration, name: 'Trại bò Ba Vì mới', timeZone: 'Asia/Ho_Chi_Minh', morningShiftStart: '06:00', operatingNotes: 'Cập nhật ca sáng' })
    expect(updated.name).toBe('Trại bò Ba Vì mới')
    expect(updated.serviceStatus).toBe(farm.serviceStatus)
    expect(updated.role).toBe('OWNER')
  })
})
