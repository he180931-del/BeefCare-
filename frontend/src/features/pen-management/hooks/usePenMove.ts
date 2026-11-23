import { useCallback } from 'react'
import { useMutation } from '../../../shared/hooks/useMutation'
import { penApi, type MoveCattle, type PenMoveCheckResult, type PenMoveCommand, type PenMoveResult } from '../api/penApi'
import type { Pen } from '../types'

export type PenMoveCheckCommand = {
  cattle: MoveCattle[]
  from: Pen
  to: Pen
  moveDate: string
}

/**
 * Feature command boundary for reception checks and all-or-nothing pen moves.
 * MoveDialog retains presentation-specific validation and stale-response
 * handling, but never calls the transport adapter directly.
 */
export function usePenMove() {
  const check = useMutation<PenMoveCheckCommand, PenMoveCheckResult>(
    useCallback(
      ({ cattle, from, to, moveDate }) => penApi.checkMove(cattle, from, to, moveDate),
      [],
    ),
  )
  const move = useMutation<PenMoveCommand, PenMoveResult>(penApi.move)

  return {
    checkMove: check.mutate,
    checking: check.loading,
    checkError: check.error,
    move: move.mutate,
    moving: move.loading,
    moveError: move.error,
  }
}
