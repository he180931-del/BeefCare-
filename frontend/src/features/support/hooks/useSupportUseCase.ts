import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { supportApi } from '../api/supportApi'
import type { CreateTicketCommand, TicketFilters } from '../types'

/** Feature-owned read/write orchestration for the support pages. */
export function useSupportOwnedFarms() {
  return useQuery(() => supportApi.listOwnedFarms(), [])
}

export function useSupportTicket(ticketId: number) {
  return useQuery(() => supportApi.getTicket(ticketId), [ticketId])
}

export function useSupportTickets(filters: TicketFilters, demoMode: string | null) {
  return useQuery(async () => {
    if (demoMode === 'loi') throw new Error('Không tải được danh sách yêu cầu hỗ trợ.')
    return supportApi.listTickets(filters)
  }, [filters, demoMode])
}

export function useSupportSubmittedTicket(ticketId: number) {
  return useQuery(async () => (ticketId ? supportApi.getTicket(ticketId) : null), [ticketId])
}

export function useSupportCommands() {
  const createTicket = useCallback((command: CreateTicketCommand) => supportApi.createTicket(command), [])
  const getMessages = useCallback((ticketId: number, beforeId: number) => supportApi.getMessages(ticketId, beforeId), [])
  return { createTicket, getMessages }
}

export function useSupportUseCase() {
  return useSupportCommands()
}
