import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FixtureSessionProvider, applyFixtureAction, createFixtureSession, useFixtureSession } from '../../../src/app/fixtureSession'

function Probe() {
  const session = useFixtureSession()
  return <><span>{session.role}</span><span>{session.reviewState}</span><span>{session.records.length}</span><button onClick={() => session.dispatch({ type: 'add-record', record: { id: 'demo-2', label: 'Bản ghi mới', status: 'ACTIVE' } })}>Thêm</button></>
}

describe('fixture session', () => {
  it('applies add, edit and status actions without persistence', () => {
    const initial = createFixtureSession()
    const added = applyFixtureAction(initial, { type: 'add-record', record: { id: 'x', label: 'Phiếu thử', status: 'DRAFT' } })
    const edited = applyFixtureAction(added, { type: 'edit-record', id: 'x', patch: { label: 'Phiếu đã sửa' } })
    const updated = applyFixtureAction(edited, { type: 'set-record-status', id: 'x', status: 'ACTIVE' })
    expect(updated.records.find((record) => record.id === 'x')).toMatchObject({ label: 'Phiếu đã sửa', status: 'ACTIVE' })
  })

  it('resets when the provider is remounted', async () => {
    const user = userEvent.setup()
    const first = render(<FixtureSessionProvider><Probe /></FixtureSessionProvider>)
    await user.click(screen.getByRole('button', { name: 'Thêm' }))
    expect(screen.getByText('2')).toBeInTheDocument()
    first.unmount()
    render(<FixtureSessionProvider><Probe /></FixtureSessionProvider>)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
