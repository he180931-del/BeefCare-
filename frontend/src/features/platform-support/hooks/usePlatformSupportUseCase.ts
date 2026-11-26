import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { supportApi } from '../api/supportApi'
import { SupportError } from '../domain/supportRules'
import type { Actor, CompleteCommand, CreateInternalCommand, QueueFilters, TargetRole, TicketCategory, TicketPriority } from '../types'

/**
 * Feature-owned query and command boundary for support screens.
 * Pages/components own route and form state; supportApi remains the adapter
 * boundary and is reached only through this hook module.
 */
export function useSupportAssigned(actor: Actor, code?: string) {
  const requests = useQuery(() => supportApi.listAssigned(actor), [actor.id, actor.role])
  const access = useQuery(async () => {
    if (!code) return 'none'
    try { await supportApi.getAssigned(actor, code); return 'ok' }
    catch (error) { return error instanceof SupportError ? error.code : 'ERROR' }
  }, [code, actor.id, actor.role, requests.data])
  return { requests, access }
}

export function useSupportNotifications() {
  return useQuery(() => supportApi.listNotifications(), [])
}

export function useSupportQueue(actor: Actor, filters: QueueFilters, demoMode?: string | null) {
  const queue = useQuery(
    () => supportApi.listQueue(actor, filters),
    [actor.id, actor.role, filters.q, filters.farm, filters.assignment, filters.category, filters.priority, filters.tab, filters.page, filters.size, demoMode],
  )
  const farms = useQuery(() => supportApi.listFarms(), [])
  return { queue, farms }
}

export function useSupportQueueTarget(actor: Actor, mode: string | null, code: string | null) {
  return useQuery(() => mode === 'nhan-lai' && code ? supportApi.getTicket(actor, code) : Promise.resolve(null), [mode, code, actor.id, actor.role])
}

export function useSupportTicket(actor: Actor, code: string) {
  return useQuery(() => supportApi.getTicket(actor, code), [actor.id, actor.role, code])
}

export function useSupportMessages(actor: Actor, code: string, beforeId: number) {
  return useQuery(() => supportApi.getMessages(actor, code, beforeId), [actor.id, actor.role, code, beforeId])
}

export function useSupportCs() {
  return useQuery(() => supportApi.listCs(), [])
}

export function useSupportRecipients(role: TargetRole) {
  return useQuery(() => supportApi.listRecipients(role), [role])
}

/** Memoized mutation boundary used by support pages and dialogs. */
export function useSupportCommands() {
  const claim = useCallback((actor: Actor, code: string, command: { reason?: string; expectedVersion: number }) => supportApi.claim(actor, code, command), [])
  const handOver = useCallback((actor: Actor, code: string, command: { toCsId: number; reason: string; expectedVersion?: number }) => supportApi.handOver(actor, code, command), [])
  const reply = useCallback((actor: Actor, code: string, command: { text: string; expectedVersion?: number }) => supportApi.reply(actor, code, command), [])
  const addNote = useCallback((actor: Actor, code: string, command: { text: string; expectedVersion?: number }) => supportApi.addNote(actor, code, command), [])
  const askCustomer = useCallback((actor: Actor, code: string, command: { question: string; expectedVersion?: number }) => supportApi.askCustomer(actor, code, command), [])
  const returnToQueue = useCallback((actor: Actor, code: string, command: { reason: string; expectedVersion?: number }) => supportApi.returnToQueue(actor, code, command), [])
  const classify = useCallback((actor: Actor, code: string, command: { category?: TicketCategory; priority?: TicketPriority; expectedVersion?: number }) => supportApi.classify(actor, code, command), [])
  const resolve = useCallback((actor: Actor, code: string, command: { content: string; expectedVersion?: number }) => supportApi.resolve(actor, code, command), [])
  const close = useCallback((actor: Actor, code: string, command: { reviewed: boolean; note?: string; expectedVersion?: number }) => supportApi.close(actor, code, command), [])
  const createInternal = useCallback((actor: Actor, code: string, command: CreateInternalCommand) => supportApi.createInternal(actor, code, command), [])
  const manageInternal = useCallback((actor: Actor, code: string, irCode: string, command: { action: 'REASSIGN' | 'CANCEL' | 'CLARIFY'; recipientId?: number; reason?: string; clarificationText?: string }) => supportApi.manageInternal(actor, code, irCode, command), [])
  const markNotificationRead = useCallback((id: number) => supportApi.markNotificationRead(id), [])
  const markAllNotificationsRead = useCallback(() => supportApi.markAllNotificationsRead(), [])
  const completeInternal = useCallback((actor: Actor, code: string, command: CompleteCommand) => supportApi.completeInternal(actor, code, command), [])
  const getMessages = useCallback((actor: Actor, code: string, beforeId: number) => supportApi.getMessages(actor, code, beforeId), [])
  return { claim, handOver, reply, addNote, askCustomer, returnToQueue, classify, resolve, close, createInternal, manageInternal, markNotificationRead, markAllNotificationsRead, completeInternal, getMessages }
}

export function usePlatformSupportUseCase() {
  return useSupportCommands()
}
