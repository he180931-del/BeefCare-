import { describe, expect, it, vi } from 'vitest'
import { createAnnouncementsApi } from '../../../src/features/farm-announcements/api/announcementsApi'
import { createAnnouncementsDemoStore } from '../../../src/features/farm-announcements/data/announcementsDemoStore'
import { markdownToEditorFragment, parseRichText, safeAnnouncementHref, serializeRichText } from '../../../src/features/farm-announcements/domain/richText'
import { BODY_MAX, resolveRecipients, validateText } from '../../../src/features/farm-announcements/domain/announcementRules'
import type { AudienceSelection, Viewer } from '../../../src/features/farm-announcements/types'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const NOW = new Date('2026-10-20T09:31:00+07:00')
const make = () => {
  const store = createAnnouncementsDemoStore(undefined, { now: () => NOW })
  return { store, api: createAnnouncementsApi({ mode: 'local', farmId: 1, transport: transport(), store }) }
}
const owner: Viewer = { name: 'Nguyễn Văn Hùng', role: 'OWNER' }
const long: Viewer = { name: 'Trần Quốc Long', role: 'MANAGER' }
const mai: Viewer = { name: 'Lê Thị Mai', role: 'TECHNICIAN' }
const tu: Viewer = { name: 'Phạm Văn Tú', role: 'TECHNICIAN' }
const techs: AudienceSelection = { allManagers: false, allTechnicians: true, memberIds: [] }

describe('visibility and tabs', () => {
  it('shows each viewer only what they received or wrote, and drafts only to the author', async () => {
    const { api } = make()
    const manager = await api.list(long)
    expect(manager.filter((a) => a.isReceived).map((a) => a.id)).toEqual([3, 4])
    expect(manager.find((a) => a.id === 3)?.latestVersionId).toBe(4)
    expect(manager.filter((a) => a.isAuthor && a.state === 'PUBLISHED')).toHaveLength(4)
    expect(manager.filter((a) => a.state === 'DRAFT')).toHaveLength(1)
    expect((await api.list(mai)).some((a) => a.state === 'DRAFT')).toBe(false)
    await expect(api.get(7, mai)).rejects.toThrow('Bạn không có quyền')
    expect((await api.listUnread(mai)).map((a) => a.id)).toEqual([1])
  })

  it('shows delivery status only to the author of a published announcement', async () => {
    const { api } = make()
    const asAuthor = await api.get(1, long)
    expect(asAuthor.deliveries?.map((d) => d.status)).toEqual(['DELIVERED', 'DELIVERED', 'READ'])
    expect((await api.get(1, mai)).deliveries).toBeNull()
  })
})

describe('recipient rules (GBR-60)', () => {
  it('lets a Manager address Technicians only and removes duplicates and the sender', async () => {
    const { store } = make()
    const members = (await store.listMembers(long)).members
    expect(members.every((m) => m.role === 'TECHNICIAN')).toBe(true)
    expect(members.map((m) => m.name)).not.toContain('Bùi Văn Nam')

    const state = { allManagers: false, allTechnicians: true, memberIds: [4, 4, 5] }
    const author = { id: 2, name: 'Trần Quốc Long', role: 'MANAGER' as const, active: true }
    const all = [author, ...members]
    expect(resolveRecipients(all, state, author).recipients.map((m) => m.id)).toEqual([4, 5, 6])
    expect(resolveRecipients(all, { ...state, allManagers: true }, author).invalid).toBe(true)
  })

  it('rejects a draft that addresses a role the author may not (MSG-FE07-02)', async () => {
    const { api } = make()
    await expect(api.saveDraft(long, { title: 'Gửi quản lý', body: 'x', audience: { ...techs, allManagers: true } })).rejects.toThrow('không được phép')
    await expect(api.saveDraft(mai, { title: 'x', body: 'x', audience: techs })).rejects.toThrow('Bạn không có quyền')
  })
})

describe('draft, review and publish', () => {
  it('saves a draft, revalidates it on edit and publishes once as version 1 with a recipient snapshot', async () => {
    const { api } = make()
    await expect(api.saveDraft(long, { title: '  ', body: 'nội dung', audience: techs })).rejects.toThrow('Tiêu đề là bắt buộc.')

    const draft = await api.saveDraft(long, { title: 'Họp giao ban', body: 'Họp 7h sáng thứ Hai.', audience: techs })
    expect(draft).toMatchObject({ state: 'DRAFT', version: 1, recipientCount: 0 })
    const edited = await api.saveDraft(long, { id: draft.id, title: 'Họp giao ban tuần', body: 'Họp 7h sáng thứ Hai.', audience: techs, expectedVersion: 1 })
    expect(edited.version).toBe(2)
    await expect(api.saveDraft(long, { id: draft.id, title: 'Cũ', body: 'x', audience: techs, expectedVersion: 1 })).rejects.toThrow('đã thay đổi')

    const preview = await api.previewPublish(long, draft.id)
    expect(preview.recipients.map((m) => m.name)).toEqual(['Lê Thị Mai', 'Phạm Văn Tú', 'Đinh Văn Sơn'])

    const published = await api.publish(long, draft.id, 2)
    expect(published.recipientCount).toBe(3)
    expect(published.announcement).toMatchObject({ state: 'PUBLISHED', version: 1, publishedTime: NOW.toISOString() })
    expect((await api.listUnread(tu)).map((a) => a.id)).toContain(draft.id)
    await expect(api.publish(long, draft.id, 2)).rejects.toThrow('đã thay đổi')
  })

  it('keeps a draft with no eligible recipient as a draft (MSG-FE07-05) and blocks other authors', async () => {
    const { api, store } = make()
    const draft = await api.saveDraft(long, { title: 'Không ai nhận', body: 'x', audience: { allManagers: false, allTechnicians: false, memberIds: [] } })
    await expect(api.publish(long, draft.id, draft.version)).rejects.toThrow('Không có người nhận hợp lệ')
    expect((await api.get(draft.id, long)).state).toBe('DRAFT')
    await expect(api.publish(owner, draft.id, draft.version)).rejects.toThrow('Bạn không có quyền')
    await store.deactivateMember(4)
    await store.deactivateMember(5)
    await store.deactivateMember(6)
    const noOne = await api.saveDraft(long, { id: 7, title: 'Lịch cân', body: 'x', audience: techs, expectedVersion: 1 })
    await expect(api.publish(long, noOne.id, noOne.version)).rejects.toThrow('Không có người nhận hợp lệ')
  })
})

describe('correction (GBR-62)', () => {
  it('needs a reason, creates the next version, keeps history and resets unread for the original recipients', async () => {
    const { api } = make()
    await expect(api.correct(long, 1, { title: 'T', body: 'B', reason: ' ', expectedVersion: 1 })).rejects.toThrow('Lý do đính chính là bắt buộc.')
    await expect(api.correct(owner, 1, { title: 'T', body: 'B', reason: 'R', expectedVersion: 1 })).rejects.toThrow('Bạn không có quyền')

    await api.markRead(mai, 1)
    expect((await api.get(1, mai)).unread).toBe(false)
    const fixed = await api.correct(long, 1, { title: 'Lịch tiêm LMLM mũi 2 (đã sửa)', body: 'Tiêm vào thứ Ba.', reason: 'Đổi ngày tiêm', expectedVersion: 1 })
    expect(fixed.version).toBe(2)
    expect(fixed.versions.map((v) => [v.versionNo, v.correctionReason])).toEqual([[2, 'Đổi ngày tiêm'], [1, null]])
    expect(fixed.deliveries?.every((d) => d.status === 'DELIVERED')).toBe(true)
    expect((await api.get(1, mai)).unread).toBe(true)
    await expect(api.correct(long, 1, { title: 'T', body: 'B', reason: 'R', expectedVersion: 1 })).rejects.toThrow('đã thay đổi')
  })

  it('does not deliver the correction to members who left', async () => {
    const { api, store } = make()
    await store.deactivateMember(5)
    const fixed = await api.correct(long, 1, { title: 'T', body: 'B', reason: 'Sửa', expectedVersion: 1 })
    expect(fixed.recipientCount).toBe(2)
  })

  it('does not let drafts be corrected or published announcements be saved as drafts', async () => {
    const { api } = make()
    await expect(api.correct(long, 7, { title: 'T', body: 'B', reason: 'R', expectedVersion: 1 })).rejects.toThrow()
    await expect(api.saveDraft(long, { id: 1, title: 'T', body: 'B', audience: techs, expectedVersion: 1 })).rejects.toThrow('đã thay đổi')
  })
})

describe('reading', () => {
  it('marks the delivery read once and keeps the first read time', async () => {
    let now = new Date('2026-10-20T09:31:00+07:00')
    const store = createAnnouncementsDemoStore(undefined, { now: () => now })
    const api = createAnnouncementsApi({ mode: 'local', farmId: 1, transport: transport(), store })
    expect((await api.markRead(mai, 1))?.readTime).toBe(now.toISOString())
    const first = now.toISOString()
    now = new Date('2026-10-20T11:00:00+07:00')
    expect((await api.markRead(mai, 1))?.readTime).toBe(first)
    expect(await api.markRead(long, 1)).toBeNull()
    expect((await api.get(1, long)).deliveries?.find((d) => d.name === 'Lê Thị Mai')?.status).toBe('READ')
  })
})

describe('rich text', () => {
  it('parses bold, italic, lists and only safe links', () => {
    const blocks = parseRichText('Chào **cả nhà** và _mọi người_\n- một\n- hai\n1. a\n2. b\n[xem](https://x.vn) [bad](javascript:alert(1))')
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul', 'ol', 'p'])
    const last = blocks[3]
    expect(last.type === 'p' && last.inline.filter((i) => i.type === 'link')).toHaveLength(1)
  })

  it('round trips semantic formats, actual links, lists, and blank paragraphs', () => {
    const markdown = 'Chào **cả nhà** và _mọi người_\n- một\n- hai\n1. a\n2. b\n[xem](https://x.vn)\n[**xem đậm**](https://example.com)\n\nđoạn sau'
    const editor = document.createElement('div')
    editor.appendChild(markdownToEditorFragment(markdown))
    expect(serializeRichText(editor)).toBe(markdown)
    expect(safeAnnouncementHref('javascript:alert(1)')).toBeNull()
    expect(safeAnnouncementHref('https://example.com/a')).toBe('https://example.com/a')
  })

  it('unwraps pasted HTML and rejects unsafe link targets before storage', () => {
    const editor = document.createElement('div')
    editor.innerHTML = '<p><script>alert(1)</script><strong>safe</strong><a href="javascript:alert(1)">bad link</a></p>'
    expect(serializeRichText(editor)).toBe('alert(1)**safe**bad link')
  })

  it('enforces the 5,000-character backend body limit on serialized Markdown', () => {
    expect(validateText({ body: 'x'.repeat(BODY_MAX) }).body).toBeUndefined()
    expect(validateText({ body: 'x'.repeat(BODY_MAX + 1) }).body).toMatch(/5\.000/)
  })
})

describe('backend mode', () => {
  const publishedRow = (overrides: Record<string, unknown> = {}) => ({
    id: 8,
    state: 'PUBLISHED',
    authorName: 'Người quản lý',
    authorRole: 'MANAGER',
    draftTitle: 'Thông báo ca trực',
    draftBody: 'Nội dung',
    title: 'Thông báo ca trực',
    body: 'Nội dung',
    version: 2,
    recipientRoles: ['TECHNICIAN'],
    recipientMemberIds: [],
    versions: [{ id: 18, versionNo: 1, title: 'Thông báo ca trực', body: 'Nội dung', publishedTime: '2026-11-14T03:00:00Z', correctionReason: null, unread: false }],
    recipientCount: 1,
    deliveries: [{ recipientId: 28, name: 'Kỹ thuật viên', role: 'TECHNICIAN', status: 'DELIVERED', readTime: null }],
    publishedTime: '2026-11-14T03:00:00Z',
    farmName: 'Trại mẫu',
    unread: false,
    readTime: null,
    isAuthor: true,
    isReceived: false,
    canCorrect: true,
    myDeliveryId: null,
    ...overrides,
  })

  it('reads the real API without falling back to the demo store', async () => {
    const store = createAnnouncementsDemoStore()
    const spy = vi.spyOn(store, 'list')
    const backend = {
      get: vi.fn(async (path: string) => path.endsWith('/announcements/8') ? publishedRow() : [publishedRow()]),
      command: vi.fn(),
      farmPath: (farmId: string | number, suffix = '') => `/api/farms/${farmId}${suffix}`,
    }
    const api = createAnnouncementsApi({ mode: 'backend', farmId: 1, transport: backend, store })
    await expect(api.list(long)).resolves.toMatchObject([{ id: 8, title: 'Thông báo ca trực', versionNo: 1, recipientCount: 1 }])
    expect(backend.get).toHaveBeenCalledWith('/api/farms/1/announcements')
    await expect(api.get(8, long)).resolves.toMatchObject({ id: 8, versions: [{ versionNo: 1 }], deliveries: [{ recipientId: 28 }], isAuthor: true })
    expect(backend.get).toHaveBeenCalledWith('/api/farms/1/announcements/8')
    await expect(api.listUnread(mai)).resolves.toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('uses the FE-07 recipient-options API and limits recipient choices to roles allowed for the author', async () => {
    const store = createAnnouncementsDemoStore()
    const backend = {
      get: vi.fn(async (path: string) => path.endsWith('/announcements/recipients') ? [
        { id: 2, name: 'Quản lý', role: 'MANAGER', active: true },
        { id: 3, name: 'Kỹ thuật viên', role: 'TECHNICIAN', active: true },
      ] : []),
      command: vi.fn(),
      farmPath: (farmId: string | number, suffix = '') => `/api/farms/${farmId}${suffix}`,
    }
    const api = createAnnouncementsApi({ mode: 'backend', farmId: 9, transport: backend, store })

    await expect(api.listMembers(long)).resolves.toEqual({
      members: [{ id: 3, name: 'Kỹ thuật viên', role: 'TECHNICIAN', active: true }],
      managerCount: 0,
      technicianCount: 1,
    })
    expect(backend.get).toHaveBeenCalledWith('/api/farms/9/announcements/recipients')
  })

  it('sends role and member selectors, optimistic versions and idempotency keys', async () => {
    const store = createAnnouncementsDemoStore()
    const posted: Array<{ path: string; body: unknown; options: unknown }> = []
    const backend = {
      get: vi.fn(async (path: string) => path.endsWith('/preview')
        ? { announcement: publishedRow({ state: 'DRAFT', canCorrect: false, recipientCount: 0, deliveries: null, publishedTime: null }), recipients: [{ id: 3, name: 'Kỹ thuật viên', role: 'TECHNICIAN', active: true }] }
        : path.endsWith('/announcements/8') ? publishedRow({ myDeliveryId: 28 }) : [publishedRow({ myDeliveryId: 28 })]),
      command: vi.fn(async (path: string, body: unknown, options: unknown) => {
        posted.push({ path, body, options })
        if (path.endsWith('/read')) return { recipientId: 28, readTime: '2026-11-14T03:10:00Z' }
        return publishedRow({ version: 3, recipientCount: 1, versions: [{ id: 19, versionNo: 2, title: 'Sửa', body: 'Nội dung', publishedTime: '2026-11-14T03:20:00Z', correctionReason: 'Đổi lịch', unread: false }] })
      }),
      farmPath: (farmId: string | number, suffix = '') => `/api/farms/${farmId}${suffix}`,
    }
    const api = createAnnouncementsApi({ mode: 'backend', farmId: 9, transport: backend, store })

    await api.saveDraft(long, { title: 'Tiêu đề', body: 'Nội dung', audience: techs })
    await api.saveDraft(long, { id: 8, title: 'Sửa nháp', body: 'Nội dung', audience: techs, expectedVersion: 2 })
    await api.publish(long, 8, 2)
    await api.correct(long, 8, { title: 'Sửa', body: 'Nội dung', reason: 'Đổi lịch', expectedVersion: 3 })
    await expect(api.markRead(mai, 8)).resolves.toEqual({ recipientId: 28, readTime: '2026-11-14T03:10:00Z' })
    expect(backend.get).toHaveBeenCalledWith('/api/farms/9/announcements/8')

    expect(posted.map(({ path, body }) => [path, body])).toEqual([
      ['/api/farms/9/announcements/drafts', { title: 'Tiêu đề', body: 'Nội dung', recipientRoles: ['TECHNICIAN'], recipientMemberIds: [] }],
      ['/api/farms/9/announcements/8/draft', { title: 'Sửa nháp', body: 'Nội dung', recipientRoles: ['TECHNICIAN'], recipientMemberIds: [], expectedVersion: 2 }],
      ['/api/farms/9/announcements/8/publish', { expectedVersion: 2 }],
      ['/api/farms/9/announcements/8/corrections', { title: 'Sửa', body: 'Nội dung', reason: 'Đổi lịch', expectedVersion: 3 }],
      ['/api/farms/9/announcements/recipients/28/read', undefined],
    ])
    expect(posted.every((item) => typeof (item.options as { key?: unknown }).key === 'string')).toBe(true)
  })

  it('roundtrips named FarmMembership IDs in backend mode without dropping them', async () => {
    const store = createAnnouncementsDemoStore()
    const draftRow = publishedRow({ state: 'DRAFT', recipientRoles: [], recipientMemberIds: [3], versions: [], recipientCount: 0, deliveries: null, publishedTime: null, canCorrect: false })
    const backend = {
      get: vi.fn(),
      command: vi.fn(async () => draftRow),
      farmPath: (farmId: string | number, suffix = '') => `/api/farms/${farmId}${suffix}`,
    }
    const api = createAnnouncementsApi({ mode: 'backend', farmId: 1, transport: backend, store })
    const saved = await api.saveDraft(owner, { title: 'T', body: 'B', audience: { allManagers: false, allTechnicians: false, memberIds: [3, 3] } })

    expect(backend.command).toHaveBeenCalledWith('/api/farms/1/announcements/drafts', {
      title: 'T', body: 'B', recipientRoles: [], recipientMemberIds: [3],
    }, expect.objectContaining({ method: 'POST' }))
    expect(saved.audience).toEqual({ allManagers: false, allTechnicians: false, memberIds: [3] })
  })
})
