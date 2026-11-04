export interface FixtureRecord { id: string; label: string; status: string; description?: string; updatedAt?: string; values?: Record<string, string>; lines?: Array<Record<string, string>>; history?: Array<{ label: string; at: string }> }

export const INITIAL_FIXTURE_RECORDS: FixtureRecord[] = [
  { id: 'record-1', label: 'Hồ sơ mới cập nhật', status: 'ACTIVE', description: 'Thông tin vận hành được cập nhật gần đây.', updatedAt: '02/11/2026 09:30' },
]
