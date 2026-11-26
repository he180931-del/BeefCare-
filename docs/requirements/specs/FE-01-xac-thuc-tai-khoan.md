# SPEC FE-01 – Xác thực và truy cập tài khoản

| | |
|---|---|
| Feature | FE-01 Authentication and Account Access |
| Use case | UC-FE01-01 → UC-FE01-06 |
| Người phụ trách | LamKD (BE + FE + test) · Review BE: DucNV · Review FE: AnNT |
| Nguồn yêu cầu và bằng chứng | SRS Report 3 bản 28/10/2026: Part I §3.2 (User Account), §3.3 (BR-D02, BR-D03), Part II §1, Part III §1 (SCR-02 → SCR-08, popup Đổi mật khẩu), bảng MSG, GBR-01 → GBR-05, GBR-09, GBR-87; API-04, API-05; quyết định D05–D07, D12, D34/K12, D49, D56–D57; runtime/OpenAPI và evidence FE-01 stability 24/11/2026 |
| Trạng thái | ĐÃ CHỐT 24/11/2026 – contract FE-01 cuối; nguồn yêu cầu nền là SRS 28/10 (D12), các quyết định không mâu thuẫn và các ràng buộc runtime/OpenAPI đã kiểm chứng |

> **Nguyên tắc của bộ spec này:** yêu cầu nghiệp vụ lấy từ SRS 28/10 và các quyết định đã chốt, mỗi dòng ghi rõ nguồn. Code, OpenAPI, persistence và test chỉ là bằng chứng xác nhận conformance hoặc ghi nhận contract gap; chúng không thay thế nguồn yêu cầu. Spec không suy ra yêu cầu mới từ giao diện đã sinh.
> Nhãn tiếng Việt trên màn hình là đề xuất; khi làm, đối chiếu lại với Figma tab 01.
> Chỗ nào SRS không nói thì ghi ở mục 10 "Điểm SRS chưa rõ", không tự bịa.

## 0. Thứ tự nguồn và các điểm lệch đã xử lý

Thứ tự quyết định cho spec này là: (1) `docs/REQUIREMENT_DECISIONS.md`, trong đó D12 chọn SRS 28/10 và 23 spec làm nguồn yêu cầu; (2) `docs/requirements/SRS_2026-10-28.txt` và các phần/UC/GBR/SCR/MSG được dẫn trong spec là nguồn quy phạm; (3) `docs/api/openapi.json`, DTO/validator và response runtime là bằng chứng contract/conformance, không override SRS; (4) code, persistence readback và test evidence xác nhận triển khai; (5) Figma chỉ cho cách trình bày. `docs/superpowers/specs/2026-11-23-fe01-auth-stability-design.md`, plan, minimal matrix và handbook là bằng chứng triển khai, không thay thế SRS. Nếu tầng bằng chứng lệch nguồn quy phạm, phải ghi contract gap và sửa triển khai/tài liệu tương ứng.

Các lệch đã được giải quyết: mật khẩu tạo/đặt lại/đổi là 8–128 **điểm mã Unicode**, không trùng email (không phân biệt hoa thường), confirmation phải khớp và không có luật bắt buộc hoa/thường/số/ký hiệu; mật khẩu đăng nhập là trường bắt buộc, tối đa 128 điểm mã và là chính sách riêng (không suy ra min-8 của tạo/reset). Schema `LoginVM` runtime hiện có ràng buộc transport `minLength: 4`; đây không phải yêu cầu chính sách tạo/reset và không được dùng để thêm luật composition. Hash mới là Argon2id, bcrypt cũ vẫn xác minh được, cột DB đủ 255 ký tự. Các quyết định D05–D07, D49, D56–D57 được giữ nguyên.

Audit FE-01 cho đổi/đặt lại mật khẩu là **N/A, ngoài phạm vi** theo D34/K12; spec không tạo mã audit, không yêu cầu sanitizer audit mới và không tuyên bố đã kiểm audit cho các thao tác này.

---

## 1. Phạm vi

| UC | Tên | Tác nhân chính | Màn hình |
|---|---|---|---|
| UC-FE01-01 | Đăng ký tài khoản Chủ trại | Khách | SCR-01, SCR-03, SCR-04, SCR-07 |
| UC-FE01-02 | Đăng nhập | Khách | SCR-02, SCR-09 |
| UC-FE01-03 | Đăng xuất | Mọi người đã đăng nhập | Menu người dùng trên thanh trên cùng |
| UC-FE01-04 | Xem và sửa hồ sơ của tôi | Mọi người đã đăng nhập | SCR-08 |
| UC-FE01-05 | Đặt lại mật khẩu đã quên | Khách | SCR-02, SCR-05, SCR-06 |
| UC-FE01-06 | Đổi mật khẩu / thêm mật khẩu đầu tiên | Mọi người đã đăng nhập | SCR-08, popup Đổi mật khẩu |

**Dịch vụ ngoài:** API-05 Đăng nhập Google (OAuth 2.0 / OpenID Connect), API-04 Gửi email.

**Ngoài phạm vi:** Đăng ký trại (UC-FE02-01, SCR-10), Chọn trại (SCR-09, FE-02), Chấp nhận lời mời (UC-FE03-04, SCR-15), Tạm ngưng / khôi phục tài khoản (UC-FE03-08, do System Admin).

---

## 2. Vai trò và quyền

| Hành động | Khách | Owner / Manager / Technician | CS / PM / SA | Nguồn |
|---|---|---|---|---|
| Đăng ký, đăng nhập, quên mật khẩu | Có | — | — | Role lists P435 |
| Đăng xuất, xem / sửa hồ sơ, đổi mật khẩu | — | Có | Có | Role lists P439–P459 |
| Tài khoản SUSPENDED | Không đăng nhập được bằng bất kỳ cách nào; phiên đang mở bị từ chối ở request kế tiếp | | | GBR-04 |
| Mọi request cần đăng nhập | Kiểm tra lại trạng thái tài khoản, membership, vai trò và trạng thái dịch vụ trại ở **mỗi** request | | | GBR-09 |

---

## 3. Dữ liệu (SRS Part I §3.2 – User Account)

### 3.1 Tài khoản người dùng (User Account)

| Thuộc tính | Kiểu | Bắt buộc | Ràng buộc | Nguồn |
|---|---|---|---|---|
| Họ tên (full name) | Chuỗi | Có | 2–100 ký tự | §3.2, SCR-03 |
| Email đã xác minh (email) | Chuỗi | Có | Định dạng email, ≤ 254 ký tự; **duy nhất toàn hệ thống, không phân biệt hoa thường** | §3.2, BR-D02, GBR-01 |
| Số điện thoại liên hệ (contact phone) | Chuỗi | Không | 10 chữ số bắt đầu bằng 0, hoặc `+84` + 9 chữ số. **Chỉ để liên hệ, không bao giờ dùng để định danh hay phân quyền** | §3.2, SCR-07, GBR-01 |
| Trạng thái (account status) | Enum | Có | `ACTIVE`, `SUSPENDED` | §3.2 |
| Đã hoàn tất đăng ký Owner | Boolean + thời điểm | Có | Mặc định `false` | §3.2, GBR-05 |
| Đã chấp nhận điều khoản | Boolean + thời điểm | Có trước khi dùng ứng dụng | Đăng ký email chấp thuận tại SCR-03; Google chấp thuận ở bước riêng theo D57 | SCR-03, SCR-07, GBR-05, D57 |
| Lần đăng nhập cuối | Thời điểm | Không | — | §3.2 |
| Thời điểm tạo | Thời điểm | Có | — | §3.2 |

**Vòng đời:** tạo `ACTIVE` ở lần đăng nhập Google đầu tiên, hoặc khi email đăng ký được xác minh. `ACTIVE ⇄ SUSPENDED` do System Admin, có lý do. **Không bao giờ xóa** khi đã có membership, trại hoặc lịch sử.

### 3.2 Phương thức đăng nhập (Sign-in Method – chi tiết của tài khoản)

| Thuộc tính | Kiểu | Ràng buộc | Nguồn |
|---|---|---|---|
| Loại | Enum `GOOGLE` / `PASSWORD` | Mỗi tài khoản tối đa 1 phương thức mỗi loại | §3.2 |
| Google subject | Chuỗi (chỉ GOOGLE) | Duy nhất; thuộc đúng 1 tài khoản; **không bao giờ gắn lại sang tài khoản khác** | §3.2, BR-D03 |
| Mật khẩu (hash) | Chuỗi (chỉ PASSWORD) | Chỉ lưu hash một chiều có salt; hash mới dùng Argon2id; bcrypt legacy (`$2a$`, `$2b$`, `$2y$`) chỉ dùng để xác minh trong giai đoạn chuyển đổi; không bao giờ hiển thị, ghi log hay trả về; cột lưu tối đa 255 ký tự | GBR-02, design §2/§5.3, migration `20261124000100` |
| Trạng thái mật khẩu | Enum | `PENDING_VERIFICATION` (sau đăng ký email) → `ACTIVE` (sau xác minh); bị thay khi đổi / đặt lại | §3.2 |
| Số lần sai liên tiếp | Số nguyên | Đặt về 0 khi đăng nhập đúng hoặc đặt lại mật khẩu | §3.2, GBR-02 |
| Khóa đến | Thời điểm | Sai 5 lần liên tiếp → khóa đăng nhập bằng mật khẩu 15 phút | GBR-02 |
| Thời điểm liên kết, lần dùng cuối | Thời điểm | — | §3.2 |

### 3.3 Liên kết qua email (token)

| Loại | Hiệu lực | Quy tắc | Nguồn |
|---|---|---|---|
| Xác minh email | 24 giờ | Ngẫu nhiên, dùng 1 lần, chỉ lưu hash; phát link mới làm link cũ cùng loại hết hiệu lực | GBR-03 |
| Đặt lại mật khẩu | 30 phút | Như trên | GBR-03 |
| Giới hạn gửi lại | Tối đa 5 email / giờ / địa chỉ; nút gửi lại khóa 60 giây sau mỗi lần gửi | SCR-04, UC-01 AF4, UC-05 AF2 |

### 3.4 Phiên đăng nhập (session)

| Thuộc tính | Giá trị | Nguồn |
|---|---|---|
| Không chọn "Ghi nhớ đăng nhập" | Hết hạn sau 8 giờ không hoạt động | UC-02 bước 4, SCR-02 |
| Chọn "Ghi nhớ đăng nhập" | Hết hạn sau 30 ngày không hoạt động **và** không bao giờ vượt quá 30 ngày kể từ lúc tạo phiên (absolute cap do server kiểm); hoạt động không gia hạn mốc absolute | UC-02 bước 4, SCR-02, design §5.5, `RememberedSessionAbsoluteExpiryIT` |
| Đăng xuất | Kết thúc phiên, xóa trại đang chọn trên thiết bị | UC-FE01-03 |
| Đổi mật khẩu | Giữ phiên hiện tại, kết thúc **các phiên khác** | UC-06 bước 4 |
| Đặt lại mật khẩu | Kết thúc **mọi** phiên | UC-05 bước 7 |

---

## 4. Quy tắc nghiệp vụ

Mỗi quy tắc viết thành câu kiểm được. Mã `R-01-xx` dùng để nối với test ở mục 9.

| Mã | Quy tắc | Nguồn |
|---|---|---|
| R-01-01 | Một người có đúng một tài khoản, định danh bằng email đã xác minh (không phân biệt hoa thường). Danh tính Google và mật khẩu BeefCare cùng email thuộc cùng một tài khoản. | GBR-01, BR-D02 |
| R-01-02 | Một Google subject thuộc đúng một tài khoản và không bao giờ được gắn lại sang tài khoản khác. | BR-D03 |
| R-01-03 | Mật khẩu tạo / đặt lại / đổi dài **8–128 điểm mã Unicode**, không được trùng email (không phân biệt hoa thường), confirmation phải khớp; không bắt buộc hoa, thường, số hoặc ký hiệu. | GBR-02; design §2; OpenAPI `RegistrationRequest`, `KeyAndPasswordVM`, `PasswordChangeDTO` |
| R-01-04 | Sai mật khẩu 5 lần liên tiếp → khóa đăng nhập bằng mật khẩu 15 phút; tăng bộ đếm, tạo khóa lần 5, reset khi đúng hoặc đặt lại phải là chuyển đổi nguyên tử, không mất cập nhật khi đồng thời. Đăng nhập Google vẫn dùng được. Sai mật khẩu hiện tại khi đổi mật khẩu cũng được tính. | GBR-02, UC-06 E1, `PasswordAttemptConcurrencyPostgresIT` |
| R-01-05 | Mật khẩu chỉ lưu dạng hash có salt; hash mới là Argon2id, bcrypt legacy được xác minh trong chuyển đổi; không hiển thị, không ghi log, không trả về trong bất kỳ response nào; không được cắt ngầm theo giới hạn bcrypt 72 byte. | GBR-02, design §5.3, `MigratingPasswordEncoderTest`, `PasswordHashPersistenceIT` |
| R-01-06 | Link xác minh hiệu lực 24 giờ, link đặt lại 30 phút; dùng 1 lần bằng compare-and-set nguyên tử; link mới vô hiệu link cũ cùng loại. Phát lại cùng địa chỉ/loại phải khóa theo danh tính trước khi kiểm cooldown, tối đa 5 email/giờ và cooldown 60 giây; lỗi gửi/lưu rollback toàn bộ thay đổi. | GBR-03, design §5.1, `AccountLinkTokenConsumptionPostgresIT`, `AccountLinkTokenIssuancePostgresIT` |
| R-01-07 | Yêu cầu đặt lại mật khẩu luôn trả cùng một phản hồi, dù email có tồn tại hay không. | GBR-03, UC-05 |
| R-01-08 | Chỉ tài khoản ACTIVE đăng nhập được. SUSPENDED bị chặn mọi phương thức; phiên đang mở bị từ chối ở request kế tiếp. Khôi phục tài khoản không khôi phục vai trò / membership đã thu hồi. | GBR-04 |
| R-01-09 | Tài khoản SUSPENDED vẫn đặt lại được mật khẩu, nhưng vẫn không đăng nhập được. | UC-05 E3 |
| R-01-10 | Khách chỉ trở thành Chủ trại khi hoàn tất đăng ký Owner (họ tên + chấp nhận điều khoản). Việc này **không** tạo trại, membership, vai trò platform hay gói dịch vụ. | GBR-05, UC-01 POST-3 |
| R-01-11 | Đăng nhập không bao giờ tự chấp nhận lời mời, khôi phục quyền đã thu hồi hay đổi gói dịch vụ. | UC-02 POST-2 |
| R-01-12 | Trại đang chọn trong trình duyệt, link, thông báo hay mã QR không bao giờ là bằng chứng quyền; quyền được kiểm lại ở mỗi request. | GBR-09 |
| R-01-13 | Thêm mật khẩu đầu tiên cho tài khoản chỉ dùng Google: phải có bằng chứng Google do server lưu trong session trong vòng **5 phút, tính cả đúng mốc 300 giây**; mật khẩu có hiệu lực ngay (email đã xác minh). Query `googleReauthenticated=true` hoặc claim/giá trị phía trình duyệt không phải bằng chứng. | UC-06 AF1, D07, design §5.3/§6, `GoogleReauthenticationIT`, `BrowserSessionFlowIT.googleReauthenticationQueryCannotAuthorizePasswordChange` |
| R-01-14 | Tài khoản chỉ dùng Google yêu cầu đặt lại mật khẩu: email gửi đi khuyên đăng nhập bằng Google, không tạo mật khẩu; mail advice dùng template `GOOGLE_SIGN_IN_ADVICE`, không có reset link/token, cùng quota 5 mail/giờ và job bỏ qua nếu mật khẩu đã được bật lúc gửi. | UC-05 AF1, D06 |
| R-01-15 | Lỗi gửi email hoặc lỗi lưu: không lưu dở dang bất kỳ phần nào (MSG-COM-02). | UC-01 E6, UC-05 E4, UC-06 E4 |
| R-01-16 | Tài khoản có phương thức Google và chưa chấp thuận điều khoản chỉ được đọc hồ sơ, lấy CSRF, chấp thuận và đăng xuất; API nghiệp vụ khác trả `403` + MSG-FE01-14 nhưng giữ phiên. Chấp thuận không tạo quyền hay hoàn tất Owner. | D57 |
| R-01-17 | Google re-authentication dùng state/nonce/PKCE và replay protection do Spring Security/OIDC framework sở hữu; ứng dụng chỉ lưu proof server-side, không thêm custom claims để thay thế. `returnTo` là input tương thích nhưng bị server bỏ qua cho quyền điều hướng; server luôn lưu đường về nội bộ cố định `/tai-khoan`, không nhận URL ngoài origin. | D07, D56, design §6; `GoogleOidcSuccessHandlerTest` |
| R-01-18 | Đặt lại mật khẩu: frontend đọc token đúng một lần vào memory, xóa token và email khỏi URL/history trước tương tác, không lưu browser storage/cookie/analytics; các route reset trả `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; reload URL đã scrub không lấy lại được token. | design §5.6, `RecoveryPages.test.tsx`, `ResetTokenSecurityHeadersIT` |
| R-01-19 | Đổi/đặt lại mật khẩu **không ghi audit FE-17**; đây là ngoài phạm vi được chốt bởi D34/K12. | D34/K12 |

### 4.1 Bất biến bảo mật và round-trip bắt buộc

- **Request/response:** mọi state-changing request trong bảng A1–A16 dùng CSRF; route yêu cầu đăng nhập dùng thêm session đúng như OpenAPI. `GET /api/csrf` là ngoại lệ công khai có chủ đích: response được phép trả CSRF transport token để frontend gửi lại ở header CSRF, endpoint không yêu cầu CSRF header, và token này không được ghi log hoặc lưu browser storage/cookie. Ngoài ngoại lệ transport này, không response, log hoặc browser storage nào được chứa password, password hash, raw reset/activation/invitation token, session ID, cookie hoặc OAuth credential/secret/token; backend persistence chỉ lưu password hash và token hash theo các quy tắc bên dưới. Các lệnh public như đăng nhập, đăng ký, resend verification và reset vẫn phải gửi CSRF. Frontend gửi `credentials: include`, không đưa các secret nói trên vào localStorage, sessionStorage, cookie do ứng dụng tự quản lý hoặc URL.
- **Persistence:** đăng ký, reset, change-password và thêm mật khẩu Google dùng cùng `PasswordEncoder`; hash mới phải là Argon2id và đọc lại từ DB phải xác minh được bằng mật khẩu gốc; bcrypt legacy chỉ verify được, không phải format hash mới. Giá trị password không bao giờ được lưu plaintext.
- **Token:** phát hành (lock identity → kiểm cooldown/quota → invalidate token cũ → insert token/job) và consume (hash/type/unused/not-expired → một compare-and-set) là transaction nguyên tử; chỉ một consumer thành công. Thất bại email/outbox không để lại identity/token/job dở dang.
- **Session:** login password thành công trả `204`; phiên thường có inactivity 8 giờ; remember-me có inactivity 30 ngày cộng absolute cap 30 ngày từ lúc tạo, do server kiểm trước request được bảo vệ và activity không dịch deadline; logout trả `204`, kết thúc phiên và xóa farm đang chọn; reset kết thúc mọi phiên, đổi mật khẩu giữ phiên hiện tại và kết thúc phiên khác.
- **Google:** OAuth state/nonce/PKCE/replay là framework-owned; callback chỉ đặt proof server-side và xoay session. Query callback chỉ khôi phục UX/popup, không cấp quyền đổi mật khẩu. Proof Google có hiệu lực 5 phút (inclusive ở đúng mốc) và chỉ áp dụng cho tài khoản có Google subject.
- **Reset browser:** route `/resetpassword` và hai API validate/finish áp dụng no-referrer/no-store; token được scrub khỏi URL/history trước render, chỉ nằm trong memory của component và được dùng một lần. Đây là hardening contract, không phải bằng chứng manual E2E đã chạy.
- **Audit:** không có round-trip audit cho reset/change/password authentication vì D34/K12 loại FE-01 khỏi danh mục audit; không tự suy ra hoặc tạo audit action mới.

---

## 5. Luồng xử lý

### UC-FE01-01 Đăng ký tài khoản Chủ trại

**Luồng chính (Google):**
1. Khách mở SCR-03, bấm **Tiếp tục với Google**.
2. Hệ thống chuyển sang Google (API-05); khách xác thực và đồng ý.
3. Google trả về subject, email đã xác minh, họ tên.
4. Hệ thống tìm tài khoản theo Google subject, rồi theo email. Không có → tạo tài khoản `ACTIVE` với email đó và gắn danh tính Google (R-01-01).
5. Hệ thống đăng nhập người dùng. Nếu tài khoản chưa chấp thuận điều khoản, mở bước **Đồng ý để tiếp tục**; khách xem hai tài liệu, tick đồng ý và lưu. Lệnh này chỉ ghi nhận chấp thuận (D57).
6. Hệ thống mở SCR-07: email chỉ đọc, họ tên điền sẵn từ Google. Khách xác nhận họ tên, nhập SĐT (không bắt buộc), bấm **Hoàn tất và đăng ký trại**.
7. Hệ thống kiểm tra trường, đánh dấu đã hoàn tất đăng ký Owner, mở SCR-10.

**Luồng phụ:**
- **AF1 – Đăng ký bằng email:** nhập họ tên, email, mật khẩu và xác nhận → **Tạo tài khoản** → form hợp lệ thì mở popup Điều khoản và Chính sách → khách tick đồng ý và bấm **Đồng ý và xác nhận** → hệ thống kiểm tra email chưa có tài khoản, tạo tài khoản với mật khẩu `PENDING_VERIFICATION`, gửi link 24 giờ (API-04) → SCR-04 + MSG-FE01-04 → khách mở link → hệ thống kích hoạt tài khoản và mật khẩu, đăng nhập, sang bước 5 (họ tên đã nhập sẵn). Nếu lệnh tạo thất bại, popup và dấu tick được giữ để thử lại; đóng hoặc tải lại thì phải tick lại.
- **AF2 – Tài khoản đã có (bước 4):** dùng lại tài khoản. Đã hoàn tất đăng ký Owner → mở SCR-09; chưa → bước 5.
- **AF3 – Rời đi trước bước 6:** tài khoản vẫn còn; lần đăng nhập sau mở lại SCR-07.
- **AF4 – Gửi lại email xác minh:** link cũ bị vô hiệu, gửi link mới; tối đa 5 email / giờ / địa chỉ.

**Ngoại lệ:**

| Mã | Tình huống | Kết quả |
|---|---|---|
| E1 | Hủy / không hoàn tất đăng nhập Google | MSG-FE01-12; không tạo tài khoản |
| E2 | AF1 với email đã có tài khoản | MSG-FE01-10 kèm link Đăng nhập và Quên mật khẩu; không tạo tài khoản thứ hai |
| E3 | Trường không hợp lệ | MSG-COM-06, MSG-COM-10, MSG-FE01-08, MSG-FE01-09 hoặc MSG-FE01-14 dưới trường |
| E4 | Link xác minh hết hạn / đã dùng | MSG-FE01-06 kèm Gửi link mới |
| E5 | Tài khoản SUSPENDED | Trạng thái "Tài khoản bị tạm ngưng" (MSG-FE01-03); không tạo phiên |
| E6 | Lỗi gửi email / lỗi lưu | MSG-COM-02; không lưu dở dang |

### UC-FE01-02 Đăng nhập

**Luồng chính (email + mật khẩu):**
1. Khách mở SCR-02, nhập email, mật khẩu, tùy chọn **Ghi nhớ đăng nhập**, bấm **Đăng nhập**.
2. Hệ thống kiểm tra: tài khoản tồn tại, mật khẩu `ACTIVE` (email đã xác minh), không bị khóa, mật khẩu khớp hash (R-01-03, R-01-04).
3. Kiểm tra tài khoản `ACTIVE` (R-01-08); đặt lại bộ đếm sai về 0.
4. Tạo phiên (mục 3.4).
5. Xác định vai trò platform hiện tại và các membership `ACTIVE`.
6. Mở màn hình đích theo **thứ tự ưu tiên** (SCR-02):
   1. Bước **Đồng ý để tiếp tục** nếu tài khoản có phương thức Google và chưa chấp thuận điều khoản (D57);
   2. Trang đã yêu cầu trước khi đăng nhập, nếu vẫn còn quyền;
   3. SCR-15 nếu bắt đầu từ link lời mời;
   4. SCR-07 nếu chưa hoàn tất đăng ký Owner;
   5. Màn hình chính của nhân viên platform: CS → SCR-67, PM → SCR-12, SA → SCR-16;
   6. Màn hình chính của trại nếu có đúng 1 trại ACTIVE: Owner / Manager → SCR-48, Technician → SCR-74;
   7. Còn lại → SCR-09 Chọn trại.

**Luồng phụ:**
- **AF1 – Tiếp tục với Google:** chuyển sang Google, tìm tài khoản theo subject hoặc email; không có → tạo tài khoản `ACTIVE` **chưa** đăng ký Owner, sang bước 4.
- **AF2 – Bắt đầu từ link lời mời:** sang UC-FE03-04.
- **AF3 – Không có trại, không có vai trò platform:** MSG-FE01-15 kèm "Đăng ký làm Chủ trại" (sang UC-01 bước 5) và hướng dẫn mở email lời mời.
- **AF4 – Đăng ký Owner chưa xong:** mở SCR-07.
- **AF5 – Quên mật khẩu:** sang UC-FE01-05.
- **AF6 – Email chưa xác minh:** MSG-FE01-11 kèm "Gửi lại email xác minh".

**Ngoại lệ:**

| Mã | Tình huống | Kết quả |
|---|---|---|
| E1 | Sai email hoặc mật khẩu | HTTP `401` + MSG-FE01-01 (không nói rõ sai cái nào); tính 1 lần sai khi định danh có phương thức mật khẩu |
| E2 | Sai 5 lần liên tiếp / đang bị khóa | HTTP `423`, MSG-FE01-02 kèm thời điểm mở khóa; Google vẫn dùng được |
| E3 | Tài khoản SUSPENDED | HTTP `403`, trạng thái "Tài khoản bị tạm ngưng" (MSG-FE01-03) kèm liên hệ chính thức (GBR-87); không tạo phiên |
| E4 | Google bị hủy / lỗi | MSG-FE01-12 |
| E5 | Trại đã yêu cầu không còn quyền | MSG-COM-01 và hiện các trại còn quyền |
| E6 | Dịch vụ không khả dụng | MSG-COM-03; không tạo phiên |

### UC-FE01-03 Đăng xuất
Mọi khung giao diện đã đăng nhập dùng cùng một menu người dùng: nút hiển thị avatar viết tắt và họ tên; khi mở có đúng hai hành động **Hồ sơ của tôi** và **Đăng xuất**. **Hồ sơ của tôi** mở popup SCR-08 ngay trên trang hiện tại. **Đăng xuất** kết thúc phiên, xóa trại đang chọn trên thiết bị và mở SCR-02.

### UC-FE01-04 Xem và sửa hồ sơ của tôi
1. Người dùng chọn **Hồ sơ của tôi** từ menu avatar; hệ thống mở popup SCR-08 **Cài đặt** ngay trên trang hiện tại. Sidebar popup có hai mục **Hồ sơ** và **Quyền theo vai trò**; không thay URL khi chuyển mục.
2. Mục **Hồ sơ** dùng bố cục Bento sáng: nhận diện tài khoản, trạng thái tài khoản, Thông tin cá nhân và Bảo mật. Email, trạng thái xác minh và phương thức đăng nhập chỉ đọc.
3. Người dùng sửa họ tên và / hoặc SĐT trong khối Thông tin cá nhân → **Lưu thay đổi** trong chính khối đó → kiểm tra → lưu → MSG-FE01-13. Không yêu cầu nhập lại mật khẩu vì email và phương thức đăng nhập không thay đổi.
4. Mục **Quyền theo vai trò** cho chọn Chủ trại / Quản lý / Kỹ thuật viên, hiển thị mô tả vai trò và bảng chức năng được phép theo Table III-2. Bảng chỉ đọc, bỏ các chức năng có mức `NO`; đây là bảng tham khảo cố định theo vai trò, không phải quyền riêng của tài khoản hoặc của trại đang chọn.
5. Các route hồ sơ cũ chỉ dùng để tương thích và chuyển về trang phù hợp với phiên. Riêng `/tai-khoan` là đường về server cố định sau Google OAuth và giữ query callback để SCR-08 cùng popup con được khôi phục; mọi `returnTo` client gửi chỉ để tương thích, bị server bỏ qua và không được dùng làm redirect.
Email **không** sửa được. Hồ sơ thuộc tài khoản và không phụ thuộc trại đang chọn.

### UC-FE01-05 Đặt lại mật khẩu đã quên
1. Khách nhập email ở SCR-05, bấm **Gửi link đặt lại**.
2. Hệ thống **luôn** hiện cùng thông báo MSG-FE01-05 (R-01-07). Email có mật khẩu `ACTIVE` → tạo link 30 phút, vô hiệu link cũ và enqueue reset-link mail + one-time reset token; tài khoản chỉ có Google → enqueue mail advice template `GOOGLE_SIGN_IN_ADVICE` (D06), không có reset link/token, cùng quota 5 mail/giờ và job bỏ qua nếu mật khẩu đã được bật lúc gửi; email unknown → không enqueue mail hoặc token.
3. Gửi email (API-04).
4. Khách mở link → frontend đọc token đúng một lần vào memory, scrub token và email khỏi URL/history trước khi render; backend kiểm tra link chưa dùng, chưa hết hạn → SCR-06 với email chỉ đọc. Route reset dùng `Referrer-Policy: no-referrer` và `Cache-Control: no-store`; token không vào browser storage/cookie/analytics.
5. Nhập mật khẩu mới + xác nhận → **Lưu mật khẩu mới**.
6. Hệ thống kiểm tra (R-01-03), lưu Argon2id hash, atomically đánh dấu link đã dùng, kết thúc mọi phiên, xóa khóa, gửi email "đã đổi mật khẩu". Consume lần thứ hai hoặc đồng thời thất bại với cùng MSG-FE01-06; lỗi gửi/lưu rollback thay đổi.
7. Mở SCR-02 với MSG-FE01-07.

AF1 tài khoản chỉ có Google (R-01-14) · AF2 gửi lại (tối đa 5 / giờ) · AF3 quay lại đăng nhập.
E1 link hết hạn / đã dùng → trạng thái "Link không còn hiệu lực" (MSG-FE01-06) · E2 mật khẩu sai quy tắc → MSG-FE01-08 / 09, mật khẩu cũ giữ nguyên · E3 SUSPENDED → đặt lại được, vẫn không đăng nhập được · E4 lỗi gửi / lưu → MSG-COM-02.

### UC-FE01-06 Đổi mật khẩu / thêm mật khẩu đầu tiên
1. Người dùng bấm **Đổi mật khẩu** hoặc **Thêm mật khẩu** trong khối Bảo mật của SCR-08 → popup tương ứng.
2. Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận → **Lưu**.
3. Kiểm tra mật khẩu hiện tại (sai được tính vào khóa, R-01-04), kiểm tra mật khẩu mới.
4. Lưu hash mới, giữ phiên hiện tại, kết thúc các phiên khác, gửi email "đã đổi mật khẩu".
5. Đóng popup, MSG-FE01-07.

AF1 **Thêm mật khẩu** (tài khoản chưa có mật khẩu): popup chưa hiện trường mật khẩu và khóa nút lưu; người dùng bấm **Xác minh bằng Google**. Google xác minh trong session có hiệu lực 5 phút; server bỏ qua `returnTo` tương thích và luôn trả về `/tai-khoan?m=doi-mat-khau&googleReauthenticated=true`; route tương thích giữ query, mở lại SCR-08 và popup **Thêm mật khẩu** chỉ với mật khẩu mới + xác nhận (R-01-13, D56) · AF2 quên mật khẩu hiện tại → bấm **Xác minh bằng Google**; server vẫn dùng `/tai-khoan`, sau callback popup **Đổi mật khẩu** chỉ hỏi mật khẩu mới + xác nhận, hoặc người dùng đăng xuất và dùng UC-05 · AF3 Hủy → không đổi gì.
E1 sai mật khẩu hiện tại → MSG-FE01-16; sau 5 lần → MSG-FE01-02 · E2 mật khẩu mới sai quy tắc → MSG-FE01-08 / 09 · E3 phiên hết hạn → phải đăng nhập lại, không lưu · E4 lỗi lưu → MSG-COM-02, giữ mật khẩu cũ.

---

## 6. Màn hình và trường

Cột **Bắt buộc**: `*` theo SRS. Cột **Lỗi** ghi mã MSG ở mục 8. Kiểm tra dữ liệu làm **cả ở FE (để báo sớm) lẫn BE (quyết định cuối cùng)**.

### SCR-02 Đăng nhập

| # | Trường (SRS / VN đề xuất) | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Continue with Google / Tiếp tục với Google | Nút | — | — | — | MSG-FE01-12 | Bắt đầu đăng nhập Google (API-05) |
| 2 | Email | Ô chữ | * | Định dạng email, ≤ 254, không phân biệt hoa thường (trim 2 đầu) | Trống | MSG-COM-06, MSG-COM-10 | — |
| 3 | Password / Mật khẩu | Ô mật khẩu + nút hiện / ẩn | * | Trường đăng nhập bắt buộc, tối đa 128 điểm mã Unicode; **không áp dụng** min-8/email-equality/composition của tạo-reset | Trống | MSG-COM-06 | Không trim |
| 4 | Remember me / Ghi nhớ đăng nhập | Checkbox | — | — | Tắt | — | Bật: inactivity 30 ngày + absolute cap 30 ngày từ lúc tạo; tắt: 8 giờ không hoạt động |
| 5 | Forgot password? / Quên mật khẩu? | Link | — | — | — | — | Sang SCR-05 |
| 6 | Sign in / Đăng nhập | Nút | — | — | — | MSG-FE01-01 (trên form), MSG-FE01-02, MSG-FE01-11, MSG-FE01-15, MSG-COM-03 | Thành công → màn hình đích theo thứ tự ở UC-02 bước 6 |
| 7 | Register / Chưa có tài khoản Chủ trại? Đăng ký | Link | — | — | — | — | Sang SCR-03 |
| **Trạng thái: Tài khoản bị tạm ngưng** | | | | | | | |
| 8 | Message / Thông báo | Chữ | — | — | — | MSG-FE01-03 kèm email | — |
| 9 | Contact BeefCare / Liên hệ BeefCare | Chữ | — | `tuanpqhe181869@fpt.edu.vn`, `0386 671 863` | — | — | GBR-87 |
| 10 | Back to sign in / Quay lại đăng nhập | Link | — | — | — | — | Về SCR-02 |

### SCR-03 Đăng ký Chủ trại

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Continue with Google / Tiếp tục với Google | Nút | — | — | — | MSG-FE01-12 | Đăng nhập Google → bước Đồng ý để tiếp tục nếu chưa chấp thuận → SCR-07 |
| 2 | Full name / Họ tên | Ô chữ | * | 2–100 ký tự (sau trim) | Trống | MSG-COM-06, MSG-COM-10 | — |
| 3 | Email | Ô chữ | * | Định dạng email, ≤ 254; chưa có tài khoản | Trống | MSG-COM-06, MSG-COM-10, MSG-FE01-10 | — |
| 4 | Password / Mật khẩu | Ô mật khẩu | * | 8–128 điểm mã Unicode, khác email không phân biệt hoa thường; không yêu cầu composition | Trống | MSG-COM-06, MSG-FE01-08 | — |
| 5 | Confirm password / Xác nhận mật khẩu | Ô mật khẩu | * | Bằng trường 4 | Trống | MSG-COM-06, MSG-FE01-09 | — |
| 6 | Create account / Tạo tài khoản | Nút | — | Form hợp lệ | — | MSG-COM-02 | Mở popup Điều khoản và Chính sách; chưa gọi API |
| 7 | Agreement / Tôi đã đọc và đồng ý | Checkbox trong popup | * | Phải tick | Không tick | MSG-FE01-14 | — |
| 8 | Agree and confirm / Đồng ý và xác nhận | Nút trong popup | — | Chỉ bật khi đã tick | — | MSG-COM-02 | Tạo tài khoản chờ xác minh, gửi link (GBR-03) → SCR-04 |
| 9 | Sign in / Đã có tài khoản? Đăng nhập | Link | — | — | — | — | Sang SCR-02 |

### Popup Điều khoản và Chính sách (dùng chung cho đăng ký email và bước sau Google OAuth, D57; D49 chỉ áp dụng cho quy tắc trình bày lỗi)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Terms of Use / Điều khoản sử dụng | Tab | — | Văn bản dài, trình bày theo mục trong vùng cuộn; không hiện ghi chú nguồn nội bộ | — | — | Không rời popup |
| 2 | Data Policy / Chính sách dữ liệu | Tab | — | Văn bản dài trong cùng popup; không dùng các ô Bento tóm tắt nội dung pháp lý | — | — | Không rời popup |
| 3 | Agreement / Tôi đã đọc và đồng ý | Checkbox | * | Phải tick | Không tick | MSG-FE01-14 | — |
| 4 | Agree and confirm / Đồng ý và xác nhận | Nút | — | Chỉ bật khi đã tick | — | MSG-COM-02 | Đăng ký email: gọi A1; sau Google: gọi A16 rồi tiếp tục điều hướng đăng nhập |
| 5 | Close / Đóng | Nút | — | — | — | — | Đăng ký email: giữ form, chưa tạo tài khoản; Google chưa chấp thuận: kết thúc phiên, về SCR-02 |

### SCR-04 Xác minh email

| # | Trường | Loại | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|
| 1 | Message / Thông báo | Chữ | MSG-FE01-04 kèm email | — | — |
| 2 | Resend verification email / Gửi lại email xác minh | Nút | Khóa 60 giây sau mỗi lần gửi; tối đa 5 lần / giờ / email; link mới vô hiệu link cũ | MSG-COM-02 | — |
| 3 | Back to sign in / Quay lại đăng nhập | Link | — | — | Sang SCR-02 |
| 4 | Verification link (trong email) | Link | 24 giờ, dùng 1 lần | MSG-FE01-06 kèm "Gửi link mới" | Mở SCR-07 |

### SCR-05 Quên mật khẩu

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Email | Ô chữ | * | Định dạng email, ≤ 254 | MSG-COM-06, MSG-COM-10 | — |
| 2 | Send reset link / Gửi link đặt lại | Nút | — | — | — | Chuyển sang trạng thái "Kiểm tra email" với MSG-FE01-05 (**giống nhau mọi trường hợp**) |
| 3 | Resend / Gửi lại | Nút (ở trạng thái xác nhận) | — | Giới hạn như SCR-04 | — | — |
| 4 | Back to sign in / Quay lại đăng nhập | Link | — | — | — | Sang SCR-02 |

### SCR-06 Đặt mật khẩu mới

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Email | Chữ chỉ đọc | — | Email của link | — | — |
| 2 | New password / Mật khẩu mới | Ô mật khẩu | * | 8–128 điểm mã Unicode, khác email không phân biệt hoa thường; không yêu cầu composition | MSG-COM-06, MSG-FE01-08 | — |
| 3 | Confirm new password / Xác nhận mật khẩu mới | Ô mật khẩu | * | Bằng trường 2 theo điểm mã; cùng giới hạn 8–128; không yêu cầu composition | MSG-COM-06, MSG-FE01-09 | — |
| 4 | Save new password / Lưu mật khẩu mới | Nút | — | — | MSG-COM-02 | Thành công → SCR-02 + MSG-FE01-07; kết thúc mọi phiên |
| **Trạng thái: Link không còn hiệu lực** | | | | | | |
| 5 | Message / Thông báo | Chữ | — | — | MSG-FE01-06 | — |
| 6 | Send new link / Gửi link mới | Nút | — | — | — | Mở SCR-05 với email điền sẵn |

### SCR-07 Hoàn tất hồ sơ Chủ trại

| # | Trường | Loại | Bắt buộc | Ràng buộc | Mặc định | Lỗi | Hành vi |
|---|---|---|---|---|---|---|---|
| 1 | Onboarding steps / Các bước | Thanh bước chỉ đọc | — | 1 Hồ sơ · 2 Trại · 3 Gói (đang ở bước 1) | — | — | — |
| 2 | Sign-in email / Email đăng nhập | Chữ chỉ đọc | — | Kèm "đã xác minh qua Google" hoặc "đã xác minh" | — | — | — |
| 3 | Full name / Họ tên | Ô chữ | * | 2–100 | Từ Google hoặc từ lúc đăng ký | MSG-COM-06, MSG-COM-10 | — |
| 4 | Contact phone / Số điện thoại liên hệ | Ô chữ | — | `0` + 9 chữ số (tổng 10) hoặc `+84` + 9 chữ số | Trống | MSG-COM-10 | Chỉ để liên hệ |
| 5 | I agree to the Terms… / Tôi đồng ý điều khoản… | Checkbox | * (chỉ khi chưa chấp nhận lúc đăng ký) | Phải tick | Không tick | MSG-FE01-14 | Ẩn nếu đã chấp nhận ở SCR-03 |
| 6 | Complete and register farm / Hoàn tất và đăng ký trại | Nút | — | — | — | MSG-COM-02 | Lưu đăng ký Owner → SCR-10 |

### SCR-08 Cài đặt tài khoản: Hồ sơ và quyền theo vai trò

SCR-08 là popup **Cài đặt** dùng chung cho mọi vai trò sau khi đăng nhập. Popup phủ trên trang đang mở, có header cố định, nút đóng, sidebar hai mục **Hồ sơ** và **Quyền theo vai trò**, vùng nội dung cuộn độc lập và nền xanh trắng nhạt. Nội dung dùng các khối Bento sáng, không bọc thêm một thẻ ngoài toàn trang. `/tai-khoan`, `/ho-so`, `/quyen-theo-vai-tro`, `/kt/tai-khoan` và `/nen-tang/ho-so` là route tương thích và chuyển tới trang phù hợp với phiên; server luôn dùng `/tai-khoan` cho Google re-authentication, bỏ qua `returnTo` và giữ query callback để khôi phục popup đổi/thêm mật khẩu.

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Account navigation / Điều hướng tài khoản | Sidebar | — | Hồ sơ / Quyền theo vai trò | — | Chuyển nội dung trong cùng popup, không đổi URL |
| 2 | Header / Tiêu đề | Chữ | — | Popup: Cài đặt; nội dung: Hồ sơ của tôi | — | Header popup không cuộn cùng nội dung |
| 3 | Sign-in email / Email đăng nhập | Chữ chỉ đọc | — | Kèm trạng thái xác minh | — | Không sửa được |
| 4 | Sign-in methods / Phương thức đăng nhập | Chữ chỉ đọc | — | Google và / hoặc Email & mật khẩu | — | — |
| 5 | Full name / Họ tên | Ô chữ | * | 2–100 | MSG-COM-06, MSG-COM-10 | — |
| 6 | Contact phone / Số điện thoại liên hệ | Ô chữ | — | Định dạng SĐT Việt Nam như SCR-07 | MSG-COM-10 | — |
| 7 | Change password / Add password – Đổi mật khẩu / Thêm mật khẩu | Nút trong khối Bảo mật | — | "Thêm mật khẩu" khi tài khoản chưa có mật khẩu | — | Mở popup con tương ứng |
| 8 | Save profile / Lưu thay đổi | Nút trong khối Thông tin cá nhân | — | Chỉ lưu họ tên, SĐT; không xác thực lại mật khẩu | MSG-COM-02 | MSG-FE01-13 |

**Tab: Quyền theo vai trò**

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Role / Vai trò | Nút chuyển | — | Chủ trại / Quản lý / Kỹ thuật viên | — | Mỗi lần hiện một vai trò |
| 2 | Functions / Chức năng | Bảng chỉ đọc | — | Chỉ liệt kê chức năng có quyền; mô tả ngắn: Xem, Quản lý, Ghi, sửa… theo Table III-2; bỏ mức `NO` | — | Không chỉnh sửa; không phụ thuộc trại đang chọn |

### Popup Đổi mật khẩu / Thêm mật khẩu (mở từ SCR-08)

| # | Trường | Loại | Bắt buộc | Ràng buộc | Lỗi | Hành vi |
|---|---|---|---|---|---|---|
| 1 | Account / Tài khoản | Chữ chỉ đọc | — | Email | — | — |
| 2 | Current password / Mật khẩu hiện tại | Ô mật khẩu | * khi đã có mật khẩu và chưa có proof Google server-side trong 5 phút | Ẩn khi thêm mật khẩu đầu tiên hoặc vừa xác minh Google; query callback không thay thế proof | MSG-COM-06, MSG-FE01-16, MSG-FE01-02 | Sai được tính vào khóa |
| 3 | New password / Mật khẩu mới | Ô mật khẩu | * | 8–128 điểm mã Unicode, khác email không phân biệt hoa thường; không yêu cầu composition | MSG-COM-06, MSG-FE01-08 | — |
| 4 | Confirm new password / Xác nhận mật khẩu mới | Ô mật khẩu | * | Bằng trường 3 theo điểm mã; 8–128 điểm mã Unicode | MSG-COM-06, MSG-FE01-09 | — |
| 5 | Google verification / Xác minh bằng Google | Nút | — | Hiện khi tài khoản có Google và chưa xác minh trong 5 phút | MSG-FE01-12, MSG-COM-02 | Chuyển tới Google; callback mở lại đúng popup con |
| 6 | Cancel / Hủy | Nút | — | — | — | Đóng, không đổi gì |
| 7 | Save / Lưu | Nút | — | Khóa khi tài khoản chưa có mật khẩu và chưa xác minh Google | MSG-COM-02 | MSG-FE01-07; kết thúc các phiên khác |

---

## 7. Hợp đồng dữ liệu FE ↔ BE (mức nghiệp vụ)

SRS không quy định đường dẫn API. **Dữ liệu vào / ra và mã lỗi lấy theo SRS.** Cột **Route** ghi đường dẫn đang có trong code (`main@dec155d`) để FE nối ngay; "chưa có" = BE phải bổ sung. Chỗ nào code lệch dữ liệu vào / ra hay mã lỗi trong bảng này thì **sửa code theo spec**.

| # | Thao tác | Vào | Ra (thành công) | Lỗi có thể trả | Route |
|---|---|---|---|---|---|
| A1 | Đăng ký bằng email | `fullName, email, password, confirmPassword, termsAccepted` | `{email}` – tài khoản chờ xác minh | MSG-COM-06, COM-10, FE01-08, 09, 10, 14, COM-02 || `POST /api/register` |
| A2 | Gửi lại email xác minh | `email` | `{nextAllowedAt}` | Quá giới hạn gửi (xem Q1), COM-02 || `POST /api/account/verification/resend` |
| A3 | Xác minh email qua link | `token` | Phiên đăng nhập + `{ownerRegistrationCompleted: false}` | FE01-06 || `GET /api/activate?token=` |
| A4 | Đăng nhập Google (bắt đầu / nhận kết quả) | Mã trả về từ Google | Phiên + thông tin điều hướng (A7) | FE01-12, FE01-03 || `GET /oauth2/authorization/google` (Spring OAuth2, kết quả qua success handler) |
| A5 | Hoàn tất hồ sơ Chủ trại | `fullName, contactPhone?, termsAccepted?` | Hồ sơ đã cập nhật, `ownerRegistrationCompleted: true` | COM-06, COM-10, FE01-14, COM-02 || `POST /api/account/owner-registration` |
| A6 | Đăng nhập bằng mật khẩu | `email, password, rememberMe` | Phiên + thông tin điều hướng (A7) | `401` + FE01-01 cho email/mật khẩu sai hoặc Google-only; `403` + FE01-03 cho SUSPENDED; `423` + FE01-02 cho lock (`{unlockAt}`); COM-03 || `POST /api/authenticate` |
| A7 | Thông tin người đang đăng nhập | — | `{id, fullName, email, emailVerified, contactPhone, status, ownerRegistrationCompleted, termsAccepted, signInMethods[GOOGLE, PASSWORD], platformRole?, farms[{farmId, farmName, role, serviceStatus}], hasPassword}` | 401 || `GET /api/account/profile` |
| A8 | Đăng xuất | — | — | — || `POST /api/logout` |
| A9 | Sửa hồ sơ | `fullName, contactPhone?` | Hồ sơ (A7) | COM-06, COM-10, COM-02 || `POST /api/account/profile` |
| A10 | Bảng quyền membership (API tương thích; tab Quyền theo vai trò của SCR-08 không gọi) | `farmId` | `{role, permissions[{area, value: FULL\|RESTRICTED\|NO}]}` | COM-01 || `GET /api/farms/{farmId}/my-permissions` |
| A11 | Yêu cầu đặt lại mật khẩu | `email` | **Luôn** thành công như nhau; tài khoản có mật khẩu → enqueue reset-link mail + one-time reset token; Google-only → enqueue `GOOGLE_SIGN_IN_ADVICE` không reset link/token; unknown → không enqueue mail, không token (D06) | COM-10 (chỉ định dạng) || `POST /api/account/reset-password/init` |
| A12 | Kiểm tra link đặt lại | `token` | `{email}` | FE01-06 || `GET /api/account/reset-password/validate?token=` |
| A13 | Đặt mật khẩu mới | `token, newPassword, confirmPassword`; new/confirm 8–128 điểm mã Unicode, không trùng email, khớp nhau | — | FE01-06, 08, 09, COM-02 || `POST /api/account/reset-password/finish` |
| A14 | Đổi mật khẩu | `currentPassword` (bắt buộc nếu không có proof Google hợp lệ), `newPassword, confirmPassword`; new/confirm 8–128 điểm mã Unicode, không trùng email, khớp nhau | — | FE01-16, 02, 08, 09, COM-01/02 || `POST /api/account/change-password` |
| A15 | Xác minh Google để đổi / thêm mật khẩu | `{returnTo}` tương thích; sau callback gửi `newPassword, confirmPassword` và không gửi `currentPassword` | Server bỏ qua `returnTo` và dùng callback `/tai-khoan?m=doi-mat-khau&googleReauthenticated=true`; framework giữ state/nonce/PKCE/replay controls; bằng chứng xác minh lưu server-side trong session 5 phút; query flag chỉ UX | FE01-08, 09, 12, cần xác thực lại (xem Q2), COM-01/02 || `POST /api/account/google-reauthentication` → framework OAuth callback → `POST /api/account/change-password` |
| A16 | Chấp thuận điều khoản sau Google | `{accepted: true}` | `{termsAccepted, termsAcceptedAt}` | FE01-14, COM-02 || `POST /api/account/terms-acceptance` |

**Không bao giờ** có password, password hash, raw reset/activation/invitation token, session ID, cookie hoặc OAuth credential/secret/token trong response, log hoặc browser storage; backend persistence chỉ giữ password hash và token hash theo mục 4.1. Ngoại lệ transport duy nhất là CSRF token được `GET /api/csrf` chủ đích trả về để frontend gửi ở header.
Lỗi trả theo khuôn chung: `{code: "MSG-FE01-08", field?: "newPassword", params?: {...}}` để FE hiện đúng chỗ.

### 7.1 HTTP, session, CSRF và OpenAPI contract cuối

`docs/api/openapi.json` là catalog contract đã refresh từ generated runtime document; các status và security requirement sau là normative cho FE-01. Các khoảng trống security trước đây cho verification resend, terms acceptance và profile đã được giải quyết bằng runtime customizer và `OpenApiContractTest`; catalog này không còn dựa vào security kế thừa ngầm từ root.

| Operation | Success | Security / request | Lỗi và bất biến |
|---|---|---|---|
| `GET /api/csrf` | `200` `{token, headerName, parameterName}` | Public; không có query parameter | Không có credential/password/token nghiệp vụ trong response |
| `POST /api/register` | `201` `{email}` | CSRF-only; body A1 | Không tạo session; lỗi dùng ProblemDetail/code; lỗi email/outbox rollback identity/token/job |
| `GET /api/activate?token=` | `303` redirect thành công | Public; token one-time 24h | Link lỗi → redirect trạng thái hết hiệu lực; token chỉ lưu hash |
| `POST /api/authenticate` | `204` | CSRF-only; body `{username,password,rememberMe}` | `400` request invalid, `401` generic `MSG-FE01-01` cho wrong/unknown/Google-only, `403` `MSG-FE01-03` cho SUSPENDED, `423` lock `MSG-FE01-02`; không tạo authenticated session khi fail |
| `GET /api/authenticate` | `204` / `401` | Public probe | Chỉ báo trạng thái authenticated |
| `POST /api/account/verification/resend` | `200` `{nextAllowedAt}` | Public; CSRF-only (public không có session requirement) | Cooldown/quota không làm lộ account; tối đa 5/h, cooldown 60s |
| `POST /api/account/reset-password/init` | `200` **không body**, giống nhau cho email unknown/known/Google-only | CSRF-only; body `{email}` | Password account → reset-link mail + one-time token; Google-only → `GOOGLE_SIGN_IN_ADVICE` không reset link/token; unknown → không enqueue mail/token; response generic, không lộ existence |
| `GET /api/account/reset-password/validate?token=` | `200` `{valid,email}` (`email` nullable) | Public; token URL-encoded | Không consume token; reset headers áp dụng |
| `POST /api/account/reset-password/finish` | `200` không body | CSRF-only; `key,newPassword,confirmPassword` bắt buộc | Token invalid/expired/replayed không đổi DB; reset thành công kết thúc mọi session |
| `POST /api/account/google-reauthentication` | `204` | Session + CSRF (AND); `{returnTo?}` tương thích | Bắt đầu framework OAuth; server bỏ qua `returnTo` và lưu đường về `/tai-khoan`; proof server-side 5 phút |
| `POST /api/account/change-password` | `200` không body | Session + CSRF (AND); `newPassword,confirmPassword` bắt buộc; `currentPassword` bắt buộc trừ Google proof hợp lệ | `403 MSG-COM-01` + `reason=google_reauthentication_required` khi thiếu proof; giữ session hiện tại, kết thúc session khác |
| `POST /api/account/profile` | `200` profile | Session + CSRF (AND); chỉ `fullName,contactPhone` | Email/sign-in methods không sửa; lỗi theo ProblemDetail |
| `POST /api/account/terms-acceptance` | `200` `{termsAccepted,termsAcceptedAt}` | Session + CSRF (AND); `accepted=true` | Idempotent thời điểm đầu tiên; không tạo Owner/farm/membership/role/subscription; D57 yêu cầu Google-only chấp thuận riêng |
| `POST /api/logout` | `204` | Session + CSRF (AND); filter route curated separately | Kết thúc session và xóa farm đang chọn; không response body |

ProblemDetail giữ RFC7807 fields (`type,title,status,detail,instance`) và các field mở rộng an toàn `code`, `params`, `message`, `path`; password/password hash/raw reset token/raw activation token/raw invitation token/session ID/cookie/OAuth token hoặc secret không bao giờ nằm trong lỗi, log hoặc response. Ngoại lệ transport có chủ đích duy nhất là CSRF token do `GET /api/csrf` trả về để frontend gửi ở header; đây không phải credential nghiệp vụ. `session` và `csrf` trong cùng một OpenAPI security requirement là AND, không phải hai lựa chọn OR.

---

## 8. Thông báo

| Mã | Kiểu | Khi nào | Nội dung (EN – SRS) | Nội dung VN (đề xuất, đối chiếu Figma) |
|---|---|---|---|---|
| MSG-FE01-01 | Trên form | Sai email hoặc mật khẩu | Email or password is incorrect. | Email hoặc mật khẩu không đúng. |
| MSG-FE01-02 | Trên form | Khóa sau 5 lần sai | Password sign-in is locked after 5 failed attempts. Try again after {time} or continue with Google. | Đăng nhập bằng mật khẩu bị khóa sau 5 lần sai. Thử lại sau {time} hoặc tiếp tục với Google. |
| MSG-FE01-03 | Trạng thái màn hình | Tài khoản bị tạm ngưng | The account {email} cannot sign in at the moment. Contact BeefCare for help. | Tài khoản {email} hiện không thể đăng nhập. Vui lòng liên hệ BeefCare để được hỗ trợ. |
| MSG-FE01-04 | Trạng thái màn hình | Đã gửi email xác minh | We sent a verification link to {email}. Open it within 24 hours to activate your account. | Chúng tôi đã gửi link xác minh tới {email}. Mở link trong 24 giờ để kích hoạt tài khoản. |
| MSG-FE01-05 | Trạng thái màn hình | Đã gửi yêu cầu đặt lại (luôn giống nhau) | If {email} has a BeefCare password, a reset link has been sent. It is valid for 30 minutes. | Nếu {email} có mật khẩu BeefCare, link đặt lại đã được gửi. Link có hiệu lực 30 phút. |
| MSG-FE01-06 | Trạng thái màn hình | Link hết hạn / đã dùng | This link has expired or has already been used. [Send a new link] | Link đã hết hạn hoặc đã được sử dụng. [Gửi link mới] |
| MSG-FE01-07 | Toast thành công | Đã đổi / đặt lại mật khẩu | Your password has been changed. Other sessions have been signed out. | Đã đổi mật khẩu. Các phiên đăng nhập khác đã bị đăng xuất. |
| MSG-FE01-08 | Dưới trường | Mật khẩu sai quy tắc | Password must have 8–128 Unicode code points and must not be the same as your email. | Mật khẩu phải có 8–128 điểm mã Unicode và không được trùng email. |
| MSG-FE01-09 | Dưới trường | Xác nhận không khớp | The passwords do not match. | Mật khẩu xác nhận không khớp. |
| MSG-FE01-10 | Trên form | Email đã có tài khoản | This email already has a BeefCare account. [Sign in] [Forgot password] | Email này đã có tài khoản BeefCare. [Đăng nhập] [Quên mật khẩu] |
| MSG-FE01-11 | Trên form | Email chưa xác minh | Please verify your email before signing in. [Resend verification email] | Vui lòng xác minh email trước khi đăng nhập. [Gửi lại email xác minh] |
| MSG-FE01-12 | Trên form | Google bị hủy / lỗi | Google sign-in was not completed. Please try again. | Đăng nhập Google chưa hoàn tất. Vui lòng thử lại. |
| MSG-FE01-13 | Toast thành công | Đã lưu hồ sơ | Your profile has been updated. | Đã cập nhật hồ sơ. |
| MSG-FE01-14 | Dưới trường | Chưa tick điều khoản | Please accept the Terms of Use and Data Policy. | Vui lòng đồng ý Điều khoản sử dụng và Chính sách dữ liệu. |
| MSG-FE01-15 | Trạng thái màn hình | Không có trại, không có vai trò platform | Your account is not linked to any farm yet. Register your farm, or open the invitation sent to your email. | Tài khoản chưa gắn với trại nào. Hãy đăng ký trại, hoặc mở lời mời đã gửi tới email của bạn. |
| MSG-FE01-16 | Dưới trường | Sai mật khẩu hiện tại | The current password is incorrect. | Mật khẩu hiện tại không đúng. |
| MSG-COM-01 | Trong trang | Không có quyền | You do not have permission to perform this action. | Bạn không có quyền thực hiện thao tác này. |
| MSG-COM-02 | Toast lỗi | Lỗi lưu | The data could not be saved. Please try again. | Không lưu được dữ liệu. Vui lòng thử lại. |
| MSG-COM-03 | Trong trang | Lỗi tải | The data could not be loaded. [Retry] | Không tải được dữ liệu. [Thử lại] |
| MSG-COM-06 | Dưới trường | Thiếu trường bắt buộc | {field} is required. | {field} là bắt buộc. |
| MSG-COM-10 | Dưới trường | Sai định dạng | {field} is not valid. | {field} không hợp lệ. |
| MSG-COM-14 | Hộp thoại | Đóng form khi có dữ liệu chưa lưu | Discard the information you have entered? [Discard] [Keep editing] | Bỏ thông tin đã nhập? [Bỏ] [Tiếp tục nhập] |

---

## 9. Test case

Tầng: **U** = unit, **I** = integration BE (service + DB), **H** = HTTP (controller, quyền, mã lỗi), **E** = E2E / kiểm tay trên giao diện.

### 9.1 Kiểm tra trường (giá trị biên)

| Mã | Màn hình · trường | Dữ liệu | Kết quả mong đợi | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-01-01 | SCR-03 Họ tên | `A` (1 ký tự) / `An` (2) / 100 ký tự / 101 ký tự | Lỗi / Hợp lệ / Hợp lệ / Lỗi | U, H | SCR-03 |
| TC-01-02 | SCR-03 Họ tên | Chỉ khoảng trắng | MSG-COM-06 | U, H | SCR-03 |
| TC-01-03 | SCR-03 Email | `abc`, `a@b`, chuỗi 255 ký tự | MSG-COM-10 | U, H | SCR-03 |
| TC-01-04 | SCR-03 Mật khẩu | 7 / 8 / 128 / 129 **điểm mã Unicode** | Lỗi FE01-08 / Hợp lệ / Hợp lệ / Lỗi | U, H | R-01-03 |
| TC-01-05 | SCR-03 Mật khẩu | Trùng email (kể cả khác hoa thường) | MSG-FE01-08 | U, H | R-01-03 |
| TC-01-05A | SCR-03 / SCR-06 / popup đổi mật khẩu | Chỉ chữ thường / chỉ số / chỉ ký hiệu / Unicode 8 và 128 điểm mã | Hợp lệ; không áp luật composition | U, I, H | R-01-03 |
| TC-01-06 | SCR-03 Xác nhận | Khác mật khẩu | MSG-FE01-09 | U, H | SCR-03 |
| TC-01-07 | SCR-03 Điều khoản | Không tick | MSG-FE01-14 | U, H | SCR-03 |
| TC-01-08 | SCR-07 SĐT | `0912345678` / `+84912345678` / `912345678` / `09123456789` / `+8491234567` | Hợp lệ / Hợp lệ / Lỗi / Lỗi / Lỗi | U, H | SCR-07 |
| TC-01-09 | SCR-07 SĐT | Để trống | Hợp lệ | U, H | SCR-07 |
| TC-01-10 | SCR-02 Email | `Owner@Farm.VN` khi tài khoản là `owner@farm.vn` | Đăng nhập được | I | R-01-01 |

### 9.2 Luồng và quy tắc

| Mã | Given | When | Then | Tầng | Nguồn |
|---|---|---|---|---|---|
| TC-01-11 | Chưa có tài khoản | Đăng ký email hợp lệ | Tài khoản tạo, mật khẩu `PENDING_VERIFICATION`, gửi 1 email; SCR-04 + MSG-FE01-04 | I, E | UC-01 AF1 |
| TC-01-12 | Đã có tài khoản `a@x.vn` | Đăng ký email `A@X.vn` | MSG-FE01-10; không có tài khoản thứ hai | I | R-01-01, UC-01 E2 |
| TC-01-13 | Đăng ký nhưng chưa xác minh | Đăng nhập bằng mật khẩu | MSG-FE01-11; không tạo phiên | I | UC-02 AF6 |
| TC-01-14 | Link xác minh tạo lúc T | Mở lúc T + 24h + 1 phút | MSG-FE01-06 | I | R-01-06 |
| TC-01-15 | Đã gửi link 1, rồi gửi lại link 2 | Mở link 1 | MSG-FE01-06; link 2 vẫn dùng được | I | R-01-06 |
| TC-01-16 | Đã gửi 5 email trong 1 giờ | Gửi lần 6 | Bị từ chối, không gửi email | I | UC-01 AF4 |
| TC-01-17 | Vừa gửi email xác minh | Bấm Gửi lại trong 60 giây | Nút bị khóa | E | SCR-04 |
| TC-01-18 | Tài khoản có mật khẩu `a@x.vn` | Đăng nhập Google với cùng email lần đầu | Gắn Google vào **cùng** tài khoản; không tạo tài khoản mới | I | R-01-01 |
| TC-01-19 | Google subject S đã gắn tài khoản A | Tình huống bất kỳ khiến S gắn sang tài khoản B | Bị chặn | I | R-01-02 |
| TC-01-20 | Tài khoản ACTIVE | Sai mật khẩu 4 lần rồi đúng | Đăng nhập được, bộ đếm về 0 | I | R-01-04 |
| TC-01-21 | Tài khoản ACTIVE | Sai 5 lần, lần 6 nhập đúng | MSG-FE01-02 kèm thời điểm mở khóa; không tạo phiên | I | R-01-04 |
| TC-01-22 | Đang bị khóa mật khẩu | Đăng nhập Google | Thành công | I | R-01-04 |
| TC-01-23 | Bị khóa lúc T | Đăng nhập đúng lúc T + 15 phút + 1 giây | Thành công | I | R-01-04 |
| TC-01-24 | Sai email / sai mật khẩu | Đăng nhập | Cả hai trường hợp cùng MSG-FE01-01 | H | UC-02 E1 |
| TC-01-25 | Tài khoản SUSPENDED | Đăng nhập mật khẩu / Google | HTTP `403` + MSG-FE01-03 + liên hệ GBR-87; không có phiên | I, E | R-01-08 |
| TC-01-26 | Đang đăng nhập, SA tạm ngưng tài khoản | Gọi request kế tiếp | 401; FE về SCR-02 trạng thái tạm ngưng | H | R-01-08 |
| TC-01-27 | Không tick Ghi nhớ | Không thao tác 8 giờ | Phiên hết hạn | I | §3.4 |
| TC-01-28 | Tick Ghi nhớ | Quay lại sau 29 ngày | Vẫn đăng nhập | I | §3.4 |
| TC-01-29 | Người dùng có 1 trại ACTIVE, vai trò Technician | Đăng nhập | Mở SCR-74 | E | UC-02 bước 6 |
| TC-01-30 | Owner có 2 trại ACTIVE | Đăng nhập | Mở SCR-09 | E | UC-02 bước 6 |
| TC-01-31 | Tài khoản PM | Đăng nhập | Mở SCR-12 | E | UC-02 bước 6 |
| TC-01-32 | Đăng nhập Google lần đầu qua trang Đăng nhập, không có trại / vai trò | Đăng nhập | Tài khoản tạo **chưa** đăng ký Owner; MSG-FE01-15 kèm "Đăng ký làm Chủ trại" | I, E | UC-02 AF1, AF3 |
| TC-01-33 | Đã đăng ký nhưng chưa xong SCR-07 | Đăng nhập | Mở SCR-07 | E | UC-02 AF4 |
| TC-01-34 | Hoàn tất SCR-07 | — | `ownerRegistrationCompleted = true`; **không** có trại, membership, vai trò platform, gói nào được tạo | I | R-01-10 |
| TC-01-35 | Có lời mời chưa chấp nhận | Đăng nhập | Lời mời vẫn chưa chấp nhận | I | R-01-11 |
| TC-01-36 | Email không tồn tại / tồn tại | Yêu cầu đặt lại | Phản hồi giống hệt nhau (nội dung, mã HTTP); password account có reset-link mail/token, unknown không có mail/token | H | R-01-07, D06 |
| TC-01-37 | Tài khoản chỉ có Google | Yêu cầu đặt lại | Email `GOOGLE_SIGN_IN_ADVICE` khuyên dùng Google, không có reset link/token và không tạo mật khẩu | I | R-01-14, D06 |
| TC-01-38 | Link đặt lại tạo lúc T | Mở lúc T + 31 phút | MSG-FE01-06 | I | R-01-06 |
| TC-01-39 | Có 2 phiên đang mở | Đặt lại mật khẩu thành công | Cả 2 phiên bị từ chối; bộ đếm sai và khóa bị xóa; có email "đã đổi mật khẩu" | I | UC-05 bước 6 |
| TC-01-40 | Tài khoản SUSPENDED | Đặt lại mật khẩu | Thành công nhưng vẫn không đăng nhập được | I | R-01-09 |
| TC-01-41 | Có 2 phiên (P1 hiện tại, P2) | Đổi mật khẩu ở P1 | P1 còn, P2 bị từ chối | I | UC-06 bước 4 |
| TC-01-42 | Đổi mật khẩu | Sai mật khẩu hiện tại 5 lần | Lần 1–4 MSG-FE01-16; lần 5 MSG-FE01-02 | I | R-01-04 |
| TC-01-43 | Tài khoản chỉ Google, xác thực Google 10 phút trước | Thêm mật khẩu | Yêu cầu xác thực lại Google | I | R-01-13 |
| TC-01-44 | Tài khoản chỉ Google, vừa xác thực lại | Thêm mật khẩu hợp lệ | Mật khẩu `ACTIVE` ngay; đăng nhập bằng email + mật khẩu được | I | R-01-13 |
| TC-01-45 | Bất kỳ | Gọi mọi API của FE-01 | Không response nào có trường mật khẩu / hash; log không chứa mật khẩu | H | R-01-05 |
| TC-01-46 | Sửa hồ sơ | Gửi kèm `email` mới | Email không đổi | H | UC-04 |
| TC-01-47 | Nhân viên platform | Mở SCR-08 từ menu avatar | Popup Cài đặt mở trên trang hiện tại; mục Quyền theo vai trò vẫn là bảng tham khảo ba vai trò trại | E | SCR-08 |
| TC-01-48 | Đang đăng nhập, đã chọn trại | Đăng xuất | Phiên kết thúc, trại đang chọn bị xóa khỏi thiết bị, về SCR-02 | E | UC-03 |
| TC-01-49 | Dịch vụ email lỗi | Đăng ký email | MSG-COM-02; không có tài khoản nào được tạo | I | R-01-15 |
| TC-01-50 | Bất kỳ vai trò đã đăng nhập | Mở `/tai-khoan`, `/ho-so`, `/kt/tai-khoan` hoặc `/nen-tang/ho-so` không có query callback | Chuyển tới trang phù hợp với phiên; không dựng lại trang hồ sơ độc lập | E | SCR-08, D56 |
| TC-01-51 | SCR-08 tab Hồ sơ | Chỉ sửa họ tên hoặc SĐT rồi lưu | Lưu thành công, không hỏi mật khẩu; email và phương thức đăng nhập không đổi | U, H | UC-04 |
| TC-01-52 | SCR-08, mục Quyền theo vai trò | Chọn lần lượt Owner, Manager, Technician | Hiện đúng Table III-2 của vai trò; không có dòng mức `NO`; không gọi A10 | U, E | SCR-08 |
| TC-01-53 | Màn hình trong trại hoặc Chọn trại | Mở menu avatar | Có đúng Hồ sơ của tôi và Đăng xuất; Hồ sơ mở popup SCR-08 tại chỗ | U, E | UC-03, SCR-08 |
| TC-01-54 | Google-linked, `termsAccepted = false` | Đăng nhập hoặc gọi API nghiệp vụ | Hiện bước Đồng ý; API nghiệp vụ trả 403 + FE01-14, phiên còn; profile/chấp thuận/đăng xuất vẫn dùng được | H, E | D57, R-01-16 |
| TC-01-55 | Google-linked, chưa hoàn tất Owner | Chấp thuận A16 hai lần | Chỉ ghi `termsAcceptedAt` lần đầu; không hoàn tất Owner, tạo trại/membership/vai trò/gói | H | D57, R-01-16 |
| TC-01-56 | Đang ở popup Đổi / Thêm mật khẩu | Xác minh Google thành công và callback qua `/tai-khoan?m=doi-mat-khau&googleReauthenticated=true` | Route tương thích giữ query; SCR-08 và đúng popup con mở lại; không có trường mật khẩu hiện tại | U, E | UC-06 AF1/AF2, D48 |
| TC-01-57 | Google-linked, xác minh lại quá 5 phút | Gửi lệnh đổi / thêm mật khẩu không có mật khẩu hiện tại | Backend từ chối và yêu cầu xác minh Google lại; mật khẩu không đổi | I, H | R-01-13, D07 |

### 9.3 Evidence matrix cuối và handbook manual-to-run

Các kiểm thử tự động được dẫn chính xác, theo lớp và không được hiểu là một browser E2E xuyên backend/frontend:

| Contract | Evidence chính xác | Trạng thái / giới hạn |
|---|---|---|
| Password policy, Argon2id/bcrypt, Unicode, DB width | `MigratingPasswordEncoderTest` (10/10); `IdentityPasswordPolicyIT` (9/9); `PasswordHashPersistenceIT` (H2 1/1); `Argon2PasswordHashWidthMigrationPostgresIT`; `PasswordAttemptConcurrencyPostgresIT` | GREEN trong unit/H2/PostgreSQL gate; DB readback đã kiểm |
| Token consume/issuance, cooldown/quota/rollback | `AccountLinkTokenConsumptionPostgresIT`; `AccountLinkTokenIssuancePostgresIT`; `BrowserSessionFlowIT.forgottenPasswordIsGenericSingleUseThirtyMinutesAndEndsAllSessions`; `BrowserSessionFlowIT.resetLinkEmailsAreLimitedToFivePerHour` | GREEN PostgreSQL 16.15 gate và H2 auth gate |
| Login/register/change/reset/session/Google | `AuthenticateControllerIT` (10/10); `BrowserSessionFlowIT.registerVerifyByEmailSignInProfileAndSignOutWithCsrf`, `BrowserSessionFlowIT.wrongPasswordsLockPasswordSignInForFifteenMinutesWithoutRevealingWhichValueIsWrong`, `BrowserSessionFlowIT.forgottenPasswordIsGenericSingleUseThirtyMinutesAndEndsAllSessions`, `BrowserSessionFlowIT.changingThePasswordKeepsThisSessionEndsTheOthersAndMailsTheOwner` (class 19/19); `GoogleReauthenticationIT` (3/3); `GoogleOidcSuccessHandlerTest` (4/4); `RememberedSessionAbsoluteExpiryIT` (5/5) | GREEN; paired H2/backend + frontend destination evidence is not cross-language E2E; query callback không phải authority; OAuth protocol controls framework-owned |
| Reset URL/storage/headers | `frontend/tests/unit/auth/RecoveryPages.test.tsx`; focused Vitest auth gate (200/200); `ResetTokenSecurityHeadersIT` (4/4; reset/browser pair 23/23) | GREEN; không claim manual browser pass |
| OpenAPI and frontend adapter | `OpenApiContractTest` (5/5); `frontend/tests/api/authApiContract.test.ts` (7/7); Node auth/session contract gate (9/9) | GREEN; `docs/api/openapi.json` curated catalog refreshed after generated assertions |
| Terms/status/error/route policy | `GoogleOidcSuccessHandlerTest`; `BrowserSessionFlowIT`; `frontend/tests/unit/auth/sessionTermsAcceptance.test.tsx`, `sessionRoles.test.tsx`, `AppRoutes.test.tsx`, `SetupPages.test.tsx` (paired route evidence 96/96) | GREEN; D57 terms gate, D49 error-presentation policy, D56 route behavior retained |
| Audit | No FE-01 audit test by design | **N/A / out of scope** per D34/K12; do not infer audit coverage |

Manual runtime/E2E remains user-owned and **manual-to-run**. Execute the exact 16 scenarios `FE01-M01` … `FE01-M16` in `docs/testing/FE01_AUTH_MANUAL_E2E_SCENARIOS.md` at `1180x820` and `1440x900`; the handbook is procedure/evidence guidance, not a manual pass claim. The manual scenarios cover registration/activation, destination, generic failures, resend/quota, lockout, reset, change, Google reauth/terms, remembered sessions, logout, suspended state, CSRF, return-path defense and accessibility/responsive behavior.

---

## 10. Điểm SRS chưa rõ và trạng thái

| # | Câu hỏi / điểm lệch | Trạng thái cuối |
|---|---|---|
| Q1 | Vượt giới hạn 5 email / giờ: SRS không có mã riêng | Đã chốt theo implementation contract: vẫn trả response generic, không lộ account; `nextAllowedAt`/cooldown là dữ liệu kiểm soát, không tạo MSG mới. UI dùng thông báo chung theo bảng MSG; không thêm MSG-FE01-17. |
| Q2 | Thêm / đổi mật khẩu khi xác thực Google đã quá 5 phút: SRS không ghi mã riêng | Đã chốt theo D07/runtime: `403 MSG-COM-01`, `params.reason=google_reauthentication_required`; popup yêu cầu **Xác minh bằng Google** lại. Proof đúng mốc 300 giây còn hợp lệ; query flag không đủ. |
| Q3 | Họ tên chỉ gồm ký tự đặc biệt / số có hợp lệ không? | **Chưa có quyết định sản phẩm riêng**; theo SRS hiện hành chỉ kiểm độ dài 2–100 sau trim. Không tự thêm pattern. |
| Q4 | SĐT có cho phép khoảng trắng / dấu chấm (`0912 345 678`) không? | **Chưa có quyết định sản phẩm riêng**; giữ quy tắc SRS cho phép dạng số/`+84`; việc chuẩn hóa whitespace/dấu chấm phải được chốt trước khi FE mở rộng. |
| Q5 | "Trang đã yêu cầu trước khi đăng nhập" lưu ở đâu, bao lâu? | **Đã giới hạn bảo mật:** `returnTo` chỉ là input tương thích, server bỏ qua và dùng đường về cố định `/tai-khoan`; redirect state/state OAuth do framework quản lý và không nhận URL ngoài origin. TTL cụ thể của UX state không phải API/persistence contract. |

Các điểm framework-owned/deferred không phải câu hỏi sản phẩm: state/nonce/PKCE/replay của OAuth do Spring Security/OIDC sở hữu; không thêm custom claims hoặc tự tuyên bố đã kiểm callback provider thật. Manual E2E cũng chưa chạy và được đánh dấu `manual-to-run` ở mục 9.3.

---

## 11. Lịch sử

| Ngày | Phiên bản SRS | Thay đổi | Người |
|---|---|---|---|
| 06/11/2026 | 28/10/2026 | Bản đầu, viết lại hoàn toàn từ SRS (không dựa trên code) | Claude (cho LamKD duyệt) |
| 06/11/2026 | 28/10/2026 | Điền cột Route theo route hiện có trong code | Claude |
| 07/11/2026 | 28/10/2026 | Nhóm chốt SRS 28/10 và bộ spec làm nguồn yêu cầu (D12). Câu hỏi mục 10 theo dõi tại `OPEN_QUESTIONS.md` | Tuấn |
| 23/11/2026 | 28/10/2026 | Theo D48: giữ SCR-08, chuẩn hóa menu người dùng và đường về sau Google re-authentication; bổ sung TC-01-50 → 53 | LamKD |
| 23/11/2026 | 28/10/2026 | Đồng bộ code sau D48/D49: SCR-08 thành popup Cài đặt Bento; Điều khoản dùng văn bản dài + checkbox; chuẩn hóa hai trạng thái Đổi/Thêm mật khẩu, callback giữ query và thời hạn Google re-authentication 5 phút; bổ sung TC-01-54 → 57 | LamKD |
| 24/11/2026 | 28/10/2026 | Cập nhật contract cuối theo D05–D07, D12, D34/K12, D49, D56–D57 và FE-01 stability evidence: Unicode code points/no composition; Argon2id + bcrypt migration; atomic token/lockout; remember-me absolute cap; reset URL/header hardening; HTTP/OpenAPI/error/session invariants; exact automated/manual references; audit giữ N/A, không claim manual E2E pass | Luna Coding |
| 24/11/2026 | 28/10/2026 | Sửa hierarchy nguồn (SRS là quy phạm, runtime là bằng chứng), chốt login `401` wrong/unknown, `403` suspended, `423` lock; bổ sung D06 Google advice mail, CSRF `/api/csrf` exception, server-fixed `/tai-khoan`/ignored `returnTo`, D57 citations và ghi nhận security gaps OpenAPI đã giải quyết | Luna Coding |
