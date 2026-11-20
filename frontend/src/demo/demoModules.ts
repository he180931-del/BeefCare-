/**
 * The only door through which demo data enters the app (`npm run dev:mock`, Vitest, the Node test suites).
 *
 * `vite build`, and `vite` on the real backend, swap this file for `noDemo.ts` (plugin `beefcare-demo-door` in
 * vite.config.js), so a production bundle carries no demo module. Production code therefore reads `demo.*` only inside
 * a local-mode branch and only when called, never while its module loads (`lazyObject` wraps stores handed to a
 * factory).
 */
import * as account from '../features/account/data/accountDemoStore'
import * as demoUsers from '../features/authentication/data/demoUsers'
import type { SessionUser } from '../app/session/sessionContext'
import * as mockAuth from '../features/authentication/data/mockAuthClient'
import * as announcements from '../features/farm-announcements/data/announcementsDemoStore'
import * as catalogue from '../features/farm-catalogue/data/catalogueDemoStore'
import * as cattleLocal from '../features/cattle/data/cattleLocalStore'
import * as farmOverview from '../features/farm-overview/data/farmOverviewDemoStore'
import * as farmWorkspace from '../features/farm-workspace/data/farmWorkspaceDemoStore'
import * as growth from '../features/growth/data/growthDemoStore'
import * as entryLocal from '../features/herd-entry/data/entryLocalAdapter'
import * as exitLocal from '../features/herd-exit/data/exitLocalAdapter'
import * as health from '../features/health/data/healthDemoStore'
import * as notifications from '../features/notifications/data/notificationsDemoStore'
import * as penLocal from '../features/pen-management/data/penLocalStore'
import * as platformAdmin from '../features/platform-admin/data/platformAdminDemoStore'
import * as finance from '../features/platform-finance/data/financeDemoStore'
import * as platformService from '../features/platform-service/data/platformServiceDemoStore'
import * as platformSupport from '../features/platform-support/data/supportDemoStore'
import * as reproduction from '../features/reproduction/data/reproductionDemoStore'
import * as reproductionOptions from '../features/reproduction/data/reproductionOptions'
import * as subscription from '../features/subscription/data/subscriptionDemoStore'
import * as support from '../features/support/data/supportDemoStore'
import * as vaccination from '../features/vaccination/data/vaccinationDemoStore'
import * as feedReceipt from '../features/feed-stock/data/feedReceiptDemoStore'
import * as feedFeedingMock from '../features/feed-stock/data/feedFeedingMock'
import * as feedRation from '../features/feed-stock/data/feedRationDemoStore'
import * as feedPens from '../features/feed-stock/data/feedPenMock'

export { useDemoState } from './useDemoState'

/** The demo user of a role, standing in for the session when a page renders without one (single-page tests). */
export const demoSessionUser = (role: SessionUser['role']): SessionUser | null => demoUsers.demoUserForRole(role)

export const demo = {
  account,
  demoUsers,
  mockAuth,
  announcements,
  catalogue,
  cattleLocal,
  farmOverview,
  farmWorkspace,
  growth,
  entryLocal,
  exitLocal,
  health,
  notifications,
  penLocal,
  platformAdmin,
  finance,
  platformService,
  platformSupport,
  reproduction,
  reproductionOptions,
  subscription,
  support,
  vaccination,
  feedReceipt,
  feedFeedingMock,
  feedRation,
  feedPens,
}
