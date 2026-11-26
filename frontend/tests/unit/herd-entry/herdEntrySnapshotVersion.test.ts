import { describe, expect, it, vi } from 'vitest'
import { createHerdEntryBackendApi, type BackendTransport } from '../../../src/features/herd-entry/api/herdEntryBackendApi'
import { BackendError } from '../../../src/shared/api/backendClient'
import { isVersionConflict, requireVersion } from '../../../src/shared/api/snapshotVersion'

const code = 'PN-2026-0041'
const root = '/api/farms/1/entry-vouchers'
const conflict = () => new BackendError(409, { code: 'MSG-COM-05' })
const record = { backendId: 41, type: 'Mua ngoài' as const, status: 'Nháp' as const, date: '2026-10-29' }
const payment = { date: '2026-10-29', amount: 100, method: 'Tiền mặt', ref: '' }

function setup(serverVersion: number | undefined = 9) {
  const dto = { id: 41, code, version: serverVersion, status: 'DRAFT', entryType: 'PURCHASE', entryDate: record.date }
  const get = vi.fn(async (path: string): Promise<unknown> => {
    if (path === root) return { items: [dto] }
    if (path === `${root}/41`) return dto
    if (path.endsWith('/pens')) return { pens: [] }
    return []
  })
  const command = vi.fn<BackendTransport['command']>().mockResolvedValue({ voucher: { ...dto, version: 4 } })
  const api = createHerdEntryBackendApi({ farmId: 1, transport: { get, command, farmPath: (id, suffix = '') => `/api/farms/${id}${suffix}` } })
  return { api, get, command }
}

const commands = {
  save: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.save({ id: code, expectedVersion: version, record }),
  discard: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.discard(code, version, 41),
  void: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.voidVoucher(code, { reason: 'Nhập nhầm', expectedVersion: version, backendId: 41 }),
  payment: (api: ReturnType<typeof setup>['api'], version: number | undefined) => api.recordPayment(code, payment, { voucherVersion: version, backendId: 41 }),
}

describe('entry snapshot version contract', () => {
  it.each(Object.entries(commands))('%s sends snapshot 3 against server 9 and leaves a 409 to the caller', async (name, run) => {
    const { api, get, command } = setup()
    const error = conflict()
    command.mockRejectedValueOnce(error)
    await expect(run(api, 3)).rejects.toBe(error)
    expect(command).toHaveBeenCalledTimes(1)
    const [path, body] = command.mock.calls[0]
    if (name === 'discard') expect(path).toBe(`${root}/41?expectedVersion=3`)
    else expect(body).toMatchObject(name === 'payment' ? { voucherVersion: 3 } : { expectedVersion: 3 })
    expect(get.mock.calls.some(([path]) => path === root || path === `${root}/41`)).toBe(false)
  })

  it.each(Object.entries(commands))('%s accepts the real version 0', async (name, run) => {
    const { api, command } = setup()
    await run(api, 0)
    const [path, body] = command.mock.calls[0]
    if (name === 'discard') expect(path).toContain('expectedVersion=0')
    else expect(body).toMatchObject(name === 'payment' ? { voucherVersion: 0 } : { expectedVersion: 0 })
  })

  it.each(Object.entries(commands))('%s rejects a missing version before every request', async (_name, run) => {
    const { api, get, command } = setup()
    await expect(run(api, undefined)).rejects.toThrow('Thiếu phiên bản hợp lệ')
    expect(get).not.toHaveBeenCalled()
    expect(command).not.toHaveBeenCalled()
  })

  it('resolves only the backend id when metadata is unavailable, retaining snapshot 3', async () => {
    const { api, get, command } = setup()
    await api.voidVoucher(code, { reason: 'Sai nguồn', expectedVersion: 3 })
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith(root)
    expect(command.mock.calls[0][1]).toMatchObject({ expectedVersion: 3 })
  })

  it('ignores expectedVersion on create, then posts the just-saved version', async () => {
    const { api, command } = setup()
    await api.save({ expectedVersion: 9, record: { ...record, status: 'Đã nhập' } })
    expect(command.mock.calls[0][1]).toMatchObject({ expectedVersion: null })
    expect(command.mock.calls[1][1]).toMatchObject({ expectedVersion: 4 })
  })

  it('does not fabricate version 0 from missing response metadata or post without it', async () => {
    const { api, command } = setup()
    command.mockResolvedValue({ voucher: { id: 41, code, status: 'DRAFT' } })
    expect((await api.save({ record })).version).toBeUndefined()
    command.mockClear()
    await expect(api.save({ record: { ...record, status: 'Đã nhập' } })).rejects.toThrow('Thiếu phiên bản hợp lệ')
    expect(command).toHaveBeenCalledTimes(1)
  })

  it('keeps zero and missing versions distinct when loading a voucher', async () => {
    expect((await setup(0).api.get(code)).version).toBe(0)
    const { api, get } = setup()
    get.mockImplementation(async (path) => path === root ? { items: [{ id: 41, code }] } : path === `${root}/41` ? { id: 41, code } : [])
    expect((await api.get(code)).version).toBeUndefined()
  })

  it('includes the snapshot version in the stable save/discard idempotency keys', async () => {
    const { api, command } = setup()
    await commands.save(api, 3); await commands.save(api, 3); await commands.save(api, 4)
    expect(command.mock.calls[0][2]?.key).toBe(command.mock.calls[1][2]?.key)
    expect(command.mock.calls[0][2]?.key).not.toBe(command.mock.calls[2][2]?.key)
    command.mockClear()
    await commands.discard(api, 3); await commands.discard(api, 4)
    expect(command.mock.calls[0][2]?.key).not.toBe(command.mock.calls[1][2]?.key)
  })
})

describe('shared version validation', () => {
  it.each([undefined, null, -1, 1.5, NaN, Infinity, '3', {}])('rejects invalid version %s', (value) => {
    expect(() => requireVersion(value)).toThrow('Thiếu phiên bản hợp lệ')
  })
  it('recognizes only the version-conflict HTTP status and code', () => {
    expect(requireVersion(0)).toBe(0)
    expect(isVersionConflict(conflict())).toBe(true)
    expect(isVersionConflict(new BackendError(409, { code: 'MSG-FE13-09' }))).toBe(false)
    expect(isVersionConflict(new BackendError(400, { code: 'MSG-COM-05' }))).toBe(false)
    expect(isVersionConflict({ status: 409, code: 'MSG-COM-05' })).toBe(false)
  })
})
