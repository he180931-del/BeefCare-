import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { farmWorkspaceApi } from '../api/farmWorkspaceApi'
import type {
  AcceptedInvitation, ChangeMemberInput, CompleteOwnerProfileInput, FarmDetails, FarmInfoInput, FarmRegistrationInput,
  FarmRole, FarmSummary, FarmWorkspaceProfile, Invitation, InvitationListQuery, InvitationPage, InvitationPreview, InviteMemberInput,
  MemberCommandOptions, MemberList, Membership, RequestKeyOptions,
} from '../types'

type QueryResult<T> = ReturnType<typeof useQuery<T>>

export type FarmListMode = 'normal' | 'empty' | 'load-error'

export interface FarmWorkspaceUseCaseInput {
  loadProfile?: boolean
  loadFarms?: boolean
  farmsMode?: FarmListMode
  farmId?: number | null
  loadFarm?: boolean
  loadMembers?: boolean
  memberViewer?: FarmRole
  invitationQuery?: InvitationListQuery | null
  invitationToken?: string | null
  signedInEmail?: string
  refreshKey?: number
}

export interface FarmWorkspaceUseCaseResult {
  profile: QueryResult<FarmWorkspaceProfile | null>
  farms: QueryResult<FarmSummary[] | null>
  farm: QueryResult<FarmDetails | null>
  members: QueryResult<MemberList | null>
  invitations: QueryResult<InvitationPage | null>
  invitationPreview: QueryResult<InvitationPreview | null>
  getProfile: () => Promise<FarmWorkspaceProfile>
  completeOwnerRegistration: (input: CompleteOwnerProfileInput) => Promise<FarmWorkspaceProfile>
  registerFarm: (input: FarmRegistrationInput, options?: RequestKeyOptions) => Promise<FarmDetails>
  updateFarm: (farmId: number, input: FarmInfoInput, options?: RequestKeyOptions) => Promise<FarmDetails>
  selectFarm: (farmId: number) => Promise<FarmSummary>
  changeMember: (farmId: number, memberId: number, input: ChangeMemberInput, options?: MemberCommandOptions) => Promise<Membership>
  inviteMember: (farmId: number, input: InviteMemberInput, options?: RequestKeyOptions) => Promise<Invitation>
  resendInvitation: (farmId: number, invitationId: number, options?: MemberCommandOptions) => Promise<Invitation>
  cancelInvitation: (farmId: number, invitationId: number, options?: MemberCommandOptions) => Promise<Invitation>
  listMembers: (farmId: number, viewer?: FarmRole) => Promise<MemberList>
  listInvitations: (farmId: number, query?: InvitationListQuery) => Promise<InvitationPage>
  acceptInvitation: (token: string, signedInEmail?: string) => Promise<AcceptedInvitation>
}

/**
 * Feature boundary for farm-workspace reads and commands.
 * Pages/components own view state and validation; this hook owns query lifecycle
 * and is the only UI-layer caller of the feature API.
 */
export function useFarmWorkspaceUseCase({
  loadProfile = false,
  loadFarms = false,
  farmsMode = 'normal',
  farmId = null,
  loadFarm = false,
  loadMembers = false,
  memberViewer = 'OWNER',
  invitationQuery = null,
  invitationToken = null,
  signedInEmail = '',
  refreshKey = 0,
}: FarmWorkspaceUseCaseInput = {}): FarmWorkspaceUseCaseResult {
  const invitationStatus = invitationQuery?.status
  const invitationPage = invitationQuery?.page
  const invitationSize = invitationQuery?.size
  const invitationSort = invitationQuery?.sort
  const invitationDir = invitationQuery?.dir
  const invitationId = invitationQuery?.invitationId

  const profile = useQuery<FarmWorkspaceProfile | null>(
    () => loadProfile ? farmWorkspaceApi.getProfile() : Promise.resolve(null),
    [loadProfile, refreshKey],
  )
  const farms = useQuery<FarmSummary[] | null>(
    () => {
      if (!loadFarms) return Promise.resolve(null)
      if (farmsMode === 'load-error') return Promise.reject(new Error('Không tải được danh sách trang trại.'))
      if (farmsMode === 'empty') return Promise.resolve([])
      return farmWorkspaceApi.listFarms()
    },
    [loadFarms, farmsMode, refreshKey],
  )
  const farm = useQuery<FarmDetails | null>(
    () => loadFarm && farmId !== null ? farmWorkspaceApi.getFarm(farmId) : Promise.resolve(null),
    [loadFarm, farmId, refreshKey],
  )
  const members = useQuery<MemberList | null>(
    () => loadMembers && farmId !== null ? farmWorkspaceApi.listMembers(farmId, memberViewer) : Promise.resolve(null),
    [loadMembers, farmId, memberViewer, refreshKey],
  )
  const invitations = useQuery<InvitationPage | null>(
    () => invitationQuery !== null && farmId !== null ? farmWorkspaceApi.listInvitations(farmId, invitationQuery) : Promise.resolve(null),
    [farmId, invitationStatus, invitationPage, invitationSize, invitationSort, invitationDir, invitationId, refreshKey],
  )
  const invitationPreview = useQuery<InvitationPreview | null>(
    () => invitationToken ? farmWorkspaceApi.previewInvitation(invitationToken, signedInEmail) : Promise.resolve(null),
    [invitationToken, signedInEmail, refreshKey],
  )

  const completeOwnerRegistration = useCallback((input: CompleteOwnerProfileInput) => farmWorkspaceApi.completeOwnerRegistration(input), [])
  const getProfile = useCallback(() => farmWorkspaceApi.getProfile(), [])
  const registerFarm = useCallback((input: FarmRegistrationInput, options?: RequestKeyOptions) => farmWorkspaceApi.registerFarm(input, options), [])
  const updateFarm = useCallback((id: number, input: FarmInfoInput, options?: RequestKeyOptions) => farmWorkspaceApi.updateFarm(id, input, options), [])
  const selectFarm = useCallback((id: number) => farmWorkspaceApi.selectFarm(id), [])
  const changeMember = useCallback((id: number, memberId: number, input: ChangeMemberInput, options?: MemberCommandOptions) => farmWorkspaceApi.changeMember(id, memberId, input, options), [])
  const inviteMember = useCallback((id: number, input: InviteMemberInput, options?: RequestKeyOptions) => farmWorkspaceApi.inviteMember(id, input, options), [])
  const resendInvitation = useCallback((id: number, invitationIdValue: number, options?: MemberCommandOptions) => farmWorkspaceApi.resendInvitation(id, invitationIdValue, options), [])
  const cancelInvitation = useCallback((id: number, invitationIdValue: number, options?: MemberCommandOptions) => farmWorkspaceApi.cancelInvitation(id, invitationIdValue, options), [])
  const listMembers = useCallback((id: number, viewer?: FarmRole) => farmWorkspaceApi.listMembers(id, viewer), [])
  const listInvitations = useCallback((id: number, query?: InvitationListQuery) => farmWorkspaceApi.listInvitations(id, query), [])
  const acceptInvitation = useCallback((token: string, email?: string) => farmWorkspaceApi.acceptInvitation(token, email), [])

  return { profile, farms, farm, members, invitations, invitationPreview, getProfile, completeOwnerRegistration, registerFarm, updateFarm, selectFarm, changeMember, inviteMember, resendInvitation, cancelInvitation, listMembers, listInvitations, acceptInvitation }
}
