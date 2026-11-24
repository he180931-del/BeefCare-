import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { comparePlannedActual, feedingRecordPrintState, rationPrintState } from '../../../src/features/feed-stock/domain/feedPrint'
import { FeedFeedingRecordPrintDocument } from '../../../src/features/feed-stock/components/FeedPrintDocuments'
import type { FeedFeedingRecord } from '../../../src/features/feed-stock/types/feedFeeding'

const record = (overrides: Partial<FeedFeedingRecord> = {}): FeedFeedingRecord => ({
  id: 1, penId: 2, penCode: 'A1', penName: 'A1', feedingDate: '2026-11-24', sessionNo: 1, time: '06:30', headCount: 12,
  rationCode: 'KP-01', rationVersion: 1, status: 'VALID', version: 0, fedBy: 'Người cho ăn', recordedBy: 'Người ghi', recordedAt: null,
  leftoverKg: null, note: null, plannedTotalKg: 10, actualTotalKg: 9,
  lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', plannedKg: 10, actualKg: 9, inRation: true, unitCost: 1000, totalCost: 9000 }],
  revisions: [], ...overrides,
})

describe('FE-23 print state and quantity labels', () => {
  it('renders planned versus actual quantity and variance', () => {
    render(<FeedFeedingRecordPrintDocument record={record()} />)
    expect(screen.getAllByText('10 kg').length).toBeGreaterThan(0)
    expect(screen.getAllByText('9 kg').length).toBeGreaterThan(0)
    expect(screen.getByText(/-1 kg · -10%/)).toBeInTheDocument()
    expect(comparePlannedActual(0, 4, false)).toEqual({ state: 'actual-only', varianceKg: null, variancePct: null })
  })

  it('keeps future and cancelled ration versions explicit', () => {
    expect(rationPrintState({ status: 'SCHEDULED', effectiveFrom: '2026-11-25', effectiveTo: null }, '2026-11-24').code).toBe('future')
    expect(rationPrintState({ status: 'CANCELLED', effectiveFrom: '2026-11-01', effectiveTo: null }, '2026-11-24').label).toBe('Đã hủy')
  })

  it('distinguishes missing, no-ration, and voided records', () => {
    expect(feedingRecordPrintState(null, true)).toBe('missing')
    expect(feedingRecordPrintState(null, false)).toBe('no-ration')
    render(<FeedFeedingRecordPrintDocument record={record({ status: 'VOIDED', voidReason: 'Ghi nhầm cữ' })} />)
    expect(screen.getByText('Đã hủy')).toBeInTheDocument()
    expect(screen.getByText('Lý do hủy:')).toBeInTheDocument()
    expect(screen.getByText('Ghi nhầm cữ')).toBeInTheDocument()
    expect(feedingRecordPrintState(record({ status: 'VOIDED' }), true)).toBe('voided')
  })
})
