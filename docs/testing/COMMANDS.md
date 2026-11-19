# Hướng dẫn chạy test BeefCare

Người giữ: Tuấn (mục 1.7 kế hoạch triển khai). Nguồn yêu cầu và mã test case: SRS 28/10 và spec trong `docs/requirements/specs/` (D12).

Lần kiểm gần nhất: 07/11/2026 trên `main` tại `6eb31ee`. Kết quả từng lệnh ở bảng dưới; lệnh nào chưa chạy được thì ghi rõ lý do.

## 1. Phiên bản và điều kiện

| Thành phần | Phiên bản dùng khi kiểm | Ghi chú |
|---|---|---|
| Node / npm | 22.22.0 / 10.9.4 | `backend/pom.xml` ghim Node 24.16.0 và npm 11.15.0 cho build Maven. App `frontend/` chưa ghim; Lâm chốt phiên bản (mục 1.3). |
| Java | 21 | Theo `<java.version>` trong `backend/pom.xml`. |
| Maven | Wrapper 3.9.16 (`./mvnw`, Windows `mvnw.cmd`) | Wrapper tự tải Maven lần đầu, cần truy cập Maven Central. |
| PostgreSQL | 16.15 | Compose root, compose JHipster và Testcontainers cùng ghim `postgres:16.15`. |
| Docker | Cần cho Testcontainers và compose | Không có Docker thì các suite `@IntegrationTest` không chạy được. |

## 2. Frontend (chạy trong `frontend/`)

| Bước | Lệnh | Phủ phần nào | Kết quả tại `6eb31ee` |
|---|---|---|---|
| Cài theo lockfile | `npm ci` | — | Đạt |
| Kiểm tra kiểu | `npm run typecheck` | Mã nguồn và mã test (`tsconfig.test.json`) | Đạt |
| Build | `npm run build` | Bundle Vite | Đạt |
| API / adapter | `npm run test:api` | `tests/api/*.test.ts`: transport, mapping DTO, adapter backend (Node test runner) | 100/100 đạt |
| Unit | `npm run test:unit:run` | Vitest toàn bộ unit/component (`tests/unit`, `src/**`) | 736/738 đạt, 2 lỗi có sẵn (mục 4) |
| Integration (nhập đàn) | `npm run test:integration` | Chỉ `tests/integration/herd-entry/*.test.ts` | 1/1 đạt |
| Integration UI | `npm run test:integration:ui` | `tests/integration/**/*.test.tsx`: luồng trang → API giả | 15/15 đạt (9 file) |

Lưu ý:

- `npm test` = `test:api` + `test:unit:run` + `test:integration`. **Không** gồm `test:integration:ui`, typecheck hay build.
- Bộ kiểm đầy đủ trước khi mở PR:

```bash
cd frontend
npm ci
npm run typecheck
npm run build
npm test
npm run test:integration:ui
```

- Chạy theo feature hoặc theo mã case:

```bash
npx vitest run tests/unit/feed-stock          # một thư mục feature
npx vitest run -t "TC-13"                     # các case có mã TC-13-xx trong tên
```

- Toàn bộ test frontend hiện chạy trên **API giả** (mock/transport giả lập). Kết quả đạt ở đây không chứng minh đã nối backend thật; ghi rõ chế độ khi báo cáo.

## 3. Backend (chạy trong `backend/`)

> Chưa kiểm chứng ở lượt 07/11: môi trường kiểm không tải được Maven từ Maven Central, nên các lệnh dưới đây lấy theo cấu hình `pom.xml` và `backend/AGENTS.md`. Đức chạy lại và cập nhật cột kết quả (mục 1.2).

| Bước | Lệnh (macOS/Linux) | Phủ phần nào | Điều kiện | Kết quả |
|---|---|---|---|---|
| Unit + service H2 | `./mvnw test -Djacoco.skip=true` | Surefire: mọi lớp test **không** có `IT` trong tên; gồm `@ServiceIntegrationTest` chạy H2 | Không cần Docker | Chưa chạy |
| Integration | `./mvnw verify -Djacoco.skip=true` | Thêm Failsafe: lớp `*IT*`, `@IntegrationTest` dùng Testcontainers PostgreSQL 16.15 | Cần Docker | Chưa chạy |
| Một lớp / một nhóm | `./mvnw test -Dtest='HerdExitVoucherServiceTest' -Djacoco.skip=true` | Lớp được chọn | — | — |
| Hợp đồng OpenAPI | `./mvnw test -Dtest='OpenApiContractTest' -Djacoco.skip=true` | Xuất `backend/target/beefcare-openapi.json` | — | — |

Trên Windows thay `./mvnw` bằng `mvnw.cmd`. `-Djacoco.skip=true` chỉ tắt đo coverage (tránh lỗi đường dẫn Unicode trên Windows), không bỏ test.

Quy mô hiện có trong `backend/src/test`: 99 file `*Test.java`, 60 file `*IT.java`; 46 lớp dùng `@IntegrationTest` (PostgreSQL), 48 lớp dùng `@ServiceIntegrationTest` (H2).

Không chạy hai lệnh Maven cùng lúc trên cùng một thư mục `backend/`.

## 4. Lỗi có sẵn tại `6eb31ee`

| Mã | Lệnh | Test | Nguyên nhân | Người sửa |
|---|---|---|---|---|
| PRE-01 | `npm run test:unit:run` | `tests/unit/feed-stock/FeedMovementApi.test.ts` › *adds one movement for a feeding session and one for a posted adjustment* | Phụ thuộc giờ chạy. Dữ liệu demo có bữa ăn lúc 16:35 hôm nay; chạy trước 16:35 (giờ máy) thì bản ghi demo đứng đầu thẻ kho thay vì bản ghi test vừa tạo. Chạy sau 16:35 thì đạt. | Tài (FE-23) |
| PRE-02 | `npm run test:unit:run` | `tests/unit/feed-stock/FeedReceiptDetail.test.tsx` › *voids a freshly posted receipt…* | Cùng nguyên nhân với PRE-01. | Tài (FE-23) |

Khi báo kết quả, lỗi có sẵn ghi riêng, không tính là lỗi do PR mới gây ra.

## 5. Ghi kết quả mỗi lượt chạy

Mỗi lượt chạy ghi đủ các mục sau (vào mô tả PR và vào Report 5.x tương ứng):

| Mục | Ví dụ |
|---|---|
| Commit | `6eb31ee` |
| Môi trường | Windows 11 / macOS / Linux; Node, Java; Docker có/không |
| Chế độ dữ liệu | API giả · transport giả lập · H2 · PostgreSQL 16.15 |
| Lệnh | `npm run test:unit:run` |
| Kết quả | Đạt / Lỗi / Bỏ qua (số lượng) |
| Lỗi có sẵn | PRE-01, PRE-02 |
| Log | Link file log hoặc ảnh chụp đính kèm PR |
| Người chạy, ngày | Tuấn, 07/11/2026 |

Đặt mã case trong tên test để truy ngược về spec:

- Vitest / Node test: `it('TC-13-08 xác nhận xuất đóng ca, hủy mũi, đóng thai', …)`
- JUnit: `@DisplayName("TC-13-08 xác nhận xuất đóng ca, hủy mũi, đóng thai")`

Mẫu bảng Report 5.1: `docs/testing/UNIT_TEST_REPORT_TEMPLATE.md`.
