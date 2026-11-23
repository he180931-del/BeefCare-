import { describe, expect, it } from 'vitest'
import { isWorkflowCurrent } from '../../../src/features/herd-exit/hooks/useExitWorkflow'

describe('isWorkflowCurrent', () => {
  it('rejects stale async results after form changes', () => {
    expect(isWorkflowCurrent(1, 'before', 2, 'after')).toBe(false)
    expect(isWorkflowCurrent(1, 'before', 1, 'after')).toBe(false)
  })

  it('accepts results for the unchanged form revision', () => {
    expect(isWorkflowCurrent(3, 'same', 3, 'same')).toBe(true)
  })
})
