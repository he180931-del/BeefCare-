import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useFixtureSession } from '../../../app/fixtureSession'
import { screenById, type ScreenDefinition, type ScreenId, type ScreenRole } from '../../../app/screenManifest'
import { landingRouteForRole } from '../../../app/navigation'
import Layout from '../../../components/Layout'
import PlatformLayout from '../../../components/PlatformLayout'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Button } from '../../../components/ui'
import { EmptyState } from '../../../components/workspace'
import { AccountScreen } from '../../account/pages/AccountScreens'
import { PenPreviewScreen } from '../../pen-management/pages/PenPreviewScreens'
import { CattlePreviewScreen } from '../../cattle/pages/CattlePreviewScreens'
import { HerdEntryPreviewScreen } from '../../herd-entry/pages/HerdEntryPreviewScreens'
import { HerdEntryAdvancedPreviewScreen } from '../../herd-entry/pages/HerdEntryAdvancedPreviewScreens'
import { AnnouncementPreviewScreen } from '../../farm-announcements/pages/AnnouncementPreviewScreens'
import { GrowthPreviewScreen } from '../../growth/pages/GrowthPreviewScreens'
import { VaccinationPreviewScreen } from '../../vaccination/pages/VaccinationPreviewScreens'
import { HealthPreviewScreen } from '../../health/pages/HealthPreviewScreens'
import { ReproductionPreviewScreen } from '../../reproduction/pages/ReproductionPreviewScreens'
import { ReproductionExtendedScreen } from '../../reproduction/pages/ReproductionExtendedPreviewScreens'
import { ReproductionExtendedV2 } from '../../reproduction/pages/ReproductionExtendedV2'
import { HerdExitPreviewScreen } from '../../herd-exit/pages/HerdExitPreviewScreens'
import { FormScreen } from '../../forms/pages/FormScreens'
import { InsightScreen } from '../../insights/pages/InsightScreens'
import { OperationalScreen } from '../../operations/pages/OperationalScreens'
import { PlatformScreen } from '../../platform/pages/PlatformScreens'
import { RecordScreen } from '../../records/pages/RecordScreens'
import { TechnicianScreen } from '../../technician/pages/TechnicianScreens'
import { CatalogueScreen } from '../../catalogue/pages/CatalogueScreens'
import { SubscriptionScreen } from '../../subscription/pages/SubscriptionScreens'
import { PlatformServiceScreen } from '../../platform-service'
import { PlatformFinanceScreen } from '../../platform-finance'
import { SupportScreen } from '../../support'
import { FeedManagementScreen } from '../../feed/pages/FeedManagementScreens'
import { RationScreen } from '../../feed/pages/RationScreens'
import { FeedCatalogueScreen } from '../../feed/pages/FeedCatalogueScreens'
import { FeedReportScreen } from '../../feed/pages/FeedReportScreens'
import { TechnicianFeedScreen } from '../../feed/pages/TechnicianFeedScreen'
import { CattleTimelineScreen } from '../../cattle/pages/CattleTimelineScreen'
import { NotificationScreen } from '../../notifications/pages/NotificationScreens'
import logo from '../../../assets/logo.png'

type PreviewKind = 'account' | 'form' | 'insight' | 'operations' | 'platform' | 'record' | 'technician'
const ACCOUNT_FEATURES = new Set(['account', 'farm', 'membership', 'subscription'])
const PLATFORM_ROLES = new Set<ScreenRole>(['cs', 'pm', 'sa'])
const ACCOUNT_SCREEN_IDS = new Set<ScreenId>(Array.from({ length: 19 }, (_, index) => `SCR-${String(index + 1).padStart(2, '0')}`) as ScreenId[])
const PEN_SCREEN_IDS = new Set<ScreenId>(['SCR-22', 'SCR-23', 'SCR-24', 'SCR-25'])
const CATTLE_SCREEN_IDS = new Set<ScreenId>(['SCR-26', 'SCR-27', 'SCR-28', 'SCR-29', 'SCR-30', 'SCR-31', 'SCR-32'])
const HERD_ENTRY_SCREEN_IDS = new Set<ScreenId>(['SCR-33', 'SCR-34', 'SCR-35', 'SCR-36', 'SCR-37'])
const HERD_ENTRY_ADVANCED_SCREEN_IDS = new Set<ScreenId>(['SCR-105', 'SCR-106', 'SCR-107', 'SCR-108', 'SCR-109', 'SCR-110'])
const ANNOUNCEMENT_SCREEN_IDS = new Set<ScreenId>(['SCR-38', 'SCR-39', 'SCR-40', 'SCR-41'])
const GROWTH_SCREEN_IDS = new Set<ScreenId>(['SCR-42', 'SCR-43', 'SCR-44', 'SCR-45'])
// The full vaccination slice is SCR-46–52 in the current executable manifest.
// Keep these IDs ahead of the health range so defer/history/correction screens
// do not fall through to the health preview renderer.
const VACCINATION_SCREEN_IDS = new Set<ScreenId>(['SCR-46', 'SCR-47', 'SCR-48', 'SCR-49', 'SCR-50', 'SCR-51', 'SCR-52'])
const HEALTH_PREVIEW_SCREEN_IDS = new Set<ScreenId>(['SCR-53', 'SCR-54', 'SCR-55', 'SCR-56', 'SCR-57', 'SCR-58'])
const REPRO_PREVIEW_SCREEN_IDS = new Set<ScreenId>(['SCR-59', 'SCR-60', 'SCR-61', 'SCR-62', 'SCR-63'])
const REPRO_EXTENDED_SCREEN_IDS = new Set<ScreenId>(['SCR-64', 'SCR-65', 'SCR-66', 'SCR-67', 'SCR-68'])
const HERD_EXIT_SCREEN_IDS = new Set<ScreenId>(['SCR-69', 'SCR-70', 'SCR-71', 'SCR-72'])
const PLATFORM_SCREEN_IDS = new Set<ScreenId>(['SCR-20', 'SCR-21'])
const TECHNICIAN_SCREEN_IDS = new Set<ScreenId>(['SCR-32', 'SCR-104'])
const INSIGHT_SCREEN_IDS = new Set<ScreenId>(['SCR-77', 'SCR-78'])
const NOTIFICATION_SCREEN_IDS = new Set<ScreenId>(['SCR-73', 'SCR-74', 'SCR-75', 'SCR-76'])
const CATALOGUE_SCREEN_IDS = new Set<ScreenId>(['SCR-81', 'SCR-82', 'SCR-83', 'SCR-84', 'SCR-85'])
const SUBSCRIPTION_SCREEN_IDS = new Set<ScreenId>(['SCR-86', 'SCR-87', 'SCR-88', 'SCR-89'])
const PLATFORM_SERVICE_SCREEN_IDS = new Set<ScreenId>(['SCR-90', 'SCR-91', 'SCR-92'])
const PLATFORM_FINANCE_SCREEN_IDS = new Set<ScreenId>(['SCR-100', 'SCR-101', 'SCR-102', 'SCR-103'])
const SUPPORT_SCREEN_IDS = new Set<ScreenId>(['SCR-93', 'SCR-94', 'SCR-95', 'SCR-96', 'SCR-97', 'SCR-98', 'SCR-99'])
const FEED_MANAGEMENT_SCREEN_IDS = new Set<ScreenId>(['SCR-111', 'SCR-112', 'SCR-113', 'SCR-114'])
const RATION_SCREEN_IDS = new Set<ScreenId>(['SCR-115', 'SCR-116', 'SCR-117', 'SCR-118', 'SCR-119'])
const FEED_CATALOGUE_SCREEN_IDS = new Set<ScreenId>(['SCR-120'])
const FEED_REPORT_SCREEN_IDS = new Set<ScreenId>(['SCR-121'])
// Owner may inspect every manager workflow, but recording/correcting care data
// remains a manager operation. Passing the existing read-only state through the
// feature surfaces keeps the UI honest while preserving the full context.
const OWNER_READ_ONLY_WORKFLOW_SCREEN_IDS = new Set<ScreenId>([
  'SCR-44', 'SCR-45',
  'SCR-47', 'SCR-48', 'SCR-50', 'SCR-52',
  'SCR-55', 'SCR-56', 'SCR-57', 'SCR-58',
  'SCR-61', 'SCR-62', 'SCR-63', 'SCR-64', 'SCR-65', 'SCR-66', 'SCR-67', 'SCR-68',
  'SCR-117', 'SCR-118',
])
export function previewKindFor(screen: ScreenDefinition, role: Exclude<ScreenRole, 'guest'>): PreviewKind {
  if (ACCOUNT_SCREEN_IDS.has(screen.id)) return 'account'
  if (PLATFORM_SCREEN_IDS.has(screen.id)) return 'platform'
  if (TECHNICIAN_SCREEN_IDS.has(screen.id) && role === 'technician') return 'technician'
  if (INSIGHT_SCREEN_IDS.has(screen.id)) return 'insight'
  if (role === 'technician' || (screen.roles.length === 1 && screen.roles[0] === 'technician')) return 'technician'
  if (PLATFORM_ROLES.has(role) || screen.feature.startsWith('platform-') || screen.feature === 'platform-work' || screen.feature === 'platform-access') return 'platform'
  if (ACCOUNT_FEATURES.has(screen.feature) || screen.roles.includes('guest')) return 'account'
  if (screen.archetype === 'dashboard' || screen.archetype === 'report') return 'insight'
  if (screen.kind === 'dialog' || screen.archetype === 'form') return 'form'
  if (screen.kind === 'tab' || screen.archetype === 'detail') return 'record'
  return 'operations'
}

function PreviewContent({ screen }: { screen: ScreenDefinition }) {
  const session = useFixtureSession()
  const kind = previewKindFor(screen, session.role)
  const reviewState = session.role === 'owner' && OWNER_READ_ONLY_WORKFLOW_SCREEN_IDS.has(screen.id)
    ? 'read-only'
    : session.reviewState
  // Feature screens own their navigation. A preview-wide back bar made every
  // screen look like a child page and often sent users to an unrelated route.
  if (screen.id === 'SCR-122') return <TechnicianFeedScreen screen={screen} role={session.role} state={reviewState} />
  if (NOTIFICATION_SCREEN_IDS.has(screen.id)) return <NotificationScreen screen={screen} role={session.role} state={reviewState} />
  if (screen.id === 'SCR-79') return <CattleTimelineScreen screen={screen} role={session.role} state={reviewState} />
  if (screen.id === 'SCR-80') {
    return session.role === 'sa' ? <PlatformScreen screen={screen} state={reviewState} role="sa" /> : <div role="alert" className="border-l-[3px] border-err-fg px-3 py-2.5 text-xs text-err-fg">Chỉ SA mới được xem lịch sử kiểm tra.</div>
  }
  if (HERD_EXIT_SCREEN_IDS.has(screen.id)) return <HerdExitPreviewScreen screen={screen} role={session.role} state={reviewState} />
  if (REPRO_EXTENDED_SCREEN_IDS.has(screen.id)) return <ReproductionExtendedV2 screen={screen} role={session.role} state={reviewState} />
  if (REPRO_PREVIEW_SCREEN_IDS.has(screen.id)) return <ReproductionPreviewScreen screen={screen} role={session.role} state={reviewState} />
  if (HEALTH_PREVIEW_SCREEN_IDS.has(screen.id)) return <HealthPreviewScreen screen={screen} role={session.role} state={reviewState} />
  if (VACCINATION_SCREEN_IDS.has(screen.id)) return <VaccinationPreviewScreen screen={screen} role={session.role} state={reviewState} />
  if (CATALOGUE_SCREEN_IDS.has(screen.id)) return <CatalogueScreen screen={screen} role={session.role} state={reviewState} />
  if (SUBSCRIPTION_SCREEN_IDS.has(screen.id)) return <SubscriptionScreen screen={screen} role={session.role} state={reviewState} />
  if (PLATFORM_SERVICE_SCREEN_IDS.has(screen.id)) return <PlatformServiceScreen screen={screen} role={session.role} state={reviewState} />
  if (PLATFORM_FINANCE_SCREEN_IDS.has(screen.id)) return <PlatformFinanceScreen screen={screen} role={session.role} state={reviewState} />
  if (SUPPORT_SCREEN_IDS.has(screen.id)) return <SupportScreen screen={screen} role={session.role} state={reviewState} />
  if (FEED_MANAGEMENT_SCREEN_IDS.has(screen.id)) return <FeedManagementScreen screen={screen} role={session.role} state={reviewState} />
  if (RATION_SCREEN_IDS.has(screen.id)) return <RationScreen screen={screen} role={session.role} state={reviewState} />
  if (FEED_CATALOGUE_SCREEN_IDS.has(screen.id)) return <FeedCatalogueScreen screen={screen} role={session.role} state={reviewState} />
  if (FEED_REPORT_SCREEN_IDS.has(screen.id)) return <FeedReportScreen screen={screen} role={session.role} state={reviewState} />
  if (HERD_ENTRY_ADVANCED_SCREEN_IDS.has(screen.id)) return <HerdEntryAdvancedPreviewScreen screen={screen} role={session.role} state={reviewState} />
  // Growth owns SCR-42–45. This must run before the generic Care Admin branch,
  // because the manifest also classifies these screens as care-admin dialogs.
  if (GROWTH_SCREEN_IDS.has(screen.id)) {
    return <GrowthPreviewScreen screen={screen} role={session.role} state={reviewState} />
  }
  // Announcement owns SCR-38–41. Keep this before the generic Care Admin
  // renderer so the full compose, review and correction flow is reachable.
  if (ANNOUNCEMENT_SCREEN_IDS.has(screen.id)) {
    return <AnnouncementPreviewScreen screen={screen} role={session.role} state={reviewState} />
  }
  const content = (() => {
    if (PEN_SCREEN_IDS.has(screen.id)) return <PenPreviewScreen screen={screen} role={session.role} state={reviewState} />
    if (CATTLE_SCREEN_IDS.has(screen.id)) return <CattlePreviewScreen screen={screen} role={session.role} state={reviewState} />
    if (HERD_ENTRY_SCREEN_IDS.has(screen.id)) return <HerdEntryPreviewScreen screen={screen} role={session.role} state={reviewState} />
  if (GROWTH_SCREEN_IDS.has(screen.id)) return <GrowthPreviewScreen screen={screen} role={session.role} state={reviewState} />
    switch (kind) {
      case 'account': return <AccountScreen screen={screen} state={reviewState} role={session.role} />
      case 'form': return <FormScreen screen={screen} state={reviewState} />
      case 'insight': return <InsightScreen screen={screen} state={reviewState} role={session.role} />
      case 'platform': return <PlatformScreen screen={screen} state={reviewState} role={PLATFORM_ROLES.has(session.role) ? session.role as 'cs' | 'pm' | 'sa' : 'sa'} />
      case 'record': return <RecordScreen screen={screen} state={reviewState} />
      case 'technician': return <TechnicianScreen screen={screen} state={reviewState} />
      default: return <OperationalScreen screen={screen} state={reviewState} role={session.role} />
    }
  })()
  return content
}

export default function ScreenPreviewPage() {
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = useFixtureSession()
  const [publicMenuOpen, setPublicMenuOpen] = useState(false)
  const screen = useMemo(() => screenById((params.screenId ?? '').toUpperCase() as ScreenId), [params.screenId])
  if (!screen) return <main className="mx-auto max-w-2xl p-8"><EmptyState title="Không tìm thấy màn hình" description="Mã màn hình không tồn tại trong tài liệu SRS hiện tại." actionLabel="Về trang phù hợp" onAction={() => window.history.back()} /></main>
  const allowed = screen.roles.includes('guest') || screen.roles.includes(session.role)
  if (!allowed) {
    const content = <div role="alert" className="flex max-w-2xl flex-col gap-4 border-l-[3px] border-err-fg px-3 py-2.5 text-sm text-err-fg">
      <div><h1 className="m-0 text-base font-semibold text-ink">Bạn không có quyền mở màn hình này.</h1><span className="mt-1 block text-subtle">Vai trò hiện tại không được truy cập {screen.viTitle.toLowerCase()}; không có thao tác nào được thực hiện.</span></div>
      <Button className="self-start" onClick={() => navigate(landingRouteForRole(session.role))}>Về trang phù hợp</Button>
    </div>
    if (session.role === 'technician') return <TechnicianLayout title="Không có quyền truy cập">{content}</TechnicianLayout>
    if (PLATFORM_ROLES.has(session.role)) return <PlatformLayout title="Không có quyền truy cập" role={session.role as 'cs' | 'pm' | 'sa'}>{content}</PlatformLayout>
    return <Layout title="Không có quyền truy cập" user={session.role === 'manager' ? 'manager' : 'owner'}>{content}</Layout>
  }
  const preview = <PreviewContent screen={screen} />
  const parent = screen.parentId ? screenById(screen.parentId) : undefined
  const parentPath = parent ? `/ui/${parent.id.toLowerCase()}${location.search}` : ''
  const content = <div className={`review-ui min-w-0 ${screen.feature === 'feed' ? 'feed-ui' : ''} ${previewKindFor(screen, session.role) === 'technician' ? 'technician-ui' : ''}`}>
    {parent && <nav aria-label="Điều hướng về màn hình cha" className="mb-3"><button type="button" onClick={() => navigate(parentPath)} className="min-h-8 px-0 text-xs font-semibold text-brand hover:underline">← {parent.viTitle}</button></nav>}
    {preview}
  </div>
  if (screen.roles.includes('guest')) {
    const landing = screen.id === 'SCR-01'
    const publicLinks = [['Tính năng', '#tinh-nang'], ['Cách hoạt động', '#cach-hoat-dong'], ['Bảng giá', '#bang-gia'], ['Hỏi đáp', '#hoi-dap']]
    return <div className="min-h-screen bg-page"><header className="sticky top-0 z-30 border-b border-rule bg-white/95 backdrop-blur"><div className="mx-auto flex min-h-[72px] w-full max-w-7xl items-center gap-4 px-4 sm:px-7"><Link to="/ui/scr-01" className="inline-flex min-h-11 items-center gap-2.5 text-2xl font-bold text-brand no-underline"><img src={logo} alt="" className="size-10 rounded-[9px] object-cover" />BeefCare</Link>{landing ? <><nav aria-label="Điều hướng trang giới thiệu" className="ml-auto hidden items-center gap-5 text-sm font-semibold text-ink lg:flex">{publicLinks.map(([label, href]) => <a key={href} className="hover:text-brand" href={href}>{label}</a>)}</nav><div className="ml-auto hidden items-center gap-2 sm:flex lg:ml-2"><Button onClick={() => navigate('/ui/scr-02')}>Đăng nhập</Button><Button variant="primary" onClick={() => navigate('/ui/scr-03')}>Dùng thử</Button></div><button type="button" className="ml-auto grid size-11 cursor-pointer place-items-center rounded-lg border border-field bg-white text-lg text-ink sm:hidden" aria-label={publicMenuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={publicMenuOpen} onClick={() => setPublicMenuOpen((open) => !open)}>{publicMenuOpen ? '×' : '☰'}</button></> : <Button className="ml-auto" onClick={() => navigate('/ui/scr-01')}>Về trang giới thiệu</Button>}</div>{landing && publicMenuOpen && <nav aria-label="Điều hướng trang giới thiệu trên điện thoại" className="border-t border-rule bg-white px-4 py-4 sm:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-1">{publicLinks.map(([label, href]) => <a key={href} className="flex min-h-11 items-center border-b border-rule text-sm font-semibold text-ink no-underline last:border-0" href={href} onClick={() => setPublicMenuOpen(false)}>{label}</a>)}<div className="mt-3 grid grid-cols-2 gap-3"><Button onClick={() => navigate('/ui/scr-02')}>Đăng nhập</Button><Button variant="primary" onClick={() => navigate('/ui/scr-03')}>Dùng thử</Button></div></div></nav>}</header><main className={landing ? 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-7 sm:py-9' : 'w-full'}>{content}</main><footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-rule px-4 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-7"><Link to="/ui/scr-01" className="inline-flex items-center gap-2 text-sm font-bold text-ink no-underline"><img src={logo} alt="" className="size-7 rounded-md object-cover" />BeefCare</Link><span>© 2026 · Điều khoản · Chính sách dữ liệu</span><span>0386 671 863 · tuanpqhe181869@fpt.edu.vn</span></footer></div>
  }
  const shellRole = (screen.roles.length === 1 && screen.roles[0] !== 'guest' ? screen.roles[0] : session.role) as Exclude<ScreenRole, 'guest'>
  if (shellRole === 'technician' || previewKindFor(screen, shellRole) === 'technician') return <TechnicianLayout title={screen.viTitle}>{content}</TechnicianLayout>
  if (PLATFORM_ROLES.has(shellRole)) return <PlatformLayout title={screen.viTitle} role={shellRole as 'cs' | 'pm' | 'sa'}>{content}</PlatformLayout>
  return <Layout title={screen.viTitle} user={shellRole === 'manager' ? 'manager' : 'owner'}>{content}</Layout>
}
