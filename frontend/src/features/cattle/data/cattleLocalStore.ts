// Local demo herd of the cattle screens. Reached only through src/demo/demoModules.ts.
// herdDomainApi creates the shared `cattle` and `pens` collections first (canonical cattle); the profile seeds below are
// merged into that same `cattle` collection afterwards, exactly as when cattleApi created it while loading.
import { moveCattle, pens } from '../../../api/herdDomainApi'
import { createCollection } from '../../../api/client'
import { cattleSchema } from '../../../api/collectionSchemas'
import { initialCows } from '../../../data/cowsData'
import type { Cattle } from '../types'

export const cattle = createCollection<Cattle, 'code'>('cattle', initialCows, { schema: cattleSchema })
export { moveCattle, pens }
export { readDemoCattlePhoto, saveDemoCattlePhoto } from './cattlePhotoDemoStore'
export { BARNS0, BREEDS, EXPORTED_COUNT, MANAGER, OWNER, STAGES, TODAY, groupCount } from '../../../data/cowsData'

/** Nội dung điền sẵn theo frame Figma cho bò mẫu BC-000142 (chuyển chuồng, đổi giai đoạn). */
export const COW_PREFILL: Record<string, { moveReason: string; stage: string; stageReason: string }> = {
  'BC-000142': { moveReason: 'Đủ 13 tháng & 236 kg – chuẩn bị theo dõi sinh sản', stage: 'Bò cái sinh sản', stageReason: 'Đủ 13 tháng & 236 kg, đưa vào theo dõi sinh sản' },
}
