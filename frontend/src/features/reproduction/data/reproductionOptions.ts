import type { ReproductionFormOptions } from '../types'
import {
  REPRODUCTION_BREEDS, REPRODUCTION_EXTERNAL_PEOPLE, REPRODUCTION_HEALTH_CASES, REPRODUCTION_MEMBERS, REPRODUCTION_PENS, REPRODUCTION_PURPOSES,
  REPRODUCTION_SIRES,
} from './reproductionMock'

/** Lựa chọn minh họa của chế độ local (không bao giờ dùng trong chế độ backend). */
export function localReproductionOptions(cattleCode?: string): ReproductionFormOptions {
  return {
    members: REPRODUCTION_MEMBERS.map((member) => ({ id: member.name, name: member.name, role: member.role })),
    externalPeople: [...REPRODUCTION_EXTERNAL_PEOPLE],
    sires: REPRODUCTION_SIRES.map((sire) => ({ ...sire })),
    breeds: [...REPRODUCTION_BREEDS],
    pens: REPRODUCTION_PENS.map((pen) => ({ ...pen })),
    purposes: REPRODUCTION_PURPOSES.map((purpose) => ({ value: purpose.value, type: purpose.value, label: purpose.label })),
    // Không có mã bò (popup render ngoài tab Sinh sản): mọi ca minh họa.
    healthCases: (cattleCode ? REPRODUCTION_HEALTH_CASES[cattleCode] ?? [] : Object.values(REPRODUCTION_HEALTH_CASES).flat()).map((item) => ({ ...item })),
  }
}
