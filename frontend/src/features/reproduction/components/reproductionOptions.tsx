import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { reproductionApi } from '../api/reproductionApi'
import type { ReproductionFormOptions } from '../types'

/**
 * Lựa chọn của các popup sinh sản (thành viên, đực giống, giống, chuồng, mục đích, ca bệnh). Mặc định do API quyết định
 * (rỗng với máy chủ thật); tab Sinh sản và SCR-40 cung cấp danh sách tải từ API.
 */
const OptionsContext = createContext<ReproductionFormOptions>(reproductionApi.initialFormOptions())

export const useReproductionOptions = (): ReproductionFormOptions => useContext(OptionsContext)

export function ReproductionOptionsProvider({ cattleCode, children }: { cattleCode: string; children: ReactNode }) {
  const [options, setOptions] = useState<ReproductionFormOptions>(() => reproductionApi.initialFormOptions(cattleCode))
  useEffect(() => {
    let active = true
    reproductionApi.formOptions(cattleCode).then((loaded) => { if (active) setOptions(loaded) }).catch(() => undefined)
    return () => { active = false }
  }, [cattleCode])
  return <OptionsContext.Provider value={options}>{children}</OptionsContext.Provider>
}
