import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

describe('backend cattle profile commands', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    vi.stubEnv('VITE_BEEFCARE_FARM_ID', '9')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('preserves every profile field when changing identity, stage or purpose', async () => {
    const puts: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/csrf') return json({ token: 'csrf' })
      if (url.pathname.endsWith('/profile')) {
        puts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return json({ id: 42 })
      }
      throw new Error(`Unexpected request ${url.pathname}`)
    })

    const { updateIdentity, updatePurpose, updateStage } = await import('../../../src/api/cattleApi')
    const current = {
      earTagNumber: 'EAR-42', name: 'Tên cũ', colourMarkings: 'Đốm trắng', notes: 'Ghi chú cũ',
      productionPurposeId: 31, lifeStage: 'ADULT', effectiveDate: '2026-10-30', reason: 'Kiểm tra', expectedVersion: 7,
    }
    const context = { backendId: 42, backendVersion: 7, currentProfile: current }

    await updateIdentity('BC-042', { name: 'Tên mới', tag: 'EAR-NEW', description: 'Đốm mới' }, context)
    await updateStage('BC-042', { stage: 'YOUNG_STOCK', date: '2026-10-30', reason: 'Đủ tuổi' }, context)
    await updatePurpose('BC-042', 32, context)

    expect(puts[0]).toMatchObject({ earTagNumber: 'EAR-NEW', name: 'Tên mới', colourMarkings: 'Đốm mới', notes: 'Ghi chú cũ', productionPurposeId: 31, lifeStage: 'ADULT' })
    expect(puts[1]).toMatchObject({ earTagNumber: 'EAR-42', name: 'Tên cũ', colourMarkings: 'Đốm trắng', notes: 'Ghi chú cũ', productionPurposeId: 31, lifeStage: 'YOUNG_STOCK' })
    expect(puts[2]).toMatchObject({ earTagNumber: 'EAR-42', name: 'Tên cũ', colourMarkings: 'Đốm trắng', notes: 'Ghi chú cũ', productionPurposeId: 32, lifeStage: 'ADULT' })
    for (const body of puts) {
      expect(body).toHaveProperty('effectiveDate')
      expect(body).toHaveProperty('reason')
      expect(body).toHaveProperty('expectedVersion', 7)
    }
  })

  it('does not clear unchanged identity fields when the identity form omits them', async () => {
    const puts: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/csrf') return json({ token: 'csrf' })
      if (url.pathname.endsWith('/profile')) {
        puts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return json({ id: 42 })
      }
      throw new Error(`Unexpected request ${url.pathname}`)
    })

    const { updateIdentity } = await import('../../../src/api/cattleApi')
    await updateIdentity('BC-042', { name: 'Tên mới' }, {
      backendId: 42,
      backendVersion: 7,
      currentProfile: { earTagNumber: 'EAR-42', name: 'Tên cũ', colourMarkings: 'Đốm trắng', notes: 'Ghi chú cũ', productionPurposeId: 31, lifeStage: 'ADULT' },
    })

    expect(puts[0]).toMatchObject({
      earTagNumber: 'EAR-42',
      name: 'Tên mới',
      colourMarkings: 'Đốm trắng',
      notes: 'Ghi chú cũ',
    })
  })

  it('passes reproduction acknowledgement with a life-stage change', async () => {
    const puts: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/csrf') return json({ token: 'csrf' })
      if (url.pathname.endsWith('/profile')) {
        puts.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return json({ id: 42 })
      }
      throw new Error(`Unexpected request ${url.pathname}`)
    })

    const { updateStage } = await import('../../../src/api/cattleApi')
    await updateStage('BC-042', { stage: 'UNWEANED_CALF', date: '2026-10-30', reason: 'Xác nhận', acknowledgedReproductionChange: true }, {
      backendId: 42,
      backendVersion: 7,
      currentProfile: { earTagNumber: 'EAR-42', name: 'Tên cũ', colourMarkings: 'Đốm trắng', notes: 'Ghi chú cũ', productionPurposeId: 31, lifeStage: 'ADULT' },
    })

    expect(puts[0]).toMatchObject({ lifeStage: 'UNWEANED_CALF', acknowledgedReproductionChange: true })
  })
})
