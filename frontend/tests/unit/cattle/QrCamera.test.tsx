import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QrCamera from '../../../src/components/QrCamera'
import { QR_BORDER, tagQrModules } from '../../../src/features/cattle/domain/tagQr'

// The decoder reads real QR pixels. Browser camera/media APIs supply those pixels in these unit tests.
function qrPixels(tag: string) {
  const modules = tagQrModules(tag)
  const cell = 5
  const side = (modules.length + QR_BORDER * 2) * cell
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  modules.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return
    for (let dy = 0; dy < cell; dy++) {
      for (let dx = 0; dx < cell; dx++) {
        const offset = (((y + QR_BORDER) * cell + dy) * side + (x + QR_BORDER) * cell + dx) * 4
        data.fill(0, offset, offset + 3)
      }
    }
  }))
  return { data, width: side, height: side }
}

function media() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  return { track, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream }
}

let capture: ReturnType<typeof media>
let getUserMedia: ReturnType<typeof vi.fn>
let getImageData: ReturnType<typeof vi.fn>
let drawImage: ReturnType<typeof vi.fn>

beforeEach(() => {
  capture = media()
  getUserMedia = vi.fn().mockResolvedValue(capture.stream)
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1280)
  vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(720)
  drawImage = vi.fn()
  getImageData = vi.fn().mockReturnValue({ data: new Uint8ClampedArray(4).fill(255), width: 1, height: 1 })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, getImageData } as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
})

describe('live QR camera', () => {
  it('decodes an actual QR frame and releases the camera before reporting the tag', async () => {
    getImageData.mockReturnValue(qrPixels('QR-CAMERA-0142'))
    const onCode = vi.fn(() => expect(capture.track.stop).toHaveBeenCalled())
    render(<QrCamera onCode={onCode} />)
    await waitFor(() => expect(onCode).toHaveBeenCalledWith('QR-CAMERA-0142'))
    expect(onCode).toHaveBeenCalledOnce()
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: 'environment' } }) }))
    expect(drawImage.mock.calls[0][0]).toBe(screen.getByLabelText('Camera quét mã QR'))
    expect(screen.getByLabelText('Camera quét mã QR')).toHaveProperty('srcObject', null)
  })

  it('reads the full frame when the tag is outside the center window', async () => {
    getImageData.mockReturnValueOnce({ data: new Uint8ClampedArray(4).fill(255), width: 1, height: 1 }).mockReturnValue(qrPixels('QR-EDGE-1'))
    const onCode = vi.fn()
    render(<QrCamera onCode={onCode} />)
    await waitFor(() => expect(onCode).toHaveBeenCalledWith('QR-EDGE-1'))
    expect(onCode).toHaveBeenCalledOnce()
    expect(drawImage).toHaveBeenCalledTimes(2)
    expect(drawImage.mock.calls[1].slice(1, 5)).toEqual([0, 0, 1280, 720])
  })

  it('releases a stream that arrives after the scanner has been closed', async () => {
    let grant!: (stream: MediaStream) => void
    getUserMedia.mockImplementation(() => new Promise<MediaStream>((resolve) => { grant = resolve }))
    const { unmount } = render(<QrCamera onCode={vi.fn()} />)
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce())
    unmount()
    await act(async () => { grant(capture.stream) })
    expect(capture.track.stop).toHaveBeenCalledOnce()
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled()
  })

  it('recovers from denied permission after retry and reads QR pixels', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'))
    const onCode = vi.fn()
    render(<QrCamera onCode={onCode} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa được cấp quyền camera')
    getImageData.mockReturnValue(qrPixels('QR-RETRY-1'))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Thử lại camera' }))
    await waitFor(() => expect(onCode).toHaveBeenCalledWith('QR-RETRY-1'))
    expect(onCode).toHaveBeenCalledOnce()
    expect(getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('switches cameras and stops the previous stream', async () => {
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { deviceId: 'front', label: 'Camera trước', kind: 'videoinput' },
      { deviceId: 'rear', label: 'Camera sau', kind: 'videoinput' },
    ] as MediaDeviceInfo[])
    const next = media()
    render(<QrCamera onCode={vi.fn()} />)
    const select = await screen.findByRole('combobox', { name: 'Camera' })
    getUserMedia.mockResolvedValueOnce(next.stream)
    await userEvent.setup().selectOptions(select, 'rear')
    await waitFor(() => expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({ video: expect.objectContaining({ deviceId: { exact: 'rear' } }) })))
    expect(capture.track.stop).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByLabelText('Camera quét mã QR')).toHaveProperty('srcObject', next.stream))
  })

  it('stops scanning and explains when a camera is disconnected', async () => {
    render(<QrCamera onCode={vi.fn()} />)
    await screen.findByText('Đưa mã QR vào khung và giữ camera ổn định.')
    act(() => capture.track.dispatchEvent(new Event('ended')))
    expect(screen.getByRole('alert')).toHaveTextContent('Camera đã ngắt kết nối')
    expect(capture.track.stop).toHaveBeenCalledOnce()
  })

  it('explains the HTTPS requirement without requesting permission on an insecure origin', async () => {
    vi.stubGlobal('isSecureContext', false)
    render(<QrCamera onCode={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Camera cần HTTPS hoặc localhost')
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})
