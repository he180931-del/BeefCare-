import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { initialCows } from '../../../src/demo/data/cowsData'
import { purposeFitsSex } from '../../../src/features/cattle/domain/profileRules'
import { validateDatedChange, validateIdentity, validatePhoto, validateTag } from '../../../src/features/cattle/validation/profileValidation'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('FE-05 profile rules', () => {
  it('TC-05-10: ear tag 31, name 51, colour 256, notes 1.001 characters and a 6 MB or GIF photo are rejected', () => {
    const errors = validateIdentity({ tag: 'T'.repeat(31), name: 'N'.repeat(51), colour: 'C'.repeat(256), notes: 'G'.repeat(1001) })
    expect(Object.keys(errors).sort()).toEqual(['colour', 'name', 'notes', 'tag'])
    expect(validateIdentity({ tag: 'T'.repeat(30), name: 'N'.repeat(50), colour: 'C'.repeat(255), notes: 'G'.repeat(1000) })).toEqual({})
    expect(validatePhoto({ type: 'image/png', size: 6 * 1024 * 1024, name: 'a.png' })).toBe('Ảnh tối đa 5 MB.')
    expect(validatePhoto({ type: 'image/gif', size: 1000, name: 'a.gif' })).toBe('Ảnh phải là JPG hoặc PNG.')
    expect(validatePhoto({ type: 'image/jpeg', size: 1000, name: 'a.jpg' })).toBe('')
  })

  it('TC-05-12 / 13: SIRE only for males, BREEDING only for females, FATTENING and UNDECIDED for both', () => {
    expect(purposeFitsSex('BREEDING', 'MALE')).toBe(false)
    expect(purposeFitsSex('SIRE', 'FEMALE')).toBe(false)
    expect(purposeFitsSex('FATTENING', 'FEMALE')).toBe(true)
    expect(purposeFitsSex('UNDECIDED', 'MALE')).toBe(true)
  })

  it('TC-05-14: effective date before herd entry or in the future is rejected', () => {
    const base = { value: 'YOUNG_STOCK', current: 'WEANED_CALF', reason: 'Đủ tuổi', today: '2026-11-07', entryDate: '2026-10-10' }
    expect(validateDatedChange({ ...base, date: '2026-10-09' }).date).toBe('Ngày hiệu lực không được trước ngày nhập đàn 10/10/2026.')
    expect(validateDatedChange({ ...base, date: '2026-11-08' }).date).toBe('Ngày hiệu lực không được ở tương lai.')
    expect(validateDatedChange({ ...base, date: '2026-10-10' })).toEqual({})
  })

  it('TC-05-23 / 24: replacing needs a reason, the first issue does not', () => {
    expect(validateTag({ replacing: true, reason: '', tagCode: '', note: '' }).reason).toBe('Vui lòng chọn Lý do thay.')
    expect(validateTag({ replacing: false, reason: '', tagCode: '', note: '' })).toEqual({})
    expect(validateTag({ replacing: false, reason: '', tagCode: 'bad code!', note: '' }).tagCode).toBeTruthy()
    expect(validateTag({ replacing: false, reason: '', tagCode: '', note: 'x'.repeat(256) }).note).toBeTruthy()
  })
})

describe('FE-05 backend flows', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_BEEFCARE_DATA_SOURCE', 'backend')
    sessionStorage.setItem('beefcare.currentFarmId', '9')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    sessionStorage.removeItem('beefcare.currentFarmId')
  })

  it('opens a visible photo picker, saves and enlarges the photo, then removes it', async () => {
    const code = 'BC-PHOTO'
    const attachment = '/api/farms/9/attachments/77'
    const profile = { id: 42, displayCode: code, herdStatus: 'ACTIVE', canUpdate: true, version: 7, photoUrl: null as string | null }
    const writes: Array<{ method: string | undefined; version: string | null; file: unknown }> = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      const path = url.pathname
      if (path === '/api/csrf') return response({ token: 'csrf' })
      if (path.endsWith('/cattle/resolve')) return response({ cattleId: 42, cattle: profile })
      if (path.endsWith('/cattle/42')) return response(profile)
      if (path.endsWith('/pen-history')) return response({ history: [] })
      if (path.endsWith('/pens') || path.endsWith('/qr-tags') || path.endsWith('/timeline') || path.endsWith('/production-purposes')) return response([])
      if (path.endsWith('/cattle/42/photo')) {
        writes.push({ method: init?.method, version: url.searchParams.get('expectedVersion'), file: init?.body instanceof FormData ? init.body.get('file') : null })
        profile.photoUrl = init?.method === 'DELETE' ? null : attachment
        profile.version += 1
        return response({ id: 77 })
      }
      throw new Error(`Unexpected request ${path}`)
    })
    const { default: CowProfile } = await import('../../../src/features/cattle/pages/CowProfile')
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={[`/cattle/${code}`]}>
      <Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes>
    </MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: 'Thêm ảnh' }))
    expect(screen.getByRole('button', { name: 'Chọn ảnh' })).toBeVisible()
    const file = new File(['sample picture'], 'bo.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('Tệp ảnh bò'), file)
    expect(screen.getByText('bo.png')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText(`Đã thêm ảnh bò ${code}.`)).toBeVisible()
    expect(writes).toEqual([{ method: 'POST', version: '7', file }])

    const thumbnail = await screen.findByRole('button', { name: `Phóng to ảnh bò ${code}` })
    await user.click(thumbnail)
    const preview = screen.getByRole('dialog', { name: `Ảnh bò ${code}` })
    expect(within(preview).getByRole('img')).toHaveAttribute('src', attachment)
    await user.keyboard('{Escape}')
    expect(preview).not.toBeInTheDocument()
    expect(thumbnail).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Đổi ảnh' }))
    await user.click(screen.getByRole('button', { name: 'Xóa ảnh' }))
    expect(screen.getByText('Ảnh hiện tại sẽ được xóa khi lưu.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText(`Đã xóa ảnh bò ${code}.`)).toBeVisible()
    expect(await screen.findByRole('img', { name: 'Chưa có ảnh bò' })).toBeVisible()
    expect(writes[1]).toEqual({ method: 'DELETE', version: '8', file: null })
  })

  it('TC-05-16: asks MSG-FE05-11 and saves again with the acknowledgement', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/farms/9/catalogues/production-purposes') return response([])
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      if (url.pathname.endsWith('/profile')) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        bodies.push(body)
        return body.acknowledgedReproductionChange ? response({ id: 42, version: 8 }) : response({ code: 'MSG-FE05-11', params: { cattle_code: 'BC-000142' } }, 422)
      }
      throw new Error(`Unexpected backend request ${url.pathname}`)
    })
    const { default: UpdateModal } = await import('../../../src/features/cattle/components/UpdateModal')
    const onSaved = vi.fn()
    const cow = { ...initialCows[0], code: 'BC-000142', lifeStage: 'ADULT', purposeId: 31, backendId: 42, backendVersion: 7, canUpdate: true }
    const user = userEvent.setup()
    render(<UpdateModal cow={cow} onClose={() => undefined} onSaved={onSaved} today="2026-11-07" />)

    await user.selectOptions(screen.getByRole('combobox'), 'WEANED_CALF')
    await user.type(screen.getAllByRole('textbox')[1], 'Nhập nhầm giai đoạn')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Sau thay đổi này BC-000142 sẽ không còn được theo dõi sinh sản. Lịch sử sinh sản được giữ lại. Tiếp tục?')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('Đã cập nhật hồ sơ BC-000142.'))
    expect(bodies.map((b) => b.acknowledgedReproductionChange)).toEqual([false, true])
  })

  it('TC-05-24: the first QR issue asks no reason and sends none', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/csrf') return response({ token: 'csrf' })
      if (url.pathname.endsWith('/qr-tags')) { bodies.push(JSON.parse(String(init?.body))); return response({ tagCode: 'QR-NEW-1' }) }
      throw new Error(`Unexpected request ${url.pathname}`)
    })
    const { default: QrReissueModal } = await import('../../../src/features/cattle/components/QrReissueModal')
    const cow = { ...initialCows[0], qrHistory: [], backendId: 42, backendVersion: 7 }
    const user = userEvent.setup()
    render(<QrReissueModal cow={cow} onClose={() => undefined} onSaved={() => undefined} />)
    expect(screen.getByText(/Cấp thẻ QR –/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Lý do thay thẻ' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xác nhận thẻ mới' }))
    expect(await screen.findByText(`Thẻ QR QR-NEW-1 đã kích hoạt cho ${cow.code}.`)).toBeInTheDocument()
    expect(bodies[0]).toEqual({ cattleVersion: 7 })
  })

  const profile = { id: 42, displayCode: 'BC-SCAN', sex: 'FEMALE', breedName: 'Brahman', birthDate: '2024-01-01', birthDateAccuracy: 'EXACT', purposeName: 'Sinh sản', lifeStage: 'ADULT', herdStatus: 'ACTIVE', version: 3 }
  const scan = async (reply: () => Response) => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test')
      if (url.pathname === '/api/farms/9/cattle/resolve') return reply()
      throw new Error(`Unexpected request ${url.pathname}`)
    })
    const { scanCode } = await import('../../../src/features/cattle/api/scanApi')
    return scanCode('Q1')
  }

  it('TC-05-27: a replaced tag opens the cattle and names the current tag', async () => {
    const outcome = await scan(() => response({ farmId: 9, cattleId: 42, switchFarmRequired: false, replacedTag: true, cattle: profile, messageCode: 'MSG-FE05-05', currentTagCode: 'Q2', replacedAt: '2026-11-01T03:00:00Z' }))
    expect(outcome).toMatchObject({ kind: 'found', replaced: { scannedTag: 'Q1', currentTag: 'Q2', date: '01/11/2026' } })
  })

  it('TC-05-28: a cattle of another accessible farm asks to switch and carries no cattle data', async () => {
    const outcome = await scan(() => response({ farmId: 12, cattleId: null, switchFarmRequired: true, replacedTag: false, cattle: null, messageCode: 'MSG-FE05-06' }))
    expect(outcome).toEqual({ kind: 'otherFarm', farmId: 12 })
  })

  it('TC-05-29 / 31: unknown codes give MSG-FE05-09, a draft calf gives MSG-FE05-10', async () => {
    expect(await scan(() => response({ code: 'MSG-FE05-09' }, 404))).toEqual({ kind: 'rejected', code: 'MSG-FE05-09' })
    vi.resetModules()
    expect(await scan(() => response({ code: 'MSG-FE05-10' }, 404))).toEqual({ kind: 'rejected', code: 'MSG-FE05-10' })
  })
})
