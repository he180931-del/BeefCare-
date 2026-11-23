import { useCallback } from 'react'
import { useMutation } from '../../../shared/hooks/useMutation'
import { penApi } from '../api/penApi'
import type { Pen, PenStatus } from '../types'

export type PenAvailabilityCommand = {
  pen: Pen
  status: PenStatus
  note: { date: string; reason: string }
}

/**
 * Feature command boundary for create/edit/availability transitions. Pages
 * coordinate notices and URL/modal state, while this hook owns the API
 * mutation state and keeps transport/local adapters out of composition code.
 */
export function usePenCommands() {
  const create = useMutation(penApi.create)
  const update = useMutation(penApi.update)
  const changeAvailability = useMutation(
    useCallback(
      ({ pen, status, note }: PenAvailabilityCommand) => penApi.changeAvailability(pen, status, note),
      [],
    ),
  )

  return {
    createPen: create.mutate,
    creating: create.loading,
    createError: create.error,
    updatePen: update.mutate,
    updating: update.loading,
    updateError: update.error,
    changeAvailability: changeAvailability.mutate,
    changingAvailability: changeAvailability.loading,
    availabilityError: changeAvailability.error,
  }
}
