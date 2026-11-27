# Bảng đối chiếu mã use case: SRS 28/10 → Report 3 v1.17

Report 3 v1.17 (27/11/2026) gộp 136 use case của SRS 28/10 thành 103 (sau khi đã bỏ UC-FE09-06 theo D46 và thêm UC-FE15-03 theo D86) và đánh số lại liền mạch trong từng feature. Không bỏ chức năng nào; các use case gộp chỉ đổi cách nhóm. Quyết định: D88 trong `docs/REQUIREMENT_DECISIONS.md`.

Code, test và spec `docs/requirements/specs/` vẫn dùng mã cũ. Khi dẫn chiếu sang báo cáo (Report 3, 4, 5) dùng cột **Mã mới**.

## Các use case gộp

| Mã mới | Tên mới | Mã cũ được gộp |
|---|---|---|
| UC-FE02-04 | View Platform Farm Services | UC-FE02-04 View Platform Farm Service Overview<br>UC-FE19-04 View Platform Subscriptions |
| UC-FE03-02 | Manage Farm Invitations | UC-FE03-02 View Farm Invitations<br>UC-FE03-03 Manage Pending Farm Invitation |
| UC-FE03-04 | Manage Farm Members | UC-FE03-05 View Farm Members<br>UC-FE03-06 Update Farm Member Role and Access |
| UC-FE03-05 | Manage Platform User Accounts | UC-FE03-07 View Platform User Accounts<br>UC-FE03-08 Suspend or Restore Platform User Account |
| UC-FE04-02 | Manage Pen | UC-FE04-02 Create Pen<br>UC-FE04-03 Update Pen Information<br>UC-FE04-04 Change Pen Availability |
| UC-FE05-01 | View Cattle List and Profile | UC-FE05-01 View Cattle List<br>UC-FE05-02 View Cattle Profile |
| UC-FE07-01 | Create or Update Farm Announcement | UC-FE07-01 Create Farm Announcement Draft<br>UC-FE07-02 Update Farm Announcement |
| UC-FE09-03 | Update or Stop Vaccination Schedule | UC-FE09-03 Update Vaccination Schedule<br>UC-FE09-04 Stop Vaccination Schedule |
| UC-FE11-01 | View Reproduction Status and History | UC-FE11-01 View Breeding Status and History<br>UC-FE12-01 View Pregnancy and Calving Records |
| UC-FE12-04 | Correct or Void Pregnancy and Calving Record | UC-FE12-05 Correct or Void Pregnancy Check Result<br>UC-FE12-06 Correct or Void Pregnancy and Calving Record |
| UC-FE14-02 | View Platform Notifications | UC-FE14-02 View Subscription Notifications<br>UC-FE14-03 View Support Notifications<br>UC-FE14-04 View Payment Reconciliation Notifications |
| UC-FE18-01 | Manage Breed Catalogue | UC-FE18-01 View Breed Catalogue<br>UC-FE18-02 Create Breed<br>UC-FE18-03 Update Breed<br>UC-FE18-04 Change Breed Availability |
| UC-FE18-02 | Manage Vaccine Catalogue | UC-FE18-05 View Vaccine Catalogue<br>UC-FE18-06 Create Vaccine Reference<br>UC-FE18-07 Update Vaccine Reference<br>UC-FE18-08 Change Vaccine Availability or Remove Unused Reference |
| UC-FE18-03 | Manage Medicine Catalogue | UC-FE18-09 View Medicine Reference Catalogue<br>UC-FE18-10 Create Medicine Reference<br>UC-FE18-11 Update Medicine Reference<br>UC-FE18-12 Change Medicine Reference Availability |
| UC-FE18-04 | Manage Production Purpose Catalogue | UC-FE18-13 View Production Purpose Catalogue<br>UC-FE18-14 Create Production Purpose<br>UC-FE18-15 Update Production Purpose<br>UC-FE18-16 Change Production Purpose Availability |
| UC-FE19-01 | View Farm Subscription and Payments | UC-FE19-01 View Farm Subscription and Plan<br>UC-FE19-03 View Own Subscription Payments |
| UC-FE19-03 | Reconcile Subscription Payment | UC-FE19-05 View Payment Transactions and Evidence<br>UC-FE19-06 Reconcile Subscription Payment |
| UC-FE20-03 | Reply to Support Ticket | UC-FE20-03 Reply to Own Support Ticket<br>UC-FE20-08 Reply to Support Ticket<br>UC-FE20-09 Add CS Internal Ticket Note |
| UC-FE21-02 | Manage Draft Finance Records | UC-FE21-02 Create Manual Finance Record<br>UC-FE21-03 View Manual Finance Records<br>UC-FE21-04 Update Draft Finance Record<br>UC-FE21-05 Discard Draft Finance Record |
| UC-FE21-05 | View and Export Platform Cash Report | UC-FE21-08 View Platform Cash Report<br>UC-FE21-09 Export Platform Cash Report |

## Toàn bộ mã cũ

| Mã cũ | Tên cũ | Mã mới | Ghi chú |
|---|---|---|---|
| UC-FE01-01 | Register Farm Owner Account | UC-FE01-01 |  |
| UC-FE01-02 | Sign In | UC-FE01-02 |  |
| UC-FE01-03 | Sign Out | UC-FE01-03 |  |
| UC-FE01-04 | View and Update Own Profile | UC-FE01-04 |  |
| UC-FE01-05 | Reset Forgotten Password | UC-FE01-05 |  |
| UC-FE01-06 | Change Password | UC-FE01-06 |  |
| UC-FE02-01 | Register Farm Workspace | UC-FE02-01 |  |
| UC-FE02-02 | View and Select Authorized Farm Workspace | UC-FE02-02 |  |
| UC-FE02-03 | Update Farm Information | UC-FE02-03 |  |
| UC-FE02-04 | View Platform Farm Service Overview | UC-FE02-04 | gộp |
| UC-FE02-05 | Suspend or Restore Farm Service | UC-FE02-05 |  |
| UC-FE03-01 | Send Farm Member Invitation | UC-FE03-01 |  |
| UC-FE03-02 | View Farm Invitations | UC-FE03-02 | gộp |
| UC-FE03-03 | Manage Pending Farm Invitation | UC-FE03-02 | gộp |
| UC-FE03-04 | Accept Farm Invitation | UC-FE03-03 | đổi số |
| UC-FE03-05 | View Farm Members | UC-FE03-04 | gộp |
| UC-FE03-06 | Update Farm Member Role and Access | UC-FE03-04 | gộp |
| UC-FE03-07 | View Platform User Accounts | UC-FE03-05 | gộp |
| UC-FE03-08 | Suspend or Restore Platform User Account | UC-FE03-05 | gộp |
| UC-FE03-09 | Manage Platform Staff Access | UC-FE03-06 | đổi số |
| UC-FE04-01 | View Pens and Occupancy | UC-FE04-01 |  |
| UC-FE04-02 | Create Pen | UC-FE04-02 | gộp |
| UC-FE04-03 | Update Pen Information | UC-FE04-02 | gộp |
| UC-FE04-04 | Change Pen Availability | UC-FE04-02 | gộp |
| UC-FE04-05 | Reassign Cattle to Another Pen | UC-FE04-03 | đổi số |
| UC-FE05-01 | View Cattle List | UC-FE05-01 | gộp |
| UC-FE05-02 | View Cattle Profile | UC-FE05-01 | gộp |
| UC-FE05-03 | Update Cattle Profile | UC-FE05-02 | đổi số |
| UC-FE05-04 | Issue or Replace Cattle QR Tag | UC-FE05-03 | đổi số |
| UC-FE05-05 | Scan Cattle QR Code | UC-FE05-04 | đổi số |
| UC-FE06-01 | Register Herd Entry Voucher | UC-FE06-01 |  |
| UC-FE06-02 | View Herd Entry Vouchers | UC-FE06-02 |  |
| UC-FE06-03 | Correct Herd Entry Record | UC-FE06-03 |  |
| UC-FE06-04 | Record Herd Entry Voucher Payment | UC-FE06-04 |  |
| UC-FE06-05 | Void Herd Entry Voucher | UC-FE06-05 |  |
| UC-FE07-01 | Create Farm Announcement Draft | UC-FE07-01 | gộp |
| UC-FE07-02 | Update Farm Announcement | UC-FE07-01 | gộp |
| UC-FE07-03 | Publish Farm Announcement | UC-FE07-02 | đổi số |
| UC-FE07-04 | View Farm Announcements and History | UC-FE07-03 | đổi số |
| UC-FE08-01 | Record Cattle Growth Assessment | UC-FE08-01 |  |
| UC-FE08-02 | View Growth and BCS History | UC-FE08-02 |  |
| UC-FE08-03 | Correct Growth Assessment Record | UC-FE08-03 |  |
| UC-FE09-01 | View Vaccination Schedules | UC-FE09-01 |  |
| UC-FE09-02 | Create Vaccination Schedule | UC-FE09-02 |  |
| UC-FE09-03 | Update Vaccination Schedule | UC-FE09-03 | gộp |
| UC-FE09-04 | Stop Vaccination Schedule | UC-FE09-03 | gộp |
| UC-FE09-05 | Record Vaccination | UC-FE09-04 | đổi số |
| UC-FE09-06 | Defer Vaccination Dose | — | bỏ theo D46 |
| UC-FE09-07 | View Vaccination History | UC-FE09-05 | đổi số |
| UC-FE09-08 | Correct or Void Vaccination Record | UC-FE09-06 | đổi số |
| UC-FE10-01 | View Health Cases and Treatment History | UC-FE10-01 |  |
| UC-FE10-02 | Open Health Case | UC-FE10-02 |  |
| UC-FE10-03 | Update Health Case Status and Observation | UC-FE10-03 |  |
| UC-FE10-04 | Record Treatment | UC-FE10-04 |  |
| UC-FE10-05 | Correct or Void Treatment or Follow-up | UC-FE10-05 |  |
| UC-FE11-01 | View Breeding Status and History | UC-FE11-01 | gộp |
| UC-FE11-02 | Record Estrus Event | UC-FE11-02 |  |
| UC-FE11-03 | Record Breeding Event | UC-FE11-03 |  |
| UC-FE11-04 | Correct or Void Estrus and Breeding Record | UC-FE11-04 |  |
| UC-FE12-01 | View Pregnancy and Calving Records | UC-FE11-01 | gộp |
| UC-FE12-02 | Record Pregnancy Check Result | UC-FE12-01 | đổi số |
| UC-FE12-03 | Update Pregnancy Status | UC-FE12-02 | đổi số |
| UC-FE12-04 | Record Calving Event and Outcome | UC-FE12-03 | đổi số |
| UC-FE12-05 | Correct or Void Pregnancy Check Result | UC-FE12-04 | gộp |
| UC-FE12-06 | Correct or Void Pregnancy and Calving Record | UC-FE12-04 | gộp |
| UC-FE13-01 | Record and Confirm Herd Exit Voucher | UC-FE13-01 |  |
| UC-FE13-02 | View Herd Exit Vouchers | UC-FE13-02 |  |
| UC-FE13-03 | Void Herd Exit Voucher | UC-FE13-03 |  |
| UC-FE13-04 | Record Herd Exit Voucher Collection | UC-FE13-04 |  |
| UC-FE14-01 | View Farm Reminders and Suggestions | UC-FE14-01 |  |
| UC-FE14-02 | View Subscription Notifications | UC-FE14-02 | gộp |
| UC-FE14-03 | View Support Notifications | UC-FE14-02 | gộp |
| UC-FE14-04 | View Payment Reconciliation Notifications | UC-FE14-02 | gộp |
| UC-FE15-01 | View Farm Operational Dashboard | UC-FE15-01 |  |
| UC-FE15-02 | View and Print Farm Management Report | UC-FE15-02 |  |
| UC-FE15-03 | View Farm Cash Report | UC-FE15-03 | thêm theo D86, không có trong SRS 28/10 |
| UC-FE16-01 | View Cattle Activity Timeline | UC-FE16-01 |  |
| UC-FE17-01 | View Platform Audit History | UC-FE17-01 |  |
| UC-FE18-01 | View Breed Catalogue | UC-FE18-01 | gộp |
| UC-FE18-02 | Create Breed | UC-FE18-01 | gộp |
| UC-FE18-03 | Update Breed | UC-FE18-01 | gộp |
| UC-FE18-04 | Change Breed Availability | UC-FE18-01 | gộp |
| UC-FE18-05 | View Vaccine Catalogue | UC-FE18-02 | gộp |
| UC-FE18-06 | Create Vaccine Reference | UC-FE18-02 | gộp |
| UC-FE18-07 | Update Vaccine Reference | UC-FE18-02 | gộp |
| UC-FE18-08 | Change Vaccine Availability or Remove Unused Reference | UC-FE18-02 | gộp |
| UC-FE18-09 | View Medicine Reference Catalogue | UC-FE18-03 | gộp |
| UC-FE18-10 | Create Medicine Reference | UC-FE18-03 | gộp |
| UC-FE18-11 | Update Medicine Reference | UC-FE18-03 | gộp |
| UC-FE18-12 | Change Medicine Reference Availability | UC-FE18-03 | gộp |
| UC-FE18-13 | View Production Purpose Catalogue | UC-FE18-04 | gộp |
| UC-FE18-14 | Create Production Purpose | UC-FE18-04 | gộp |
| UC-FE18-15 | Update Production Purpose | UC-FE18-04 | gộp |
| UC-FE18-16 | Change Production Purpose Availability | UC-FE18-04 | gộp |
| UC-FE18-17 | Configure Farm State and Reminder References | UC-FE18-05 | đổi số |
| UC-FE19-01 | View Farm Subscription and Plan | UC-FE19-01 | gộp |
| UC-FE19-02 | Request Subscription Payment | UC-FE19-02 |  |
| UC-FE19-03 | View Own Subscription Payments | UC-FE19-01 | gộp |
| UC-FE19-04 | View Platform Subscriptions | UC-FE02-04 | gộp |
| UC-FE19-05 | View Payment Transactions and Evidence | UC-FE19-03 | gộp |
| UC-FE19-06 | Reconcile Subscription Payment | UC-FE19-03 | gộp |
| UC-FE19-07 | Update Subscription Plan Terms | UC-FE19-04 | đổi số |
| UC-FE19-08 | Confirm Subscription Payment from SePay | UC-FE19-05 | đổi số |
| UC-FE20-01 | Create Support Ticket | UC-FE20-01 |  |
| UC-FE20-02 | View Own Support Tickets | UC-FE20-02 |  |
| UC-FE20-03 | Reply to Own Support Ticket | UC-FE20-03 | gộp |
| UC-FE20-04 | Confirm Ticket Resolution | UC-FE20-04 |  |
| UC-FE20-05 | Reopen Resolved Support Ticket | UC-FE20-05 |  |
| UC-FE20-06 | View Support Ticket Queue | UC-FE20-06 |  |
| UC-FE20-07 | Manage Ticket Assignment and Processing | UC-FE20-07 |  |
| UC-FE20-08 | Reply to Support Ticket | UC-FE20-03 | gộp |
| UC-FE20-09 | Add CS Internal Ticket Note | UC-FE20-03 | gộp |
| UC-FE20-10 | Resolve Support Ticket | UC-FE20-08 | đổi số |
| UC-FE20-11 | Close Support Ticket | UC-FE20-09 | đổi số |
| UC-FE20-12 | Manage Ticket Internal Requests | UC-FE20-10 | đổi số |
| UC-FE20-13 | Handle Assigned Internal Support Request | UC-FE20-11 | đổi số |
| UC-FE21-01 | View Subscription Receipts | UC-FE21-01 |  |
| UC-FE21-02 | Create Manual Finance Record | UC-FE21-02 | gộp |
| UC-FE21-03 | View Manual Finance Records | UC-FE21-02 | gộp |
| UC-FE21-04 | Update Draft Finance Record | UC-FE21-02 | gộp |
| UC-FE21-05 | Discard Draft Finance Record | UC-FE21-02 | gộp |
| UC-FE21-06 | Post Finance Record | UC-FE21-03 | đổi số |
| UC-FE21-07 | Void Posted Finance Record | UC-FE21-04 | đổi số |
| UC-FE21-08 | View Platform Cash Report | UC-FE21-05 | gộp |
| UC-FE21-09 | Export Platform Cash Report | UC-FE21-05 | gộp |
| UC-FE22-01 | View Public Landing Page | UC-FE22-01 |  |
| UC-FE23-01 | View Feed Stock | UC-FE23-01 |  |
| UC-FE23-02 | Record Feed Receipt | UC-FE23-02 |  |
| UC-FE23-03 | Void Feed Receipt | UC-FE23-03 |  |
| UC-FE23-04 | Record Stock Adjustment | UC-FE23-04 |  |
| UC-FE23-05 | View Rations | UC-FE23-05 |  |
| UC-FE23-06 | Create or Update Ration | UC-FE23-06 |  |
| UC-FE23-07 | View Feeding Log | UC-FE23-07 |  |
| UC-FE23-08 | Record Feeding Session | UC-FE23-08 |  |
| UC-FE23-09 | Correct or Void Feeding Record | UC-FE23-09 |  |
| UC-FE23-10 | Maintain Feed Catalogue and Suppliers | UC-FE23-10 |  |
| UC-FE23-11 | View Feed Consumption and Cost Report | UC-FE23-11 |  |

## Số use case theo feature

| Feature | SRS 28/10 | Report 3 v1.17 |
|---|---|---|
| FE-01 | 6 | 6 |
| FE-02 | 5 | 5 |
| FE-03 | 9 | 6 |
| FE-04 | 5 | 3 |
| FE-05 | 5 | 4 |
| FE-06 | 5 | 5 |
| FE-07 | 4 | 3 |
| FE-08 | 3 | 3 |
| FE-09 | 8 | 6 |
| FE-10 | 5 | 5 |
| FE-11 | 4 | 4 |
| FE-12 | 6 | 4 |
| FE-13 | 4 | 4 |
| FE-14 | 4 | 2 |
| FE-15 | 2 | 3 |
| FE-16 | 1 | 1 |
| FE-17 | 1 | 1 |
| FE-18 | 17 | 5 |
| FE-19 | 8 | 5 |
| FE-20 | 13 | 11 |
| FE-21 | 9 | 5 |
| FE-22 | 1 | 1 |
| FE-23 | 11 | 11 |
| **Tổng** | **136** | **103** |
