import type { FeedRationPenOption } from '../types/feedRation'

// Pens as drawn in the feed frames (head counts match the frame totals: 119 head in 5 pens, C1 empty).
export const FEED_DEMO_PENS: FeedRationPenOption[] = [
  { id: 1, code: 'A1', name: 'A1 – Bò cái', headcount: 29, status: 'ACTIVE' },
  { id: 2, code: 'A2', name: 'A2 – Bò cái', headcount: 28, status: 'ACTIVE' },
  { id: 3, code: 'A3', name: 'A3 – Bê con', headcount: 6, status: 'ACTIVE' },
  { id: 4, code: 'B1', name: 'B1 – Vỗ béo', headcount: 46, status: 'ACTIVE' },
  { id: 5, code: 'B2', name: 'B2 – Đực giống', headcount: 10, status: 'ACTIVE' },
  { id: 6, code: 'C1', name: 'C1 – Cách ly', headcount: 0, status: 'ACTIVE' },
]
