import { useCallback, useState } from 'react'
import { scanCode } from '../../cattle'

export type ExitQrFeedback = { message: string; ok: boolean }

type QrCandidate = { code: string }

type UseExitQrPickOptions<T extends QrCandidate> = {
  candidates: readonly T[]
  onPick: (candidate: T) => void
  selectedCodes?: ReadonlySet<string>
}

/** Coordinates manual and camera QR input for the exit picker. */
export function useExitQrPick<T extends QrCandidate>({ candidates, onPick, selectedCodes }: UseExitQrPickOptions<T>) {
  const [showQr, setShowQr] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [checkingQr, setCheckingQr] = useState(false)
  const [qrFeedback, setQrFeedback] = useState<ExitQrFeedback | null>(null)
  const [recentCodes, setRecentCodes] = useState<string[]>([])

  const selectFromQr = useCallback(async (value: string) => {
    const input = value.trim()
    if (!input || checkingQr) return
    setShowQr(false)
    setQrFeedback(null)
    setCheckingQr(true)
    try {
      const result = await scanCode(input)
      if (result?.kind !== 'found') {
        setQrFeedback({ message: result?.kind === 'otherFarm' ? 'Bò thuộc trại khác.' : 'Không tìm được bò theo mã này.', ok: false })
        return
      }
      const candidate = candidates.find((row) => row.code === result.cow.code)
      if (!candidate) {
        setQrFeedback({ message: `Bò ${result.cow.code} hiện không thể thêm vào phiếu này.`, ok: false })
        return
      }
      if (selectedCodes?.has(candidate.code)) {
        setQrFeedback({ message: `Bò ${candidate.code} đã có trong danh sách chọn.`, ok: false })
        return
      }
      onPick(candidate)
      setQrCode('')
      setRecentCodes((current) => [candidate.code, ...current.filter((code) => code !== candidate.code)].slice(0, 5))
      setQrFeedback({ message: `Đã chọn bò ${candidate.code}.`, ok: true })
    } catch {
      setQrFeedback({ message: 'Không tra được mã bò. Vui lòng thử lại.', ok: false })
    } finally {
      setCheckingQr(false)
    }
  }, [candidates, checkingQr, onPick, selectedCodes])

  return { showQr, setShowQr, qrCode, setQrCode, checkingQr, qrFeedback, recentCodes, selectFromQr }
}
