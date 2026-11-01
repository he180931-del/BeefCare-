import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { loadImportDetailPage, loadImportListPage, loadImportNewPage } from './features/herd-entry'
import { loadExportDetailPage, loadExportListPage, loadExportNewPage } from './features/herd-exit'
import { loadCowListPage, loadCowProfilePage } from './features/cattle'
import { loadPenListPage } from './features/pen-management'
import { loadFeedCataloguePage, loadFeedConsumptionReportPage, loadFeedFeedingPage, loadFeedRationFormPage, loadFeedRationPage, loadFeedReceiptFormPage, loadFeedReceiptPage, loadFeedStockAdjustmentFormPage, loadFeedStockAdjustmentPage, loadFeedStockPage, loadFeedTodayRationsPage } from './features/feed-stock'
import { loadCalvingPage, loadReproductionWorklistPage } from './features/reproduction'
import { loadAcceptInvitationPage, loadFarmInformationPage, loadFarmRegistrationPage, loadFarmSelectPage, loadInvitationsPage, loadMembersPage, loadOwnerRegistrationPage } from './features/farm-workspace'

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
const Calving = lazy(loadCalvingPage)
const OwnerRegistration = lazy(loadOwnerRegistrationPage)
const FarmSelect = lazy(loadFarmSelectPage)
const FarmRegistration = lazy(loadFarmRegistrationPage)
const FarmInformation = lazy(loadFarmInformationPage)
const Members = lazy(loadMembersPage)
const Invitations = lazy(loadInvitationsPage)
const AcceptInvitation = lazy(loadAcceptInvitationPage)
const Placeholder = lazy(() => import('./pages/Placeholder'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Navigate to="/herd-entry" replace />} />
        <Route path="/herd-entry" element={<ImportList />} />
        <Route path="/herd-entry/new" element={<ImportNew />} />
        <Route path="/herd-entry/:id" element={<ImportDetail />} />
        <Route path="/herd-exit" element={<ExportList />} />
        <Route path="/herd-exit/new" element={<ExportNew />} />
        <Route path="/herd-exit/:id" element={<ExportDetail />} />
        <Route path="/pens" element={<BarnList />} />
        <Route path="/cattle" element={<CowList />} />
        <Route path="/cattle/:code/sinh-san/de" element={<Calving />} />
        <Route path="/cattle/:code" element={<CowProfile />} />
        <Route path="/sinh-san" element={<ReproductionWorklist />} />
        <Route path="/thuc-an" element={<FeedStock />} />
        <Route path="/thuc-an/hom-nay" element={<FeedTodayRations />} />
        <Route path="/thuc-an/phieu-nhap" element={<FeedReceipts />} />
        <Route path="/thuc-an/phieu-nhap/moi" element={<FeedReceiptForm />} />
        <Route path="/thuc-an/phieu-nhap/:id" element={<FeedReceiptForm />} />
        <Route path="/thuc-an/kiem-ke" element={<FeedStockAdjustments />} />
        <Route path="/thuc-an/kiem-ke/moi" element={<FeedStockAdjustmentForm />} />
        <Route path="/thuc-an/kiem-ke/:id" element={<FeedStockAdjustmentForm />} />
        <Route path="/thuc-an/khau-phan" element={<FeedRations />} />
        <Route path="/thuc-an/khau-phan/moi" element={<FeedRationForm />} />
        <Route path="/thuc-an/khau-phan/:id" element={<FeedRationForm />} />
        <Route path="/thuc-an/nhat-ky" element={<FeedFeeding />} />
        <Route path="/thuc-an/danh-muc" element={<FeedCatalogue />} />
        <Route path="/thuc-an/bao-cao" element={<FeedConsumptionReport />} />
        <Route path="/owner-registration" element={<OwnerRegistration />} />
        <Route path="/chon-trai" element={<FarmSelect />} />
        <Route path="/dang-ky-trai" element={<FarmRegistration />} />
        <Route path="/thong-tin-trai" element={<FarmInformation />} />
        <Route path="/thanh-vien" element={<Members />} />
        <Route path="/loi-moi" element={<Invitations />} />
        <Route path="/chap-nhan-loi-moi" element={<AcceptInvitation />} />
        <Route path="*" element={<Placeholder />} />
      </Routes>
    </Suspense>
  )
}
