import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { backendMode } from '../../../shared/config/runtime'
import { reproductionApi } from '../api/reproductionApi'
import { EMPTY_REPRODUCTION_OPTIONS, localReproductionOptions } from '../data/reproductionOptions'
import type { ReproductionFormOptions } from '../types'

/**
 * Lựa chọn của các popup sinh sản (thành viên, đực giống, giống, chuồng, mục đích, ca bệnh). Mặc định là dữ liệu minh
 * họa của chế độ local; tab Sinh sản và SCR-40 cung cấp danh sách tải từ API (chế độ backend).
 */
const OptionsContext = createContext<ReproductionFormOptions>(localReproductionOptions())

export const useReproductionOptions = (): ReproductionFormOptions => useContext(OptionsContext)

export function ReproductionOptionsProvider({ cattleCode, children }: { cattleCode: string; children: ReactNode }) {
  const [options, setOptions] = useState<ReproductionFormOptions>(() => (backendMode === 'backend' ? EMPTY_REPRODUCTION_OPTIONS : localReproductionOptions(cattleCode)))
  useEffect(() => {
    let active = true
    reproductionApi.formOptions(cattleCode).then((loaded) => { if (active) setOptions(loaded) }).catch(() => undefined)
    return () => { active = false }
  }, [cattleCode])
  return <OptionsContext.Provider value={options}>{children}</OptionsContext.Provider>
}
