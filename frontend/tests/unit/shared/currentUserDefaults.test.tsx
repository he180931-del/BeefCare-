import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { useCurrentMember } from '../../../src/features/health/components/healthUi'
import { initialFeedReceiptForm } from '../../../src/features/feed-stock/domain/feedReceiptForm'
import { initialFeedStockAdjustmentForm } from '../../../src/features/feed-stock/domain/feedStockAdjustmentForm'

const members = [{ id: 11, name: 'Nguyễn An', email: 'an@example.test' }, { id: 15, name: 'Lê Cường', email: 'cuong@example.test' }] as never[]
const withSession = (session: unknown) => ({ children }: { children: ReactNode }) =>
  <SessionContext.Provider value={session as never}>{children}</SessionContext.Provider>

describe('người thực hiện mặc định là người đang đăng nhập', () => {
  it('health: matches the signed-in member by id or email', () => {
    expect(renderHook(() => useCurrentMember(members), { wrapper: withSession({ id: 15 }) }).result.current).toMatchObject({ id: 15 })
    expect(renderHook(() => useCurrentMember(members), { wrapper: withSession({ id: 99, email: 'an@example.test' }) }).result.current).toMatchObject({ id: 11 })
  })

  it('health: leaves the field empty instead of picking the first member when the user is not a member', () => {
    expect(renderHook(() => useCurrentMember(members), { wrapper: withSession({ id: 99, email: 'other@example.test' }) }).result.current).toBeUndefined()
    expect(renderHook(() => useCurrentMember(members)).result.current).toBeUndefined()
  })

  it('feed receipt / stock count: new forms prefill the signed-in user, saved records keep their value', () => {
    expect(initialFeedReceiptForm(null, '', 'Nguyễn An').receivedBy).toBe('Nguyễn An')
    expect(initialFeedReceiptForm(null).receivedBy).toBe('')
    expect(initialFeedStockAdjustmentForm(null, [], 'Nguyễn An').countedBy).toBe('Nguyễn An')
    const saved = { countDate: '2026-11-20', adjustmentType: 'LOSS', countedBy: '', lines: [] } as never
    expect(initialFeedStockAdjustmentForm(saved, [], 'Nguyễn An').countedBy).toBe('')
  })
})
