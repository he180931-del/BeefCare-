# FE-01 — Kịch bản kiểm thử tích hợp/E2E thủ công cho xác thực

Trạng thái: sổ tay WBS13 dành cho kiểm thử runtime/E2E thủ công. Các kịch bản đang ở trạng thái `manual-to-run`, nghĩa là người kiểm thử cần thực hiện; tài liệu này là hướng dẫn thao tác, không phải bằng chứng rằng các kịch bản đã chạy thành công.

## 1. Quy tắc an toàn, môi trường và bằng chứng

1. Dùng bản build tích hợp cuối cùng, gồm backend, proxy frontend, hộp thư thử nghiệm và cơ sở dữ liệu PostgreSQL có thể xóa bỏ. Chỉ dùng tài khoản giả dành riêng cho kiểm thử, ví dụ `e2e-<lần-chạy>-<mã-kịch-bản>@example.test`. Không dùng người thật, tài khoản production hoặc địa chỉ email thật.
2. Chạy mọi kịch bản giao diện ở cả hai kích thước bắt buộc: iPad ngang `1180x820` và desktop `1440x900`. Khi so sánh hai kích thước, phải giữ nguyên trình duyệt, bản build/checkpoint, seed dữ liệu, route và trạng thái tài khoản.
3. Lưu mật khẩu và giá trị dùng một lần trong trình quản lý bí mật của người kiểm thử hoặc chỉ sinh trong bộ nhớ. Không đưa chúng vào ảnh chụp, log, ticket, tên file, manifest hoặc tài liệu này. Trong bằng chứng, thay mọi giá trị bí mật bằng `<đã-che>`.
4. Không ghi lại token reset/kích hoạt/lời mời/OAuth, cookie, `JSESSIONID`, giá trị CSRF, session ID, authorization code hoặc dữ liệu cá nhân thật. Chỉ ghi trạng thái như “đã có cookie”, “session đã xoay”, “token được chấp nhận” hoặc “token bị từ chối”.
5. Mỗi lần chạy chỉ ghi: mã kịch bản, ngày giờ, bản build/checkpoint, kích thước màn hình, trình duyệt, nhãn tài khoản giả, kết quả mong đợi/thực tế, HTTP status/mã lỗi, route, ảnh chụp hoặc accessibility snapshot đã che dữ liệu, tóm tắt console/network đã loại bí mật, kết quả kiểm tra DB/email, kết quả dọn dữ liệu và trạng thái Đạt/Không đạt/Bị chặn.
6. “Runtime/E2E thủ công” nghĩa là người kiểm thử trực tiếp thao tác trên trình duyệt và thu thập bằng chứng. “Kiểm thử tự động tham chiếu” chỉ là kiểm thử hỗ trợ một lớp của cùng hợp đồng, không được coi là bằng chứng E2E xuyên suốt frontend–backend.

## 2. Mẫu biên bản dùng lại

Sao chép khối sau cho từng lần chạy. Để trống phần kết quả cho đến khi thực hiện xong.

```text
Kịch bản: FE01-M## — <tên kịch bản>
Hình thức: Runtime/E2E thủ công | Kiểm thử tự động tham chiếu
Nguồn: FE-01 UC/GBR/SCR hoặc quyết định <tham chiếu>
Bản build/checkpoint:
Kích thước: 1180x820 | 1440x900
Trình duyệt:
Nhãn tài khoản giả:
Điều kiện trước/dữ liệu:
Các bước đã thực hiện:
Route/giao diện mong đợi:
HTTP/status/mã lỗi mong đợi:
Session/cookie mong đợi (chỉ mô tả có/không hoặc đã xoay):
Ảnh hưởng DB/email mong đợi:
Kết quả thực tế:
Đường dẫn bằng chứng đã che dữ liệu:
Dọn dữ liệu:
Kết quả: Đạt | Không đạt | Bị chặn
Ghi chú/liên kết lỗi:
```

## 3. Danh mục kịch bản

### FE01-M01 — Đăng ký bằng email, kích hoạt, hoàn tất hồ sơ Chủ trại và đăng nhập

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.registerVerifyByEmailSignInProfileAndSignOutWithCsrf`.

Điều kiện trước/dữ liệu:

- Email giả chưa tồn tại.
- Mật khẩu hợp lệ từ 8–128 điểm mã Unicode, được giữ ngoài bằng chứng; xác nhận mật khẩu khớp.
- Đồng ý điều khoản.
- Bắt đầu tại `/dang-ky` ở cả hai kích thước màn hình.

Các bước thực hiện:

1. Lấy CSRF qua luồng trình duyệt bình thường; nhập email có khoảng trắng hai đầu hoặc trộn chữ hoa/thường rồi gửi form đăng ký.
2. Xác nhận giao diện hiển thị trạng thái chờ xác minh và không làm lộ mật khẩu, hash hoặc token.
3. Mở link xác minh từ hộp thư thử nghiệm trong một browser context mới; không sao chép token thô vào bằng chứng.
4. Hoàn tất đăng ký Chủ trại bằng dữ liệu hồ sơ giả hợp lệ và trạng thái điều khoản phù hợp.
5. Mở context mới, đăng nhập và truy cập trang tài khoản/hồ sơ.

Kết quả mong đợi:

- Đăng ký trả `201`; kích hoạt chuyển hướng bằng `303`; đăng nhập trả `204`.
- Chỉ sau khi đăng nhập, trình duyệt mới có session đã xác thực.
- DB có đúng một user/tài khoản đã kích hoạt; response không chứa credential.
- Có đúng email xác minh dự kiến.
- Hoàn tất hồ sơ Chủ trại không tự tạo trại.
- Dọn dữ liệu: xóa tài khoản giả, email, session và các dòng DB thử nghiệm.

### FE01-M02 — Đăng nhập thành công khi không có trại hoặc có nhiều trại hoạt động

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: các trường hợp chọn trại trong `sessionRoles.test.tsx` và `AppRoutes.test.tsx`.

Điều kiện trước/dữ liệu: tài khoản giả đã xác minh, thuộc một trong hai trường hợp: không có trại `ACTIVE`, hoặc có từ hai trại `ACTIVE` trở lên; tab hiện tại chưa chọn trại.

Các bước thực hiện:

1. Đăng nhập thành công từ `/dang-nhap`.
2. Quan sát route sau đăng nhập và mở màn hình chọn trại.
3. Với trường hợp nhiều trại, chọn một trại `ACTIVE` mà tài khoản có quyền truy cập và quan sát route tiếp theo.

Kết quả mong đợi:

- Đăng nhập trả `204`.
- Khi không có đúng một trại `ACTIVE`, route sau đăng nhập là `/chon-trai`.
- Giao diện chỉ liệt kê các trại có thể truy cập và giữ đúng phân hệ người dùng đã yêu cầu.
- Trại được chọn chỉ là lựa chọn của tab hiện tại; DB/session không tự sinh trại mặc định.
- Dọn dữ liệu: xóa lựa chọn trại khỏi storage và xóa trại/tài khoản thử nghiệm.

### FE01-M03 — Đăng nhập thành công khi có đúng một trại hoạt động

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: trường hợp trang chủ theo trại trong `sessionRoles.test.tsx` và trường hợp chỉ có một trại `ACTIVE` trong `SetupPages.test.tsx`.

Điều kiện trước/dữ liệu: tài khoản giả Chủ trại/Quản lý/Kỹ thuật viên đã xác minh, có đúng một trại `ACTIVE` và không có lựa chọn trại cũ gây xung đột.

Các bước thực hiện:

1. Đăng nhập trong một browser context mới.
2. Quan sát chuyển hướng và mở một trang thuộc phạm vi trại.

Kết quả mong đợi:

- Đăng nhập trả `204`.
- Hệ thống mở trực tiếp trang chủ phù hợp vai trò của trại duy nhất, ví dụ `/tong-quan` hoặc `/kt`.
- Không xuất hiện bước chọn trại lần hai.
- Vai trò trong session khớp vai trò tại trại.
- Dọn dữ liệu: xóa trại/tài khoản và dữ liệu tab.

### FE01-M04 — Email không tồn tại và mật khẩu sai trả cùng một lỗi công khai

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.wrongPasswordsLockPasswordSignInForFifteenMinutesWithoutRevealingWhichValueIsWrong`.

Điều kiện trước/dữ liệu: một tài khoản giả đang `ACTIVE` và đã xác minh; một context khách mới có CSRF; một email giả không tồn tại.

Các bước thực hiện:

1. Gửi email không tồn tại cùng một mật khẩu giả.
2. Trong cùng context, gửi email đã tồn tại cùng mật khẩu sai.
3. Sau mỗi lần thất bại, gọi `/api/account/profile` hoặc mở trang được bảo vệ.

Kết quả mong đợi:

- Cả hai lần đều trả `401 MSG-FE01-01` với cùng thông báo công khai và cùng cấu trúc `params`.
- Giao diện vẫn ở `/dang-nhap` và hiển thị lỗi chung, không cho biết email hay mật khẩu sai.
- Không tạo security context hoặc session đã xác thực; profile tiếp tục trả `401`.
- Chỉ tài khoản đã tồn tại bị tăng bộ đếm sai một lần.
- Dọn dữ liệu: xóa tài khoản và session thử nghiệm.

### FE01-M05 — Gửi lại xác minh, chỉ link mới nhất hợp lệ, cooldown và quota

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.verificationLinkCanBeResentAndOnlyTheNewestLinkWorks` và các trường hợp resend/quota trong `AccountLinkTokenIssuancePostgresIT`.

Điều kiện trước/dữ liệu: tài khoản vừa đăng ký nhưng chưa xác minh; hộp thư thử nghiệm; đồng hồ kiểm thử hoặc fixture cho phép tăng tuổi link.

Các bước thực hiện:

1. Yêu cầu gửi lại email xác minh một lần; kiểm tra thông báo/thời điểm cooldown nhưng không làm lộ giá trị nhạy cảm trong bằng chứng.
2. Sau khoảng chờ cho phép, yêu cầu link thứ hai; mở link cũ rồi mở link mới nhất trong các context mới.
3. Thực hiện yêu cầu thứ sáu trong một giờ và quan sát phản hồi quota/cooldown chung.

Kết quả mong đợi:

- Resend trả `200` và có ngữ nghĩa `nextAllowedAt`.
- Link cũ chuyển tới trạng thái không hợp lệ/hết hạn; link mới nhất kích hoạt thành công.
- Tối đa năm email/job xác minh cho mỗi email trong một giờ.
- DB chỉ còn token mới nhất chưa dùng theo đúng hợp đồng; UI/log không lộ token.
- Dọn dữ liệu: consume hoặc xóa link/job còn lại và xóa tài khoản.

### FE01-M06 — Sai mật khẩu năm lần, khóa đăng nhập và vẫn cho phép Google

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.wrongPasswordsLockPasswordSignInForFifteenMinutesWithoutRevealingWhichValueIsWrong` và kiểm thử đăng nhập Google.

Điều kiện trước/dữ liệu: tài khoản mật khẩu đang `ACTIVE` và đã xác minh; danh tính Google thử nghiệm đã liên kết hoặc provider sandbox; các context mới.

Các bước thực hiện:

1. Nhập sai mật khẩu bốn lần, sau đó nhập sai lần thứ năm.
2. Thử đăng nhập bằng mật khẩu khi đang bị khóa.
3. Thử đăng nhập Google hợp lệ trong lúc đăng nhập mật khẩu bị khóa.
4. Sau khi hết thời gian khóa trong môi trường test, đăng nhập bằng mật khẩu đúng.

Kết quả mong đợi:

- Bốn lần đầu trả `401 MSG-FE01-01`.
- Lần thứ năm và các lần trong thời gian khóa trả `423 MSG-FE01-02`, kèm ngữ nghĩa thời điểm mở khóa.
- Bộ đếm sai chính xác là năm; không mất lần tăng khi có request đồng thời.
- Google vẫn dùng được nếu tài khoản đã liên kết.
- Đăng nhập đúng sau khi hết hạn khóa sẽ xóa bộ đếm.
- Dọn dữ liệu: xóa session, trạng thái khóa, fixture nhà cung cấp và tài khoản.

### FE01-M07 — Reset mật khẩu chung, link hợp lệ/hết hạn/dùng lại và thu hồi session

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.forgottenPasswordIsGenericSingleUseThirtyMinutesAndEndsAllSessions` và các test reset-token.

Điều kiện trước/dữ liệu: tài khoản đã biết có hai session đang hoạt động; một email không tồn tại; hộp thư và đồng hồ thử nghiệm.

Các bước thực hiện:

1. Yêu cầu reset cho email đã biết và email không tồn tại từ hai context khách riêng.
2. So sánh giao diện/status mà không làm lộ việc tài khoản có tồn tại hay không.
3. Dùng link hợp lệ một lần, gửi mật khẩu mới hợp lệ và xác nhận khớp; sau đó dùng lại chính link đó.
4. Thử một link đã hết hạn và một link không hợp lệ.
5. Kiểm tra hai session cũ; thử đăng nhập bằng mật khẩu cũ và mật khẩu mới.

Kết quả mong đợi:

- Reset-init luôn trả `200` chung cho email tồn tại/không tồn tại.
- Tài khoản có mật khẩu nhận reset-link mail; tài khoản chỉ Google nhận email hướng dẫn Google không có reset token; email không tồn tại không tạo mail.
- Reset thành công trả `200`; link chỉ dùng một lần.
- Link hết hạn/dùng lại/không hợp lệ bị từ chối và không đổi mật khẩu.
- Tất cả session cũ bị thu hồi; mật khẩu cũ thất bại, mật khẩu mới thành công.
- Token reset không nằm trong browser storage hoặc bằng chứng.
- Dọn dữ liệu: xóa user, token, mail job và session.

### FE01-M08 — Đổi mật khẩu giữ session hiện tại và thu hồi các session khác

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.changingThePasswordKeepsThisSessionEndsTheOthersAndMailsTheOwner`.

Điều kiện trước/dữ liệu: tài khoản đã xác minh, đang đăng nhập ở hai browser context và có hộp thư thử nghiệm.

Các bước thực hiện:

1. Lần lượt gửi request thiếu/sai CSRF và request có mật khẩu hiện tại sai.
2. Gửi mật khẩu hiện tại đúng, mật khẩu mới hợp lệ và xác nhận khớp.
3. Kiểm tra profile ở cả hai context; sau đó thử mật khẩu cũ và mới trong context thứ ba.

Kết quả mong đợi:

- Thiếu CSRF bị từ chối.
- Dữ liệu không hợp lệ trả đúng mã `MSG-FE01-*` và không đổi hash.
- Đổi thành công trả `200`; session hiện tại còn dùng được, session còn lại trả `401`.
- Mật khẩu cũ thất bại, mật khẩu mới thành công.
- Gửi đúng một email thông báo đổi mật khẩu, không chứa mật khẩu/hash.
- DB lưu hash Argon2id chỉ khớp mật khẩu mới.
- Dọn dữ liệu: xóa tài khoản, session và email.

### FE01-M09 — Thêm mật khẩu cho tài khoản chỉ Google, xác minh lại và chống giả mạo query

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `GoogleReauthenticationIT`, `GoogleOidcSuccessHandlerTest` và `BrowserSessionFlowIT.googleReauthenticationQueryCannotAuthorizePasswordChange`.

Điều kiện trước/dữ liệu: một tài khoản chỉ Google và một tài khoản Google có mật khẩu trong provider sandbox; có thể điều khiển đồng hồ server hoặc dùng khoảng kiểm thử ngắn; các context mới.

Các bước thực hiện:

1. Thử thêm/đổi mật khẩu khi chưa có bằng chứng Google gần đây.
2. Bắt đầu xác minh lại Google từ route tài khoản được phép và hoàn tất luồng provider.
3. Gửi thao tác thêm/đổi mật khẩu trong vòng năm phút; sau đó thử lại khi proof đã hết hạn.
4. Chỉ thêm `googleReauthenticated=true` vào URL rồi gọi đổi mật khẩu, nhưng không có proof phía server.

Kết quả mong đợi:

- Request không có proof bị từ chối.
- OIDC thành công làm xoay session và lưu proof phía server.
- Proof chỉ cho phép thao tác mật khẩu dự kiến trong cửa sổ năm phút, bao gồm đúng mốc 300 giây theo hợp đồng.
- Proof hết hạn bị từ chối; query flag một mình không có quyền đổi mật khẩu.
- Khi bị từ chối, mật khẩu/session lưu trữ không thay đổi.
- Server bỏ qua `returnTo` từ client và dùng đường về nội bộ `/tai-khoan`.
- Dọn dữ liệu: xóa danh tính provider, session, tài khoản và email.

### FE01-M10 — Lần đăng nhập Google đầu tiên phải chấp thuận điều khoản

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: các trường hợp điều khoản/tài khoản tạm ngưng trong `GoogleOidcSuccessHandlerTest` và test luồng tài khoản.

Điều kiện trước/dữ liệu: danh tính Google mới chưa chấp thuận điều khoản và một danh tính khác đã chấp thuận; provider sandbox.

Các bước thực hiện:

1. Hoàn tất đăng nhập Google lần đầu khi chưa đồng ý điều khoản.
2. Quan sát route điều khoản và gọi thử một API nghiệp vụ được bảo vệ trước khi chấp thuận.
3. Chấp thuận điều khoản, hoàn tất hồ sơ Chủ trại nếu cần và đăng nhập lại.

Kết quả mong đợi:

- Lần đầu chuyển tới `/chap-nhan-dieu-khoan`.
- API nghiệp vụ bị chặn cho đến khi trạng thái tài khoản bắt buộc hoàn tất; session vẫn tồn tại cho các API được allowlist.
- Sau khi đồng ý/hoàn tất hồ sơ, điểm đến tuân theo chính sách tài khoản/trại.
- Không tự tạo mật khẩu.
- Dọn dữ liệu: xóa fixture provider, tài khoản và session.

### FE01-M11 — Remember-me, thời gian không hoạt động và giới hạn tuyệt đối của session

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `RememberedSessionAbsoluteExpiryIT`.

Điều kiện trước/dữ liệu: một tài khoản, có thể điều khiển đồng hồ, hai context mới; một lần đăng nhập thường và một lần bật “Ghi nhớ đăng nhập”.

Các bước thực hiện:

1. Đăng nhập một lần không bật “Ghi nhớ đăng nhập” và một lần có bật.
2. Tăng thời gian tới các mốc không hoạt động rồi gọi profile.
3. Với session được ghi nhớ, gửi request đã xác thực trước hạn tuyệt đối, lặp hoạt động nhiều lần, rồi gửi request tại/sau hạn tuyệt đối.

Kết quả mong đợi:

- Session thường tuân theo thời gian không hoạt động 8 giờ.
- Session ghi nhớ có thời gian không hoạt động 30 ngày và giới hạn tuyệt đối 30 ngày kể từ khi tạo.
- Hoạt động không kéo dài hạn tuyệt đối.
- Tại hoặc sau hạn tuyệt đối, filter vô hiệu session/xóa context và API được bảo vệ trả `401`.
- Session thường không bị áp giới hạn absolute của remember-me.
- Dọn dữ liệu: vô hiệu cả hai session.

### FE01-M12 — Đăng xuất xóa session và trại đang chọn

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.registerVerifyByEmailSignInProfileAndSignOutWithCsrf` và các trường hợp farm/session trong `AppRoutes.test.tsx`.

Điều kiện trước/dữ liệu: tài khoản đã đăng nhập và đã chọn trại trong tab hiện tại.

Các bước thực hiện:

1. Mở trang tài khoản/trại được bảo vệ và xác nhận giao diện đang hiển thị trại đã chọn.
2. Gửi logout không có CSRF, sau đó gửi lại với CSRF hợp lệ.
3. Truy cập lại API/trang được bảo vệ và tải lại ứng dụng.

Kết quả mong đợi:

- Logout thiếu CSRF bị từ chối, session vẫn dùng được.
- Logout hợp lệ trả `204`, xóa trạng thái xác thực/cookie và trại đang chọn.
- Profile được bảo vệ trả `401`.
- Giao diện trở về trạng thái khách/đăng nhập và không tái sử dụng trại cũ.
- Dọn dữ liệu: xóa tài khoản, session và storage.

### FE01-M13 — Hành vi của tài khoản bị tạm ngưng

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `BrowserSessionFlowIT.suspendedAccountsAndGoogleOnlyAccountsAreRefusedPasswordSignIn` và các test reset/Google.

Điều kiện trước/dữ liệu: tài khoản đã chuyển sang `SUSPENDED`, có mật khẩu và danh tính Google liên kết; có một session cũ nếu cần kiểm tra active-account guard.

Các bước thực hiện:

1. Thử đăng nhập bằng mật khẩu và Google.
2. Yêu cầu reset mật khẩu.
3. Dùng session cũ để gọi profile và API nghiệp vụ được bảo vệ.

Kết quả mong đợi:

- Đăng nhập bị chặn bằng ngữ nghĩa tài khoản tạm ngưng, cụ thể `403 MSG-FE01-03` khi áp dụng.
- Session cũ bị active-account guard từ chối.
- Reset vẫn trả phản hồi chung và có thể thực hiện theo FE-01, nhưng reset không làm tài khoản `SUSPENDED` đăng nhập được.
- Không API nghiệp vụ trái phép nào thành công.
- Dọn dữ liệu: khôi phục hoặc xóa tài khoản giả, provider data và session.

### FE01-M14 — Thiếu hoặc sai CSRF trên các thao tác thay đổi trạng thái

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: các assertion đăng ký/logout/đổi mật khẩu/reset trong `BrowserSessionFlowIT` và kiểm tra transport trong `authApiContract.test.ts`.

Điều kiện trước/dữ liệu: context khách và context đã đăng nhập; CSRF hợp lệ chỉ giữ trong bộ nhớ.

Các bước thực hiện:

1. Bỏ header CSRF khi gọi đại diện các thao tác đăng ký, gửi lại xác minh, hoàn tất reset, đổi mật khẩu và logout.
2. Sau khi session xoay, gửi CSRF cũ hoặc không khớp.
3. Lặp lại bằng CSRF hiện tại hợp lệ.

Kết quả mong đợi:

- Request thay đổi trạng thái không có CSRF hợp lệ bị từ chối, thông thường là `403`.
- DB/session/mail không thay đổi khi request bị chặn.
- Request có CSRF đúng đi tới status nghiệp vụ đã định nghĩa.
- Giao diện giữ trạng thái an toàn hiện tại và chỉ hiển thị lỗi không chứa bí mật.
- Dọn dữ liệu: xóa các dòng test và session.

### FE01-M15 — Đường quay lại nội bộ và chống open redirect

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: `SetupPages.test.tsx`, `AppRoutes.test.tsx`, test Google return-path và các test kích hoạt/lời mời.

Điều kiện trước/dữ liệu: các context khách, đã đăng nhập, lời mời, kích hoạt và OAuth sandbox. Chuẩn bị đường quay lại gồm: route nội bộ an toàn; route chi tiết cần rút gọn về phân hệ; URL bắt đầu `//`; URL HTTPS bên ngoài.

Các bước thực hiện:

1. Truyền đường quay lại an toàn qua đăng nhập, kích hoạt, lời mời, chọn trại và bắt đầu Google re-auth.
2. Lặp lại với URL bên ngoài và URL dạng protocol-relative.
3. Hoàn tất luồng, kiểm tra header `Location` và route cuối.

Kết quả mong đợi:

- Đường nội bộ an toàn chỉ trở về route được phép.
- Route chi tiết được chuẩn hóa về phân hệ nếu hợp đồng yêu cầu.
- URL ngoài/protocol-relative bị bỏ qua hoặc thay bằng route mặc định an toàn.
- Không chuyển hướng ra ngoài origin của ứng dụng.
- Query flag chỉ phục vụ UX, không bao giờ là bằng chứng cấp quyền phía backend.
- Riêng Google re-auth, server bỏ qua `returnTo` client và dùng `/tai-khoan` cố định.
- Dọn dữ liệu: xóa token chờ, session state và email.

### FE01-M16 — Kiểm tra responsive, focus, bàn phím, dán dữ liệu và điều khiển mật khẩu

Hình thức: Runtime/E2E thủ công. Kiểm thử tự động tham chiếu: các unit test giao diện xác thực liên quan. Đây không phải kiểm thử visual regression tự động.

Điều kiện trước/dữ liệu: các màn hình đăng nhập, đăng ký, khôi phục và đổi mật khẩu với dữ liệu giả; bật accessibility tree và ghi console.

Thực hiện ở cả `1180x820` và `1440x900`:

1. Dùng phím Tab đi qua toàn bộ trường/nút; kiểm tra focus nhìn thấy rõ và thứ tự hợp lý.
2. Dán giá trị giả hợp lệ/không hợp lệ vào từng trường mật khẩu; dùng nút hiện/ẩn mật khẩu.
3. Kích hoạt trạng thái validation, loading, lỗi chung và thành công mà không sao chép bí mật vào bằng chứng.
4. Kiểm tra tràn ngang/dọc, heading, label và thông báo lỗi/live region.

Kết quả mong đợi:

- Không có tràn ngang ngoài ý muốn.
- Label và lỗi xác định đúng trường.
- Người dùng bàn phím tiếp cận được mọi điều khiển.
- Nút hiện/ẩn giữ nguyên giá trị và không đưa mật khẩu vào log.
- Route thành công/thất bại và vị trí focus dễ sử dụng ở cả hai kích thước.
- Bằng chứng ảnh/accessibility/console không chứa credential hoặc token.
- Dọn dữ liệu: đóng tab, xóa session và storage.

## 4. Thứ tự chạy và đối chiếu kiểm thử tự động

Nên chạy các kịch bản quan trọng theo thứ tự: M01, M02/M03, M04, M05, M06, M07, M08, M09, M12, sau đó M10/M11/M13–M16. Với mỗi biên bản, đánh dấu Đạt/Không đạt/Bị chặn và gắn bằng chứng đã che dữ liệu.

Các test tự động sau chỉ là bằng chứng theo từng lớp:

- Vòng đời backend và luồng lỗi: `BrowserSessionFlowIT`, `AuthenticateControllerIT`, `EmailActivationFlowIT`, `GoogleReauthenticationIT`, `GoogleOidcSuccessHandlerTest`, `RememberedSessionAbsoluteExpiryIT`.
- Adapter/session/điểm đến frontend: `authApiContract.test.ts`, `sessionRoles.test.tsx`, `AppRoutes.test.tsx`, `SetupPages.test.tsx` và các unit test xác thực liên quan.
- Các bộ test này không tạo thành một hành trình trình duyệt tự động duy nhất xuyên frontend và backend. Bằng chứng runtime/E2E thủ công phải ghi rõ bản build, route, kích thước, trình duyệt và quan sát đã che dữ liệu.
