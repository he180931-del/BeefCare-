# Account Settings Bento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển hai tab của popup Cài đặt tài khoản sang bố cục Bento lai, giữ nguyên hành vi và hợp đồng dữ liệu.

**Architecture:** Chỉ thay đổi cấu trúc trình bày trong các component thuộc `features/account`. `AccountDialog` tiếp tục sở hữu khung popup và sidebar; `ProfileCard` và `RolePermissionsPanel` chịu trách nhiệm các thẻ Bento trong vùng nội dung.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-23-account-settings-bento-design.md`

## Global Constraints

- Không đổi API, route, schema dữ liệu, validation hoặc logic lưu.
- Không thêm dependency.
- Giữ nguyên sidebar, kích thước popup và vùng cuộn độc lập.
- Bảng quyền tiếp tục bỏ các mục mức `NO` và không gọi API membership.

## Review Focus

- Tên dài và email dài không làm tràn thẻ nhận diện.
- Nút lưu vẫn submit đúng `profile-form` khi được chuyển vào Bento.
- Trạng thái Google-only vẫn hiện nút `Thêm mật khẩu`.
- Bộ chọn vai trò vẫn đổi đúng nội dung bảng và có trạng thái bàn phím rõ ràng.
- Popup không tràn ngang tại viewport `1180x820` và `1440x900`.

---

### Task 1: Bento hồ sơ

**Files:**
- Modify: `frontend/tests/unit/account/AccountLayout.test.tsx`
- Modify: `frontend/src/features/account/components/AccountProfilePanel.tsx`
- Modify: `frontend/src/features/account/components/ProfileParts.tsx`

**Interfaces:**
- Consumes: `ProfileCard` props hiện có và `profile-form`.
- Produces: các vùng có nhãn `Nhận diện tài khoản`, `Thông tin cá nhân`, `Đăng nhập và bảo mật`.

- [ ] **Step 1: Viết test thất bại** cho ba vùng Bento, vị trí nút lưu trong vùng thông tin cá nhân, trạng thái xác minh và hành động đổi mật khẩu.
- [ ] **Step 2: Chạy** `npm run test:unit:run -- frontend/tests/unit/account/AccountLayout.test.tsx` và xác nhận thất bại vì cấu trúc Bento chưa tồn tại.
- [ ] **Step 3: Sửa tối thiểu** `AccountProfilePanel` và `ProfileCard` để tạo lưới Bento responsive; giữ nguyên props, form id và callback.
- [ ] **Step 4: Chạy lại test** và xác nhận PASS.

### Task 2: Bento quyền theo vai trò

**Files:**
- Modify: `frontend/tests/unit/account/AccountPages.test.tsx`
- Modify: `frontend/src/features/account/components/RolePermissionsPanel.tsx`

**Interfaces:**
- Consumes: `PERMISSION_AREAS`, `FARM_ROLE_LABEL`, `Segmented`.
- Produces: thẻ `Vai trò đang xem` và thẻ `Phạm vi quyền` chứa bảng hiện tại.

- [ ] **Step 1: Viết test thất bại** cho hai thẻ Bento, mô tả vai trò và việc đổi vai trò vẫn lọc đúng quyền.
- [ ] **Step 2: Chạy** `npm run test:unit:run -- frontend/tests/unit/account/AccountPages.test.tsx` và xác nhận RED đúng nguyên nhân.
- [ ] **Step 3: Sửa tối thiểu** `RolePermissionsPanel` để tách thẻ chọn vai trò và thẻ bảng quyền, không đổi thuật toán quyền.
- [ ] **Step 4: Chạy lại test** và xác nhận PASS.

### Task 3: Kiểm chứng tích hợp giao diện

**Files:**
- Verify only: `frontend/src/features/account/**`

**Interfaces:**
- Consumes: kết quả Task 1–2.
- Produces: bằng chứng test, typecheck, build và runtime.

- [ ] **Step 1: Chạy** toàn bộ test account.
- [ ] **Step 2: Chạy** `npm run typecheck` và `npm run build`.
- [ ] **Step 3: Kiểm tra thủ công** popup tại `1180x820` và `1440x900`, hai tab, cuộn dọc và overflow ngang.
- [ ] **Step 4: Chạy** `git diff --check` và kiểm tra phạm vi thay đổi trước khi bàn giao; không commit nếu người dùng chưa yêu cầu.
