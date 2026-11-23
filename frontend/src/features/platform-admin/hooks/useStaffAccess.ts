import { useQuery } from '../../../shared/hooks/useQuery'
import { platformAdminApi } from '../api/platformAdminApi'
import { useCommandKey } from './useCommandKey'
import type { AccountDetail, AccountChange, PlatformAccessChange } from '../types'

/**
 * Platform staff access command/query boundary for SCR-16 dialogs.
 * Components keep only form state and presentation; API calls and retry-key
 * semantics stay in the feature hook.
 */
export function useStaffAccess(account: Pick<AccountDetail, 'id' | 'version' | 'platformAccessVersion'>) {
  const requestKey = useCommandKey()
  const history = useQuery(() => platformAdminApi.accountHistory(account.id), [account.id, account.platformAccessVersion])

  const changePlatformAccess = (command: PlatformAccessChange) => {
    const key = requestKey.keyFor([account.id, command])
    return platformAdminApi.changePlatformAccess(account.id, command, key)
  }
  const suspendAccount = (command: AccountChange) => {
    const key = requestKey.keyFor([account.id, 'suspend', command.reason, command.expectedVersion])
    return platformAdminApi.suspendAccount(account.id, command, key)
  }
  const restoreAccount = (command: AccountChange) => {
    const key = requestKey.keyFor([account.id, 'restore', command.reason, command.expectedVersion])
    return platformAdminApi.restoreAccount(account.id, command, key)
  }

  return { history, changePlatformAccess, suspendAccount, restoreAccount, clearRequestKey: requestKey.clear }
}
