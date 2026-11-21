import { useMemo } from 'react'
import { accountApi } from '../api/accountApi'

/**
 * Feature-owned command boundary for account pages and dialogs.  Components
 * own form state and validation; account API calls stay in this hook.
 */
export function useAccountUseCase() {
  return useMemo(() => ({
    samplePasswordHint: () => accountApi.samplePasswordHint(),
    reauthenticateWithGoogle: (identity: Parameters<typeof accountApi.reauthenticateWithGoogle>[0], returnTo: string) => accountApi.reauthenticateWithGoogle(identity, returnTo),
    changePassword: (identity: Parameters<typeof accountApi.changePassword>[0], input: Parameters<typeof accountApi.changePassword>[1]) => accountApi.changePassword(identity, input),
    getProfile: (identity: Parameters<typeof accountApi.getProfile>[0]) => accountApi.getProfile(identity),
    updateProfile: (identity: Parameters<typeof accountApi.updateProfile>[0], input: Parameters<typeof accountApi.updateProfile>[1]) => accountApi.updateProfile(identity, input),
    getFarmPermissions: (identity: Parameters<typeof accountApi.getFarmPermissions>[0], farmId: number) => accountApi.getFarmPermissions(identity, farmId),
  }), [])
}
