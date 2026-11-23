/** Một con trong phiếu nhập. dob = 'YYYY-MM'. */
export const blankCow = (defaultBarn = 'A1') => ({
  tag: '', name: '', breed: '', sex: 'Cái', dob: '', dobAccuracy: 'UNKNOWN', stage: '', purpose: '',
  weight: 0, estimated: false, barn: defaultBarn, unitPrice: 0, pricing: 'kg' as const,
  hist: { vaccine: 'Không rõ', vaccineNote: '', disease: 'Không rõ', repro: 'Không rõ' },
})

// Tuổi (tháng) tại ngày nhập: dateIso 'YYYY-MM-DD', dob 'YYYY-MM'.
export const ageOf = (dob: string, dateIso: string) => {
  if (!dob || !dateIso) return 0
  const [y, m] = dateIso.split('-').map(Number)
  const [dy, dm] = dob.split('-').map(Number)
  return y * 12 + m - (dy * 12 + dm)
}
