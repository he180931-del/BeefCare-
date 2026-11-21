import type { HerdGroup, LifeStage, ScheduleTarget, VaccCattle } from '../types'
import { resolveTarget } from '../domain/vaccinationRules'

export interface CattleReference extends VaccCattle { id: number }
export interface PenReference { id: number; code: string }
export interface VaccinationTargetDto {
  cattleIds: number[]
  penIds: number[]
  herdGroups: HerdGroup[]
  lifeStages: LifeStage[]
  excludedCattleIds: number[]
}

/** Maps the feature's display-code target to the backend's id-based request DTO. */
export function toVaccinationTargetDto(target: ScheduleTarget, herd: CattleReference[], pens: PenReference[]): VaccinationTargetDto {
  const idOf = (code: string) => herd.find((c) => c.code === code)?.id
  const ids = (codes: string[]) => codes.map(idOf).filter((id): id is number => id !== undefined)
  const hasSelector = target.penCodes.length > 0 || target.herdGroups.length > 0 || target.lifeStages.length > 0
  return {
    cattleIds: hasSelector ? ids(target.added) : resolveTarget(herd, target).map((c) => (c as CattleReference).id),
    penIds: target.penCodes.map((code) => pens.find((p) => p.code === code)?.id).filter((id): id is number => id !== undefined),
    herdGroups: target.herdGroups,
    lifeStages: target.lifeStages,
    excludedCattleIds: hasSelector ? ids(target.excluded) : [],
  }
}
