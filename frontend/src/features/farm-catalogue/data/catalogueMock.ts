import { DEFAULT_PARAMETERS } from '../domain/parameterRules'
import type { Breed, Medicine, ParameterValues, ParameterVersionRecord, Purpose, Vaccine } from '../types'

export interface CatalogueSeed {
  breeds: Breed[]
  vaccines: Vaccine[]
  medicines: Medicine[]
  purposes: Purpose[]
  parameterVersions: ParameterVersionRecord[]
}

const breed = (id: number, code: string, name: string, group: string, description: string, activeCattle: number, available = true, referenced = activeCattle > 0): Breed =>
  ({ id, code, name, group, description, available, activeCattle, referenced, version: 1 })

const pens = (...codes: string[]) => codes.map((code, i) => ({ id: i + 1, code, name: `Chuồng ${code}` }))

const v1: ParameterValues = { ...DEFAULT_PARAMETERS, minBreedingWeightKg: 220 }
const v2: ParameterValues = { ...v1, targetFinishingWeightKg: 380 }
const v3: ParameterValues = { ...v2, minBreedingWeightKg: 230 }

export const CATALOGUE_DEMO: CatalogueSeed = {
  breeds: [
    breed(1, 'ZEB-DO', 'Zebu đỏ', 'Zebu', 'U vai cao, yếm cổ rộng, lông đỏ nâu, chịu nóng và ve tốt', 142),
    breed(2, 'LAI-SIND', 'Lai Sind', 'Lai Zebu', 'Red Sindhi × bò Vàng VN', 106),
    breed(3, 'RED-SINDHI', 'Red Sindhi', 'Zebu', 'Zebu thuần · gốc Nam Á', 0, true, true),
    breed(4, 'BRAHMAN-DO', 'Brahman đỏ', 'Zebu', 'Đực giống / tinh TTNT', 1),
    breed(5, 'SAHIWAL', 'Sahiwal', 'Zebu', 'Zebu · chịu nóng tốt', 0, true, false),
    breed(6, 'VANG-VN', 'Bò Vàng Việt Nam', 'Nội', 'Giống nội – không còn nhập', 0, false, true),
  ],
  vaccines: [
    { id: 1, code: 'AFT-O', name: 'Aftopor (LMLM type O)', diseasePrevented: 'Lở mồm long móng type O', manufacturer: 'Boehringer Ingelheim', dose: '2 ml', route: 'INTRAMUSCULAR', boosterInterval: 180, withdrawalDays: 0, scheduleCount: 3, recordCount: 0, available: true, version: 1 },
    { id: 2, code: 'PAST-B', name: 'Vắc-xin tụ huyết trùng', diseasePrevented: 'Tụ huyết trùng', manufacturer: '', dose: '2 ml', route: 'SUBCUTANEOUS', boosterInterval: 180, withdrawalDays: 0, scheduleCount: 1, recordCount: 0, available: true, version: 1 },
    { id: 3, code: 'LSD-N', name: 'Vắc-xin viêm da nổi cục', diseasePrevented: 'Viêm da nổi cục', manufacturer: '', dose: '1 ml', route: 'SUBCUTANEOUS', boosterInterval: 365, withdrawalDays: 0, scheduleCount: 1, recordCount: 0, available: true, version: 1 },
    { id: 4, code: 'ANTH-1', name: 'Vắc-xin nhiệt thán', diseasePrevented: 'Nhiệt thán', manufacturer: '', dose: '1 ml', route: 'SUBCUTANEOUS', boosterInterval: 365, withdrawalDays: 0, scheduleCount: 0, recordCount: 0, available: true, version: 1 },
    { id: 5, code: 'FMD-OA', name: 'LMLM type O+A (cũ)', diseasePrevented: 'Lở mồm long móng', manufacturer: '', dose: '2 ml', route: 'INTRAMUSCULAR', boosterInterval: 180, withdrawalDays: 0, scheduleCount: 0, recordCount: 12, available: false, version: 1 },
    { id: 6, code: 'VX-VDNC', name: 'Vắc-xin Viêm da nổi cục', diseasePrevented: 'Viêm da nổi cục', manufacturer: '', dose: '', route: '', boosterInterval: null, withdrawalDays: 0, scheduleCount: 0, recordCount: 0, available: true, version: 1 },
  ],
  medicines: [
    { id: 1, code: 'OXY-LA', name: 'Oxytetracycline 20% LA', description: 'Không dùng cho bò đang cho bê bú dưới 7 ngày', dose: '1 ml/10 kg thể trọng', route: 'INTRAMUSCULAR', withdrawalDays: 28, usageCount: 18, available: true, version: 1 },
    { id: 2, code: 'ORS-V', name: 'Điện giải thú y (Oresol)', description: '', dose: '2 lít/ngày', route: 'ORAL', withdrawalDays: 0, usageCount: 7, available: true, version: 1 },
    { id: 3, code: 'IVM-1', name: 'Ivermectin 1%', description: '', dose: '1 ml/50 kg', route: 'SUBCUTANEOUS', withdrawalDays: 35, usageCount: 12, available: true, version: 1 },
    { id: 4, code: 'MEL-2', name: 'Meloxicam 2%', description: '', dose: '2,5 ml/100 kg', route: 'INTRAMUSCULAR', withdrawalDays: 15, usageCount: 5, available: true, version: 1 },
    { id: 5, code: 'PEN-S', name: 'Penicillin–Streptomycin', description: '', dose: '1 ml/20 kg', route: 'INTRAMUSCULAR', withdrawalDays: 30, usageCount: 3, available: false, version: 1 },
  ],
  purposes: [
    { id: 1, code: 'BREED', name: 'Sinh sản', purposeType: 'BREEDING', description: 'Bò cái Zebu đỏ / Lai Sind giữ lại làm giống', activeCattle: 86, referenced: true, receivingPens: pens('A1', 'A2', 'C1', 'D'), available: true, version: 1 },
    { id: 2, code: 'FATTEN', name: 'Vỗ béo', purposeType: 'FATTENING', description: 'Bò thịt nuôi vỗ béo trước khi xuất bán', activeCattle: 46, referenced: true, receivingPens: pens('B1'), available: true, version: 1 },
    { id: 3, code: 'SIRE', name: 'Đực giống', purposeType: 'SIRE', description: 'Đực giống phối trực tiếp hoặc lấy tinh TTNT', activeCattle: 10, referenced: true, receivingPens: pens('B2'), available: true, version: 1 },
    { id: 4, code: 'GROW', name: 'Nuôi lớn', purposeType: 'UNDECIDED', description: 'Bê và bò tơ chưa quyết định hướng nuôi', activeCattle: 69, referenced: true, receivingPens: pens('A3', 'C2'), available: true, version: 1 },
    { id: 5, code: 'SALE-Y', name: 'Nuôi bán giống', purposeType: 'BREEDING', description: '', activeCattle: 0, referenced: false, receivingPens: [], available: false, version: 1 },
  ],
  parameterVersions: [
    { id: 1, versionNo: 1, effectiveFrom: '2026-06-15', parameters: v1, sourceNote: 'Tạo trại', savedBy: 'Nguyễn Văn Hùng' },
    { id: 2, versionNo: 2, effectiveFrom: '2026-07-15', parameters: v2, sourceNote: 'Kế hoạch bán 2026', savedBy: 'Trần Quốc Long' },
    { id: 3, versionNo: 3, effectiveFrom: '2026-09-01', parameters: v3, sourceNote: 'Phỏng vấn chủ trại 20/09/2026', savedBy: 'Nguyễn Văn Hùng' },
  ],
}
