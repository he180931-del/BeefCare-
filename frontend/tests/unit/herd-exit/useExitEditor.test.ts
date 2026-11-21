import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExitEditor } from '../../../src/features/herd-exit/hooks/useExitEditor'

const seed = { type: 'Bán' as const, lossKind: 'DIED' as const, deathCause: '', carcassDisposal: '', date: '2026-11-21', picked: [{ code: 'BC-1', weight: 100 }] }

describe('useExitEditor', () => {
  it('updates one picked cattle without replacing the rest', () => {
    const hook = renderHook(() => useExitEditor(seed))
    act(() => hook.result.current.patch('BC-1', { weight: 120 }))
    expect(hook.result.current.picked).toEqual([{ code: 'BC-1', weight: 120 }])
  })
})
