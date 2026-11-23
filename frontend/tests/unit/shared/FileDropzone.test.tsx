import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { FileDropzone } from '../../../src/shared/ui'
it('accepts keyboard activation and dropped files', () => { const onFiles = vi.fn(); render(<FileDropzone onFiles={onFiles} />); const zone = screen.getByRole('button'); fireEvent.keyDown(zone, { key: 'Enter' }); const file = new File(['x'], 'x.pdf', { type: 'application/pdf' }); fireEvent.drop(zone, { dataTransfer: { files: [file] } }); expect(onFiles).toHaveBeenCalledWith([file]) })
