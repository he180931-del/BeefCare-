import { lazy, Suspense, type ReactElement } from 'react'
import { Route, Routes } from 'react-router-dom'
import { loadImportDetailPage, loadImportListPage, loadImportNewPage } from './features/herd-entry'
import { loadExportDetailPage, loadExportListPage, loadExportNewPage } from './features/herd-exit'
import { loadCowListPage, loadCowProfilePage, loadScanQrPage, loadTechnicianCattleRoutes } from './features/cattle'
import { loadPenListPage } from './features/pen-management'
import { loadFeedCataloguePage, loadFeedConsumptionReportPage, loadFeedFeedingPage, loadFeedRationFormPage, loadFeedRationPage, loadFeedReceiptFormPage, loadFeedReceiptPage, loadFeedStockAdjustmentFormPage, loadFeedStockAdjustmentPage, loadFeedStockPage, loadFeedTodayRationsPage } from './features/feed-stock'
import { loadCalvingPage, loadReproductionWorklistPage, loadTechnicianReproductionPage } from './features/reproduction'
import { loadAcceptInvitationPage, loadFarmInformationPage, loadFarmRegistrationPage, loadFarmSelectPage, loadInvitationsPage, loadMembersPage, loadOwnerRegistrationPage } from './features/farm-workspace'
import { loadFarmDashboardPage, loadManagementReportPage, loadRemindersPage, loadTechnicianHomePage, loadTechnicianRemindersPage } from './features/farm-overview'
import { loadAnnouncementRoutes, loadTechnicianAnnouncementRoutes } from './features/farm-announcements'
import { loadGrowthRoutes } from './features/growth'
import { loadVaccinationRoutes } from './features/vaccination'
import { loadHealthRoutes } from './features/health'
import { loadCatalogueRoutes } from './features/farm-catalogue'
import { loadFirstSubscriptionPage, loadSubscriptionRoutes } from './features/subscription'
import { loadSupportRoutes } from './features/support'
import { loadMyNotificationsPage } from './features/notifications'
import { loadPlatformProfilePage, loadProfilePage, loadTechnicianAccountPage } from './features/account'
import { loadInternalRequestRoutes, loadSupportDeskRoutes } from './features/platform-support'
import { loadFarmServiceRoutes, loadPaymentReconciliationRoutes, loadPlanPriceRoutes, loadPlatformSubscriptionRoutes } from './features/platform-service'
import { loadCashReportRoutes, loadManualFinanceRoutes, loadPmSupportNoticePage, loadReceiptRoutes, loadReconciliationNoticePage } from './features/platform-finance'
import { loadAdminNoticePage, loadAuditRoutes, loadStaffAccessRoutes, loadUserAccountRoutes } from './features/platform-admin'
import { HomeRedirect, RoleGate, type AppRole } from './features/authorization'
import { LegalPage } from './features/authentication/pages/LegalPage'

// Mỗi trang tải lazy: lỗi ở một trang không làm hỏng các trang khác.
const ImportList = lazy(loadImportListPage)
const ImportNew = lazy(loadImportNewPage)
const ImportDetail = lazy(loadImportDetailPage)
const ExportList = lazy(loadExportListPage)
const ExportNew = lazy(loadExportNewPage)
const ExportDetail = lazy(loadExportDetailPage)
const BarnList = lazy(loadPenListPage)
const CowList = lazy(loadCowListPage)
const CowProfile = lazy(loadCowProfilePage)
const ScanQr = lazy(loadScanQrPage)
const TechnicianCattle = lazy(loadTechnicianCattleRoutes)
const FeedStock = lazy(loadFeedStockPage)
const FeedReceipts = lazy(loadFeedReceiptPage)
const FeedReceiptForm = lazy(loadFeedReceiptFormPage)
const FeedStockAdjustments = lazy(loadFeedStockAdjustmentPage)
const FeedStockAdjustmentForm = lazy(loadFeedStockAdjustmentFormPage)
const FeedRations = lazy(loadFeedRationPage)
const FeedRationForm = lazy(loadFeedRationFormPage)
const FeedFeeding = lazy(loadFeedFeedingPage)
const FeedCatalogue = lazy(loadFeedCataloguePage)
const FeedConsumptionReport = lazy(loadFeedConsumptionReportPage)
const FeedTodayRations = lazy(loadFeedTodayRationsPage)
const ReproductionWorklist = lazy(loadReproductionWorklistPage)
const TechnicianReproduction = lazy(loadTechnicianReproductionPage)
const Calving = lazy(loadCalvingPage)
const OwnerRegistration = lazy(loadOwnerRegistrationPage)
const FarmSelect = lazy(loadFarmSelectPage)
const FarmRegistration = lazy(loadFarmRegistrationPage)
const FarmInformation = lazy(loadFarmInformationPage)
const Members = lazy(loadMembersPage)
const Invitations = lazy(loadInvitationsPage)
const AcceptInvitation = lazy(loadAcceptInvitationPage)
const FarmDashboard = lazy(loadFarmDashboardPage)
const Reminders = lazy(loadRemindersPage)
const ManagementReport = lazy(loadManagementReportPage)
const TechnicianHome = lazy(loadTechnicianHomePage)
const TechnicianReminders = lazy(loadTechnicianRemindersPage)
const Announcements = lazy(loadAnnouncementRoutes)
const TechnicianAnnouncements = lazy(loadTechnicianAnnouncementRoutes)
const Growth = lazy(loadGrowthRoutes)
const Vaccination = lazy(loadVaccinationRoutes)
const Health = lazy(loadHealthRoutes)
const Catalogue = lazy(loadCatalogueRoutes)
const Subscription = lazy(loadSubscriptionRoutes)
const FirstSubscription = lazy(loadFirstSubscriptionPage)
const Support = lazy(loadSupportRoutes)
const MyNotifications = lazy(loadMyNotificationsPage)
const Profile = lazy(loadProfilePage)
const TechnicianAccount = lazy(loadTechnicianAccountPage)
const PlatformProfile = lazy(loadPlatformProfilePage)
const SupportDesk = lazy(loadSupportDeskRoutes)
const InternalRequests = lazy(loadInternalRequestRoutes)
const FarmService = lazy(loadFarmServiceRoutes)
const PlatformSubscriptions = lazy(loadPlatformSubscriptionRoutes)
const PaymentReconciliation = lazy(loadPaymentReconciliationRoutes)
const PlanPrices = lazy(loadPlanPriceRoutes)
const Receipts = lazy(loadReceiptRoutes)
const ManualFinance = lazy(loadManualFinanceRoutes)
const CashReport = lazy(loadCashReportRoutes)
const ReconciliationNotices = lazy(loadReconciliationNoticePage)
const PmSupportNotices = lazy(loadPmSupportNoticePage)
const UserAccounts = lazy(loadUserAccountRoutes)
const StaffAccess = lazy(loadStaffAccessRoutes)
const Audit = lazy(loadAuditRoutes)
const AdminNotices = lazy(loadAdminNoticePage)
const Placeholder = lazy(() => import('./pages/Placeholder'))

const only = (allow: readonly AppRole[], element: ReactElement) => <RoleGate allow={allow}>{element}</RoleGate>
const desk = (element: ReactElement) => only(['OWNER', 'MANAGER'], element)
const owner = (element: ReactElement) => only(['OWNER'], element)
const farmMember = (element: ReactElement) => only(['OWNER', 'MANAGER', 'TECHNICIAN'], element)
const technician = (element: ReactElement) => only(['TECHNICIAN'], element)
const cs = (element: ReactElement) => only(['CS'], element)
const pm = (element: ReactElement) => only(['PM'], element)
const sa = (element: ReactElement) => only(['SA'], element)

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/data-policy" element={<LegalPage kind="data" />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/tong-quan" element={desk(<FarmDashboard />)} />
        <Route path="/nhac-viec" element={desk(<Reminders />)} />
        <Route path="/bao-cao" element={desk(<ManagementReport />)} />
        <Route path="/thong-bao/*" element={desk(<Announcements />)} />
        <Route path="/herd-entry" element={desk(<ImportList />)} />
        <Route path="/herd-entry/new" element={desk(<ImportNew />)} />
        <Route path="/herd-entry/:id" element={desk(<ImportDetail />)} />
        <Route path="/herd-exit" element={desk(<ExportList />)} />
        <Route path="/herd-exit/new" element={desk(<ExportNew />)} />
        <Route path="/herd-exit/:id" element={desk(<ExportDetail />)} />
        <Route path="/pens" element={farmMember(<BarnList />)} />
        <Route path="/cattle" element={desk(<CowList />)} />
        <Route path="/cattle/:code/sinh-san/de" element={desk(<Calving />)} />
        <Route path="/cattle/:code" element={desk(<CowProfile />)} />
        <Route path="/quet-qr" element={desk(<ScanQr />)} />
        <Route path="/can-nang/*" element={desk(<Growth />)} />
        <Route path="/tiem-phong/*" element={desk(<Vaccination />)} />
        <Route path="/suc-khoe/*" element={desk(<Health />)} />
        <Route path="/sinh-san" element={desk(<ReproductionWorklist />)} />
        <Route path="/thuc-an" element={desk(<FeedStock />)} />
        <Route path="/thuc-an/hom-nay" element={farmMember(<FeedTodayRations />)} />
        <Route path="/thuc-an/phieu-nhap" element={desk(<FeedReceipts />)} />
        <Route path="/thuc-an/phieu-nhap/moi" element={desk(<FeedReceiptForm />)} />
        <Route path="/thuc-an/phieu-nhap/:id" element={desk(<FeedReceiptForm />)} />
        <Route path="/thuc-an/kiem-ke" element={desk(<FeedStockAdjustments />)} />
        <Route path="/thuc-an/kiem-ke/moi" element={desk(<FeedStockAdjustmentForm />)} />
        <Route path="/thuc-an/kiem-ke/:id" element={desk(<FeedStockAdjustmentForm />)} />
        <Route path="/thuc-an/khau-phan" element={desk(<FeedRations />)} />
        <Route path="/thuc-an/khau-phan/moi" element={desk(<FeedRationForm />)} />
        <Route path="/thuc-an/khau-phan/:id" element={desk(<FeedRationForm />)} />
        <Route path="/thuc-an/nhat-ky" element={farmMember(<FeedFeeding />)} />
        <Route path="/thuc-an/danh-muc" element={desk(<FeedCatalogue />)} />
        <Route path="/thuc-an/bao-cao" element={desk(<FeedConsumptionReport />)} />
        <Route path="/danh-muc/*" element={farmMember(<Catalogue />)} />
        <Route path="/owner-registration" element={<OwnerRegistration />} />
        <Route path="/chon-trai" element={<FarmSelect />} />
        <Route path="/dang-ky-trai" element={<FarmRegistration />} />
        <Route path="/dang-ky-goi" element={owner(<FirstSubscription />)} />
        <Route path="/thong-tin-trai" element={owner(<FarmInformation />)} />
        <Route path="/thanh-vien" element={desk(<Members />)} />
        <Route path="/loi-moi" element={owner(<Invitations />)} />
        <Route path="/invitation/accept" element={<AcceptInvitation />} />
        <Route path="/goi-dich-vu/*" element={owner(<Subscription />)} />
        <Route path="/ho-tro/*" element={owner(<Support />)} />
        <Route path="/thong-bao-cua-toi" element={owner(<MyNotifications />)} />
        <Route path="/ho-so" element={desk(<Profile />)} />

        <Route path="/kt" element={technician(<TechnicianHome />)} />
        <Route path="/kt/nhac-viec" element={technician(<TechnicianReminders />)} />
        <Route path="/kt/thong-bao/*" element={technician(<TechnicianAnnouncements />)} />
        <Route path="/kt/dan-bo/*" element={technician(<TechnicianCattle />)} />
        <Route path="/kt/quet-qr" element={technician(<ScanQr />)} />
        <Route path="/kt/sinh-san" element={technician(<TechnicianReproduction />)} />
        <Route path="/kt/thuc-an" element={technician(<FeedTodayRations />)} />
        <Route path="/kt/tai-khoan" element={technician(<TechnicianAccount />)} />

        <Route path="/nen-tang/ho-tro/*" element={cs(<SupportDesk />)} />
        <Route path="/nen-tang/yeu-cau/*" element={only(['PM', 'SA'], <InternalRequests />)} />
        <Route path="/nen-tang/dich-vu/*" element={pm(<FarmService />)} />
        <Route path="/nen-tang/goi-dang-ky/*" element={pm(<PlatformSubscriptions />)} />
        <Route path="/nen-tang/thanh-toan/*" element={pm(<PaymentReconciliation />)} />
        <Route path="/nen-tang/bang-gia/*" element={pm(<PlanPrices />)} />
        <Route path="/nen-tang/bien-nhan/*" element={pm(<Receipts />)} />
        <Route path="/nen-tang/thu-chi/*" element={pm(<ManualFinance />)} />
        <Route path="/nen-tang/bao-cao-dong-tien/*" element={pm(<CashReport />)} />
        <Route path="/nen-tang/thong-bao-doi-soat" element={pm(<ReconciliationNotices />)} />
        <Route path="/nen-tang/thong-bao-ho-tro" element={pm(<PmSupportNotices />)} />
        <Route path="/nen-tang/tai-khoan/*" element={sa(<UserAccounts />)} />
        <Route path="/nen-tang/quyen/*" element={sa(<StaffAccess />)} />
        <Route path="/nen-tang/audit/*" element={sa(<Audit />)} />
        <Route path="/nen-tang/thong-bao" element={sa(<AdminNotices />)} />
        <Route path="/nen-tang/ho-so" element={only(['CS', 'PM', 'SA'], <PlatformProfile />)} />

        <Route path="*" element={<Placeholder />} />
      </Routes>
    </Suspense>
  )
}
