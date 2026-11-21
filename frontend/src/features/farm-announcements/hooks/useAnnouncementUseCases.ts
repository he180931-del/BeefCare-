import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { announcementsApi } from '../api/announcementsApi'
import type {
  AnnouncementSummary, AnnouncementView, CorrectionCommand, DraftCommand, MemberOptions, PublishPreview, PublishResult, ReadResult, Viewer,
} from '../types'

type QueryResult<T> = ReturnType<typeof useQuery<T>>

export interface AnnouncementUseCaseInput {
  viewer: Viewer
  loadList?: boolean
  detailId?: number | null
  loadMembers?: boolean
  draftId?: number | null
  previewId?: number | null
  refreshKey?: number
}

export interface AnnouncementUseCaseResult {
  list: QueryResult<AnnouncementSummary[] | null>
  detail: QueryResult<AnnouncementView | null>
  members: QueryResult<MemberOptions | null>
  draft: QueryResult<AnnouncementView | null>
  preview: QueryResult<PublishPreview | null>
  saveDraft: (draft: DraftCommand) => Promise<AnnouncementView>
  correct: (id: number, correction: CorrectionCommand) => Promise<AnnouncementView>
  publish: (id: number, expectedVersion: number) => Promise<PublishResult>
  markRead: (id: number) => Promise<ReadResult | null>
}

/**
 * Owns announcement read/command orchestration for pages and dialogs.
 * The API remains the only DTO/transport boundary; this hook only coordinates
 * query lifecycle, retry state and feature commands for the UI.
 */
export function useAnnouncementUseCases({ viewer, loadList = false, detailId = null, loadMembers = false, draftId = null, previewId = null, refreshKey = 0 }: AnnouncementUseCaseInput): AnnouncementUseCaseResult {
  const list = useQuery<AnnouncementSummary[] | null>(
    () => loadList ? announcementsApi.list(viewer) : Promise.resolve(null),
    [loadList, viewer, refreshKey],
  )
  const detail = useQuery<AnnouncementView | null>(
    () => detailId === null ? Promise.resolve(null) : announcementsApi.get(detailId, viewer),
    [detailId, viewer, refreshKey],
  )
  const members = useQuery<MemberOptions | null>(
    () => loadMembers ? announcementsApi.listMembers(viewer) : Promise.resolve(null),
    [loadMembers, viewer],
  )
  const draft = useQuery<AnnouncementView | null>(
    () => draftId === null ? Promise.resolve(null) : announcementsApi.get(draftId, viewer),
    [draftId, viewer],
  )
  const preview = useQuery<PublishPreview | null>(
    () => previewId === null ? Promise.resolve(null) : announcementsApi.previewPublish(viewer, previewId),
    [previewId, viewer],
  )

  const saveDraft = useCallback((command: DraftCommand) => announcementsApi.saveDraft(viewer, command), [viewer])
  const correct = useCallback((id: number, command: CorrectionCommand) => announcementsApi.correct(viewer, id, command), [viewer])
  const publish = useCallback((id: number, expectedVersion: number) => announcementsApi.publish(viewer, id, expectedVersion), [viewer])
  const markRead = useCallback((id: number) => announcementsApi.markRead(viewer, id), [viewer])

  return {
    list,
    detail,
    members,
    draft,
    preview,
    saveDraft,
    correct,
    publish,
    markRead,
  }
}
