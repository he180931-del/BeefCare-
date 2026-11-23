import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const output = path.join(here, 'fe01-usecase-flows.html')

const unitDefinitions = {
  'register-page': ['frontend/src/features/authentication/pages/RegisterPage.tsx', 9, 71, 21, 40, 'Cả hàm component', 'RegisterPage()'],
  'auth-provider-init': ['frontend/src/features/authentication/AuthContext.tsx', 33, 94, 33, 61, 'Cả hàm component', 'AuthProvider() · khởi tạo phiên'],
  'auth-client-register': ['frontend/src/features/authentication/client.ts', 1, 27, 8, 17, 'Cả file', 'client.ts'],
  'backend-client-request': ['frontend/src/shared/api/backendClient.ts', 55, 141, 79, 103, 'Cả hàm', 'createBackendClient()'],
  'google-oauth-file': ['frontend/src/features/authentication/googleOAuth.ts', 1, 5, 1, 5, 'Cả file', 'googleOAuth.ts'],
  'account-usecase-file': ['frontend/src/features/account/hooks/useAccountUseCase.ts', 1, 17, 8, 16, 'Cả file', 'useAccountUseCase.ts'],
  'account-register': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 112, 118, 112, 118, 'Cả hàm', 'registerAccount()'],
  'identity-register': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 74, 113, 74, 113, 'Cả hàm', 'register()'],
  'account-activate': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 131, 154, 131, 154, 'Cả hàm', 'activateAccount()'],
  'identity-activate': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 115, 128, 115, 128, 'Cả hàm', 'activateEmail()'],
  'account-resend-verification': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 156, 178, 157, 166, 'Endpoint + DTO response', 'resendEmailVerification()'],
  'identity-resend-verification': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 130, 159, 131, 149, 'Hàm resend + đọc email token', 'resendVerification()'],
  'owner-registration-page': ['frontend/src/features/farm-workspace/pages/OwnerRegistrationPage.tsx', 7, 32, 7, 27, 'Cả hàm component', 'OwnerRegistrationPage()'],
  'owner-registration-hook': ['frontend/src/features/farm-workspace/hooks/useOwnerRegistration.ts', 9, 16, 9, 16, 'Cả hook', 'useOwnerRegistration()'],
  'owner-registration-api': ['frontend/src/features/farm-workspace/api/farmWorkspaceApi.ts', 162, 177, 169, 177, 'Cả hàm chứa adapter', 'createFarmWorkspaceApi() · completeOwnerRegistration'],
  'account-owner-complete': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 180, 204, 181, 204, 'Cả hàm', 'completeOwnerRegistration()'],

  'sign-in-page': ['frontend/src/features/authentication/pages/SignInPage.tsx', 11, 94, 25, 45, 'Cả hàm component', 'SignInPage()'],
  'backend-client-login': ['frontend/src/shared/api/backendClient.ts', 55, 141, 108, 113, 'Cả hàm', 'createBackendClient() · login'],
  'backend-client-auth-check': ['frontend/src/shared/api/backendClient.ts', 55, 141, 124, 128, 'Cả hàm', 'createBackendClient() · isAuthenticated'],
  'authenticate-controller': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AuthenticateController.java', 35, 128, 72, 122, 'Cả class controller', 'AuthenticateController'],
  'authenticate-check': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AuthenticateController.java', 124, 127, 124, 127, 'Cả hàm', 'isAuthenticated()'],
  'identity-signin-policy': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 251, 269, 251, 269, 'Cả hàm', 'checkPasswordSignInAllowed()'],
  'identity-failed-attempt': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 271, 294, 271, 294, 'Hai hàm trọn vẹn', 'recordFailedPasswordAttempt() + clearFailedPasswordAttempts()'],
  'google-button': ['frontend/src/features/authentication/components/AuthControls.tsx', 27, 31, 27, 31, 'Cả hàm component', 'GoogleButton()'],
  'google-identity': ['backend/src/main/java/vn/edu/fpt/beefcare/service/GoogleIdentityService.java', 37, 88, 37, 88, 'Cả hàm', 'provisionOrLink()'],
  'google-success-handler': ['backend/src/main/java/vn/edu/fpt/beefcare/security/GoogleOidcSuccessHandler.java', 30, 100, 57, 79, 'Cả class', 'GoogleOidcSuccessHandler'],
  'session-provider': ['frontend/src/app/session/SessionProvider.tsx', 19, 68, 25, 63, 'Cả hàm component', 'SessionProvider()'],
  'session-route': ['frontend/src/features/authorization/roles.ts', 18, 43, 38, 43, 'Cả nhóm hàm điều hướng', 'needsOwnerRegistration() + homePathForSession()'],

  'technician-account': ['frontend/src/features/account/pages/TechnicianAccountPage.tsx', 14, 52, 21, 23, 'Cả hàm component', 'TechnicianAccountPage()'],
  'auth-provider-logout': ['frontend/src/features/authentication/AuthContext.tsx', 33, 94, 63, 80, 'Cả hàm component', 'AuthProvider()'],
  'authentication-usecase': ['frontend/src/features/authentication/hooks/useAuthenticationUseCase.ts', 1, 21, 11, 20, 'Cả file', 'useAuthenticationUseCase.ts'],
  'backend-client-logout': ['frontend/src/shared/api/backendClient.ts', 55, 141, 114, 122, 'Cả hàm', 'createBackendClient() · logout'],
  'security-logout': ['backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java', 78, 151, 138, 145, 'Cả hàm cấu hình', 'filterChain()'],
  'security-filter-chain': ['backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java', 78, 151, 88, 119, 'Cả hàm cấu hình', 'filterChain() · CSRF và authorization'],
  'security-oauth': ['backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java', 78, 151, 148, 148, 'Cả hàm cấu hình', 'filterChain() · oauth2Login'],
  'session-lifecycle': ['frontend/src/app/session/sessionLifecycle.ts', 1, 21, 5, 14, 'Cả file', 'sessionLifecycle.ts'],
  'session-redirect': ['frontend/src/features/authentication/AuthContext.tsx', 109, 125, 109, 125, 'Cả hàm', 'SessionRedirect()'],
  'clear-farm': ['frontend/src/app/session/currentFarm.ts', 51, 57, 51, 57, 'Cả hàm', 'clearCurrentFarmId()'],

  'profile-screen': ['frontend/src/features/account/components/ProfileScreen.tsx', 13, 46, 14, 43, 'Cả hàm component', 'ProfileScreen()'],
  'account-profile-hook': ['frontend/src/features/account/hooks/useAccountProfile.ts', 25, 36, 25, 36, 'Cả hook', 'useAccountProfile()'],
  'profile-form-hook': ['frontend/src/features/account/hooks/useAccountProfile.ts', 38, 57, 39, 57, 'Cả hook', 'useProfileForm()'],
  'account-api-profile': ['frontend/src/features/account/api/accountApi.ts', 18, 50, 24, 36, 'Cả hàm tạo adapter', 'createAccountApi() · profile methods'],
  'account-get-update-profile': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 210, 228, 210, 228, 'Hai hàm trọn vẹn', 'getProfile() + updateProfile()'],
  'account-profile-response': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 297, 307, 297, 307, 'Cả hàm', 'profile()'],
  'account-profile-get': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 210, 213, 210, 213, 'Cả endpoint', 'getProfile()'],
  'account-permissions': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 230, 278, 231, 239, 'Cả nhóm hàm quyền', 'myPermissions() + permissionEntries()'],

  'forgot-password-page': ['frontend/src/features/authentication/pages/RecoveryPages.tsx', 15, 45, 23, 33, 'Cả hàm component', 'ForgotPasswordPage()'],
  'auth-client-reset': ['frontend/src/features/authentication/client.ts', 1, 27, 14, 18, 'Cả file', 'client.ts · reset endpoints'],
  'account-reset-init': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 417, 425, 417, 425, 'Hai hàm trọn vẹn', 'requestPasswordReset() + validateResetLink()'],
  'identity-reset-init': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 161, 178, 166, 178, 'Cả hàm', 'requestPasswordReset()'],
  'reset-password-page': ['frontend/src/features/authentication/pages/RecoveryPages.tsx', 59, 119, 75, 102, 'Cả hàm component', 'ResetPasswordPage()'],
  'account-reset-finish': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 429, 439, 436, 439, 'Cả hàm', 'finishPasswordReset()'],
  'identity-reset-finish': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 180, 212, 197, 212, 'Ba hàm trọn vẹn', 'isPasswordResetLinkValid() + passwordResetEmail() + completePasswordReset()'],

  'change-password-dialog': ['frontend/src/features/account/components/ChangePasswordDialog.tsx', 39, 115, 51, 80, 'Cả hàm component', 'ChangePasswordDialog()'],
  'account-api-password': ['frontend/src/features/account/api/accountApi.ts', 18, 50, 37, 48, 'Cả hàm tạo adapter', 'createAccountApi() · password methods'],
  'account-google-reauth': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 386, 410, 391, 408, 'Cả nhóm hàm', 'startGoogleReauthentication() + reauthenticationReturnPath()'],
  'google-reauth-window': ['backend/src/main/java/vn/edu/fpt/beefcare/security/GoogleReauthentication.java', 1, 31, 11, 30, 'Cả class', 'GoogleReauthentication'],
  'account-change-password': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/AccountResource.java', 374, 384, 380, 384, 'Cả hàm', 'changePassword()'],
  'identity-change-password': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 218, 249, 223, 249, 'Cả hàm', 'changePassword()'],
  'domain-user-details': ['backend/src/main/java/vn/edu/fpt/beefcare/security/DomainUserDetailsService.java', 22, 90, 32, 56, 'Cả class', 'DomainUserDetailsService'],
  'mail-queue-action-link': ['backend/src/main/java/vn/edu/fpt/beefcare/service/MailService.java', 58, 81, 58, 81, 'Cả hàm', 'queueActionLink()'],
  'account-link-token-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/AccountLinkTokenRepository.java', 1, 33, 13, 32, 'Cả file', 'AccountLinkTokenRepository.java'],
  'app-user-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/AppUserRepository.java', 1, 37, 15, 28, 'Cả file', 'AppUserRepository.java'],
  'farm-membership-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/FarmMembershipRepository.java', 1, 64, 14, 18, 'Cả file', 'FarmMembershipRepository.java'],
  'user-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/UserRepository.java', 1, 35, 1, 35, 'Cả file', 'UserRepository.java'],

  'app-providers': ['frontend/src/app/providers/AppProviders.tsx', 1, 14, 7, 12, 'Cả file', 'AppProviders.tsx'],
  'guest-auth-flow': ['frontend/src/features/authentication/pages/GuestAuthFlow.tsx', 1, 36, 15, 34, 'Cả hàm component', 'GuestAuthFlow()'],
  'auth-validation': ['frontend/src/features/authentication/validation/authValidation.ts', 1, 51, 4, 51, 'Cả file', 'authValidation.ts'],
  'auth-errors': ['frontend/src/features/authentication/domain/authErrors.ts', 1, 62, 13, 62, 'Cả file', 'authErrors.ts'],
  'auth-types': ['frontend/src/features/authentication/types.ts', 1, 31, 1, 31, 'Cả file hợp đồng TypeScript', 'authentication/types.ts'],
  'email-sent-page': ['frontend/src/features/authentication/pages/EmailSentPage.tsx', 1, 90, 18, 70, 'Cả file', 'EmailSentPage.tsx'],
  'farm-workspace-usecase': ['frontend/src/features/farm-workspace/hooks/useFarmWorkspaceUseCase.ts', 1, 118, 49, 117, 'Cả hook use case', 'useFarmWorkspaceUseCase()'],
  'workspace-validation': ['frontend/src/features/farm-workspace/validation/workspaceValidation.ts', 1, 104, 15, 44, 'Cả file validation', 'workspaceValidation.ts'],
  'backend-transport': ['frontend/src/shared/api/backendTransport.ts', 1, 16, 5, 16, 'Cả file', 'backendTransport.ts'],
  'session-profile': ['frontend/src/app/session/sessionProfile.ts', 1, 40, 16, 40, 'Cả file mapper', 'sessionFromProfile()'],
  'account-mapper': ['frontend/src/features/account/api/accountMapper.ts', 1, 37, 5, 37, 'Cả file mapper', 'accountMapper.ts'],
  'profile-validation': ['frontend/src/features/account/validation/profileValidation.ts', 1, 29, 9, 29, 'Cả file validation', 'profileValidation.ts'],
  'use-query': ['frontend/src/shared/hooks/useQuery.ts', 1, 32, 4, 32, 'Cả hook', 'useQuery()'],
  'user-facing-error': ['frontend/src/shared/api/userFacingError.ts', 1, 23, 7, 23, 'Cả file', 'userFacingError()'],
  'session-context': ['frontend/src/app/session/sessionContext.ts', 1, 20, 5, 20, 'Cả file', 'sessionContext.ts'],
  'profile-parts': ['frontend/src/features/account/components/ProfileParts.tsx', 1, 71, 1, 71, 'Cả file component', 'ProfileParts.tsx'],
  'account-types': ['frontend/src/features/account/types.ts', 1, 41, 1, 41, 'Cả file hợp đồng TypeScript', 'account/types.ts'],
  'app-routes-fe01': ['frontend/src/app/routes/AppRoutes.tsx', 110, 194, 151, 188, 'Hàm route chính', 'AppRoutes() · FE-01 routes'],
  'profile-rules': ['frontend/src/features/account/domain/profileRules.ts', 1, 19, 1, 19, 'Cả file policy FE', 'profileRules.ts'],

  'active-account-filter': ['backend/src/main/java/vn/edu/fpt/beefcare/config/SecurityConfiguration.java', 150, 202, 150, 201, 'Cả filter', 'ActiveAccountFilter.doFilterInternal()'],
  'farm-access-current': ['backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAccessService.java', 1, 135, 76, 131, 'Cả class service', 'FarmAccessService.currentActiveUser()'],
  'farm-workspace-list': ['backend/src/main/java/vn/edu/fpt/beefcare/service/FarmWorkspaceService.java', 1, 139, 31, 47, 'Cả class service', 'FarmWorkspaceService.list()'],
  'farm-service-facts': ['backend/src/main/java/vn/edu/fpt/beefcare/service/FarmServiceFacts.java', 1, 144, 46, 79, 'Cả class service', 'FarmServiceFacts.activeCattle() + latestEnd()'],
  'identity-link-helpers': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 296, 348, 296, 348, 'Nhóm hàm nội bộ', 'IdentityService · account/link helpers'],
  'identity-consume': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 339, 346, 339, 345, 'Cả hàm', 'consume()'],
  'identity-validation-session': ['backend/src/main/java/vn/edu/fpt/beefcare/service/IdentityService.java', 350, 405, 350, 405, 'Nhóm hàm nội bộ', 'IdentityService · validation/session helpers'],
  'domain-exception': ['backend/src/main/java/vn/edu/fpt/beefcare/service/DomainException.java', 1, 77, 11, 77, 'Cả class', 'DomainException'],
  'exception-translator': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/errors/ExceptionTranslator.java', 75, 122, 90, 120, 'Nhóm hàm dịch lỗi', 'ExceptionTranslator'],
  'action-link-signer': ['backend/src/main/java/vn/edu/fpt/beefcare/service/email/ActionLinkSigner.java', 1, 53, 18, 52, 'Cả class', 'ActionLinkSigner'],
  'email-job-service': ['backend/src/main/java/vn/edu/fpt/beefcare/service/email/EmailDeliveryJobService.java', 1, 342, 91, 247, 'Cả class job', 'EmailDeliveryJobService'],
  'email-job-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/EmailDeliveryJobRepository.java', 1, 30, 14, 29, 'Cả file', 'EmailDeliveryJobRepository.java'],
  'authority-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/AuthorityRepository.java', 1, 12, 1, 12, 'Cả file', 'AuthorityRepository.java'],
  'platform-staff-repository': ['backend/src/main/java/vn/edu/fpt/beefcare/repository/PlatformStaffAccessRepository.java', 1, 49, 16, 48, 'Cả file', 'PlatformStaffAccessRepository.java'],
  'account-link-token-entity': ['backend/src/main/java/vn/edu/fpt/beefcare/domain/AccountLinkToken.java', 1, 64, 11, 64, 'Cả entity', 'AccountLinkToken'],
  'email-job-entity': ['backend/src/main/java/vn/edu/fpt/beefcare/domain/EmailDeliveryJob.java', 1, 129, 17, 129, 'Cả entity', 'EmailDeliveryJob'],
  'user-entity': ['backend/src/main/java/vn/edu/fpt/beefcare/domain/User.java', 1, 254, 20, 254, 'Cả entity', 'User'],
  'app-user-entity': ['backend/src/main/java/vn/edu/fpt/beefcare/domain/AppUser.java', 1, 360, 19, 360, 'Cả entity', 'AppUser'],
  'login-vm': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/vm/LoginVM.java', 1, 53, 12, 52, 'Cả DTO', 'LoginVM'],
  'password-change-dto': ['backend/src/main/java/vn/edu/fpt/beefcare/service/dto/PasswordChangeDTO.java', 1, 46, 10, 45, 'Cả DTO', 'PasswordChangeDTO'],
  'key-password-vm': ['backend/src/main/java/vn/edu/fpt/beefcare/web/rest/vm/KeyAndPasswordVM.java', 1, 37, 10, 36, 'Cả DTO', 'KeyAndPasswordVM'],
  'google-failure-handler': ['backend/src/main/java/vn/edu/fpt/beefcare/security/GoogleOidcFailureHandler.java', 1, 27, 14, 27, 'Cả class', 'GoogleOidcFailureHandler'],
  'mail-send-email': ['backend/src/main/java/vn/edu/fpt/beefcare/service/MailService.java', 135, 192, 135, 191, 'Nhóm hàm gửi sau commit', 'MailService.sendEmail()'],
  'smtp-email-delivery': ['backend/src/main/java/vn/edu/fpt/beefcare/service/email/SmtpEmailDelivery.java', 1, 58, 16, 57, 'Cả adapter', 'SmtpEmailDelivery'],
  'mock-email-delivery': ['backend/src/main/java/vn/edu/fpt/beefcare/service/email/MockEmailDelivery.java', 1, 40, 12, 39, 'Cả adapter', 'MockEmailDelivery'],
  'farm-action': ['backend/src/main/java/vn/edu/fpt/beefcare/service/FarmAction.java', 1, 94, 11, 94, 'Cả enum quyền', 'FarmAction'],
  'user-not-activated': ['backend/src/main/java/vn/edu/fpt/beefcare/security/UserNotActivatedException.java', 1, 21, 9, 21, 'Cả class', 'UserNotActivatedException'],
  'farm-membership-entity': ['backend/src/main/java/vn/edu/fpt/beefcare/domain/FarmMembership.java', 1, 171, 17, 171, 'Cả entity', 'FarmMembership'],
  'platform-staff-entity': ['backend/src/main/java/vn/edu/fpt/beefcare/domain/PlatformStaffAccess.java', 1, 138, 17, 138, 'Cả entity', 'PlatformStaffAccess'],
}

function sourceUnit([file, start, end, highlightStart, highlightEnd, scope, symbol]) {
  const fullPath = path.join(root, file)
  const lines = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n').split('\n')
  if (start < 1 || end > lines.length || start > end) throw new Error(`Invalid source range ${file}:${start}-${end}`)
  if (highlightStart < start || highlightEnd > end) throw new Error(`Invalid highlight range ${file}:${highlightStart}-${highlightEnd}`)
  return { file, start, end, highlightStart, highlightEnd, scope, symbol, code: lines.slice(start - 1, end).join('\n') }
}

const sources = Object.fromEntries(Object.entries(unitDefinitions).map(([key, definition]) => [key, sourceUnit(definition)]))

const sourceNotes = {
  'app-providers': 'AppProviders lắp Router, AuthProvider, AuthGate và SessionProvider theo thứ tự. AuthProvider phải xác định anonymous/authenticated trước; SessionProvider chỉ tải profile sau khi đã có session hợp lệ.',
  'backend-client-auth-check': 'isAuthenticated gọi request("/api/authenticate"). Response 204 trả true; BackendError 401 trả false; lỗi mạng hoặc status khác được ném tiếp để AuthProvider hiển thị lỗi kết nối.',
  'guest-auth-flow': 'GuestAuthFlow đọc pathname hiện tại. /register render RegisterPage; route link hết hạn render InvalidLinkPage; trạng thái suspended chuyển sang màn hình tạm ngưng.',
  'security-filter-chain': 'filterChain cấu hình CSRF, ActiveAccountFilter và quyền truy cập endpoint. GET /api/authenticate, POST /api/register, resend và GET /api/activate được permitAll; /api/account/** yêu cầu session authenticated.',
  'authenticate-check': 'Controller chỉ kiểm Principal do Spring Security gắn vào request. Principal null trả 401; có Principal trả 204; hàm không đọc database và không tạo session mới.',
  'security-oauth': 'oauth2Login đăng ký GoogleOidcSuccessHandler và GoogleOidcFailureHandler. Spring Security sở hữu endpoint authorization/callback; code ứng dụng chỉ xử lý kết quả success hoặc failure.',
  'google-oauth-file': 'googleAuthorizationUrl trả đúng đường dẫn Backend /oauth2/authorization/google. GoogleButton đặt URL này vào href nên toàn bộ OAuth chạy bằng browser redirect, không phải AJAX.',
  'google-identity': 'provisionOrLink nhận OidcUser đã xác minh. Hàm kiểm subject, email_verified, account status và xung đột identity; sau đó tạo hoặc cập nhật AppUser/User và trả cờ ownerRegistrationCompleted.',
  'app-user-repository': 'AppUserRepository đọc tài khoản theo email hoặc Google subject và persist thay đổi hồ sơ nghiệp vụ. Trong UC-01 nó lưu liên kết Google, trạng thái phương thức đăng nhập và hồ sơ Owner.',
  'user-repository': 'UserRepository quản lý identity dùng cho Spring Security. UC-01 dùng repository để kiểm email trùng, lưu password đã mã hóa, kích hoạt User và nạp identity theo email/login.',
  'domain-user-details': 'loadUserByUsername đọc User cùng authorities rồi tạo UserDetails cho Spring Security. AccountResource hoặc GoogleOidcSuccessHandler dùng kết quả này để tạo Authentication trước khi lưu SecurityContext vào session.',
  'auth-validation': 'normalizeEmail trim/lowercase email; validateRegistration kiểm fullName, email, password, confirmPassword và termsAccepted. Object lỗi khác rỗng làm RegisterPage return trước client.register.',
  'auth-types': 'RegistrationRequest là shape dữ liệu từ form sang client: fullName, email, password, confirmPassword, termsAccepted. AuthClient định nghĩa các lời gọi register, resend, login và reset mà page được phép dùng.',
  'auth-client-register': 'createBackendAuthClient nối use case xác thực với shared HTTP client. register gửi POST /api/register; resendVerification gửi POST /api/account/verification/resend và đọc nextAllowedAt.',
  'backend-transport': 'backendTransport là adapter dùng chung quanh backendClient. Feature gọi get/command qua boundary này để giữ xử lý 401, CSRF, cookie và idempotency ở một chỗ.',
  'auth-errors': 'Các hàm friendly... đọc BackendError.status/code/params rồi chọn thông báo tiếng Việt. MSG-FE01-10 được giữ để RegisterPage nhận biết email trùng và hiện liên kết đăng nhập/quên mật khẩu.',
  'account-register': 'registerAccount bind JSON vào RegistrationRequest và truyền từng field sang IdentityService.register. Service trả email đã chuẩn hóa; annotation @ResponseStatus(CREATED) tạo HTTP 201 cùng RegistrationResponse.',
  'exception-translator': 'domainProblem chuyển DomainException thành response lỗi có status, code và params. backendClient đọc JSON này thành BackendError để Frontend phân biệt validation, conflict, suspended và lỗi chung.',
  'user-entity': 'User là identity lưu password hash, activated, login/email, authorities và trạng thái khóa đăng nhập. IdentityService tạo bản ghi với activated=false cho đến khi link email được consume.',
  'app-user-entity': 'AppUser lưu hồ sơ nghiệp vụ BeefCare: accountStatus, phương thức đăng nhập, điều khoản, fullName/phone và ownerRegistrationCompleted. UC-01 cập nhật entity này ở đăng ký, Google link, kích hoạt password method và hoàn tất Owner.',
  'authority-repository': 'IdentityService đọc ROLE_USER từ AuthorityRepository rồi gắn vào User trước saveAndFlush. Thiếu ROLE_USER làm register fail thay vì tạo identity không có quyền chuẩn.',
  'identity-link-helpers': 'sendLink vô hiệu token cũ, tạo AccountLinkToken mới, ký bearer, lưu tokenHash rồi gọi MailService.queueActionLink. consume tìm token bằng hash, từ chối token thiếu/hết hạn/đã dùng và đặt usedAt khi hợp lệ.',
  'action-link-signer': 'ActionLinkSigner sinh nonce, ký payload ACCOUNT_LINK bằng HMAC và hash raw bearer bằng SHA-256. Raw token đi vào URL email; database chỉ giữ hash để giảm rủi ro lộ token dùng được.',
  'account-link-token-entity': 'AccountLinkToken giữ tokenType, tokenHash, tokenNonce, createdAt, expiresAt, usedAt và quan hệ User. usedAt khác null hoặc expiresAt đã qua làm link bị từ chối.',
  'account-link-token-repository': 'Repository tìm token theo hash/type, lấy token mới nhất để rate-limit và invalidate token chưa dùng. sendLink gọi save/saveAndFlush trước khi queue email.',
  'mail-queue-action-link': 'queueActionLink tạo EmailDeliveryJob PENDING thay vì gửi SMTP trong transaction đăng ký. Job giữ recipient, template và reference đến AccountLinkToken để worker dựng URL sau commit.',
  'email-job-entity': 'EmailDeliveryJob lưu trạng thái giao mail, số lần thử, thời điểm thử tiếp theo và lỗi cuối. Trạng thái bền vững cho phép worker retry sau khi request đăng ký đã kết thúc.',
  'email-job-repository': 'Repository khóa và đọc các job đến hạn, đồng thời persist SENT/RETRY/FAILED. Nó là hàng đợi database giữa transaction đăng ký và adapter gửi mail.',
  'smtp-email-delivery': 'SmtpEmailDelivery chuyển OutboundEmail sang JavaMailSender trong môi trường production. Exception được EmailDeliveryJobService ghi lại để tính retry.',
  'mock-email-delivery': 'MockEmailDelivery không gửi ra SMTP; nó ghi nội dung vào mail sink cho dev/test. Luồng trạng thái job vẫn giống production để kiểm tra link.',
  'account-resend-verification': 'Endpoint nhận EmailRequest, gọi resendVerification và luôn trả ResendVerificationResponse chứa nextAllowedAt. Response không nói email có tồn tại hay không.',
  'identity-resend-verification': 'resendVerification chuẩn hóa email, tìm password account chưa activate, áp dụng 60 giây và tối đa 5 lần/giờ. Đủ điều kiện mới gọi sendLink; mọi trường hợp vẫn trả thời điểm thử lại.',
  'identity-consume': 'consume hash raw token để tìm AccountLinkToken đúng type. Token rỗng, không tồn tại, đã dùng hoặc hết hạn ném MSG-FE01-06; token hợp lệ được đặt usedAt ngay trong transaction.',
  'owner-registration-page': 'Component bind fullName, phone, termsAccepted vào form và chuyển onSubmit sang hook. Email chỉ đọc; điều khoản chỉ hiện khi account chưa ghi nhận consent.',
  'workspace-validation': 'validateOwnerProfile kiểm tên, số điện thoại Việt Nam và điều khoản. compactPhone bỏ khoảng trắng/dấu phân cách trước khi adapter tạo contactPhone cho Backend.',
  'farm-workspace-usecase': 'Hook là boundary giữa page và farmWorkspaceApi. completeOwnerRegistration chỉ chuyển input sang adapter; query profile dùng useQuery để tải dữ liệu hiện tại khi mở trang.',
  'owner-registration-api': 'Adapter đổi phone của form thành contactPhone, gọi command POST /api/account/owner-registration và map OwnerRegistrationResponse về profile shape của Frontend.',
  'active-account-filter': 'Mọi authenticated API đi qua filter. Session hết hạn trả 401; account không còn ACTIVE làm expire session và trả status/code trước khi request tới controller.',
  'farm-access-current': 'currentActiveUser lấy user id/email từ Authentication, đọc AppUser và bắt buộc accountStatus ACTIVE. Controller dùng kết quả này thay vì tin id do Frontend gửi.',
  'session-lifecycle': 'notifyOwnerRegistrationCompleted phát custom event trong browser. SessionProvider nghe event, đặt cờ completed tức thời rồi gọi loadProfile để đồng bộ lại từ Backend.',
  'authentication-usecase': 'loadSessionProfile gọi GET /api/account/profile qua backendTransport. SessionProvider dùng response này làm nguồn dữ liệu cho SessionContext sau đăng nhập/kích hoạt/hoàn tất Owner.',
  'session-profile': 'sessionFromProfile kiểm và map ProfileResponse thành SessionUser: account status, ownerRegistrationCompleted, roles, farms và farm hiện tại. Payload sai shape bị từ chối thay vì đưa dữ liệu không hợp lệ vào context.',
  'account-profile-get': 'getProfile lấy AppUser hiện tại qua FarmAccessService rồi chuyển sang profile(account). Endpoint chỉ chạy khi session authenticated và ActiveAccountFilter đã cho qua.',
  'account-profile-response': 'profile đọc email verified, platform role, sign-in methods và danh sách farm/permission để tạo ProfileResponse. ownerRegistrationCompleted lấy trực tiếp từ AppUser vừa persist.',
  'farm-workspace-list': 'FarmWorkspaceService.list đọc memberships/trại có hiệu lực cho account hiện tại. Kết quả được profile() map thành farms trong ProfileResponse.',
}

const node = (file, pathName, methods, source, result) => ({ file, path: pathName, methods, source, result })
const row = (title, subtitle, nodes, arrows) => ({ title, subtitle, nodes, arrows })
const step = (title, pseudo, meta, source, note) => ({ title, pseudo, meta, source, note })
const exchange = (request, backendReceiver, response, frontendReceiver, local = false, failure = '') => ({ request, backendReceiver, response, frontendReceiver, local, failure })

const useCases = [
  {
    id: 'uc-fe01-01', short: 'UC-01', title: 'Đăng ký tài khoản Chủ trại',
    handoff: 'GET session → Google OAuth hoặc đăng ký email → kích hoạt → hoàn tất hồ sơ Owner → đọc lại profile',
    exchanges: [
      [exchange('GET /api/authenticate', 'SecurityConfiguration → AuthenticateController.isAuthenticated()', '204: đã có session → vào ứng dụng', 'backendClient.isAuthenticated() → AuthProvider đặt authenticated', false, '401: chưa có session → AuthProvider đặt anonymous → GuestAuthFlow mở RegisterPage')],
      [exchange('Browser GET /oauth2/authorization/google', 'SecurityConfiguration.oauth2Login() → Google', 'Google callback hợp lệ → GoogleOidcSuccessHandler', 'Browser chờ redirect từ Backend', false, 'Google từ chối/lỗi OAuth → GoogleOidcFailureHandler → 302 /sign-in?error=google-sign-in')],
      [exchange('GET /login/oauth2/code/google + OIDC claims', 'GoogleOidcSuccessHandler → GoogleIdentityService → repositories → session', '302 + JSESSIONID → /owner-registration hoặc /chon-trai', 'Browser tải route mới → AuthProvider/SessionProvider đọc session', false, 'Identity xung đột → /sign-in?error=google-sign-in; account SUSPENDED → /tai-khoan-tam-ngung')],
      [exchange('Không gọi API', 'Không có xử lý Backend', 'Đúng: tạo RegistrationRequest và chuyển sang bước gửi', 'Sai: setErrors(nextErrors) rồi return; request không rời trình duyệt', true)],
      [exchange('POST /api/register + JSON RegistrationRequest', 'SecurityConfiguration → AccountResource.registerAccount() → IdentityService.register()', '201 + RegistrationResponse { email } sau khi transaction hoàn tất', 'backendClient trả về → RegisterPage chuyển sang /email-verification-sent', false, '400/409/403 + { code, params, message } → BackendError → friendlyAccountError → hiện lỗi tại form')],
      [],
      [],
      [exchange('Không có request mới', 'EmailDeliveryJobService đọc job PENDING và gọi EmailDelivery', 'SMTP/Mock thành công → job SENT; lỗi tạm thời → RETRY', 'EmailSentPage hiển thị địa chỉ và thời gian được gửi lại', true, 'Job gửi mail thất bại không đổi response 201 đã trả; job tự retry theo trạng thái trong DB')],
      [exchange('POST /api/account/verification/resend + { email }', 'AccountResource.resendEmailVerification() → IdentityService.resendVerification()', '200 + { nextAllowedAt }', 'useResend() cập nhật bộ đếm, khóa nút đến nextAllowedAt', false, 'Lỗi HTTP → friendlyEmailRequestError; email không tồn tại vẫn trả cùng kiểu response để tránh lộ tài khoản')],
      [exchange('GET /api/activate?token=…', 'AccountResource.activateAccount() → IdentityService.activateEmail()', '303 + JSESSIONID → /owner-registration', 'Browser tải OwnerRegistrationPage; AuthProvider/SessionProvider nhận session', false, 'Token thiếu/hết hạn/đã dùng → 303 /lien-ket-khong-con-hieu-luc; SUSPENDED → 403')],
      [exchange('Không gọi API khi bấm submit', 'Không có xử lý Backend', 'Đúng: hook gọi completeOwnerRegistration(form)', 'Sai: validateOwnerProfile trả errors; hook dừng trước adapter', true)],
      [exchange('POST /api/account/owner-registration + cookie + CSRF + JSON', 'ActiveAccountFilter → FarmAccessService → AccountResource.completeOwnerRegistration()', '200 + OwnerRegistrationResponse { id, email, fullName, contactPhone, completed }', 'hook phát OWNER_REGISTRATION_COMPLETED_EVENT rồi chuyển /dang-ky-trai', false, '400: dữ liệu sai; 401: session hết hạn; 403: account bị khóa/tạm ngưng → không cập nhật AppUser')],
      [exchange('GET /api/account/profile', 'ActiveAccountFilter → AccountResource.getProfile() → profile()', '200 + ProfileResponse có ownerRegistrationCompleted=true', 'SessionProvider → sessionFromProfile() → cập nhật SessionContext', false, '401/403 hoặc payload sai → userFacingError; session không được coi là đã làm mới')],
    ],
    frontend: [
      row('0. Mở /register', 'kiểm tra session trước khi chọn màn hình', [
        node('AppProviders.tsx', 'app/providers', ['AppProviders()', 'Router → AuthProvider → AuthGate → SessionProvider'], 'app-providers', 'Ghép provider toàn ứng dụng'),
        node('AuthContext.tsx', 'features/authentication', ['AuthProvider()', 'auth.isAuthenticated()'], 'auth-provider-init', 'Giữ checking/anonymous/authenticated'),
        node('backendClient.ts', 'shared/api', ['isAuthenticated()', 'request("/api/authenticate")'], 'backend-client-auth-check', 'GET kiểm tra JSESSIONID'),
        node('GuestAuthFlow.tsx', 'features/authentication/pages', ['GuestAuthFlow()', 'path → RegisterPage'], 'guest-auth-flow', '401 thì mở trang đăng ký'),
      ], ['khởi tạo auth', 'gọi API kiểm tra', 'nhận 401 → chọn trang']),
      row('A1. Chọn đăng ký Google', 'browser rời trang để bắt đầu OAuth2', [
        node('RegisterPage.tsx', 'features/authentication/pages', ['<GoogleButton />'], 'register-page', 'Hiển thị lựa chọn Google'),
        node('AuthControls.tsx', 'features/authentication/components', ['GoogleButton()', '<a href=...>'], 'google-button', 'Click dùng điều hướng browser'),
        node('googleOAuth.ts', 'features/authentication', ['googleAuthorizationUrl()'], 'google-oauth-file', 'Trả URL OAuth Backend'),
      ], ['render nút', 'lấy URL OAuth']),
      row('A2. Nhận redirect sau Google', 'Frontend không tự xác minh token Google', [
        node('AuthContext.tsx', 'features/authentication', ['AuthProvider()', 'isAuthenticated()'], 'auth-provider-init', 'Đọc session do Backend tạo'),
        node('SessionProvider.tsx', 'app/session', ['SessionProvider()', 'loadProfile()'], 'session-provider', 'Tải hồ sơ và dựng SessionContext'),
        node('roles.ts', 'features/authorization', ['needsOwnerRegistration()', 'homePathForSession()'], 'session-route', 'Chọn route tiếp theo'),
      ], ['kiểm tra session', 'tải profile']),
      row('B1. Nhập form email', 'validation chạy hoàn toàn trong trình duyệt', [
        node('RegisterPage.tsx', 'features/authentication/pages', ['RegisterPage()', 'submit(event)'], 'register-page', 'Tạo RegistrationRequest'),
        node('authValidation.ts', 'features/authentication/validation', ['normalizeEmail()', 'validateRegistration()'], 'auth-validation', 'Kiểm tra dữ liệu FE'),
        node('types.ts', 'features/authentication', ['RegistrationRequest', 'AuthClient'], 'auth-types', 'Hợp đồng TypeScript'),
      ], ['chuẩn hóa + validate', 'dựng đúng shape']),
      row('B2. Gửi request đăng ký', 'adapter → HTTP client → API', [
        node('client.ts', 'features/authentication', ['createBackendAuthClient()', 'register(request)'], 'auth-client-register', 'POST /api/register'),
        node('backendTransport.ts', 'shared/api', ['backendTransport', 'onUnauthorized'], 'backend-transport', 'HTTP boundary dùng chung'),
        node('backendClient.ts', 'shared/api', ['request()', 'getCsrf()', 'fetch(credentials: include)'], 'backend-client-request', 'Gắn CSRF, cookie và JSON'),
        node('authErrors.ts', 'features/authentication/domain', ['friendlyAccountError()'], 'auth-errors', 'BackendError → thông báo form'),
      ], ['gọi client.register', 'ủy quyền transport', 'fetch']),
      row('B3. Chờ transaction đăng ký', 'Promise chỉ resolve khi Backend trả 201', [
        node('RegisterPage.tsx', 'features/authentication/pages', ['await client.register(request)', 'catch(reason)', 'finally'], 'register-page', 'Thành công chuyển trang; lỗi giữ form'),
      ], []),
      row('B4. Chờ tạo token và queue mail', 'vẫn thuộc cùng POST /api/register', [
        node('RegisterPage.tsx', 'features/authentication/pages', ['submitting=true', 'await client.register(request)'], 'register-page', 'Khóa nút trong khi chờ'),
      ], []),
      row('B5. Xem trạng thái gửi email', 'email do job bất đồng bộ gửi', [
        node('EmailSentPage.tsx', 'features/authentication/pages', ['EmailSentPage()', 'useResend()', 'send()'], 'email-sent-page', 'Hiển thị email + countdown'),
      ], []),
      row('B6. Gửi lại email (tùy chọn)', 'nút bị khóa theo nextAllowedAt', [
        node('EmailSentPage.tsx', 'features/authentication/pages', ['useResend()', 'send()'], 'email-sent-page', 'Quản lý countdown/busy/error'),
        node('client.ts', 'features/authentication', ['resendVerification(email)'], 'auth-client-register', 'POST endpoint resend'),
        node('backendClient.ts', 'shared/api', ['request()'], 'backend-client-request', 'Gửi CSRF + JSON'),
      ], ['click send', 'gửi HTTP']),
      row('B7. Mở link kích hoạt', 'link trong email đi thẳng vào Backend', [
        node('GuestAuthFlow.tsx', 'features/authentication/pages', ['InvalidLinkPage', 'owner-registration redirect'], 'guest-auth-flow', 'Nhánh link lỗi/hợp lệ'),
        node('AuthContext.tsx', 'features/authentication', ['AuthProvider()', 'isAuthenticated()'], 'auth-provider-init', 'Nhận session mới'),
        node('SessionProvider.tsx', 'app/session', ['SessionProvider()', 'loadProfile()'], 'session-provider', 'Tải profile sau session'),
      ], ['browser redirect', 'dựng session FE']),
      row('C1. Nhập hồ sơ Owner', 'page → validation → hook → use case', [
        node('OwnerRegistrationPage.tsx', 'features/farm-workspace/pages', ['OwnerRegistrationPage()', 'form onSubmit={submit}'], 'owner-registration-page', 'Hiển thị SCR-07'),
        node('workspaceValidation.ts', 'features/farm-workspace/validation', ['validateOwnerProfile()', 'compactPhone()'], 'workspace-validation', 'Kiểm tên/điện thoại/điều khoản'),
        node('useOwnerRegistration.ts', 'features/farm-workspace/hooks', ['useOwnerRegistration()', 'submit(event)'], 'owner-registration-hook', 'Validate + điều hướng'),
        node('useFarmWorkspaceUseCase.ts', 'features/farm-workspace/hooks', ['completeOwnerRegistration()'], 'farm-workspace-usecase', 'Feature boundary'),
      ], ['validate', 'điều phối submit', 'gọi adapter']),
      row('C2. Gửi hồ sơ Owner', 'adapter → shared transport → API', [
        node('farmWorkspaceApi.ts', 'features/farm-workspace/api', ['completeOwnerRegistration(input)'], 'owner-registration-api', 'POST owner-registration'),
        node('backendTransport.ts', 'shared/api', ['command()'], 'backend-transport', 'POST có CSRF/cookie'),
        node('sessionLifecycle.ts', 'app/session', ['notifyOwnerRegistrationCompleted()'], 'session-lifecycle', 'Thành công → phát event'),
      ], ['gửi command', 'thành công → event']),
      row('C3. Làm mới session', 'event hoàn tất kích hoạt GET profile', [
        node('sessionLifecycle.ts', 'app/session', ['OWNER_REGISTRATION_COMPLETED_EVENT'], 'session-lifecycle', 'Báo hồ sơ vừa hoàn tất'),
        node('SessionProvider.tsx', 'app/session', ['markCompleted()', 'loadProfile()'], 'session-provider', 'Cập nhật nhanh rồi đọc server'),
        node('useAuthenticationUseCase.ts', 'features/authentication/hooks', ['loadSessionProfile()'], 'authentication-usecase', 'GET /api/account/profile'),
        node('sessionProfile.ts', 'app/session', ['sessionFromProfile()'], 'session-profile', 'ProfileResponse → SessionUser'),
      ], ['phát event', 'gọi API profile', 'map response']),
    ],
    backend: [
      row('0. Nhận kiểm tra session', 'route public; không tạo session mới', [
        node('SecurityConfiguration.java', 'config', ['filterChain()', 'GET /api/authenticate permitAll'], 'security-filter-chain', 'Cho request đi qua'),
        node('AuthenticateController.java', 'web/rest', ['isAuthenticated(Principal)'], 'authenticate-check', 'principal null → 401; có → 204'),
      ], ['route tới controller']),
      row('A1. Khởi động OAuth2', 'Spring Security điều phối sang Google', [
        node('SecurityConfiguration.java', 'config', ['oauth2Login()', 'successHandler()', 'failureHandler()'], 'security-oauth', 'Cấu hình OAuth'),
        node('GoogleOidcFailureHandler.java', 'security', ['onAuthenticationFailure()'], 'google-failure-handler', 'Lỗi OAuth → redirect'),
      ], ['bắt đầu OAuth']),
      row('A2. Xử lý callback Google', 'claims đã được Spring/Google xác minh', [
        node('GoogleOidcSuccessHandler.java', 'security', ['onAuthenticationSuccess()'], 'google-success-handler', 'Điểm vào callback'),
        node('GoogleIdentityService.java', 'service', ['provisionOrLink(OidcUser)'], 'google-identity', 'Tìm/tạo/link account'),
        node('AppUserRepository.java', 'repository', ['find by subject/email', 'saveAndFlush(account)'], 'app-user-repository', 'Persist AppUser'),
        node('UserRepository.java', 'repository', ['find by email', 'saveAndFlush(identity)'], 'user-repository', 'Persist User identity'),
        node('DomainUserDetailsService.java', 'security', ['loadUserByUsername()'], 'domain-user-details', 'Nạp principal; handler lưu session'),
      ], ['gọi service', 'đọc/ghi DB', 'tạo session']),
      null,
      row('B2. Nhận POST /api/register', 'Security → Controller → Service → lỗi HTTP', [
        node('SecurityConfiguration.java', 'config', ['CSRF', 'POST /api/register permitAll'], 'security-filter-chain', 'Kiểm CSRF và route'),
        node('AccountResource.java', 'web/rest', ['registerAccount(RegistrationRequest)'], 'account-register', 'Bind JSON và gọi service'),
        node('IdentityService.java', 'service', ['register(...)'], 'identity-register', 'Validation + transaction'),
        node('ExceptionTranslator.java', 'web/rest/errors', ['domainProblem()'], 'exception-translator', 'DomainException → JSON lỗi'),
      ], ['route', 'gọi service', 'dịch lỗi nếu throw']),
      row('B3. Tạo dữ liệu tài khoản', 'nằm trong transaction register()', [
        node('User.java', 'domain', ['new User()', 'activated=false', 'password=encoded'], 'user-entity', 'Identity dùng đăng nhập'),
        node('AppUser.java', 'domain', ['new AppUser()', 'status=ACTIVE', 'passwordMethod=PENDING_VERIFICATION'], 'app-user-entity', 'Hồ sơ BeefCare'),
        node('AuthorityRepository.java', 'repository', ['findById(ROLE_USER)'], 'authority-repository', 'Gắn ROLE_USER'),
      ], ['tạo identity', 'tạo account']),
      row('B4. Persist và tạo token/email job', 'ghi DB trước khi trả 201', [
        node('UserRepository.java', 'repository', ['saveAndFlush(identity)'], 'user-repository', 'Lưu User'),
        node('AppUserRepository.java', 'repository', ['saveAndFlush(account)'], 'app-user-repository', 'Lưu AppUser'),
        node('IdentityService.java', 'service', ['sendLink()', 'invalidateUnused()'], 'identity-link-helpers', 'Vô hiệu token cũ + tạo token'),
        node('ActionLinkSigner.java', 'service/email', ['newNonce()', 'bearer()', 'hash()'], 'action-link-signer', 'Ký và hash token'),
        node('AccountLinkToken.java', 'domain', ['AccountLinkToken', 'tokenHash/nonce/expiresAt'], 'account-link-token-entity', 'Entity token dùng một lần'),
        node('AccountLinkTokenRepository.java', 'repository', ['invalidateUnused()', 'saveAndFlush()'], 'account-link-token-repository', 'Persist hash/nonce/hạn dùng'),
        node('MailService.java', 'service', ['queueActionLink()'], 'mail-queue-action-link', 'Lưu job PENDING'),
      ], ['lưu account', 'tạo token', 'ký token', 'persist token', 'queue job']),
      row('B5. Job gửi email xác minh', 'chạy bất đồng bộ sau transaction', [
        node('EmailDeliveryJob.java', 'domain', ['EmailDeliveryJob', 'PENDING/SENT/RETRY'], 'email-job-entity', 'Entity trạng thái job'),
        node('EmailDeliveryJobRepository.java', 'repository', ['find due jobs', 'save()'], 'email-job-repository', 'Đọc/ghi hàng đợi'),
        node('EmailDeliveryJobService.java', 'service/email', ['dispatchDueJobs()', 'prepare()', 'dispatch()'], 'email-job-service', 'Dựng link + retry'),
        node('SmtpEmailDelivery.java', 'service/email', ['deliver(outbound)'], 'smtp-email-delivery', 'Gửi SMTP production'),
        node('MockEmailDelivery.java', 'service/email', ['deliver(outbound)'], 'mock-email-delivery', 'Mail sink dev/test'),
      ], ['poll PENDING', 'render email', 'gửi provider']),
      row('B6. Nhận yêu cầu gửi lại', 'không lộ email có tồn tại hay không', [
        node('AccountResource.java', 'web/rest', ['resendEmailVerification(request)'], 'account-resend-verification', 'Trả nextAllowedAt'),
        node('IdentityService.java', 'service', ['resendVerification(email)'], 'identity-resend-verification', 'Kiểm 60 giây/5 lần giờ'),
        node('IdentityService.java', 'service', ['sendLink()'], 'identity-link-helpers', 'Vô hiệu link cũ + queue link mới'),
      ], ['gọi service', 'đủ điều kiện → sendLink']),
      row('B7. Consume token và tạo session', 'GET /api/activate', [
        node('AccountResource.java', 'web/rest', ['activateAccount(token)'], 'account-activate', 'Điểm vào link email'),
        node('IdentityService.java', 'service', ['activateEmail(token)'], 'identity-activate', 'Activate User/password method'),
        node('IdentityService.java', 'service', ['consume(token)'], 'identity-consume', 'Token hợp lệ → usedAt=now'),
        node('UserRepository.java', 'repository', ['load User', 'flush transaction'], 'user-repository', 'Persist User activated'),
        node('AppUserRepository.java', 'repository', ['load AppUser', 'flush transaction'], 'app-user-repository', 'Persist password method ACTIVE'),
        node('DomainUserDetailsService.java', 'security', ['loadUserByUsername()'], 'domain-user-details', 'Controller tạo JSESSIONID + redirect'),
      ], ['consume token', 'persist', 'tạo session']),
      null,
      row('C2. Xác thực session và lưu Owner', 'request đã có JSESSIONID', [
        node('ActiveAccountFilter', 'config/SecurityConfiguration', ['doFilterInternal()'], 'active-account-filter', 'Kiểm session/account'),
        node('FarmAccessService.java', 'service', ['currentActiveUser()'], 'farm-access-current', 'Lấy account ACTIVE'),
        node('AccountResource.java', 'web/rest', ['completeOwnerRegistration(request)'], 'account-owner-complete', 'completed=true'),
        node('AppUser.java', 'domain', ['fullName/phone/completedAt'], 'app-user-entity', 'Entity nhận trạng thái mới'),
        node('AppUserRepository.java', 'repository', ['save(user)'], 'app-user-repository', 'Persist hồ sơ Owner'),
      ], ['lọc session', 'lấy account', 'validate + save']),
      row('C3. Trả profile mới', 'đọc lại dữ liệu đã persist', [
        node('ActiveAccountFilter', 'config/SecurityConfiguration', ['doFilterInternal()'], 'active-account-filter', 'Chặn session hết hạn/suspended'),
        node('AccountResource.java', 'web/rest', ['getProfile()'], 'account-profile-get', 'Nhận GET profile'),
        node('AccountResource.java', 'web/rest', ['profile(AppUser)'], 'account-profile-response', 'Tạo ProfileResponse'),
        node('FarmAccessService.java', 'service', ['currentActiveUser()'], 'farm-access-current', 'Lấy AppUser hiện tại'),
        node('FarmWorkspaceService.java', 'service', ['list()'], 'farm-workspace-list', 'Đính danh sách trại/quyền'),
      ], ['lọc session', 'lấy account', 'dựng response']),
    ],
    steps: [
      step('Mở trang đăng ký và kiểm tra session', 'AppProviders → AuthProvider → backendClient.isAuthenticated → GET /api/authenticate → 401 → GuestAuthFlow → RegisterPage', 'Frontend + Backend · điểm bắt đầu', 'auth-provider-init', 'AuthProvider giữ màn hình checking trong lúc gọi API. 204 nghĩa là đã đăng nhập; 401 là nhánh bình thường của khách và mở RegisterPage. Lỗi khác 401 được hiển thị như lỗi kết nối.'),
      step('Nhánh Google: điều hướng đến OAuth2', 'RegisterPage → GoogleButton → googleAuthorizationUrl → /oauth2/authorization/google → Spring Security → Google', 'Frontend → Backend → Google', 'google-button', 'Nút Google là thẻ link, không gọi fetch. Browser tự đi qua redirect OAuth; mật khẩu hoặc token Google không được xử lý trong code React.'),
      step('Nhánh Google: link account và tạo session', 'Google callback → GoogleOidcSuccessHandler → GoogleIdentityService.provisionOrLink → repositories → DomainUserDetailsService → SecurityContext → JSESSIONID → redirect', 'Backend · OAuth callback', 'google-success-handler', 'Handler chỉ chạy sau khi Spring xác minh callback. Service kiểm subject, email_verified và trạng thái account; thành công mới lưu identity/account và tạo session. Mọi nhánh lỗi đều xóa SecurityContext trước khi redirect.'),
      step('Nhánh email: kiểm form trước API', 'RegisterPage.submit → normalizeEmail → validateRegistration → lỗi thì setErrors + return; hợp lệ thì client.register(request)', 'Frontend · form boundary', 'register-page', 'RegistrationRequest gồm fullName, email, password, confirmPassword, termsAccepted. Validation Frontend cho phản hồi nhanh; Backend vẫn kiểm lại toàn bộ quy tắc.'),
      step('Nhánh email: gửi POST /api/register', 'client.register → backendTransport → backendClient.request → CSRF + credentials/include + JSON → AccountResource.registerAccount', 'Frontend → HTTP → Backend', 'backend-client-request', 'request() lấy CSRF cho POST, gắn cookie session nếu có và serialize body. Lỗi thành BackendError chứa status/code/params/message; 201 resolve Promise.'),
      step('Backend validate và tạo User/AppUser', 'AccountResource.registerAccount → IdentityService.register → validatePassword/terms/duplicate → User + AppUser + ROLE_USER → repositories.saveAndFlush', 'Backend · transaction đăng ký', 'identity-register', 'User chứa credential và activated=false. AppUser chứa hồ sơ BeefCare, accountStatus=ACTIVE, passwordLoginEnabled=true, passwordMethodStatus=PENDING_VERIFICATION. Exception làm rollback transaction.'),
      step('Backend tạo token và queue email', 'IdentityService.sendLink → invalidate token cũ → ActionLinkSigner → AccountLinkToken → MailService.queueActionLink → EmailDeliveryJob PENDING', 'Backend · token + mail queue', 'identity-link-helpers', 'Raw token được dựng từ nonce đã ký; database chỉ lưu tokenHash. Email job giữ tham chiếu token để worker dựng link sau commit.'),
      step('Worker gửi email xác minh', 'EmailDeliveryJobService.dispatchDueJobs → prepare → dispatch → SmtpEmailDelivery hoặc MockEmailDelivery → SENT/RETRY', 'Backend · bất đồng bộ', 'email-job-service', 'Response 201 không chờ SMTP. Job lỗi tạm thời được lưu trạng thái retry; thành công HTTP chỉ chứng minh đã queue, chưa chứng minh người dùng nhận email.'),
      step('Gửi lại email nếu cần', 'EmailSentPage.useResend → client.resendVerification → AccountResource.resendEmailVerification → IdentityService.resendVerification → sendLink', 'Frontend ↔ Backend', 'email-sent-page', 'Frontend khóa nút theo nextAllowedAt. Backend quyết định giới hạn 60 giây và tối đa 5 lần/giờ; email không tồn tại vẫn trả response giống nhau.'),
      step('Kích hoạt email và tạo session', 'GET /api/activate?token → AccountResource.activateAccount → IdentityService.activateEmail/consume → User activated=true → DomainUserDetailsService → SecurityContext/JSESSIONID → 303', 'Backend → Browser → Frontend', 'account-activate', 'Token hợp lệ chỉ dùng một lần và chuyển password method sang ACTIVE. Token sai/hết hạn/đã dùng chuyển sang trang link lỗi; account suspended không được tạo session.'),
      step('Validate hồ sơ Owner', 'OwnerRegistrationPage → useOwnerRegistration.submit → validateOwnerProfile → useFarmWorkspaceUseCase.completeOwnerRegistration', 'Frontend · owner profile', 'owner-registration-hook', 'Tên, điện thoại và điều khoản được kiểm trước API. Có lỗi thì hook chỉ cập nhật errors. Hợp lệ thì input đi qua use-case boundary sang adapter.'),
      step('Lưu hồ sơ Owner', 'farmWorkspaceApi.completeOwnerRegistration → backendTransport.command → ActiveAccountFilter → FarmAccessService.currentActiveUser → AccountResource.completeOwnerRegistration → AppUserRepository.save', 'Frontend ↔ Backend · authenticated command', 'account-owner-complete', 'Backend kiểm session/account ACTIVE, chuẩn hóa tên và điện thoại, rồi đặt ownerRegistrationCompleted=true và thời điểm hoàn tất. Endpoint không tạo Farm hoặc FarmMembership.'),
      step('Làm mới SessionContext', 'notifyOwnerRegistrationCompleted → SessionProvider.markCompleted/loadProfile → GET /api/account/profile → AccountResource.profile → sessionFromProfile', 'Frontend ↔ Backend · readback', 'session-provider', 'Frontend cập nhật cờ ngay để chuyển route, sau đó đọc profile từ server. ProfileResponse là bằng chứng vòng về rằng ownerRegistrationCompleted đã được persist.'),
    ],
  },
  {
    id: 'uc-fe01-02', short: 'UC-02', title: 'Đăng nhập',
    handoff: 'POST /api/authenticate (mật khẩu)  hoặc  GET /oauth2/authorization/google (Google)  →  GET /api/account/profile',
    exchanges: [
      [],
      [],
      [
        exchange('POST /api/authenticate', 'AuthenticateController.authorize()', '204 + JSESSIONID', 'createBackendClient.login() → SignInPage.submit()'),
      ],
      [],
      [
        exchange('GET /api/account/profile', 'AccountResource.getProfile()', '200 · ProfileResponse', 'SessionProvider.loadProfile() → sessionFromProfile()'),
      ],
      [
        exchange('GET /oauth2/authorization/google', 'GoogleOidcSuccessHandler.onAuthenticationSuccess()', '302 + JSESSIONID', 'Browser → SessionProvider → chọn route'),
      ],
    ],
    frontend: [
      row('1. Provider chọn màn hình đăng nhập', 'guest path trước khi có session', [
        node('AppProviders.tsx', 'app/providers', ['AppProviders()'], 'app-providers', 'Router + AuthProvider'),
        node('AuthContext.tsx', 'features/authentication', ['AuthProvider()', 'client.isAuthenticated()'], 'auth-provider-logout', 'Quyết định trạng thái auth'),
        node('GuestAuthFlow.tsx', 'features/authentication/pages', ['GuestAuthFlow()', 'path → SignInPage'], 'guest-auth-flow', 'Hiển thị SCR-02'),
      ], ['khởi tạo auth', 'chọn trang']),
      row('2. Form, validation và lỗi đăng nhập', 'chuẩn hóa dữ liệu trước request', [
        node('SignInPage.tsx', 'features/authentication/pages', ['SignInPage()', 'submit(event)'], 'sign-in-page', 'email + password + rememberMe'),
        node('authValidation.ts', 'features/authentication/validation', ['normalizeEmail()', 'validateSignIn()'], 'auth-validation', 'Validation FE'),
        node('types.ts', 'features/authentication', ['AuthClient.login()'], 'auth-types', 'Hợp đồng adapter'),
        node('authErrors.ts', 'features/authentication/domain', ['friendlyLoginError()', 'isCredentialError()'], 'auth-errors', 'Ánh xạ MSG-FE01'),
      ], ['validate', 'dựng lệnh login', 'xử lý lỗi']),
      row('3. Lấy CSRF và gửi credentials', 'adapter → shared HTTP client', [
        node('client.ts', 'features/authentication', ['createBackendAuthClient()', 'login()'], 'auth-client-register', 'Dùng backend client'),
        node('backendTransport.ts', 'shared/api', ['backendTransport'], 'backend-transport', 'Transport dùng chung'),
        node('backendClient.ts', 'shared/api', ['login(username, password, rememberMe)', 'request()'], 'backend-client-login', 'POST /api/authenticate'),
      ], ['client.login', 'GET CSRF → POST authenticate']),
      row('4. FE nhận session mới', 'AuthProvider mở AuthGate và SessionProvider', [
        node('AuthContext.tsx', 'features/authentication', ['onAuthenticated()', 'status=authenticated'], 'auth-provider-logout', 'Cho phép render ứng dụng'),
        node('AppProviders.tsx', 'app/providers', ['AuthGate', 'SessionProvider'], 'app-providers', 'Mở cây authenticated'),
        node('SessionProvider.tsx', 'app/session', ['SessionProvider()', 'loadProfile()'], 'session-provider', 'Bắt đầu tải profile'),
      ], ['đổi auth state', 'mount session']),
      row('5. Tải profile và chọn route', 'response profile → session facts → màn hình đích', [
        node('useAuthenticationUseCase.ts', 'features/authentication/hooks', ['loadSessionProfile()'], 'authentication-usecase', 'GET profile'),
        node('backendTransport.ts', 'shared/api', ['get()'], 'backend-transport', 'Gửi cookie session'),
        node('sessionProfile.ts', 'app/session', ['sessionFromProfile()'], 'session-profile', 'Chuẩn hóa ProfileResponse'),
        node('roles.ts', 'features/authorization', ['needsOwnerRegistration()', 'homePathForSession()'], 'session-route', 'Chọn route'),
      ], ['GET profile', 'map session', 'route policy']),
      row('6. Nhánh đăng nhập Google', 'browser đi qua Spring OAuth2', [
        node('AuthControls.tsx', 'features/authentication/components', ['GoogleButton()', 'googleAuthorizationUrl()'], 'google-button', 'Chuyển trình duyệt sang backend'),
        node('googleOAuth.ts', 'features/authentication', ['googleAuthorizationUrl()'], 'google-oauth-file', 'URL OAuth'),
        node('authErrors.ts', 'features/authentication/domain', ['friendlyLoginError()'], 'auth-errors', 'Nhận callback lỗi'),
        node('roles.ts', 'features/authorization', ['needsOwnerRegistration()', 'homePathForSession()'], 'session-route', 'Chọn màn hình sau đăng nhập'),
      ], ['mở OAuth', 'callback về app', 'chọn route']),
    ],
    backend: [
      row('1. Security chain và error contract', 'CSRF, public endpoint, lỗi JSON', [
        node('SecurityConfiguration.java', 'config', ['filterChain()', 'csrf()', 'permitAll(authenticate)'], 'security-logout', 'Mở endpoint login'),
        node('ExceptionTranslator.java', 'web/rest/errors', ['domainProblem()'], 'exception-translator', 'MSG code → HTTP JSON'),
        node('DomainException.java', 'service', ['DomainException'], 'domain-exception', 'Lỗi policy đăng nhập'),
      ], ['CSRF + authorization', 'dịch lỗi']),
      row('2. Nhận LoginVM và kiểm policy', 'controller kiểm account trước AuthenticationManager', [
        node('AuthenticateController.java', 'web/rest', ['authorize(loginVM, request, response)'], 'authenticate-controller', 'SecurityContext + JSESSIONID'),
        node('LoginVM.java', 'web/rest/vm', ['username', 'password', 'rememberMe'], 'login-vm', 'DTO request'),
        node('IdentityService.java', 'service', ['checkPasswordSignInAllowed()', 'recordFailedPasswordAttempt()', 'clearFailedPasswordAttempts()'], 'identity-signin-policy', '5 lần sai → khóa 15 phút'),
        node('AppUserRepository.java', 'repository', ['findOneByEmailIgnoreCase()'], 'app-user-repository', 'Kiểm ACTIVE / Google-only'),
      ], ['bind DTO', 'kiểm suspended/locked', 'đọc account']),
      row('3. Spring xác thực mật khẩu', 'AuthenticationManager → UserDetailsService', [
        node('DomainUserDetailsService.java', 'security', ['loadUserByUsername(login)', 'createSpringSecurityUser(...)'], 'domain-user-details', 'Nạp identity + password hash'),
        node('UserRepository.java', 'repository', ['findOneWithAuthoritiesByEmailIgnoreCase()'], 'user-repository', 'Nạp User + authority'),
        node('User.java', 'domain', ['password', 'activated', 'failedPasswordAttempts'], 'user-entity', 'Credential state'),
        node('UserNotActivatedException.java', 'security', ['UserNotActivatedException'], 'user-not-activated', 'Nhánh chưa verify'),
      ], ['load user', 'PasswordEncoder.matches', 'trả principal']),
      row('4. Ghi bộ đếm và tạo HttpSession', 'đúng/sai đều cập nhật state phù hợp', [
        node('IdentityService.java', 'service', ['recordFailedPasswordAttempt()', 'clearFailedPasswordAttempts()'], 'identity-failed-attempt', 'Khóa 5 lần / reset counter'),
        node('UserRepository.java', 'repository', ['managed entity flush'], 'user-repository', 'Persist counter/lock'),
        node('AuthenticateController.java', 'web/rest', ['SecurityContext', 'SessionRegistry', 'rememberMe cookie'], 'authenticate-controller', '8 giờ hoặc 30 ngày'),
        node('SecurityConfiguration.java', 'config', ['SessionRegistry bean', 'PasswordEncoder bean'], 'security-logout', 'Hạ tầng session/password'),
      ], ['cập nhật counter', 'lưu context', 'register session']),
      row('5. Profile sau đăng nhập', 'mọi request authenticated kiểm lại account', [
        node('ActiveAccountFilter', 'config/SecurityConfiguration', ['doFilterInternal()'], 'active-account-filter', 'Kiểm session bị expire'),
        node('FarmAccessService.java', 'service', ['currentActiveUser()'], 'farm-access-current', 'Kiểm account ACTIVE'),
        node('AccountResource.java', 'web/rest', ['getProfile()', 'profile()'], 'account-profile-response', 'Trả ProfileResponse'),
        node('FarmWorkspaceService.java', 'service', ['list()'], 'farm-workspace-list', 'Danh sách farm/role'),
      ], ['filter session', 'lấy account', 'dựng profile']),
      row('6. Nhánh Google OIDC', 'verified claim → link identity → session', [
        node('SecurityConfiguration.java', 'config', ['oauth2Login()'], 'security-logout', 'Đăng ký success/failure handler'),
        node('GoogleOidcSuccessHandler.java', 'security', ['onAuthenticationSuccess(...)'], 'google-success-handler', 'Tạo session + redirect'),
        node('GoogleIdentityService.java', 'service', ['provisionOrLink(google)'], 'google-identity', 'Link theo email đã verify'),
        node('GoogleOidcFailureHandler.java', 'security', ['onAuthenticationFailure()'], 'google-failure-handler', 'Redirect /sign-in?error'),
      ], ['callback OIDC', 'link User/AppUser', 'trả redirect']),
    ],
    steps: [
      step('Người dùng bấm “Đăng nhập”', 'Validate form → client.login(normalizedEmail, password, rememberMe)', 'Frontend · SignInPage.submit()', 'sign-in-page', 'Component đầy đủ cho thấy cả xử lý lỗi sai thông tin, chưa xác minh và tài khoản tạm ngưng.'),
      step('HTTP client lấy CSRF rồi gửi thông tin đăng nhập', 'GET /api/csrf → POST /api/authenticate → làm mới CSRF sau khi session đổi', 'Frontend · createBackendClient().login()', 'backend-client-login', 'rememberMe được gửi cùng username và password.'),
      step('Backend kiểm tra và tạo phiên đăng nhập', 'check policy → AuthenticationManager.authenticate → tạo SecurityContext/JSESSIONID → đăng ký SessionRegistry', 'Backend · AuthenticateController.authorize()', 'authenticate-controller', 'Cả class được giữ để thấy endpoint CSRF và isAuthenticated xung quanh luồng chính.'),
      step('Service chặn tài khoản không được đăng nhập mật khẩu', 'Không tồn tại: không lộ thông tin; Google-only: 401 như sai mật khẩu; suspended: 403; locked: 423', 'Backend · IdentityService policy', 'identity-signin-policy', 'Đây là logic D05: tài khoản chỉ Google không bị lộ qua response.'),
      step('Sai mật khẩu được đếm, đúng mật khẩu xóa bộ đếm', 'recordFailedPasswordAttempt tăng đến 5 và khóa 15 phút; clearFailedPasswordAttempts đặt lại 0', 'Backend · IdentityService lock counter', 'identity-failed-attempt', 'Hai hàm liền nhau được hiển thị trọn vẹn.'),
      step('Nhánh Google bắt đầu từ liên kết OAuth', 'GoogleButton → /oauth2/authorization/google', 'Frontend · GoogleButton()', 'google-button', 'Frontend không tự xử lý token Google; trình duyệt đi qua Spring OAuth2.'),
      step('Backend liên kết Google subject với tài khoản', 'Đọc email đã verify → tìm theo subject/email → tạo hoặc liên kết AppUser/User', 'Backend · GoogleIdentityService.provisionOrLink()', 'google-identity', 'Không tạo tài khoản thứ hai khi email đã tồn tại.'),
      step('Callback Google tạo session và chọn đích đến', 'Tạo BeefCare authentication → ghi authenticatedAt → redirect owner-registration hoặc chọn trại', 'Backend · GoogleOidcSuccessHandler', 'google-success-handler', 'Class đầy đủ cho thấy cả nhánh lỗi và tài khoản suspended.'),
      step('Frontend tải profile để dựng session và điều hướng', 'GET /api/account/profile → sessionFromProfile → chọn owner-registration / platform / chọn trại / home', 'Frontend · SessionProvider + roles', 'session-provider', 'Session chứa dữ kiện profile; quyền thật vẫn được backend kiểm tra ở từng API.'),
    ],
  },
  {
    id: 'uc-fe01-03', short: 'UC-03', title: 'Đăng xuất',
    handoff: 'POST /api/logout  →  Spring Security hủy HttpSession và xóa JSESSIONID/XSRF-TOKEN',
    exchanges: [
      [
        exchange('POST /api/logout', 'Spring Security LogoutFilter', '204 + xóa JSESSIONID/XSRF-TOKEN', 'backendClient.logout() → AuthProvider.logout()'),
      ],
      [
        exchange('', '', 'Sau response 204: không gọi backend lần nữa', 'clearCurrentFarmId() → notifySessionSignedOut() → /sign-in', true),
      ],
    ],
    frontend: [
      row('Người dùng đăng xuất', 'UI → session → auth context → HTTP client', [
        node('TechnicianAccountPage.tsx', 'features/account/pages', ['TechnicianAccountPage()', 'signOut()'], 'technician-account', 'session.logout()'),
        node('AuthContext.tsx', 'features/authentication', ['AuthProvider()', 'value.logout()'], 'auth-provider-logout', 'Xóa trạng thái local'),
        node('useAuthenticationUseCase.ts', 'features/authentication/hooks', ['logout()'], 'authentication-usecase', 'Chuyển đến AuthClient'),
        node('backendClient.ts', 'shared/api', ['logout()', 'request()'], 'backend-client-logout', 'POST /api/logout'),
      ], ['gọi session.logout', 'gọi auth.logout', 'gọi client.logout']),
      row('Sau response', 'xóa trại đang chọn và về đăng nhập', [
        node('currentFarm.ts', 'app/session', ['clearCurrentFarmId()'], 'clear-farm', 'Xóa sessionStorage'),
        node('sessionLifecycle.ts', 'app/session', ['notifySessionSignedOut()'], 'session-lifecycle', 'Phát event'),
        node('AuthContext.tsx', 'features/authentication', ['SessionRedirect()'], 'session-redirect', 'navigate(/sign-in)'),
      ], ['sau logout', 'event được lắng nghe']),
    ],
    backend: [
      row('Spring Security xử lý /api/logout', 'không có controller trung gian', [
        node('SecurityConfiguration.java', 'config', ['filterChain()', 'logout(logout → …)'], 'security-logout', 'Cấu hình LogoutFilter'),
        node('Spring LogoutFilter', 'Spring Security', ['invalidateHttpSession(true)', 'deleteCookies(...)'], 'security-logout', 'Hủy session + cookie'),
        node('HttpServletResponse', 'Servlet API', ['setStatus(204)'], 'security-logout', 'Không trả body'),
      ], ['match /api/logout', 'logoutSuccessHandler']),
    ],
    steps: [
      step('Người dùng bấm “Đăng xuất”', 'signOut() → session.logout()', 'Frontend · trang tài khoản', 'technician-account', 'Component đầy đủ cho thấy nút đăng xuất gọi đúng session hiện tại.'),
      step('AuthProvider điều phối đăng xuất', 'auth.logout() → dù server lỗi vẫn clear farm → phát signed-out event → status=anonymous', 'Frontend · AuthProvider.logout()', 'auth-provider-logout', 'Thiết bị luôn rời trạng thái đăng nhập; lỗi server được biến thành thông báo.'),
      step('Use-case hook chuyển lời gọi đến AuthClient', 'useAuthenticationUseCase.logout → client.logout()', 'Frontend · feature boundary', 'authentication-usecase', 'File ngắn được hiển thị toàn bộ để thấy ranh giới feature.'),
      step('HTTP client gửi POST /api/logout', 'request POST kèm CSRF/cookie → chấp nhận cả 401 → xóa CSRF cache', 'Frontend · backendClient.logout()', 'backend-client-logout', 'Nếu session đã hết hạn thì frontend vẫn coi đăng xuất hoàn tất.'),
      step('Spring Security hủy phiên và cookie', 'LogoutFilter match /api/logout → invalidate session → delete JSESSIONID/XSRF-TOKEN → 204', 'Backend · SecurityConfiguration.filterChain()', 'security-logout', 'Không có tầng controller riêng cho logout; đây là cấu hình thật xử lý request.'),
      step('Frontend xóa trại đang chọn và về đăng nhập', 'clearCurrentFarmId → notifySessionSignedOut → SessionRedirect navigate(/sign-in)', 'Frontend · app session lifecycle', 'session-lifecycle', 'Event giúp mọi bề mặt đang nghe cùng chuyển về màn hình đăng nhập.'),
    ],
  },
  {
    id: 'uc-fe01-04', short: 'UC-04', title: 'Xem và sửa hồ sơ của tôi',
    handoff: 'GET /api/account/profile  +  POST /api/account/profile  +  GET /api/farms/{farmId}/my-permissions',
    exchanges: [
      [
        exchange('GET /api/account/profile', 'AccountResource.getProfile()', '200 · ProfileResponse', 'accountApi.getProfile() → useAccountProfile()'),
        exchange('GET /api/farms/{farmId}/my-permissions', 'AccountResource.myPermissions()', '200 · FarmPermissionsResponse', 'accountApi.getFarmPermissions()'),
      ],
      [
        exchange('POST /api/account/profile', 'AccountResource.updateProfile()', '200 · ProfileResponse', 'accountApi.updateProfile() → useProfileForm.submit()'),
      ],
    ],
    frontend: [
      row('Tải và hiển thị hồ sơ', 'query profile + permissions', [
        node('ProfileScreen.tsx', 'features/account/components', ['ProfileScreen()', 'useAccountProfile()'], 'profile-screen', 'Render SCR-08'),
        node('useAccountProfile.ts', 'features/account/hooks', ['useAccountProfile()', 'useQuery(...)'], 'account-profile-hook', 'Profile + quyền'),
        node('accountApi.ts', 'features/account/api', ['getProfile()', 'getFarmPermissions()'], 'account-api-profile', 'GET hai endpoint'),
      ], ['gọi hook', 'gọi adapter']),
      row('Lưu họ tên và điện thoại', 'form validate → command', [
        node('ProfileScreen.tsx', 'features/account/components', ['form="profile-form"', 'form.submit'], 'profile-screen', 'Nút ở PageHeader'),
        node('useAccountProfile.ts', 'features/account/hooks', ['useProfileForm()', 'submit(event)'], 'profile-form-hook', 'Validate + save'),
        node('accountApi.ts', 'features/account/api', ['updateProfile(identity, input)'], 'account-api-profile', 'POST /api/account/profile'),
      ], ['submit HTML form', 'account.updateProfile']),
    ],
    backend: [
      row('Đọc và cập nhật profile', 'email chỉ đọc; chỉ lưu fullName/contactPhone', [
        node('AccountResource.java', 'web/rest', ['getProfile()', 'updateProfile(request)'], 'account-get-update-profile', 'ProfileResponse'),
        node('AccountResource.java', 'web/rest', ['profile(account)'], 'account-profile-response', 'Tổng hợp signInMethods + farms'),
        node('AppUserRepository.java', 'repository', ['findOneByEmailIgnoreCase()', 'save(...)'], 'app-user-repository', 'Đọc/lưu AppUser'),
      ], ['gọi helper profile', 'đọc facts']),
      row('Đọc bảng quyền theo trại', 'membership thật trên server', [
        node('AccountResource.java', 'web/rest', ['myPermissions(farmId)', 'permissionEntries(role)'], 'account-permissions', 'FULL / RESTRICTED / NO'),
        node('FarmMembershipRepository.java', 'repository', ['findFirstByFarmIdAndUserIdAndStatusIgnoreCase(...)'], 'farm-membership-repository', 'Xác nhận membership ACTIVE'),
      ], ['truy vấn membership']),
    ],
    steps: [
      step('Mở màn hình Hồ sơ & quyền', 'ProfileScreen → useAccountProfile + useProfileForm', 'Frontend · ProfileScreen()', 'profile-screen', 'Component đầy đủ cho thấy profile, quyền, nút lưu và popup đổi mật khẩu cùng nằm ở đâu.'),
      step('Hook tải profile và quyền của trại đang chọn', 'getProfile(identity) song song với getFarmPermissions(identity, farmId)', 'Frontend · useAccountProfile()', 'account-profile-hook', 'Không có farm đang chọn thì không gọi endpoint quyền.'),
      step('Adapter gọi đúng endpoint backend', 'GET profile; GET my-permissions; khi lưu thì POST profile với contactPhone', 'Frontend · createAccountApi()', 'account-api-profile', 'Cả hàm adapter được giữ để thấy ba lời gọi liên quan nằm cạnh nhau.'),
      step('Backend dựng ProfileResponse', 'currentActiveUser → profile(account) → emailVerified, signInMethods, platformRole, farms', 'Backend · AccountResource', 'account-profile-response', 'Frontend không tự suy đoán phương thức đăng nhập hay danh sách trại.'),
      step('Người dùng sửa tên/điện thoại và bấm Lưu', 'validateProfile → account.updateProfile → hiển thị thông báo → refetch', 'Frontend · useProfileForm.submit()', 'profile-form-hook', 'Email không có trong payload cập nhật.'),
      step('Backend kiểm tra và lưu hồ sơ', 'fullName()/phone() → AppUserRepository.save → đồng bộ firstName của User → trả profile mới', 'Backend · get/update profile methods', 'account-get-update-profile', 'Response sau lưu đi lại qua chính helper profile(account).'),
      step('Backend trả bảng quyền theo membership thật', 'farmId + current user → membership ACTIVE → role → permissionEntries', 'Backend · myPermissions()', 'account-permissions', 'Browser state không được dùng làm bằng chứng quyền.'),
    ],
  },
  {
    id: 'uc-fe01-05', short: 'UC-05', title: 'Đặt lại mật khẩu đã quên',
    handoff: 'POST /api/account/reset-password/init  →  GET .../validate?token=…  →  POST .../finish',
    exchanges: [
      [
        exchange('POST /api/account/reset-password/init', 'AccountResource.requestPasswordReset()', '200/204 · không tiết lộ email tồn tại', 'requestPasswordReset() → ForgotPasswordPage'),
      ],
      [
        exchange('GET /api/account/reset-password/validate?token=…', 'AccountResource.validateResetLink()', '200 · { valid, email? }', 'ResetPasswordPage.checkLink()'),
        exchange('POST /api/account/reset-password/finish', 'AccountResource.finishPasswordReset()', '204', 'ResetPasswordPage.submit() → /sign-in?reset=success'),
      ],
    ],
    frontend: [
      row('1. Yêu cầu link đặt lại', 'response giống nhau cho mọi email', [
        node('RecoveryPages.tsx', 'features/authentication/pages', ['ForgotPasswordPage()', 'submit(event)'], 'forgot-password-page', 'Email đã chuẩn hóa'),
        node('useAuthenticationUseCase.ts', 'features/authentication/hooks', ['requestPasswordReset'], 'authentication-usecase', 'Feature boundary'),
        node('client.ts', 'features/authentication', ['requestPasswordReset(email)'], 'auth-client-reset', 'POST reset-password/init'),
      ], ['gọi use case', 'gọi client']),
      row('2. Mở link và lưu mật khẩu mới', 'validate token trước khi hiện form', [
        node('RecoveryPages.tsx', 'features/authentication/pages', ['ResetPasswordPage()', 'checkLink()', 'submit(event)'], 'reset-password-page', 'Validate → finish'),
        node('client.ts', 'features/authentication', ['validatePasswordReset(token)', 'resetPassword(...)'], 'auth-client-reset', 'GET validate + POST finish'),
        node('backendClient.ts', 'shared/api', ['request()'], 'backend-client-request', 'CSRF + cookie + JSON'),
      ], ['gọi client', 'gửi HTTP']),
    ],
    backend: [
      row('1. Phát link hoặc email hướng dẫn Google', 'không tiết lộ email tồn tại', [
        node('AccountResource.java', 'web/rest', ['requestPasswordReset(request)', 'validateResetLink(token)'], 'account-reset-init', 'Response đồng nhất'),
        node('IdentityService.java', 'service', ['requestPasswordReset(email)', 'issueRateLimited(...)'], 'identity-reset-init', 'Link 30 phút / tối đa 5 giờ'),
        node('AccountLinkTokenRepository.java', 'repository', ['countByUserIdAndTokenType...', 'findOneByTokenHashAndTokenType(...)'], 'account-link-token-repository', 'Lưu và tra token hash'),
      ], ['gọi service', 'tạo token/mail']),
      row('2. Tiêu thụ token và đổi mật khẩu', 'token một lần; đóng mọi phiên', [
        node('AccountResource.java', 'web/rest', ['finishPasswordReset(keyAndPassword)'], 'account-reset-finish', 'POST finish'),
        node('IdentityService.java', 'service', ['passwordResetEmail(token)', 'completePasswordReset(...)'], 'identity-reset-finish', 'consume + encode + expire sessions'),
        node('UserRepository.java', 'repository', ['findOneWithAuthoritiesByLogin()', 'save qua transaction'], 'user-repository', 'Persist password mới'),
      ], ['gọi completePasswordReset', 'lưu và thu hồi phiên']),
    ],
    steps: [
      step('Người dùng nhập email và yêu cầu đặt lại', 'Validate email → requestPasswordReset(normalizedEmail) → chuyển màn hình “Kiểm tra email”', 'Frontend · ForgotPasswordPage()', 'forgot-password-page', 'Response thành công không cho biết email có tồn tại hay không.'),
      step('Frontend gửi request init', 'Auth hook → client.requestPasswordReset → POST /api/account/reset-password/init', 'Frontend · client.ts', 'auth-client-reset', 'File đầy đủ cho thấy cả validate và finish dùng cùng client.'),
      step('Backend nhận yêu cầu và giữ response đồng nhất', 'AccountResource.requestPasswordReset → IdentityService.requestPasswordReset', 'Backend · AccountResource', 'account-reset-init', 'Controller không trả dữ liệu phân biệt tài khoản.'),
      step('Service quyết định gửi link hay hướng dẫn Google', 'Có password: token 30 phút; Google-only: email hướng dẫn; không tồn tại: không làm gì', 'Backend · IdentityService.requestPasswordReset()', 'identity-reset-init', 'D06 được thể hiện trong nhánh findGoogleOnlyAccount.'),
      step('Người dùng mở link; frontend kiểm tra token', 'ResetPasswordPage.checkLink → GET validate → chỉ hiện form nếu valid=true', 'Frontend · ResetPasswordPage()', 'reset-password-page', 'Cả component cho thấy kiểm tra token và submit mật khẩu trong cùng một luồng.'),
      step('Backend kiểm tra token mà chưa tiêu thụ', 'validateResetLink → passwordResetEmail → kiểm tra token còn hạn/chưa dùng', 'Backend · validate endpoint', 'account-reset-init', 'GET validate chỉ đọc; token chỉ bị consume ở bước finish.'),
      step('Người dùng lưu mật khẩu mới', 'validateReset → resetPassword(token, new, confirm) → POST finish → về trang đăng nhập', 'Frontend · ResetPasswordPage.submit()', 'reset-password-page', 'Nếu backend trả MSG-FE01-06 thì chuyển sang màn hình link hết hạn.'),
      step('Backend tiêu thụ token và thu hồi mọi phiên', 'consume token → validate password → encode → reset lock counter → expireSessions(false) → gửi email báo đổi', 'Backend · IdentityService.completePasswordReset()', 'identity-reset-finish', 'Đặt lại mật khẩu kết thúc tất cả session, kể cả session của người thao tác.'),
    ],
  },
  {
    id: 'uc-fe01-06', short: 'UC-06', title: 'Đổi mật khẩu / thêm mật khẩu đầu tiên',
    handoff: 'POST /api/account/google-reauthentication (khi cần)  →  Google OAuth  →  POST /api/account/change-password',
    exchanges: [
      [
        exchange('POST /api/account/google-reauthentication', 'AccountResource.startGoogleReauthentication()', '204', 'accountApi.reauthenticateWithGoogle() → mở Google'),
        exchange('GET /oauth2/authorization/google', 'GoogleOidcSuccessHandler.onAuthenticationSuccess()', '302 · ?googleReauthenticated=true', 'ChangePasswordDialog(reauthed=true)'),
      ],
      [
        exchange('POST /api/account/change-password', 'AccountResource.changePassword()', '204', 'accountApi.changePassword() → ChangePasswordDialog.submit()'),
      ],
    ],
    frontend: [
      row('Nhánh xác thực lại Google', 'tài khoản chưa có password hoặc quên password hiện tại', [
        node('ChangePasswordDialog.tsx', 'features/account/components', ['ChangePasswordDialog()', 'reauthenticate()'], 'change-password-dialog', 'Mở Google OAuth'),
        node('accountApi.ts', 'features/account/api', ['reauthenticateWithGoogle(identity, returnTo)'], 'account-api-password', 'POST google-reauthentication'),
        node('googleOAuth.ts', 'features/authentication', ['googleAuthorizationUrl()'], 'google-oauth-file', 'Đi tới /oauth2/authorization/google'),
      ], ['gọi account API', 'sau 204 chuyển trang']),
      row('Nhánh lưu mật khẩu', 'current password hoặc Google recent', [
        node('ChangePasswordDialog.tsx', 'features/account/components', ['submit(event)', 'validatePasswordChange(...)'], 'change-password-dialog', 'Dựng PasswordChangeInput'),
        node('useAccountUseCase.ts', 'features/account/hooks', ['changePassword(identity, input)'], 'account-usecase-file', 'Feature boundary'),
        node('accountApi.ts', 'features/account/api', ['changePassword(identity, input)'], 'account-api-password', 'POST change-password'),
      ], ['account.changePassword', 'transport.command']),
    ],
    backend: [
      row('1. Ghi yêu cầu re-auth và nhận callback Google', 'cửa sổ tin cậy 5 phút trong session', [
        node('AccountResource.java', 'web/rest', ['startGoogleReauthentication()', 'reauthenticationReturnPath()'], 'account-google-reauth', 'Lưu return path vào session'),
        node('GoogleOidcSuccessHandler.java', 'security', ['onAuthenticationSuccess(...)'], 'google-success-handler', 'Ghi AUTHENTICATED_AT'),
        node('GoogleReauthentication.java', 'security', ['recent(session, now)'], 'google-reauth-window', 'Kiểm tra ≤ 5 phút'),
      ], ['OAuth callback', 'sau đó kiểm cửa sổ']),
      row('2. Đổi hoặc thêm password', 'giữ session hiện tại, đóng session khác', [
        node('AccountResource.java', 'web/rest', ['changePassword(dto, request)'], 'account-change-password', 'Đọc Google recent'),
        node('IdentityService.java', 'service', ['changePassword(..., googleReauthenticated)'], 'identity-change-password', 'Validate + encode + revoke'),
        node('UserRepository.java', 'repository', ['findOneWithAuthoritiesByLogin()', 'managed entity flush'], 'user-repository', 'Lưu password mới'),
      ], ['gọi service', 'persist / expire']),
    ],
    steps: [
      step('Mở popup Đổi/Thêm mật khẩu', 'hasPassword quyết định hiện mật khẩu hiện tại; Google recent quyết định có thể bỏ qua', 'Frontend · ChangePasswordDialog()', 'change-password-dialog', 'Component đầy đủ thể hiện cả hai nhánh đổi mật khẩu và thêm mật khẩu đầu tiên.'),
      step('Nếu cần, người dùng xác thực lại với Google', 'reauthenticate() → account.reauthenticateWithGoogle(identity, returnTo)', 'Frontend · dialog reauthenticate()', 'change-password-dialog', 'Sau response 204, trình duyệt mới được chuyển sang Google.'),
      step('Frontend ghi return path rồi mở OAuth', 'POST /api/account/google-reauthentication → googleAuthorizationUrl() → window.location.assign()', 'Frontend · accountApi password methods', 'account-api-password', 'Backend xác minh return path; frontend không tự đưa URL tùy ý.'),
      step('Backend lưu đường quay lại an toàn', 'currentActiveUser → chỉ chấp nhận route hồ sơ phù hợp vai trò → ghi vào HttpSession', 'Backend · startGoogleReauthentication()', 'account-google-reauth', 'Route không hợp lệ luôn rơi về /ho-so.'),
      step('Callback Google đánh dấu thời điểm xác thực', 'GoogleOidcSuccessHandler ghi AUTHENTICATED_AT và redirect về popup với googleReauthenticated=true', 'Backend · Google callback', 'google-success-handler', 'Dấu thời gian nằm trong session server, không tin query parameter một mình.'),
      step('Người dùng nhập mật khẩu mới và bấm Lưu', 'validatePasswordChange → account.changePassword(identity, input)', 'Frontend · ChangePasswordDialog.submit()', 'change-password-dialog', 'currentPassword chỉ được gửi khi thực sự bắt buộc.'),
      step('REST endpoint kiểm tra cửa sổ Google 5 phút', 'GoogleReauthentication.recent(session, now) → identityService.changePassword(..., boolean)', 'Backend · AccountResource.changePassword()', 'account-change-password', 'Controller chuyển kết quả kiểm tra server-side vào service.'),
      step('Service đổi/thêm password và đóng phiên khác', 'Kiểm current password hoặc Google recent → validate new password → encode → activate method → expireSessions(true)', 'Backend · IdentityService.changePassword()', 'identity-change-password', 'Session hiện tại được giữ; các session khác bị expire.'),
    ],
  },
]

const payload = JSON.stringify({ useCases, sources, sourceNotes }).replaceAll('<', '\\u003c')

const html = String.raw`<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BeefCare · FE-01 · Luồng code theo use case</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
  <style>
    :root { --bg:#f4f7fb; --paper:#fff; --ink:#182230; --muted:#667085; --line:#d9e1ec; --blue:#2563eb; --blue-soft:#eef4ff; --green:#0f766e; --green-soft:#eefaf7; --amber:#f59e0b; --code:#101827; }
    * { box-sizing:border-box; }
    body { margin:0; color:var(--ink); background:var(--bg); font:14px/1.45 Arial, Helvetica, sans-serif; }
    button { font:inherit; }
    .shell { max-width:1480px; margin:0 auto; padding:10px 16px 18px; }
    .topbar { display:flex; align-items:center; gap:10px; min-height:30px; overflow:auto; white-space:nowrap; color:var(--muted); font-size:12px; }
    .brand { color:var(--ink); font-weight:750; }
    .sep { color:#98a2b3; }
    .tabs { display:flex; align-items:center; gap:4px; min-width:max-content; }
    .tab { border:0; border-bottom:2px solid transparent; background:transparent; color:#667085; padding:5px 7px 4px; cursor:pointer; }
    .tab:hover { color:var(--blue); }
    .tab.active { color:var(--blue); border-bottom-color:var(--blue); font-weight:700; }
    .card { background:var(--paper); border:1px solid var(--line); border-radius:10px; box-shadow:0 4px 14px rgba(32,55,91,.04); overflow:hidden; }
    .card-head { min-height:38px; padding:7px 11px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .card-head h1, .card-head h2 { margin:0; font-size:15px; }
    .hint { color:var(--muted); font-size:11px; }
    .diagram-body { padding:8px; overflow:auto; }
    .system-map { display:grid; grid-template-columns:minmax(0,1fr) minmax(250px,.52fr) minmax(0,1fr); min-width:1120px; align-items:stretch; }
    .lane-head { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:30px; padding:6px 8px; border:1px solid; border-radius:8px 8px 0 0; font-size:11px; font-weight:800; }
    .lane-head small { color:var(--muted); font-size:9px; font-weight:400; }
    .lane-head.frontend { color:var(--blue); border-color:#c9d8f7; background:#eef4ff; }
    .lane-head.backend { color:var(--green); border-color:#b9e0d8; background:#eaf8f4; }
    .bridge-head { display:flex; align-items:center; justify-content:center; min-height:30px; padding:4px 7px; color:#475569; text-align:center; font-size:9px; font-weight:700; }
    .lane-cell { min-width:0; padding:6px; border-right:1px solid; border-left:1px solid; border-top:1px solid rgba(148,163,184,.28); }
    .lane-cell.frontend { border-right-color:#c9d8f7; border-left-color:#c9d8f7; background:#f8faff; }
    .lane-cell.backend { border-right-color:#b9e0d8; border-left-color:#b9e0d8; background:#f7fcfa; }
    .lane-cell.last { border-bottom:1px solid; border-radius:0 0 8px 8px; }
    .lane-cell.frontend.last { border-bottom-color:#c9d8f7; }
    .lane-cell.backend.last { border-bottom-color:#b9e0d8; }
    .lane-cell.empty { display:flex; align-items:center; justify-content:center; color:#98a2b3; font-size:9px; }
    .row-caption { display:flex; gap:6px; align-items:baseline; margin:0 1px 5px; font-size:10px; font-weight:750; }
    .row-caption span { color:var(--muted); font-weight:400; }
    .nodes { display:flex; align-items:stretch; gap:3px; min-width:0; }
    .node { flex:1 1 0; min-width:0; border:1px solid #b8c7dd; border-radius:6px; background:#fff; padding:5px; color:inherit; text-align:left; cursor:pointer; overflow-wrap:anywhere; word-break:break-word; }
    .backend .node { border-color:#add5cd; }
    .node:hover, .node.active { border-color:var(--blue); box-shadow:0 0 0 2px rgba(37,99,235,.09); }
    .backend .node:hover, .backend .node.active { border-color:var(--green); box-shadow:0 0 0 2px rgba(15,118,110,.09); }
    .node-file { display:flex; align-items:baseline; justify-content:space-between; gap:4px; font-size:11px; font-weight:800; }
    .node-lines { flex:none; color:#667085; font:7px/1.2 "SFMono-Regular", Consolas, monospace; font-weight:600; }
    .node-path { display:block; color:var(--muted); font:8px/1.25 "SFMono-Regular", Consolas, monospace; margin-top:2px; }
    .methods { display:block; border-top:1px solid #edf1f6; margin-top:3px; padding-top:3px; color:#344054; font:9px/1.32 "SFMono-Regular", Consolas, monospace; white-space:normal; }
    .method { display:block; }
    .node-result { display:block; margin-top:3px; color:#64748b; font-size:8px; }
    .arrow { flex:0 0 24px; align-self:center; color:#8190a6; text-align:center; font-size:13px; line-height:1; }
    .arrow span { display:block; margin-bottom:2px; color:#667085; font-size:7px; line-height:1.15; white-space:normal; }
    .bridge-cell { display:flex; flex-direction:column; justify-content:center; gap:5px; min-width:0; padding:6px 7px; border-top:1px dashed #cbd5e1; background:#fbfcfe; }
    .bridge-cell.last { border-bottom:1px solid #e2e8f0; }
    .exchange { min-width:0; padding:4px 0; }
    .exchange + .exchange { border-top:1px dotted #cbd5e1; }
    .request-line, .response-line, .failure-line { padding:4px 5px; border-radius:4px; overflow-wrap:anywhere; font:9px/1.35 "SFMono-Regular", Consolas, monospace; font-weight:700; }
    .request-line { color:#1d4ed8; background:#eef4ff; text-align:right; }
    .response-line { color:#0f766e; background:#eefaf7; text-align:left; }
    .failure-line { margin-top:3px; color:#b42318; background:#fff1f0; text-align:left; }
    .receiver { padding:2px 3px; color:#475569; font-size:9px; line-height:1.3; overflow-wrap:anywhere; }
    .receiver strong { color:#344054; }
    .local-exchange { padding:7px; border:1px dashed #cbd5e1; border-radius:6px; background:#fff; color:#475569; font-size:9px; line-height:1.45; }
    .local-exchange strong { color:#344054; }
    .local-result { margin-top:3px; padding:3px 5px; border-radius:4px; background:#f1f5f9; overflow-wrap:anywhere; }
    .workspace { display:grid; grid-template-columns:minmax(330px,.74fr) minmax(570px,1.26fr); gap:9px; margin-top:9px; align-items:start; }
    .flow { padding:7px 10px 9px; }
    .flow-step { display:grid; grid-template-columns:21px 1fr; gap:7px; width:100%; padding:4px 1px; border:0; border-left:2px solid transparent; background:transparent; color:inherit; text-align:left; cursor:pointer; }
    .flow-step:hover, .flow-step.active { color:var(--blue); border-left-color:var(--blue); }
    .flow-num { color:#98a2b3; text-align:right; font-size:10px; font-weight:800; }
    .flow-title { display:block; font-size:12px; }
    .flow-pseudo { display:block; color:#475569; font-size:11px; line-height:1.35; margin-top:1px; }
    .flow-step.active .flow-pseudo { color:#1d4ed8; }
    .flow-meta { display:block; color:#98a2b3; font-size:9px; margin-top:1px; }
    .detail { position:sticky; top:8px; }
    .detail-body { padding:9px; }
    .source-head { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:start; margin-bottom:7px; }
    .source-symbol { margin:0; font-size:14px; }
    .source-path { color:var(--muted); font:10px/1.35 "SFMono-Regular", Consolas, monospace; overflow-wrap:anywhere; }
    .scope { border:1px solid #c7d6ee; border-radius:999px; background:var(--blue-soft); color:#1d4ed8; padding:3px 7px; font-size:9px; white-space:nowrap; }
    .source-note { display:none; }
    .code-window { max-height:500px; overflow:auto; border-radius:7px; background:var(--code); color:#dbeafe; padding:7px 0; font:11px/1.48 "SFMono-Regular", Consolas, "Liberation Mono", monospace; tab-size:2; }
    .code-line { display:grid; grid-template-columns:48px max-content; min-width:100%; min-height:16px; padding-right:14px; }
    .code-line.highlight { background:rgba(245,158,11,.16); box-shadow:inset 3px 0 #f59e0b; }
    .line-number { color:#65748b; padding:0 9px 0 5px; text-align:right; user-select:none; }
    .highlight .line-number { color:#fbbf24; }
    .line-code { white-space:pre; }
    .code-explanation { margin-top:8px; border:1px solid #d8e2ea; border-radius:7px; background:#f8fafc; overflow:hidden; }
    .explain-row { display:grid; grid-template-columns:108px 1fr; gap:8px; padding:7px 9px; color:#344054; font-size:10px; line-height:1.45; }
    .explain-row + .explain-row { border-top:1px solid #e5eaf0; }
    .explain-row strong { color:#0f5f59; }
    @media (max-width:980px) { .workspace{grid-template-columns:1fr;} .detail{position:static;} .code-window{max-height:480px;} }
  </style>
</head>
<body>
  <main class="shell">
    <nav class="topbar" aria-label="Use case Feature 1">
      <span class="brand">FE-01 · Xác thực tài khoản</span><span class="sep">›</span><div id="tabs" class="tabs"></div>
    </nav>
    <article class="card">
      <div class="card-head"><h1 id="title"></h1><span class="hint">Bấm file/hàm để mở code thật bên dưới</span></div>
      <div id="diagram" class="diagram-body"></div>
    </article>
    <section class="workspace">
      <article class="card"><div class="card-head"><h2>Mã giả luồng</h2><span id="step-count" class="hint"></span></div><div id="flow" class="flow"></div></article>
      <article class="card detail"><div class="card-head"><h2>Chi tiết code thật</h2><span class="hint">Dòng vàng = phần tham gia trực tiếp</span></div><div id="detail" class="detail-body"></div></article>
    </section>
  </main>
  <script id="data" type="application/json">%%DATA%%</script>
  <script>
    const DATA = JSON.parse(document.getElementById('data').textContent)
    const state = { caseIndex: Math.max(0, DATA.useCases.findIndex((item) => '#' + item.id === location.hash)), stepIndex: 0, sourceOverride: null }
    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]))
    const currentCase = () => DATA.useCases[state.caseIndex]
    const currentStep = () => currentCase().steps[state.stepIndex]
    const currentSource = () => state.sourceOverride || currentStep().source
    function findDiagramNode(source) {
      const rows = [...currentCase().frontend, ...currentCase().backend]
      for (const item of rows) {
        if (!item) continue
        for (const entry of item.nodes) if (entry.source === source) return entry
      }
      return null
    }

    function selectCase(index) {
      state.caseIndex = index
      state.stepIndex = 0
      state.sourceOverride = null
      history.replaceState(null, '', '#' + DATA.useCases[index].id)
      render()
    }
    function selectStep(index) {
      state.stepIndex = index
      state.sourceOverride = null
      renderFlow()
      renderDiagram()
      renderDetail()
    }
    function selectSource(source) {
      const index = currentCase().steps.findIndex((item) => item.source === source)
      if (index >= 0) selectStep(index)
      else if (DATA.sources[source]) {
        state.sourceOverride = source
        renderDiagram()
        renderDetail()
      }
    }
    function renderTabs() {
      document.getElementById('tabs').innerHTML = DATA.useCases.map((item, index) => '<button class="tab ' + (index === state.caseIndex ? 'active' : '') + '" type="button" data-case="' + index + '">' + escapeHtml(item.short) + ' · ' + escapeHtml(item.title) + '</button>').join('')
      document.querySelectorAll('[data-case]').forEach((button) => button.addEventListener('click', () => selectCase(Number(button.dataset.case))))
    }
    function renderNode(item) {
      const active = item.source === currentSource() ? ' active' : ''
      const source = DATA.sources[item.source]
      const lines = source ? 'L' + source.highlightStart + '–' + source.highlightEnd : ''
      const sourcePath = source ? source.file : item.path
      return '<button type="button" class="node' + active + '" data-source="' + escapeHtml(item.source || '') + '" title="' + escapeHtml(sourcePath) + '"><span class="node-file"><span>' + escapeHtml(item.file) + '</span><span class="node-lines">' + escapeHtml(lines) + '</span></span><span class="node-path">' + escapeHtml(item.path) + '</span><span class="methods">' + item.methods.map((method) => '<span class="method">' + escapeHtml(method) + '</span>').join('') + '</span><span class="node-result">' + escapeHtml(item.result) + '</span></button>'
    }
    function renderRow(item, kind, last) {
      if (!item) return '<div class="lane-cell ' + kind + (last ? ' last' : '') + ' empty">Không có xử lý ' + (kind === 'frontend' ? 'Frontend' : 'Backend') + ' mới</div>'
      let nodes = ''
      item.nodes.forEach((entry, index) => {
        if (index > 0) nodes += '<div class="arrow"><span>' + escapeHtml(item.arrows[index - 1] || 'gọi') + '</span>→</div>'
        nodes += renderNode(entry)
      })
      return '<div class="lane-cell ' + kind + (last ? ' last' : '') + '"><p class="row-caption">' + escapeHtml(item.title) + '<span>' + escapeHtml(item.subtitle) + '</span></p><div class="nodes">' + nodes + '</div></div>'
    }
    function renderExchange(entry) {
      if (entry.local) return '<div class="local-exchange"><strong>Không có HTTP mới</strong><div class="local-result">✓ ' + escapeHtml(entry.response) + '</div><div class="local-result">→ ' + escapeHtml(entry.frontendReceiver) + '</div>' + (entry.failure ? '<div class="failure-line">✕ ' + escapeHtml(entry.failure) + '</div>' : '') + '</div>'
      return '<div class="exchange"><div class="request-line">' + escapeHtml(entry.request) + ' ──▶</div><div class="receiver"><strong>Hàm Backend nhận</strong> · ' + escapeHtml(entry.backendReceiver) + '</div><div class="response-line">◀── ✓ Thành công · ' + escapeHtml(entry.response) + '</div><div class="receiver"><strong>Frontend nhận</strong> · ' + escapeHtml(entry.frontendReceiver) + '</div>' + (entry.failure ? '<div class="failure-line">✕ Không hợp lệ/lỗi · ' + escapeHtml(entry.failure) + '</div>' : '') + '</div>'
    }
    function renderBridge(entries, last) {
      return '<div class="bridge-cell' + (last ? ' last' : '') + '">' + (entries || []).map(renderExchange).join('') + '</div>'
    }
    function renderDiagram() {
      const item = currentCase()
      const rowCount = Math.max(item.frontend.length, item.backend.length, item.exchanges.length)
      let map = '<div class="system-map"><div class="lane-head frontend"><span>Frontend</span><small>React / TypeScript</small></div><div class="bridge-head">Request sang →<br>← Response về</div><div class="lane-head backend"><span>Backend</span><small>Spring Boot / Database</small></div>'
      for (let index = 0; index < rowCount; index += 1) {
        const last = index === rowCount - 1
        map += renderRow(item.frontend[index], 'frontend', last)
        map += renderBridge(item.exchanges[index], last)
        map += renderRow(item.backend[index], 'backend', last)
      }
      map += '</div>'
      document.getElementById('title').textContent = item.short + ' · ' + item.title
      document.getElementById('diagram').innerHTML = map
      document.querySelectorAll('.node[data-source]').forEach((button) => button.addEventListener('click', () => selectSource(button.dataset.source)))
    }
    function renderFlow() {
      const item = currentCase()
      document.getElementById('step-count').textContent = item.steps.length + ' bước'
      document.getElementById('flow').innerHTML = item.steps.map((entry, index) => '<button type="button" class="flow-step ' + (index === state.stepIndex ? 'active' : '') + '" data-step="' + index + '"><span class="flow-num">' + (index + 1) + '.</span><span><span class="flow-title">' + escapeHtml(entry.title) + '</span><span class="flow-pseudo">' + escapeHtml(entry.pseudo) + '</span><span class="flow-meta">' + escapeHtml(entry.meta) + '</span></span></button>').join('')
      document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => selectStep(Number(button.dataset.step))))
    }
    function renderDetail() {
      const selectedStep = currentStep()
      const diagramNode = state.sourceOverride ? findDiagramNode(state.sourceOverride) : null
      const selected = diagramNode
        ? { source: state.sourceOverride, title: diagramNode.methods.join(' → '), pseudo: diagramNode.result, note: DATA.sourceNotes[state.sourceOverride] || (diagramNode.result + '. Các symbol trực tiếp trong ô: ' + diagramNode.methods.join(', ') + '. Dòng tô vàng là nơi nhận dữ liệu, gọi dependency hoặc tạo giá trị chuyển sang ô kế tiếp.') }
        : selectedStep
      const source = DATA.sources[selected.source]
      const lines = source.code.split('\n')
      const code = lines.map((line, offset) => {
        const number = source.start + offset
        const highlighted = number >= source.highlightStart && number <= source.highlightEnd
        return '<div class="code-line' + (highlighted ? ' highlight' : '') + '" data-line="' + number + '"><span class="line-number">' + number + '</span><span class="line-code">' + (line ? escapeHtml(line) : ' ') + '</span></div>'
      }).join('')
      document.getElementById('detail').innerHTML = '<div class="source-head"><div><h3 class="source-symbol">' + escapeHtml(source.symbol) + '</h3><div class="source-path">' + escapeHtml(source.file) + ':' + source.start + '–' + source.end + '</div></div><span class="scope">' + escapeHtml(source.scope) + '</span></div><div class="code-window" tabindex="0">' + code + '</div><div class="code-explanation"><div class="explain-row"><strong>Hàm / điểm vào</strong><span>' + escapeHtml(selected.title) + '</span></div><div class="explain-row"><strong>Đường gọi</strong><span>' + escapeHtml(selected.pseudo) + '</span></div><div class="explain-row"><strong>Xử lý và kết quả</strong><span>' + escapeHtml(selected.note) + '</span></div><div class="explain-row"><strong>Đoạn liên quan</strong><span>Dòng ' + source.highlightStart + '–' + source.highlightEnd + ' được tô vàng; phần còn lại giữ nguyên để thấy import, kiểu dữ liệu, class hoặc hàm bao quanh.</span></div></div>'
      const codeWindow = document.querySelector('.code-window')
      const first = codeWindow && codeWindow.querySelector('.code-line.highlight')
      if (codeWindow && first) codeWindow.scrollTop = Math.max(0, first.offsetTop - codeWindow.offsetTop - codeWindow.clientHeight / 3)
    }
    function render() { renderTabs(); renderDiagram(); renderFlow(); renderDetail() }
    window.addEventListener('hashchange', () => {
      const index = DATA.useCases.findIndex((item) => '#' + item.id === location.hash)
      if (index >= 0 && index !== state.caseIndex) { state.caseIndex = index; state.stepIndex = 0; state.sourceOverride = null; render() }
    })
    render()
  </script>
</body>
</html>`

fs.writeFileSync(output, html.replace('%%DATA%%', payload), 'utf8')
console.log(`Generated ${path.relative(root, output)} with ${useCases.length} use cases and ${Object.keys(sources).length} source views.`)
