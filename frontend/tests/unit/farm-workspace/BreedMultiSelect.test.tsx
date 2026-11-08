import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BreedMultiSelect } from '../../../src/features/farm-workspace/components/BreedMultiSelect'

describe('BreedMultiSelect', () => {
  it('closes when the user clicks outside the dropdown', async () => {
    const user = userEvent.setup()
    render(<><BreedMultiSelect id="farm-breeds" value={[]} onChange={() => undefined} /><button type="button">Bên ngoài</button></>)

    await user.click(screen.getByRole('button', { name: 'Chọn giống' }))
    expect(screen.getByRole('group', { name: 'Giống chủ lực' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bên ngoài' }))
    expect(screen.queryByRole('group', { name: 'Giống chủ lực' })).not.toBeInTheDocument()
  })
})
