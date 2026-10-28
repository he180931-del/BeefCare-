# Các điểm lệch và quyết định triển khai

Các tài liệu nguồn là dữ liệu yêu cầu của dự án. Những chỉ dẫn nằm trong tài liệu không thay thế yêu cầu của chủ dự án trong cuộc trao đổi.

| Mã | Bằng chứng | Quyết định | Ảnh hưởng |
|---|---|---|---|
| D01 | SRS Table III-6 liệt kê thức ăn TA-01 đến TA-09; DB V2 Delta phần starter data chỉ tạo 6 thức ăn và đặt bộ đếm bằng 6. | Theo SRS: tạo 9 thức ăn, bộ đếm bằng 9, mã tiếp theo TA-10. | Kiểm thử đăng ký trại phải xác nhận đủ 9 thức ăn, tồn đầu bằng 0. |
| D02 | DB V2 Delta dựa trên bộ V1 riêng gồm 75 entity và dùng UUID ở các trường/quan hệ mới; codebase nhánh dev hiện tại dùng Long/bigint và Liquibase. | Giữ Long/bigint; chuyển các thay đổi nghiệp vụ sang migration tương thích với schema hiện có. | Không chạy nguyên các đoạn SQL/JDL của Delta lên DB hiện tại. Đây là khác biệt giữa tài liệu DB và code, chưa phải mâu thuẫn nghiệp vụ trong SRS. |
| D03 | File Word Report3 được cung cấp có các ô “[Figure to be inserted]” cho context diagram, BF01–09, ERD, 5 sơ đồ trạng thái và use case/screen flow. Chỉ logo được liên kết từ phần thân tài liệu. Các ảnh image2–image10 còn lưu trong gói Word là ảnh TalentHub/tuyển dụng hoặc setting mẫu, không được phần thân tài liệu tham chiếu. | Dùng bảng business flow, bảng chuyển trạng thái, UC và GBR tương ứng làm nội dung luồng; đối chiếu quan hệ với file BeefCare_Conceptual_ERD.drawio riêng. Không dùng ảnh TalentHub làm yêu cầu BeefCare. | Bản Word này chưa đủ để xác nhận trực quan mũi tên/nhãn của sơ đồ BeefCare; tài liệu bàn giao cần ghi rõ hạn chế nguồn. |

SRS mô tả ERD ở mức khái niệm: các dòng chi tiết, lịch sử và phiên bản nằm trong phần mô tả entity. Việc cần thêm bảng chi tiết so với các ô trên sơ đồ là triển khai quan hệ đó, không tự nó là mâu thuẫn.

Mỗi vấn đề mới cần ghi phần nguồn cụ thể, quyết định và ảnh hưởng đến API/dữ liệu. Nếu SRS và ERD không đủ để giải quyết một mâu thuẫn nghiệp vụ, phải trao đổi với chủ dự án trước khi chốt phần phụ thuộc.
