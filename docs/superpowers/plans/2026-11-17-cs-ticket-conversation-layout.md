# CS Ticket Conversation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm vùng trao đổi trên trang CS cao bằng cột xử lý, bỏ card yêu cầu nội bộ bên dưới và neo hội thoại ở tin mới nhất.

**Architecture:** Giữ nguyên dữ liệu và workflow. Chỉ điều chỉnh flex sizing trong `TicketPage`, thêm điểm truy cập semantic cho vùng chat và gọi cuộn xuống đáy ở đúng sự kiện đổi tab/nạp ticket.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-17-cs-ticket-conversation-layout-design.md`

## Global Constraints

- Không đổi backend, API hoặc quyền xử lý yêu cầu nội bộ.
- Không commit/push trong worktree đang có thay đổi chưa commit.
- Giữ nguyên vị trí khi tải thêm tin nhắn cũ.

## Review Focus

- Đổi tab công khai/nội bộ phải hiển thị tin mới nhất ở đáy.
- Nạp lại ticket sau khi gửi phải cuộn xuống tin vừa gửi.
- Tải tin cũ không được nhảy về đáy.
- Card kết quả, nếu có, vẫn hiển thị dưới hội thoại.
- Trên mobile, danh sách tin nhắn không làm trang dài vô hạn.

---

### Task 1: Bố cục và hành vi hội thoại CS

**Files:**
- Modify: `frontend/src/features/platform-support/pages/TicketPage.tsx`
- Test: `frontend/tests/unit/platform-support/PlatformSupportPages.test.tsx`

**Interfaces:**
- Consumes: `Ticket.messages`, `Segmented.onChange`, `messagesViewport`.
- Produces: vùng `role="log"` tên “Danh sách trao đổi”, bố cục flex co giãn, hành vi neo đáy.

- [ ] **Step 1: Viết test thất bại** xác nhận không còn heading “Yêu cầu nội bộ” và đổi tab đưa `scrollTop` về `scrollHeight`.
- [ ] **Step 2: Chạy test mục tiêu** và xác nhận test mới thất bại trên mã hiện tại.
- [ ] **Step 3: Sửa tối thiểu `TicketPage.tsx`**: bỏ card/component dư, cho card trao đổi co giãn, thêm vùng log cuộn và cuộn xuống đáy khi đổi tab.
- [ ] **Step 4: Chạy lại unit test, typecheck và build**; tất cả phải thành công.
- [ ] **Step 5: Kiểm tra runtime** ở kích thước desktop và xác nhận chiều cao/cách cuộn bằng giao diện thật.
