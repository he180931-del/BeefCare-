# Các điểm lệch và quyết định triển khai

Các tài liệu nguồn là dữ liệu yêu cầu của dự án. Những chỉ dẫn nằm trong tài liệu không thay thế yêu cầu của chủ dự án trong cuộc trao đổi.

| Mã | Bằng chứng | Quyết định | Ảnh hưởng |
|---|---|---|---|
| D01 | SRS Table III-6 liệt kê thức ăn TA-01 đến TA-09; DB V2 Delta phần starter data chỉ tạo 6 thức ăn và đặt bộ đếm bằng 6. | Theo SRS: tạo 9 thức ăn, bộ đếm bằng 9, mã tiếp theo TA-10. | Kiểm thử đăng ký trại phải xác nhận đủ 9 thức ăn, tồn đầu bằng 0. |
| D02 | DB V2 Delta dựa trên bộ V1 riêng gồm 75 entity và dùng UUID ở các trường/quan hệ mới; codebase nhánh dev hiện tại dùng Long/bigint và Liquibase. | Giữ Long/bigint; chuyển các thay đổi nghiệp vụ sang migration tương thích với schema hiện có. | Không chạy nguyên các đoạn SQL/JDL của Delta lên DB hiện tại. Đây là khác biệt giữa tài liệu DB và code, chưa phải mâu thuẫn nghiệp vụ trong SRS. |
| D03 | File Word Report3 được cung cấp có các ô “[Figure to be inserted]” cho context diagram, BF01–09, ERD, 5 sơ đồ trạng thái và use case/screen flow. Chỉ logo được liên kết từ phần thân tài liệu. Các ảnh image2–image10 còn lưu trong gói Word là ảnh TalentHub/tuyển dụng hoặc setting mẫu, không được phần thân tài liệu tham chiếu. | Dùng bảng business flow, bảng chuyển trạng thái, UC và GBR tương ứng làm nội dung luồng; đối chiếu quan hệ với file BeefCare_Conceptual_ERD.drawio riêng. Không dùng ảnh TalentHub làm yêu cầu BeefCare. | Bản Word này chưa đủ để xác nhận trực quan mũi tên/nhãn của sơ đồ BeefCare; tài liệu bàn giao cần ghi rõ hạn chế nguồn. |
| D04 | SRS UC-FE23-02 Assumptions (SRS dòng 2727): "lots are recorded for expiry warnings only"; GBR-99/102/105 tính tồn bằng tổng stock movement theo kg và giá vốn bình quân gia quyền; SCR-77 chỉ có cột "Lot near expiry". DB V2 Delta không có FEFO. Handoff 28/10 lại đề xuất "hoàn thiện FEFO thật". | Theo SRS, chủ dự án xác nhận ngày 28/10/2026: không phân bổ xuất kho theo lô. Lô và hạn dùng lưu trên dòng phiếu nhập; "Lot near expiry" là lô có hạn gần nhất trong 30 ngày của các phiếu POSTED. Bảng `feed_inventory_lot`/`feed_lot_allocation` (migration 00800) giữ nguyên, không được đọc/ghi, không phải nguồn tính tồn. | Không thêm logic lô vào nhập/hủy/điều chỉnh/cho ăn. Nếu sau này SRS đổi sang FEFO thì làm bằng changeSet mới và backfill. |
| D05 | UC-FE01-02 E1: "The message does not reveal which value is wrong". Mã cũ trả 403 cho tài khoản chỉ dùng Google nhưng 401 cho sai mật khẩu. | Tài khoản chỉ dùng Google đăng nhập bằng mật khẩu nhận đúng như sai mật khẩu: 401 `MSG-FE01-01`, không đếm lần khóa. | Hai test xác thực đổi kỳ vọng sang 401. |
| D06 | UC-FE01-05 AF1: "the email advises signing in with Google; no password is created". Mã cũ không gửi gì. | Gửi email hướng dẫn đăng nhập bằng Google qua hàng đợi mail bền vững (template `GOOGLE_SIGN_IN_ADVICE`), cùng giới hạn 5 mail/giờ, không link, không token; job bỏ mail nếu tài khoản đã có mật khẩu lúc gửi. | Câu trả lời của API vẫn giống hệt mọi địa chỉ. |
| D07 | UC-FE01-06 AF1/AF2 cần "re-authenticate with Google (sign-in within the last 5 minutes)"; SRS không có mã thông báo riêng cho trường hợp chưa xác thực lại. | Thời điểm đăng nhập Google được lưu trong session; trong 5 phút, đổi mật khẩu không cần mật khẩu hiện tại (chỉ khi tài khoản có Google subject). Thiếu xác thực lại: 403 `MSG-COM-01`, `params.reason=google_reauthentication_required`. | FE gọi `POST /api/account/google-reauthentication` rồi chuyển tới Google. |
| D08 | JOB-05 (24.5) và GBR-71 (không tạo yêu cầu thanh toán khi SUSPENDED). | Trại SUSPENDED không nhận thông báo mở gia hạn và sắp hết hạn, chỉ nhận thông báo đã hết hạn. Thông báo "đã hết hạn" dùng chung event key với JOB-04 để chỉ có một thông báo trong app, email gửi một lần. Lần chạy chỉ tạo thông báo của chính ngày đó (không bù ngày bị lỡ, theo "Job fails"). | Nếu chủ dự án muốn báo cả trại SUSPENDED thì bỏ một điều kiện trong `SubscriptionNoticeJob`. |
| D09 | SCR-61 "Search: Farm name or subscription code"; schema không có mã gói (subscription code). | Tìm theo tên trại hoặc mã thanh toán (payment code) của các kỳ đã mua; không tự đặt mã gói mới. | Cần chủ dự án xác nhận nếu SRS muốn một mã riêng. |
| D10 | SCR-48 "Getting started": hai bước "Review breeds and production purposes", "Check farm parameters" không có dữ liệu chứng minh đã xem. | Bước dữ liệu (chuồng, thuốc, mời thành viên, phiếu nhập đầu tiên) suy ra từ dữ liệu; ba bước xem lại (giống/mục đích, tham số, liều vaccine) xong khi đã sửa dữ liệu tương ứng hoặc người dùng đánh dấu. Trạng thái lưu ở `farm.onboarding_steps_done` / `onboarding_dismissed_at` có sẵn. | Không thêm migration. |
| D11 | GBR-14, MSG-COM-12, UC-FE02-02 AF1: trại không ACTIVE chỉ còn thông tin trại, gói dịch vụ và hỗ trợ. Test cũ của FE04/06/13 kỳ vọng vẫn đọc được dữ liệu vận hành. | Giữ hành vi của mã: cả đọc lẫn ghi dữ liệu vận hành đều trả `MSG-COM-12`. Test cũ được sửa theo SRS. | Không đổi API. |
| D12 | Repo có hai bản SRS: `docs/requirements/SRS_2026-10-28.txt` (86 SCR) và `SRS_2026-11-01_SEP490_G35_Report.txt` trên nhánh LamKD (104 SCR, đánh số khác, ví dụ Tồn kho thức ăn SCR-77 ↔ SCR-111). Spec cũ trong `docs/superpowers/specs/` viết trước khi chốt. | Nhóm chốt ngày 07/11/2026: nguồn yêu cầu để triển khai và nghiệm thu là SRS 28/10 cùng 23 spec trong `docs/requirements/specs/`. Mã UC, SCR, MSG, GBR theo bản 28/10. Bản 01/11 không dùng. Spec trong `docs/superpowers/specs/` chỉ để tham khảo lịch sử. | Mọi PR, test case (TC-xx-nn) và báo cáo 5.1–5.5 dẫn theo SRS 28/10 và spec. Checklist dùng số SCR bản 01/11 phải đổi về bản 28/10. Câu hỏi còn mở theo dõi tại `docs/requirements/specs/OPEN_QUESTIONS.md`; route thiếu tại `MISSING_ROUTES.md`. |
| D13 | 19 câu hỏi mục 10 của spec FE-08 → FE-12 (`docs/requirements/specs/OPEN_QUESTIONS.md`). | Chủ feature (Tuấn) chốt ngày 07/11/2026 theo đề xuất trong spec. Điểm cần lưu ý: FE-10 Q3 bỏ chức năng sửa việc đóng ca vì SRS không có; FE-08 Q3 thang BCS 1–9 dùng ngưỡng dưới 4,0; FE-11 Q2 kiểm trùng 12 giờ áp cho cả động dục và phối, trừ phối lần hai có chủ ý; FE-12 Q1 sau kết quả KHÔNG CÓ THAI con cái về Chờ phối theo Table 3.4-3. | Không đổi yêu cầu trong SRS. Route sửa đóng ca hiện có trong code được gỡ khi làm FE-10. Test case viết theo quyết định này. |
| D14 | SRS Part III §19.1.1 SCR-57 yêu cầu số ngày tới cuối kỳ hiện tại nhưng chưa quy định làm tròn. `FarmWorkspaceService.details` dùng `Duration.toDays()`; `subscriptionRules.daysUntil` dùng `Math.floor`. FE-02 Q4 đã chốt không có kỳ hiện tại thì hiện "—", SUSPENDED vẫn đếm theo kỳ. | Văn Đức (DucNV) xác nhận ngày 09/11/2026: giữ số ngày tròn 24 giờ, làm tròn xuống, tối thiểu 0. Còn 23 giờ → 0 ngày nhưng vẫn có bao phủ tới đúng end; không có kỳ hiện tại → null / "—". SUSPENDED không dừng đếm kỳ hiện tại. | Làm rõ hiển thị SCR-57 và thống nhất FE-02 / FE-19; không đổi thời điểm kỳ, bao phủ [start, end), trạng thái dịch vụ hoặc tạm ngưng. Bổ sung R-19-16, FE-19 Q6 và tiêu chí TC-19-36; đây là quyết định yêu cầu, chưa phải bằng chứng API / UI đã được kiểm chứng. |

| D15 | UC-FE19-02, SCR-58/59: cần chốt phạm vi, ý nghĩa bước nhận giao dịch trước xác nhận và cách tự cập nhật màn hình. | Người dùng xác nhận ngày 09/11/2026 trong phiên: làm backend + nối SCR-58/SCR-59, gồm tạo/mở lại/đọc chi tiết. Chứng từ đã xác thực, chiều vào, đúng môi trường/namespace/tài khoản/mã được thể hiện đã nhận dù sai số tiền; chỉ shared confirmation hợp lệ mới PAID/cấp kỳ. SCR-59 tự đọc lại mỗi 5 giây khi PENDING, không request chồng; dừng khi PAID/EXPIRED hoặc rời màn hình, giữ nút Kiểm tra lại; kiểm tra thêm một lần khi hết thời gian. | Bổ sung mốc nhận/xác nhận có nguồn lưu thật và API readback; không suy giờ xác nhận từ giờ ngân hàng. Không mở rộng sang danh sách lịch sử, UI đối soát/công bố giá hoặc bật SePay LIVE. |

| D16 | UC-FE19-03, SCR-60, Q3: cần xác nhận scope, tìm mã, biên ngày và cách làm mới lịch sử. | Người dùng xác nhận cả bốn đề xuất ngày 09/11/2026: backend + SCR-60, dùng lại SCR-59 của UC2; tìm chứa một phần mã không phân biệt hoa/thường, mặc định mọi trạng thái và ngày, mới nhất theo requestedAt trước; khoảng ngày tạo bao gồm trọn from/to theo Asia/Ho_Chi_Minh, cho nhập riêng từng đầu, from > to báo MSG-COM-11. Tải mới khi vào màn, thay filter/trang, trở lại từ SCR-59 hoặc bấm Làm mới; polling 5 giây áp dụng SCR-59 theo D15. | Chốt phần UC-03 của Q3. Theo Table III-1: 20 dòng/trang, giữ bộ lọc trong phiên; PAID/EXPIRED xem panel chỉ đọc như SCR-60. Bổ sung paging/filter/sort ở API A3, giữ quyền Owner hiện tại và dữ liệu snapshot; không thay logic xác nhận/cấp kỳ. |

| D17 | UC-FE19-04 / SCR-61 thiếu đặc tả Part II (FE-19 Q3); trang hiện có dùng demo, thiếu coverage/paging/sort và liên kết thanh toán cụ thể. D09 chưa diễn giải trường mã subscription trong chi tiết. | Người dùng xác nhận ngày 09/11/2026 thực hiện cả sáu đề xuất: hoàn thiện backend + nối SCR-61 hiện có và phần đọc đúng thanh toán nguồn ở SCR-62. CURRENT = có kỳ bao phủ now; FUTURE_ONLY = không có kỳ hiện tại, có kỳ tương lai; NONE = không có cả hai, gồm chưa mua và đã hết hạn; độc lập với SUSPENDED. Áp dụng D09: nhận diện bằng tên trại, tìm tên trại hoặc mã thanh toán của kỳ PAID, không tạo/hiển thị mã subscription giả. Hiển thị và lọc ngày xác nhận đến theo ngày cuối phục vụ (end trừ một đơn vị thời gian trước khi đổi sang Asia/Ho_Chi_Minh); nhận độc lập hai đầu ngày, khoảng đảo MSG-COM-11. Lần mua mới nhất theo confirmedAt của PAID; phân biệt chưa có subscription với đã đăng ký nhưng chưa có kỳ mua. Tìm contains không phân biệt hoa/thường; mặc định mọi lọc, confirmedUntil giảm dần, null cuối; 20 dòng/trang, giữ lọc trong phiên, làm mới theo thao tác/vào màn/quay lại hoặc nút Làm mới. | Chốt riêng UC-04 của Q3; dùng lại trang và API sẵn có, bổ sung contract/tests theo ma trận tại docs/reviews/FE19_UC04_REVIEW.md. Trạng thái đọc suy ra tại một clock, kỳ vẫn [start,end), max(end) gồm kỳ tương lai, mở gia hạn = end − 90 ngày; không thay nghiệp vụ ghi tiền/cấp kỳ. Đây là quyết định yêu cầu, chưa phải bằng chứng đã kiểm chứng hay READY_FOR_FE. |

SRS mô tả ERD ở mức khái niệm: các dòng chi tiết, lịch sử và phiên bản nằm trong phần mô tả entity. Việc cần thêm bảng chi tiết so với các ô trên sơ đồ là triển khai quan hệ đó, không tự nó là mâu thuẫn.

Mỗi vấn đề mới cần ghi phần nguồn cụ thể, quyết định và ảnh hưởng đến API/dữ liệu. Nếu SRS và ERD không đủ để giải quyết một mâu thuẫn nghiệp vụ, phải trao đổi với chủ dự án trước khi chốt phần phụ thuộc.

### D18 — UC-FE19-05 (10/11/2026)

Người dùng xác nhận cả sáu đề xuất: backend + nối SCR-62 hiện có cho phần xem
hai tab, tổng hợp, chi tiết, ứng viên và lịch sử. API-03 (ID/khoảng ngày, Q2)
và mọi thao tác ghi đối soát để gói UC6. Tổng hợp toàn hệ thống độc lập lọc;
PENDING chỉ khi now < expiresAt; Cần xem gồm UNMATCHED/NEEDS_REVIEW chưa khóa,
HOLD/HELD và khóa có ô riêng. Mặc định Tất cả/không giới hạn ngày; chứng từ
theo bankPaidAt desc/id desc, yêu cầu theo requestedAt desc/id desc; tìm mã/tên
trại contains không phân biệt hoa thường và lọc trạng thái hiệu lực. Danh sách
che mã chỉ còn bốn số cuối, chi tiết PM xem đầy đủ. Tải khi vào màn/đổi
tab/lọc/trang/quay lại/Làm mới; giữ lọc/trang trong phiên, không polling.

Chốt phần xem UC-05 của Q3; phân trang 20 và ngày VN theo SRS III-1/GBR-66.
Ma trận, test và giới hạn: `docs/reviews/FE19_UC05_REVIEW.md`. GET không ghi
tiền/cấp kỳ/đổi chứng từ; không suy sai thời gian từ trạng thái EXPIRED. Phần
tra cứu và ghi UC6 ghi rõ là hoãn, chưa chứng nhận toàn SCR-62/READY_FOR_FE.

### D19 — UC-FE19-06 (10/11/2026)

Người dùng đồng ý cả năm đề xuất:

1. SCR-62 giữ **một ô** "Lý do và tham chiếu chứng từ" (SRS 4961), tối đa
   1.000 ký tự cho quyết định ACCEPT/HOLD/REJECT và lý do khóa/mở khóa (Q4);
   A9 bỏ `references?`. Migration mới mở rộng `review_reason` lên 1.000, không
   sửa migration đã chạy.
2. LOCK / UNLOCK / RETURN_VERIFIED được lưu thành dòng `evidence_review` (SRS
   815), audit vẫn ghi. Lịch sử SCR-62 đọc bảng này; dữ liệu cũ chỉ có audit
   vẫn hiển thị, không trùng.
3. Ghi hoàn trả có ngày hoàn trả bắt buộc (cột mới), ngày Việt Nam, không ở
   tương lai và không trước ngày ngân hàng nhận; ghi một lần, sau đó bất biến.
4. Tra cứu SePay (API-03, Q2) làm cả theo mã giao dịch và theo khoảng ngày:
   khoảng ngày trả danh sách để PM lưu từng giao dịch thành chứng từ. Cùng giao
   dịch đến từ webhook và tra cứu được so theo trường nghiệp vụ, không theo hash
   payload, để không trả 409 sai.
5. Làm tiếp trên nhánh `feat/fe19-goi-thanh-toan`, tách commit code và docs.

Theo SRS không cần quyết thêm: lỗi theo MSG-FE19-11/COM-05/COM-06/COM-02,
`Idempotency-Key` cho lệnh ghi, mã chính xác thì không bắt chọn ứng viên,
không khóa hoàn trả giao dịch chiều ra. Ma trận và bằng chứng:
`docs/reviews/FE19_UC06_REVIEW.md`.

### D20 — Giao dịch chuyển ra không vào hàng "Cần xem" (10/11/2026)

Người dùng chọn phương án (a) sau review runtime UC-06. Bước 1 của
UC-FE19-06 (SRS 2447) chỉ coi là cần xem các trường hợp tiền vào: mã không
khớp, yêu cầu hết hạn, không có yêu cầu, sai số tiền. Giao dịch chuyển ra
không thể trả cho yêu cầu nào, nên chứng từ chiều ra chưa được PM quyết định
có trạng thái hiển thị `NO_ACTION` ("Không cần xử lý"), không tính vào ô
"Chứng từ cần xem" và không có trong bộ lọc "Cần xem"; vẫn xem được ở "Tất cả".
Chứng từ chưa có chiều (dữ liệu cũ) vẫn coi là cần xem. PM vẫn có thể Tạm giữ
hoặc Từ chối chứng từ chiều ra; khi đó trạng thái theo quyết định. Điều chỉnh
quy tắc đếm của D18. Bằng chứng: `docs/reviews/FE19_UC06_REVIEW.md`.

### D21 — UC-FE19-06: xác nhận từ tra cứu và yêu cầu liên quan trong lịch sử (10/11/2026)

Người dùng xác nhận hai đề xuất trong phiên:

1. Giao dịch tìm lại qua SePay được tự xác nhận nếu đủ toàn bộ điều kiện
   GBR-72/84, dùng chung cơ chế xác nhận với webhook, nguồn SEPAY. Không thêm
   bước PM duyệt cho giao dịch hợp lệ. Không khớp thì chỉ lưu chứng từ để PM
   đối soát; tra cứu theo khoảng vẫn chỉ đọc. Chạy lại không cấp trùng kỳ hay
   biên lai; thanh toán không gỡ SUSPENDED.
2. Mỗi dòng Evidence Review lưu riêng yêu cầu thanh toán liên quan tại lúc
   quyết định. ACCEPT luôn lưu yêu cầu được xác nhận (kể cả tìm bằng mã chính
   xác); HOLD/REJECT lưu yêu cầu PM chọn nếu có và vẫn được lưu khi không chọn.
   Liên kết này chỉ là ngữ cảnh lịch sử, không phân bổ tiền hay cấp dịch vụ.
   Không suy liên kết của lịch sử cũ từ thanh toán được phân bổ cuối cùng.

Bổ sung phần `related payment request` từng hoãn trong báo cáo UC6; thay quy
ước HOLD/REJECT bỏ qua `paymentId` của D19. Không bật SePay LIVE hoặc mở rộng
JOB-06. Ma trận và bằng chứng tại `docs/reviews/FE19_UC06_REVIEW.md`.

### D22 — UC-FE19-06: mã chính xác chỉ cấp cho trại của mã; mã giao dịch là khóa tra cứu (10/11/2026)

Người dùng chọn hai đề xuất sau review UC6:

1. Khi nội dung chuyển khoản có mã chính xác của yêu cầu X, PM chỉ được chấp
   nhận chứng từ cho một yêu cầu **cùng trại với X** (kể cả chính X). Danh sách
   ứng viên chỉ gồm yêu cầu của trại đó; chọn yêu cầu trại khác bị MSG-FE19-11
   `OTHER_FARM`, không phân bổ gì. Trường hợp Owner dùng lại mã của yêu cầu cũ
   đã hết hạn để trả cho yêu cầu mới của cùng trại vẫn được chấp nhận. Mã gõ sai
   hoặc không có mã: giữ GBR-72, ứng viên gồm mọi trại.
2. Tra cứu SePay theo mã (`POST …/lookup/{transactionId}`) không thêm
   `Idempotency-Key`: mã giao dịch SePay là request key theo BR-D24/GBR-88. Gọi
   lại cùng mã luôn trả chứng từ và kết quả đầu, không cấp kỳ hai lần.

Cùng đợt review (không cần quyết thêm, theo SRS): xác nhận và JOB-04 khóa trại
trước khi đọc subscription (GBR-72/73); tra cứu ghi PM thực hiện vào audit
(GBR-86), nguồn xác nhận vẫn SEPAY (D21); giao dịch chiều ra không gửi thông báo
cần đối soát (D20); dữ liệu SePay không lưu được khi tra cứu là 502. Ma trận và
bằng chứng tại `docs/reviews/FE19_UC06_REVIEW.md`.

### D23 — UC-FE19-07: công bố, rút và lịch sử bảng giá (10/11/2026)

Người dùng xác nhận cả năm đề xuất trong phiên, sau khi làm rõ rằng thời điểm
công bố do hệ thống tự ghi và khác thời điểm hiệu lực do PM chọn:

1. Hoàn thiện backend và nối SCR-63 hiện có; kiểm giá hiệu lực cho yêu cầu mới
   và trang công khai; yêu cầu đã phát hành và kỳ đã mua giữ nguyên.
2. Bổ sung `POST /api/platform/plan-prices/{version}/withdraw` (Q1), lý do rút
   bắt buộc, ít nhất 5 ký tự không phải khoảng trắng và tối đa 1.000 ký tự theo
   Table III-1 (chốt phần UC7 của Q4). Lưu lý do/người/giờ rút, giữ lịch sử;
   backend kiểm lại điều kiện strictly before effectiveAt, revision và key.
3. Bỏ nút Lưu nháp; không thêm API/bảng lưu nháp. Giữ nội dung khi lỗi, hỏi trước
   khi hủy chỉnh sửa; không lấy dữ liệu demo để thay lỗi backend.
4. Công bố ngay không tự hủy lịch tương lai, kể cả lịch có số phiên bản nhỏ hơn;
   chọn giá bằng thời điểm hiệu lực. Phiên bản đã rút không chiếm mốc thời gian,
   cho phép công bố phiên bản thay thế tại mốc đó.
5. Lịch sử 20 dòng/trang, mới công bố trước; đủ giá chính xác, trạng thái, hiệu
   lực, người/giờ công bố và thông tin rút. Tải khi vào màn, công bố/rút thành
   công, Làm mới và tới mốc hiệu lực; không polling định kỳ.

Giữ mã phiên bản backend hiện có (`PlanVersion.id`, không cam kết liên tiếp);
frontend không tự dự đoán max+1. Metadata cũ chỉ lấy từ audit công bố thật, thiếu
thì null / “—”, không suy từ effectiveAt. Ma trận, contract thay đổi và bằng
chứng tại `docs/reviews/FE19_UC07_REVIEW.md`.

### D24 — UC-FE19-08: nhận webhook, xử lý bền vững và email thanh toán (10/11/2026)

Người dùng đồng ý cả năm đề xuất sau khi đọc spec19/UC8:

1. Làm API-02, JOB-06 và phần JOB-07 của thanh toán, dùng chung cho webhook,
   tra cứu và PM xác nhận; không kích hoạt consumer cho các sự kiện outbox của
   feature khác (Chung Q1 vẫn mở).
2. Giữ `POST /api/webhooks/sepay`, thêm alias SRS
   `POST /api/v1/payments/sepay/webhook`. Cả hai xác thực HMAC/raw body như SRS,
   chỉ trả `200 {"success":true}` sau khi chứng từ và job cùng commit; 200 chưa
   có nghĩa PAID. API-03/simulator giữ kết quả thành công ngay như hiện có,
   chạy chung bộ xử lý chứng từ đã lưu; lỗi kỹ thuật sau lưu còn job để retry.
3. JOB-06 retry sau1/5/15 phút, rồi mỗi giờ, giới hạn24h tính từ lỗi đầu;
   sau đó dừng tự động, giữ dữ liệu/lỗi để PM xử lý trên SCR-62, thông báo một
   lần. Lỗi kỹ thuật phân biệt sai mã/số tiền; D20 vẫn loại thông báo đối soát
   cho chiều ra. Job không ghi đè quyết định/khóa PM hoặc phân bổ đã commit.
4. Mã trong `code`, `referenceCode`, `content` mâu thuẫn hoặc nhiều mã khác nhau
   thì không chọn mã đầu; giữ chứng từ cho PM. Giao lặp vẫn theo dữ liệu nghiệp
   vụ D19/D22, không theo hash payload đơn thuần.
5. Q5 chốt email tiếng Việt cho Owner hiện tại: trại, mã thanh toán, số tiền,
   kỳ hạn, kỳ đã xác nhận, biên lai và link đúng trại, dựa MSG-FE19-06. Không
   tuyên bố gỡ SUSPENDED. Lưu ý định gửi cùng PAID, chống trùng; gửi/retry độc
   lập đến24h, kiểm lại quyền/người nhận lúc gửi.

Không quyết lại các luật đã rõ: GBR-72/73/84, cửa sổ ngân hàng [tạo,hết hạn),
khóa theo trại, không cấp trùng, không gỡ tạm ngưng. Mốc kỷ niệm 29/02 theo
GBR-73 suy từ chuỗi kỳ đã mua liên tục, không tạo mốc lịch sử giả. Chỉ kiểm
MOCK/PostgreSQL/Mailpit local; chưa SePay LIVE hay READY_FOR_FE. Ma trận,
test, readback và runtime: `docs/reviews/FE19_UC08_REVIEW.md`.

Review UC8 (10/11/2026), người dùng đồng ý sửa cả bốn điểm:

1. Tra cứu/simulator giữ lease job ngay trong commit lưu; JOB-06 không lấy chen
   vào làm mất kết quả trả ngay của D21. Request chết thì lease hết hạn và job
   retry như E3.
2. Giao lặp tăng số lần giao bằng bulk update, không đổi version chứng từ, nên
   quyết định PM đang mở không bị MSG-COM-05 vô cớ.
3. Trường chữ của giao dịch đã xác thực (gateway, referenceCode, accountNumber,
   code) luôn được lưu đủ: chọn nới cột theo giới hạn body 65.536 byte thay vì
   từ chối 400 hoặc làm hỏng cả khoảng tra cứu 502 (R-19-08, E3).
4. Metadata lời gọi bị 401 giữ 30 ngày rồi JOB-08 xóa; không lưu được metadata
   vẫn trả 401.

### D25 — UC-FE03-01: gửi lời mời thành viên (11/11/2026)

Người dùng đồng ý cả bốn đề xuất trong phiên:

1. Email thuộc membership INACTIVE trả `MSG-FE03-21`, kèm `email` và
   `membershipId`, để Owner mở popup Kích hoạt lại của UC6. Không tạo lời mời,
   không tự kích hoạt hoặc đổi vai trò. Popup vẫn yêu cầu ngày hiệu lực và lý
   do; kích hoạt lại giữ vai trò hiện tại của membership.
2. Tài khoản SUSPENDED chưa là thành viên trại vẫn được nhận lời mời. Trạng thái
   này tiếp tục chặn đăng nhập/chấp nhận; chỉ có thể chấp nhận sau khi tài khoản
   được khôi phục và lời mời còn hạn. Quy tắc membership ACTIVE/INACTIVE vẫn
   được kiểm trước; không công bố trạng thái tài khoản platform cho Owner.
3. Thành công lưu lời mời và ý định gửi email dùng `MSG-FE03-01` với nội dung
   “Đã tạo lời mời tới {email}. Hệ thống đang gửi email.”, kèm hạn chính xác.
   Không coi HTTP thành công là email đã đến. Lỗi nhà cung cấp giữ lời mời
   PENDING, retry tăng dần tối đa 24 giờ theo JOB-07; không rollback nghiệp vụ.
   Gửi lại dùng thông báo tương ứng: đã cập nhật lời mời, hệ thống đang gửi
   email (MSG-FE03-05), giữ cùng lời mời thay vì tuyên bố tạo lời mời mới.
4. Scope gồm backend, popup Mời từ SCR-13/SCR-14, gửi email và đọc lại kết quả;
   nối nhánh Gửi lại (UC3) và Kích hoạt lại (UC6), kiểm phần phụ thuộc được dùng.
   UC4 Chấp nhận lời mời là gói riêng; không chứng nhận toàn UC3/UC6 hoặc FE-03.

Chốt FE-03 Q1 và riêng phần nhận lời mời của Q4; phần cấp quyền platform của
Q4 vẫn mở. Giữ tên field API hiện có `validityDays` (3/7/14, mặc định 7), đồng
bộ spec thay cho tên mô tả `validDays`; không đổi route. Ghi kiểm thử và giới
hạn tại `docs/reviews/FE03_UC01_REVIEW.md`; quyết định chưa phải READY_FOR_FE.

### D26 — UC-FE03-02: xem lời mời của trại (12/11/2026)

Người dùng xác nhận cả sáu đề xuất trong phiên, sau khi đọc spec FE-03 Q2:

1. Hoàn thiện backend và SCR-14: danh sách, tab, số lượng, phân trang, sắp xếp,
   tải/lỗi/rỗng. Tái dùng popup Mời UC1 và các lệnh UC3; chỉ kiểm phần phụ thuộc
   được sử dụng, không chứng nhận toàn UC3/UC4 hoặc toàn FE-03.
2. Owner có membership ACTIVE được xem lời mời đúng trại ở mọi trạng thái dịch
   vụ, gồm PENDING_PAYMENT/EXPIRED/SUSPENDED, để thu hồi quyền truy cập. Mời và
   Gửi lại vẫn cần trại ACTIVE; Hủy chỉ áp dụng lời mời còn PENDING, chưa hết hạn.
   Đây là ngoại lệ đọc phục vụ việc hủy ở GBR-14, không mở dữ liệu vận hành khác.
3. Lần đầu mở chọn PENDING; mặc định lastSentAt giảm dần, bấm cột để đảo chiều.
   Khi bằng thời điểm, id giảm dần giữ thứ tự ổn định. Giữ lựa chọn theo từng
   trại/tài khoản trong phiên; đổi tab hoặc chiều sắp xếp trở về trang đầu.
4. Tại một clock của mỗi lần đọc, PENDING có expiresAt <= now được trả và đếm
   như EXPIRED, không có thao tác. GET không sửa bản ghi/version/audit/mail;
   JOB-02 và luồng ghi tiếp tục quản lý trạng thái lưu.
5. API danh sách trả `{items,total,page,size,counts,asOf}`, thay cho mảng.
   `counts` có đủ PENDING/ACCEPTED/EXPIRED/CANCELLED, tính trên toàn trại trước
   lọc/phân trang; `total` theo bộ lọc hiện tại. UI 20 dòng/trang theo Table III-1.
   Cập nhật đồng bộ UC1; tra lời mời xung đột bằng ID, không chỉ tìm ở trang đầu.
6. Tải lại khi vào/quay lại màn, đổi tab/trang/sắp xếp, sau Mời/Gửi lại/Hủy hoặc
   bấm Làm mới. Không polling định kỳ.

Chốt riêng UC2 của FE-03 Q2; UC5 và UC7 vẫn mở. `hasAccount` tiếp tục chỉ báo
có tài khoản tại lần đọc, không công bố trạng thái tài khoản platform (D25).
Ngày giờ hiển thị theo múi giờ trại (Table III-1), mặc định Asia/Ho_Chi_Minh.
Ma trận, kiểm thử và giới hạn ghi tại `docs/reviews/FE03_UC02_REVIEW.md`;
quyết định yêu cầu không tự tạo bằng chứng READY_FOR_FE.

### D27 — UC-FE03-03: gửi lại / hủy lời mời đang chờ (14/11/2026)

Người dùng chọn cả bốn đề xuất trong phiên, sau khi đọc spec FE-03 và SRS
UC-FE03-03:

1. Gửi lại vô hiệu link cũ: mỗi lần gửi lại tạo token mới, chỉ link trong email
   mới nhất mở được lời mời; link cũ báo lời mời không còn hiệu lực. Theo mẫu
   "link mới thay link cũ" của FE-01 (UC-FE01-01 AF4, UC-FE01-05 AF2, SCR-04).
   Vẫn là cùng lời mời; email, vai trò, số ngày hiệu lực giữ nguyên, hạn tính
   lại từ lần gửi (GBR-16).
2. Không giới hạn số lần Gửi lại: SRS không đặt giới hạn cho lời mời, không áp
   giới hạn 60 giây / 5 lần mỗi giờ của email xác minh FE-01. Chống bấm trùng
   bằng Idempotency-Key và khóa nút khi đang gửi; rủi ro Owner gửi lặp email
   được ghi trong review.
3. Xác nhận Hủy (MSG-FE03-06) là hộp thoại modal với nút "Quay lại" /
   "Hủy lời mời", giữ version đã thấy khi mở (TC-03-45). Thông báo thành công
   MSG-FE03-05/07 vẫn là banner như UC1.
4. Hiển thị link sau khi Hủy (SCR-15 "Lời mời không còn hiệu lực" kèm trạng thái
   và hạn, JOB-08 chỉ xóa hash sau 7 ngày) chuyển sang UC4, làm cùng trường hợp
   EXPIRED (FE-03 Q6). UC3 giữ hành vi hiện có: Hủy xóa hash, link không cấp gì
   (POST-2) và SCR-15 báo "Liên kết không hợp lệ".

Triển khai đi kèm, không đổi route/DTO: khóa dòng lời mời khi Gửi lại/Hủy; thứ tự
lỗi COM-01 → FE03-04 (chỉ Gửi lại) → COM-08 (lời mời không thuộc trại) →
FE03-08 kèm trạng thái hiện tại, kể cả khi version cũ → COM-05. PENDING đã quá
hạn báo EXPIRED theo clock của lần gọi mà không ghi; JOB-02 vẫn quản lý trạng
thái lưu. Audit Gửi lại ghi lastSentAt/expiresAt trước/sau, audit Hủy ghi
statusBefore/statusAfter (GBR-86). Frontend hiện MSG-FE03-08 kèm trạng thái và
tải lại danh sách khi lời mời đã đổi; lỗi lưu giữ hộp thoại và cùng key để thử
lại. Spec A5/A6 dùng tên field `expectedVersion` như code. Kiểm thử và giới hạn
ghi tại `docs/reviews/FE03_UC03_REVIEW.md`; quyết định chưa phải READY_FOR_FE.

### D28 — UC-FE03-04: chấp nhận lời mời (14/11/2026)

Người dùng chọn cả bốn đề xuất trong phiên, sau khi đọc SRS UC-FE03-04, SCR-15 và
đối chiếu code:

1. Sửa tối thiểu phần đăng nhập/điều hướng dùng chung (FE-01) trong UC4, chỉ ở
   frontend: link lời mời đang mở khi chưa đăng nhập được nhớ trong trình duyệt
   (localStorage, 24 giờ, xóa khi dùng) và mở lại sau khi đăng nhập Google hoặc
   xác minh email (UC-FE01-02 AF2, UC4 AF3). Complete Owner Profile (SCR-07) chỉ
   là đích khi tài khoản chưa có trại nào và chưa có vai trò platform (UC-FE01-02
   bước 6, AF4); Manager/Technician được mời vào thẳng trại của mình. Không đổi
   backend FE-01; ghi chú cho chủ FE-01 (LamKD) trong review.
2. Báo Owner khi lời mời được chấp nhận bằng email tiếng Việt qua hàng đợi JOB-07:
   ý định gửi lưu cùng transaction chấp nhận (GBR-64), một email mỗi membership
   (BR-D22), retry tối đa 24 giờ, xác định lại Owner ACTIVE lúc gửi và bỏ nếu
   người nhận mất quyền. Không thêm thông báo trong app (SCR-45 chỉ có tab gói
   dịch vụ và hỗ trợ).
3. Mở lại link đã chấp nhận (AF2): nếu đúng email và membership còn ACTIVE thì
   SCR-15 hiện "đã tham gia" với nút Vào trại; membership đã ngưng hoặc trường hợp
   khác là link đã dùng (E1, MSG-FE03-08 kèm ACCEPTED).
4. Lệnh Chấp nhận không dùng Idempotency-Key: token trong link là khóa của ý định,
   gọi lại trả cùng membership (GBR-17). Spec A8 sửa theo, response trả
   `{membershipId, farmId, farmName, role, status}`.

Đi kèm theo quyết định UC3 (D27 mục 4, FE-03 Q6): hash của link được giữ sau khi
Hủy hoặc hết hạn (kể cả JOB-02) đến khi JOB-08 xóa sau 7 ngày; link vẫn không cấp
gì vì trạng thái được kiểm. A7 trả `{status, farmId, farmName, timeZone, email,
role, invitedBy, sentAt, expiresAt, membershipId?}` cho đúng email được mời; lỗi
MSG-FE03-08 kèm `status` và `expiresAt`. "Gửi lúc" là lần gửi cuối. Vào trại sau
khi chấp nhận đi qua kiểm tra của SCR-09 (quyền và dịch vụ) rồi tải lại phiên.
Kiểm thử và giới hạn ghi tại `docs/reviews/FE03_UC04_REVIEW.md`; quyết định chưa
phải READY_FOR_FE.

### D29 — UC-FE03-05: xem thành viên trại (14/11/2026)

Người dùng đồng ý cả sáu đề xuất trong phiên, sau khi đọc SRS SCR-13 (dòng
3043–3080), Table III-1, GBR-14 và đối chiếu code. Chốt phần UC5 của FE-03 Q2:

1. Phạm vi UC5 là A1 và SCR-13: danh sách, tab, số đếm, sắp xếp, phân trang,
   bảng quyền, tải/rỗng/lỗi và nút thao tác đúng điều kiện. Nút mở popup có sẵn
   của UC6; popup và lệnh đổi vai trò / ngưng / kích hoạt lại không được chứng
   nhận ở UC5.
2. Owner có membership ACTIVE xem SCR-13 ở mọi trạng thái dịch vụ, vì GBR-14 cho
   Owner ngưng thành viên khi trại không ACTIVE và việc đó cần thấy danh sách.
   Khi trại không ACTIVE chỉ còn Ngưng; Mời, Đổi vai trò, Kích hoạt lại bị khóa
   kèm ghi chú (cách làm của SCR-14). Manager chỉ xem khi trại ACTIVE (MSG-COM-12);
   Technician không xem (Table III-2, TC-03-26). GBR-14 trong SRS 28/10 ghi ngoại
   lệ chỉ đọc này, như D26 đã làm cho lời mời.
3. Tab: "Tất cả" là mọi dòng trả về (với Owner gồm chính Owner và người đã ngưng);
   "Quản lý" / "Kỹ thuật viên" chỉ người ACTIVE của vai trò đó; "Đã ngưng" là
   membership INACTIVE. Mỗi người chỉ thuộc một trong các nhóm Owner, Quản lý,
   Kỹ thuật viên, Đã ngưng. Manager không có tab Đã ngưng nên không nhận số này.
4. Ngày tham gia là cột `joined_at` mới (SRS Part I §3.2 "joined time"), ghi một
   lần khi tạo membership (đăng ký trại cho Owner, chấp nhận lời mời); đổi vai trò,
   ngưng, kích hoạt lại không đổi. Dữ liệu cũ lấy từ audit `MEMBER_ACCEPT`, rồi
   `FARM_REGISTER` (Owner), rồi `accepted_at` của lời mời cùng email, cuối cùng
   `effective_date`. SCR-13 hiện mm/yyyy theo múi giờ trại.
5. A1 trả cả danh sách của trại (trại nhỏ; FE-08 chọn người cân và popup Mời khi
   gặp MSG-FE03-21 cần cả danh sách) dạng `{farmName, timeZone, serviceStatus,
   counts{all, managers, technicians, inactive?}, items}`; mỗi dòng `{id, userId,
   fullName, email, role, status, joinedAt, version, actions[]}`. Bỏ `reason` và
   `effectiveDate` của lần đổi gần nhất (SCR-13 không có; Manager không được thấy
   ghi chú của Owner). Giữ tên `id`/`userId` như code, spec A1 sửa theo. Thứ tự
   mặc định theo tên tiếng Việt A→Z, không phân biệt hoa thường; chưa có tên thì
   theo email; bằng nhau theo id; bấm cột để đảo; không ghim Owner. Frontend chia
   20 dòng/trang và nhớ tab/chiều sắp xếp theo tài khoản + trại trong phiên.
6. Bảng "Quyền theo vai trò" theo đúng Table III-2: 17 nhóm × 3 vai trò, nội dung
   ô lấy từ SRS. Bảng dùng chung nên popup Mời và dữ liệu mô phỏng của SCR-08 đổi
   theo; mức FULL/RESTRICTED/NO khớp backend SCR-08 (`AccountResource`). Tóm tắt 3
   dòng ở SCR-15 giữ nguyên.

Đi kèm, không cần quyết riêng: Technician bị chặn ở A1 (trước đây lọt qua quyền
`VIEW_CATALOGUES`); Manager mở được SCR-13 (trước đây trang gọi API chi tiết trại
chỉ dành cho Owner); nhãn "Đã ngưng" / "Ngưng" theo spec; tải lại khi vào màn,
sau thao tác và nút Làm mới, không polling. Kiểm thử và giới hạn ghi tại
`docs/reviews/FE03_UC05_REVIEW.md`; quyết định chưa phải READY_FOR_FE.

### D30 — UC-FE03-06: đổi vai trò / ngưng / kích hoạt lại thành viên (14/11/2026)

Người dùng đồng ý cả sáu đề xuất trong phiên, sau khi đọc SRS UC-FE03-06 (dòng
1817–1830), popup (3115–3130), MSG-FE03-11/12/13, Table III-1 và đối chiếu code:

1. Phạm vi: popup "Đổi vai trò / Ngưng thành viên", lệnh A2 và tải lại SCR-13, gồm cả
   lối Kích hoạt lại từ popup Mời (MSG-FE03-21, D25). Giữ tên trường `role` như code;
   spec A2 sửa theo (trước ghi `newRole`).
2. Lịch sử lưu ở bảng mới `farm_membership_change`, chỉ thêm: hành động, vai trò và
   trạng thái cũ/mới, ngày hiệu lực, lý do, người làm, thời điểm; cùng transaction với
   membership và audit. Audit ghi giá trị trước/sau (GBR-86), không ghi lý do.
3. Ngày hiệu lực chỉ để ghi lịch sử (chốt FE-03 Q3): quyền đổi từ request kế tiếp của
   thành viên kể cả khi chọn ngày trong quá khứ; chỉ chặn ngày tương lai, "hôm nay" theo
   múi giờ trại.
4. Lý do bỏ khoảng trắng đầu cuối, 5–500 ký tự, ít nhất 5 ký tự không phải khoảng trắng
   (Table III-1 dòng 2789 + popup); ngắn hơn hoặc dài hơn → MSG-COM-10, trống → MSG-COM-06.
5. Xác nhận ngay trong popup [Quay lại] [Xác nhận]: MSG-FE03-11 (ngưng), MSG-FE03-12
   (đổi vai trò) và câu riêng cho kích hoạt lại (SRS không có mã): "Kích hoạt lại
   {member} với vai trò {role}? Người này vào lại {farm} từ thao tác kế tiếp." Thành
   công MSG-FE03-13. Hủy khi đã nhập → MSG-COM-14.
6. Thứ tự kiểm sau khi khóa dòng membership: COM-01 (không phải Owner) → COM-08
   (membership không thuộc trại) → COM-01 (đích là Owner) → dữ liệu COM-06/07/10 →
   đổi vai trò người INACTIVE (COM-10, `field=action`) → FE03-04 (trại không ACTIVE, chỉ
   đổi vai trò / kích hoạt lại) → FE03-20 (đã đúng, kể cả version cũ) → COM-05. Lệnh bị
   từ chối không ghi gì. Frontend: FE03-20 / FE03-04 / COM-05 / COM-08 hiện lý do, đóng
   popup, tải lại danh sách, không tự thử lại bằng version mới; lỗi lưu / mạng giữ popup
   và cùng Idempotency-Key.

Đã có sẵn, chỉ thêm test: quyền mới áp dụng từ request kế tiếp (GBR-09); bản ghi giữ tác
giả; thông báo nháp của Manager bị ngưng vẫn riêng tư và không sửa được (AF2). Ghi nhận,
không làm trong UC6: thành viên vừa bị ngưng đang mở trang sẽ nhận MSG-COM-01 ở thao tác
kế tiếp, chưa tự chuyển về SCR-09 (SRS không quy định). Kiểm thử và giới hạn ghi tại
`docs/reviews/FE03_UC06_REVIEW.md`; quyết định chưa phải READY_FOR_FE.

### D31 — UC-FE03-07: xem tài khoản người dùng (14/11/2026)

Người dùng đồng ý cả tám đề xuất trong phiên, sau khi đọc SRS SCR-16 (dòng 3150–3177), danh
sách UC (1114), ma trận quyền (1375), User Account (461–468), UC-FE03-09 PRE-2 (1858),
GBR-10/11, Table III-1 (2789–2794) và đối chiếu code. Chốt phần UC7 của FE-03 Q2:

1. Phạm vi: A9, A10 và SCR-16 (tìm, lọc, sắp xếp, phân trang, khung chi tiết, tải / rỗng /
   lỗi), nối chế độ backend cho danh sách và chi tiết. Nút Tạm ngưng / Khôi phục (UC8), Quyền
   nền tảng (UC9) và lịch sử A11 giữ như cũ, không được chứng nhận ở UC7; ở chế độ backend
   chúng vẫn báo "chưa tích hợp". FE-03 Q4, Q5 để sang UC8 / UC9.
2. Danh sách gồm cả tài khoản đăng ký mật khẩu chưa xác minh email, hiện "Chưa xác minh". SRS
   tự mâu thuẫn: dòng 467 nói tài khoản chỉ được tạo khi đã xác minh, còn dòng 1858 và 3168
   ngầm có tài khoản chưa xác minh; code tạo `app_user` ngay khi đăng ký. Đã xác minh = có
   Google subject hoặc identity `jhi_user` cùng email đã kích hoạt (như SCR-08).
3. Tìm kiếm chỉ theo tên hoặc email (bỏ SĐT): bỏ khoảng trắng đầu cuối, không phân biệt hoa
   thường, giữ dấu, tìm chứa chuỗi; `%` và `_` là ký tự thường; tối đa 100 ký tự (short text,
   Table III-1).
4. Lọc CS / PM / SA theo vai trò platform đang ACTIVE; "Không có" (`NONE`) gồm người chưa có
   vai trò và người bị thu hồi. API vẫn trả vai trò đang lưu kèm `platformAccessStatus`; cột
   hiện "Không có" kèm chú thích "CS đã thu hồi". Tham số sai (`status`, `platformRole`,
   `page`, `size`, `sort`, `dir`, `q` quá dài, sai kiểu) → 400 MSG-COM-10 kèm `params.field`.
5. Sắp xếp theo tên tiếng Việt A→Z (collation ICU `vi-x-icu` có sẵn trong PostgreSQL 16.15;
   chưa có tên thì theo email), rồi email, rồi id; `dir=desc` đảo cả ba. Backend phân trang 20
   dòng (`page` từ 0, `size` 1–100). Đổi bộ lọc hoặc chiều sắp xếp về trang 1; ô tìm, bộ lọc
   và chiều sắp xếp được giữ trong phiên theo tài khoản SA.
6. "Trại tham gia" chỉ đếm membership ACTIVE, không xét trạng thái dịch vụ; vai trò theo thứ tự
   Chủ trại → Quản lý → Kỹ thuật viên, ví dụ "3 (Chủ trại, Quản lý)"; không có trại → "0".
7. A10: cột mới `app_user.created_at` (Part I §3.2 "created time", migration
   `20261114000300`; dữ liệu cũ lấy từ `jhi_user.created_date`, rồi thời điểm liên kết cách
   đăng nhập sớm nhất, rồi lúc chấp nhận điều khoản, cuối cùng lúc nâng cấp). Đăng nhập cuối là
   giá trị mới hơn giữa `password_last_used_at` và `google_last_used_at`. Thêm `signInMethods`,
   đăng ký Chủ trại kèm thời điểm, tên các trại sở hữu, vai trò / trạng thái / version quyền
   platform. Bỏ `phone` khỏi mọi phản hồi tài khoản (cả tạm ngưng, khôi phục, quyền platform).
   Frontend đọc chi tiết bằng A10 theo id trên URL; id không tồn tại → 404 MSG-COM-08.
8. Ngày giờ SCR-16 hiện dd/mm/yyyy HH:mm theo Asia/Ho_Chi_Minh (Table III-1 dòng 2790).

Đi kèm, không cần quyết riêng: nhãn "Tạm khóa / Mở khóa" đổi thành "Tạm ngưng / Khôi phục"
trên SCR-16 và hộp thoại UC8; bỏ N+1 (fetch join quyền platform, đếm membership và kiểm xác
minh theo cả trang); lỗi DB khi GET → MSG-COM-03. Kiểm thử và giới hạn ghi tại
`docs/reviews/FE03_UC07_REVIEW.md`; quyết định chưa phải READY_FOR_FE.

### D32 — UC-FE03-08: tạm ngưng / khôi phục tài khoản (14/11/2026)

Người dùng đồng ý cả bảy đề xuất trong phiên ("theo đề xuất"), sau khi đọc SRS UC-FE03-08 (dòng
1833–1850), SCR-16 (3154–3174), ma trận quyền (1376, chú thích 1440), User Account (461–468),
Table III-1 (2789, 2794, 2795), GBR-04 (5771), GBR-10 (5777), GBR-77 (5872), BR-D06 (934),
MSG-FE03-14 → 20 (5981–5987), SCR-67 "Needs attention" (5061) và đối chiếu code:

1. Tạm ngưng chỉ chặn đăng nhập (mọi cách, phiên đang mở bị từ chối ở request kế tiếp); không thu
   hồi vai trò platform hay membership. Khôi phục đưa tài khoản về ACTIVE; vai trò / membership đã
   bị thu hồi hoặc ngưng riêng vẫn giữ nguyên (MSG-FE03-15, POST-2). CS bị tạm ngưng vẫn có vai trò
   CS ACTIVE trong DB nhưng không còn "khả dụng"; SA bị tạm ngưng không được tính là SA ACTIVE.
2. Lịch sử ở bảng mới `app_user_status_change` (Liquibase `20261114000400`), chỉ thêm: hành động
   (SUSPEND / RESTORE), trạng thái trước / sau, lý do, SA thực hiện, thời điểm; cùng transaction với
   tài khoản và audit. Audit `ACCOUNT_SUSPEND` / `ACCOUNT_RESTORE` ghi trước / sau, không ghi lý do
   (như D30). SCR-16 không có trường lịch sử nên UC8 không thêm UI; A11 để sang UC9.
3. Lý do bỏ khoảng trắng đầu cuối, 5–500 ký tự, ít nhất 5 ký tự không phải khoảng trắng (Table III-1
   dòng 2789 + SCR-16 dòng 3171): trống → MSG-COM-06, ngoài khoảng → MSG-COM-10 (`field=reason`).
4. Tạm ngưng và khôi phục được cả tài khoản chưa xác minh email (D31 cho hiện loại này); bỏ lỗi
   MSG-FE03-18 của lệnh khôi phục (thông báo đó thuộc UC9).
5. Phiếu hỗ trợ chưa CLOSED của CS bị tạm ngưng về hàng đợi chưa giao ngay trong transaction tạm
   ngưng (giữ trạng thái, lịch sử `AUTO_REQUEUE`, thông báo CS khả dụng); job 60 giây giữ làm lưới an
   toàn (bước 6 dòng 1842, GBR-77).
6. "Đánh dấu cần giao lại" yêu cầu nội bộ OPEN được tính lúc đọc: `InternalView.needsReassignment`
   = OPEN và người nhận không còn khả dụng (tài khoản bị tạm ngưng hoặc mất vai trò); SCR-68 hiện
   "Người nhận không còn khả dụng – cần đổi người nhận". Không thêm cột; tự hết khi khôi phục; UC9
   dùng lại. Màn của chính người nhận (SCR-69) luôn `false`.
7. A10 trả `actions[]` do backend tính: `SUSPEND` cho tài khoản ACTIVE không phải của SA đang xem,
   `RESTORE` cho tài khoản SUSPENDED. Frontend chỉ hiện ô lý do và nút theo `actions`; tài khoản của
   chính SA hiện "Bạn không thể tạm ngưng tài khoản của chính mình." Backend vẫn kiểm FE03-17 khi lưu.

Đi kèm, không cần quyết riêng: thứ tự kiểm sau khi khóa dòng COM-01 → COM-08 (404) → dữ liệu
(COM-06 / COM-10; thiếu `reason` / `version` / `Idempotency-Key` bị chặn ở tầng HTTP với `field`) →
FE03-17 (tự tạm ngưng) → FE03-20 (`{target: email, value: status}`, kể cả version cũ) → COM-05 →
FE03-17 (SA cuối cùng); FE03-17 là 409 cho cả hai trường hợp; lệnh bị từ chối không ghi gì.
`Idempotency-Key` bắt buộc (cùng key + dữ liệu trả kết quả đầu, khác dữ liệu → COM-19). Sửa race SA
cuối cùng: lệnh tạm ngưng khóa cả dòng tài khoản của SA đang thao tác (khóa dòng, không nạp entity)
theo thứ tự id, đọc lại từ DB rằng SA đó còn ACTIVE (không → COM-01) và còn SA ACTIVE khác; đếm SA
bằng truy vấn đọc DB, dùng chung cho thu hồi quyền ở UC9 (khóa dòng SA đang thao tác cho UC9 làm khi
làm UC9). Frontend: MSG-FE03-14 / 15 / 16 / 17 theo spec; lỗi FE03-17 / FE03-20 / COM-05 / COM-08
đóng hộp thoại, hiện lý do trên khung chi tiết, tải lại A9 + A10, giữ lý do đã nhập; lỗi lưu / mạng
giữ hộp thoại và cùng khóa. Runtime tìm ra lỗi có từ trước: hết hạn phiên dùng `Set.of(login, email)`
nên tài khoản có login trùng email (mọi tài khoản thật) làm lệnh tạm ngưng trả 500; đã sửa, có test
hồi quy. Phiên đã đăng ký bị hết hạn khi tạm ngưng nên request kế tiếp là 401, đăng nhập lại là
MSG-FE01-03. Kiểm thử và giới hạn ghi tại `docs/reviews/FE03_UC08_REVIEW.md`; quyết định chưa phải
READY_FOR_FE.

### D33 — UC-FE03-09: quyền nhân viên nền tảng (14/11/2026)

Người dùng đồng ý cả sáu đề xuất trong phiên ("thực hiện theo đề xuất"), sau khi đọc SRS UC-FE03-09
(dòng 1852–1869), popup "Platform Staff Access" (3179–3190), thực thể CS / PM / SA (497–517), GBR-10
(5777), GBR-11 (5778), BR-D06 (934), ma trận quyền (1377, chú thích 1440), SCR-16 (1514),
MSG-FE03-17 → 20 (5984–5987) và đối chiếu code. Chốt FE-03 Q4 (phần quyền nền tảng) và Q5:

1. (FE-03 Q5) Theo SRS: bỏ mục sidebar và trang "Quyền nhân sự nền tảng" (`/nen-tang/quyen`) làm theo
   Figma; nút "Quyền nền tảng" mở popup ngay trên SCR-16 (`/nen-tang/tai-khoan/{id}?m=access`); link cũ
   `/nen-tang/quyen/{id}` chuyển sang đó, `/nen-tang/quyen` về SCR-16. Danh sách nhân sự = bộ lọc vai trò
   CS / PM / SA của SCR-16.
2. Lịch sử ở bảng mới `platform_access_change` (Liquibase `20261114000500`), chỉ thêm: hành động, vai
   trò và trạng thái trước / sau, lý do, SA thực hiện, thời điểm; cùng transaction với quyền và audit.
   Audit `PLATFORM_ACCESS_*` chỉ ghi trước / sau (bỏ lý do, như D30 / D32). A11 đọc bảng này, trả
   `[{id, action, roleBefore, statusBefore, roleAfter, statusAfter, reason, byName, byEmail, at}]`, mới nhất
   trước, tối đa 100 dòng; chỉ lịch sử vai trò. Khi nâng cấp (PostgreSQL), các mục audit
   `PLATFORM_ACCESS_*` cũ được chép sang (NONE → null, thiếu lý do → "(không ghi lý do)"); audit giữ
   nguyên.
3. (FE-03 Q4) Tài khoản đang SUSPENDED: chặn Cấp / Đổi / Khôi phục bằng mã mới **MSG-FE03-22** "Tài khoản
   {email} đang tạm ngưng. Hãy khôi phục tài khoản trước khi cấp, đổi hoặc khôi phục quyền."; vẫn cho
   Thu hồi.
4. SA không đổi / thu hồi quyền của chính mình (SRS dòng 517: thu hồi "by another System Admin"): popup
   trên tài khoản của chính mình chỉ xem lịch sử; backend trả MSG-COM-01.
5. Lệnh không khớp trạng thái: giá trị yêu cầu đã có hiệu lực (Cấp / Đổi sang đúng vai trò đang ACTIVE,
   Thu hồi khi đã REVOKED, Khôi phục khi đã ACTIVE) → MSG-FE03-20 `{target: email, value: role|status}`;
   còn lại (Cấp khi đã có quyền khác, Đổi / Thu hồi khi không có vai trò ACTIVE, Khôi phục khi chưa có
   quyền) → MSG-COM-05. Không bao giờ tạo vai trò ACTIVE thứ hai (TC-03-29).
6. A10 trả `accessActions[]` do backend tính: theo quyền đang lưu GRANT / CHANGE + REVOKE / RESTORE; tài
   khoản bị tạm ngưng hoặc chưa xác minh chỉ còn REVOKE (nếu có vai trò ACTIVE); tài khoản của chính SA
   rỗng. Frontend chỉ hiện hành động có trong danh sách; rỗng thì popup hiện lý do và lịch sử.

Đi kèm, không cần quyết riêng (theo D32): `Idempotency-Key` bắt buộc; lý do 5–500 ký tự; thứ tự kiểm sau
khi khóa dòng (cả dòng của SA đang thao tác, theo thứ tự id) COM-01 → COM-08 → dữ liệu (`operation`,
`role`, `reason`) → của chính mình (COM-01) → tạm ngưng (FE03-22) → chưa xác minh (FE03-18) → trạng thái
(FE03-20 / COM-05) → version (COM-05) → SA đang thao tác còn ACTIVE (COM-01) → SA cuối cùng (FE03-17);
lệnh bị từ chối không ghi gì. CS mất quyền (thu hồi, hoặc đổi sang PM / SA) → phiếu chưa CLOSED về hàng
đợi trong cùng lệnh (lịch sử `AUTO_REQUEUE` cause `CS_ACCESS_REMOVED`); PM / SA mất quyền → yêu cầu nội bộ
OPEN tự có `needsReassignment=true` (D32). Frontend: popup "Quyền nhân viên nền tảng", lý do là ô chữ dài,
ghi chú SA cuối cùng cố định, MSG-FE03-18 / 19 / 22 theo spec, hủy khi đã nhập hỏi lại (MSG-COM-14), lỗi
nghiệp vụ đóng popup và tải lại, lỗi lưu / mạng giữ popup và cùng khóa. Kiểm thử và giới hạn ghi tại
`docs/reviews/FE03_UC09_REVIEW.md`; quyết định chưa phải READY_FOR_FE.

### D34 — UC-FE17-01: lịch sử audit nền tảng (15/11/2026)

Người dùng đồng ý toàn bộ đề xuất K1–K12 trong phiên ("theo đề xuất"), sau khi đọc spec FE-17, SRS §3.2 J
Audit Log Entry (dòng 870–876), SCR-51 (4647–4667), GBR-86 (5885), GBR-88 (5887), NFR-S11 / NFR-R01 (5748,
5755), bảng MSG-COM (5925–5935), các UC có ghi audit (FE-02 1715, FE-06 1953 / 1989, FE-13 2373 / 2391, FE-19
2465 / 2483, FE-23 2720, JOB 5574) và đối chiếu code. Chốt FE-17 Q1–Q5:

1. (K1, Q5) Một bảng `audit_log`. SCR-51 chỉ hiện các mã trong **danh mục audit trung tâm**
   (`PlatformAuditCatalog`) theo 6 nhóm của GBR-86; audit của dữ liệu trại (bò, chăm sóc, lâm sàng, phiếu,
   thức ăn, danh mục…) vẫn ghi và vẫn phục vụ lịch sử trong trại nhưng SA không thấy; A2 của mục ngoài danh
   mục trả 404 MSG-COM-08 như mục không tồn tại.
2. (K2) Không đổi mã đã lưu (các nơi khác đọc lại). Danh mục ánh xạ mã lưu → mã công khai dạng SRS; API trả
   và nhận mã công khai.
3. (K3, Q2) Danh mục 30 mã / 8 loại đích của SCR-51: ACCOUNT_SUSPENDED / RESTORED; PLATFORM_ACCESS_GRANTED /
   CHANGED / REVOKED / RESTORED; MEMBERSHIP_JOINED / ROLE_CHANGED / DEACTIVATED / REACTIVATED;
   FARM_REGISTERED, FARM_SERVICE_SUSPENDED / RESTORED, FARM_SERVICE_STATUS_CHANGED (JOB-04, "System");
   PAYMENT_CONFIRMED (mọi `*_PAYMENT_PAID`), EVIDENCE_REVIEWED; FINANCE_RECORD_POSTED / VOIDED; TICKET_CREATED /
   ASSIGNED / HANDED_OVER / RELEASED / WAITING_CUSTOMER / RESOLVED / ACKNOWLEDGED / CLOSED / REOPENED;
   INTERNAL_REQUEST_CREATED / UPDATED / COMPLETED. Không hiện: lời mời, yêu cầu / hết hạn thanh toán, lưu và
   hoàn trả chứng từ, giá gói (`PlanVersion` không thuộc 8 loại đích), nháp và báo cáo thu chi, trả lời /
   ghi chú / phân loại ticket, sửa hồ sơ trại. `OWNERSHIP_TRANSFERRED` của spec bỏ (SRS không có UC chuyển chủ
   trại); `MEMBERSHIP_REMOVED` đổi thành `MEMBERSHIP_DEACTIVATED` theo FE-03.
4. (K4) Cột mới `audit_log.actor_role`: vai trò lúc thực hiện. Hành động nền tảng lấy vai trò nhân viên
   ACTIVE (SA / PM / CS), hành động trong trại lấy vai trò thành viên ACTIVE (OWNER / MANAGER / TECHNICIAN),
   thiếu bên này thì lấy bên kia; lệnh có `FarmContext` dùng vai trò đã kiểm. Hệ thống: rỗng. Dòng cũ để
   trống ("—"), không suy từ vai trò hiện tại.
5. (K5) Cột mới `audit_log.correlation_id`. Filter `CorrelationIdFilter` nhận `X-Request-Id` của client nếu
   là chuỗi 8–64 ký tự `[A-Za-z0-9._-]`, nếu không thì tạo UUID; trả lại trong header `X-Request-Id`, đưa vào
   MDC (`[%X{correlationId}]` trong log). Mỗi lượt job định kỳ có ID riêng (task decorator của scheduler).
   Dòng cũ để trống. Liquibase `20261114000600` (2 cột + index `logged_at,id` và `action,logged_at`).
6. (K6) Một chỗ ghi duy nhất `AuditService` (MANDATORY transaction; lặp key không ghi thêm theo GBR-88): 6
   service nền tảng và job (FE-02, FE-03, FE-19, FE-21, SePay, JOB-04) thôi tự tạo `AuditLog`, nội dung
   details giữ nguyên. Ticket: `SUPPORT_PROCESS` tách thành `SUPPORT_<CLAIM|HANDOVER|RELEASE|CLASSIFY|
   ASK_CUSTOMER>`; details ticket có `statusBefore` (khi biết), `status`, `assignee` (tên CS phụ trách). Yêu
   cầu nội bộ ghi đích `InternalRequest` (id của yêu cầu) với trạng thái trước / sau và người nhận.
7. (K7, R-17-04) Trước / sau: mỗi mã có danh sách trường riêng (role, status, assignee, name, decision,
   amountVnd, termYears, periodStart, periodEnd, receiptCode), đọc từ các dạng nguồn đang ghi
   (`xBefore/xAfter`, `fromX/toX`, `before{x}/after{x}`, một giá trị = sau); "NONE" bỏ. **Không hiện lý do**
   (như D30 / D32 / D33), nội dung ticket, chứng từ ngân hàng, bí mật. Không sửa cách ghi của FE nguồn (SCR-11
   của FE-02 vẫn đọc lý do từ audit).
8. (K8, Q1, Q3) A1 `from`, `to` bắt buộc (ngày lịch giờ Asia/Ho_Chi_Minh, tính cả hai đầu, MSG-COM-06);
   `from` sau `to` → MSG-COM-11; quá 12 tháng (`to` > `from` + 12 tháng theo `plusMonths`) → MSG-COM-10
   `field=dateRange`. Mặc định 7 ngày gồm hôm nay (hôm nay − 6 → hôm nay). Ô Người thực hiện: tìm một phần tên
   hoặc email (không phân biệt hoa thường); "Hệ thống" / "System" → `system=true` (không dùng chung với
   `actor`). `dir=desc|asc` (mặc định mới nhất trước), 20 dòng / trang, tối đa 100. Spec ghi sai mã MSG, sửa
   theo bảng MSG-COM của SRS: không phải SA → MSG-COM-01, tải lỗi → MSG-COM-03, không có kết quả → MSG-COM-04
   [Xóa bộ lọc]. Màn hình có dòng gợi ý cố định "Tối đa 12 tháng" vì nội dung MSG-COM-10 cố định.
9. (K9) Đích hiện tên lúc đọc (gom theo loại, không N+1): tài khoản → họ tên, không có tên thì email che
   (`ng***@domain`); thành viên → "tên · trại"; trại → tên; thanh toán / duyệt chứng từ → mã thanh toán; bản
   ghi thu chi, ticket, yêu cầu nội bộ → mã. Người thực hiện: tên (hoặc email che), chữ viết tắt, vai trò; danh
   sách không hiện email.
10. (K10) A3 `GET /api/platform/audit/actions` trả `[{code, targetType}]` từ danh mục; frontend giữ nhãn tiếng
    Việt, mã lạ hiện nguyên mã.
11. (K11) Bỏ nút Xuất CSV và dropdown người thực hiện của frontend (SRS không có); thay bằng ô tìm theo SRS.
    Tên mục menu đổi thành "Lịch sử audit" theo tên SCR-51.
12. (K12) Ngoài phạm vi: đổi / đặt lại mật khẩu (FE-01) chưa ghi audit, TC-17-06 kiểm bằng allowlist; job trả
    ticket về hàng đợi không ghi audit; mục `SUPPORT_PROCESS` cũ không hiện. Ghi ở `MISSING_ROUTES.md`.
    Q4: audit không xóa, không có job dọn.

Hợp đồng (thay đổi phá vỡ, FE chưa nối trước đây): A1 `GET /api/platform/audit?from&to&actor|system&action&
targetType&dir&page&size` → `{items[{id, time, actor{id, name, initials, role}|null, action, targetType,
targetLabel}], total, page, size}`; A2 `GET /api/platform/audit/{id}` → `{id, time, actor, farm{id, name}|null,
action, targetType, targetId, targetLabel, before{}, after{}, correlationId}`; A3 như trên. Không có route sửa /
xóa (405). Kiểm thử và giới hạn ghi tại `docs/reviews/FE17_UC01_REVIEW.md`; quyết định chưa phải
READY_FOR_FE.

### D35 — FE-10: popup Cập nhật / Đóng ca có ô chọn diễn biến; bắt buộc khi lưu thành lần theo dõi (14/11/2026; mã cũ D30, đổi khi gộp FE-03 / FE-17 vào `dev` vì trùng D30 của UC-FE03-06)

SRS mục 3.2 yêu cầu mỗi lần theo dõi có diễn biến (Tốt hơn / Không đổi / Xấu
hơn), nhưng popup Cập nhật / Đóng ca (Part III §10) chỉ có ô chữ "Diễn biến mới
nhất". Bản trước của adapter tự suy diễn biến từ kết quả (Khỏi → Tốt hơn, Chết →
Xấu hơn, còn lại → Không đổi), tức là ghi một giá trị người dùng không chọn.

Quyết định (TuanPQ):

1. Popup có nhóm radio "Diễn biến" cạnh ô "Diễn biến mới", không chọn sẵn.
2. Bắt buộc khi lệnh tạo lần theo dõi: Giữ trạng thái (ô chữ bắt buộc theo
   FE-10 Q1), hoặc ô chữ có nội dung. Thiếu → `MSG-COM-06` dưới nhóm radio.
   Đổi trạng thái / Đóng ca mà ô chữ trống thì không tạo theo dõi, không bắt buộc.
3. A5 `POST …/health-cases/{caseId}/status` thêm `progress?`; có
   `latestProgress` mà thiếu `progress` → 400 `MSG-COM-06 {field: progress}`.
   Backend không tự điền giá trị mặc định. Frontend (backend và local) gửi / lưu
   đúng giá trị người dùng chọn; bỏ đoạn tự suy.

Nhãn diễn biến trong FE theo spec FE-10 (Tốt hơn / Không đổi / Xấu hơn). Test:
TC-10-27, TC-10-28.

### D36 — FE-11 / FE-12: thẻ tai bê "Đăng ký ngay" không bắt buộc; các chốt triển khai sinh sản (15/11/2026)

FE-12 Q5: Figma bắt buộc thẻ tai khi chọn "Đăng ký ngay", SRS (§3.5, SCR-40 dòng
13) không bắt buộc. Quyết định (TuanPQ): **theo SRS (D12), không bắt buộc**, khớp
Q3 — bê đăng ký ngay không có thẻ được cấp mã khi ghi sổ phiếu nhập FARM_BORN
(FE-06). Khi có nhập vẫn kiểm ≤ 50 ký tự và trùng mã (MSG-FE12-08). FE bỏ lỗi bắt
buộc, chế độ local tự cấp mã như backend.

Các chốt triển khai khi đối chiếu spec FE-11 / FE-12 mục 7 với code (TuanPQ):

1. P1: người quan sát / thực hiện / khám / đỡ đẻ có thể là thành viên ACTIVE
   (`observer_id`, `performer_id`, `examiner_id`, `attendant_id` — changeset mới,
   FK `app_user`, nullable) hoặc tên ngoài (cột chữ cũ). Người quan sát mặc định
   là người ghi.
2. P2: kiểm trùng 12 giờ (MSG-FE11-03) cho cả động dục và phối; không hỏi khi lần
   phối cùng `linkedEstrusId` với lần phối VALID trước (phối lần hai có chủ ý,
   R-11-08) hoặc client gửi `confirmDuplicate=true`.
3. P3: bản ghi có bản ghi phụ thuộc → 409 MSG-FE11-07 `{records, dependents[]}`.
   MSG-FE12-02 chỉ cho mâu thuẫn khám / thai; MSG-FE12-12 cho thai đã đóng và đẻ
   trùng trong 30 ngày.
4. P4: lần đẻ thứ hai của cùng bò mẹ trong 30 ngày bị chặn 409 MSG-FE12-12.
5. P5: liên kết sai bò / sai loại / đã hủy giữ MSG-COM-05; chỉ thời điểm sớm hơn
   sự kiện liên kết → MSG-FE11-10 `{event, time, field}`.
6. P6: 1–4 bê mỗi lần đẻ (R-12-08, BR-D19).
7. P7: khám CÓ THAI không có phối liên kết và không có số tháng → thai OPEN không
   có ngày dự kiến, trả `episode.notice = MSG-FE12-11`.
8. Thiếu tham số trại thì không dùng giá trị mặc định: không có thời gian mang
   thai → không tính ngày (`parameterMissing`, MSG-FE11-08); khám CÓ THAI khi đã
   có thai OPEN → xác nhận thai đó (AF2), không báo lỗi; diễn biến thai bắt buộc
   chi tiết ≤ 1.000 ký tự.

Chi tiết và bảng lệch: `docs/agent-context/FE-11-12-progress.md`. Test:
TC-11-xx, TC-12-xx trong `ReproductionResourceTest`.
