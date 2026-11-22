import { expect, it } from 'vitest'
import { exitCattleStatus } from '../../../src/features/herd-exit/domain/exitCattleStatus'
import type { ExitStatus } from '../../../src/features/herd-exit/types'

const voucherStatuses: ExitStatus[] = ['Nháp', 'Chờ xác nhận', 'Đã xuất', 'Đã hủy', 'Đã bác']

it.each(voucherStatuses)('prioritizes explicit cattle status on a %s voucher', (status) => {
  expect(exitCattleStatus('ACTIVE', status)).toBe('ACTIVE')
  expect(exitCattleStatus('EXITED', status)).toBe('EXITED')
})

it.each([undefined, ''])('falls back to exited for a confirmed voucher with current=%s', (current) => {
  expect(exitCattleStatus(current, 'Đã xuất')).toBe('EXITED')
})

it.each(voucherStatuses.filter((status) => status !== 'Đã xuất').flatMap((status) => [
  { current: undefined, status }, { current: '', status },
]))('keeps missing current=$current unknown on a $status voucher', ({ current, status }) => {
  expect(exitCattleStatus(current, status)).toBeNull()
})

it.each(['UNKNOWN', ' '])('does not infer status from a confirmed voucher for unknown current=%s', (current) => {
  expect(exitCattleStatus(current, 'Đã xuất')).toBeNull()
})
