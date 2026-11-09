package vn.edu.fpt.beefcare.service;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Published, read-only copy for guests. No account, farm or payment data is exposed here. */
@Service
public class PublicLandingService {
    private static final String OFFICIAL_CONTACT_EMAIL = "beefcare@gmail.com";
    private static final String OFFICIAL_CONTACT_PHONE = "0386 671 863";
    private final PlanPriceService prices;
    private final String contactEmail;
    private final String contactPhone;

    public PublicLandingService(PlanPriceService prices,
        @Value("$" + "{beefcare.public.contact-email:beefcare@gmail.com}") String contactEmail,
        @Value("$" + "{beefcare.public.contact-phone:0386 671 863}") String contactPhone) {
        this.prices = prices;
        this.contactEmail = contactEmail == null || contactEmail.isBlank() ? OFFICIAL_CONTACT_EMAIL : contactEmail.trim();
        this.contactPhone = contactPhone == null || contactPhone.isBlank() ? OFFICIAL_CONTACT_PHONE : contactPhone.trim();
    }

    public LandingContent get() {
        return new LandingContent(
            "BeefCare",
            "Quản lý đàn bò và vận hành trang trại trên cùng một nền tảng.",
            List.of(
                new Feature("Hồ sơ cá thể & thẻ QR", "Mở đúng hồ sơ từng con bằng QR, xem ngay nhận diện, chuồng nuôi và lịch sử chăm sóc."),
                new Feature("Tăng trưởng & BCS", "Theo dõi cân nặng và BCS theo từng mốc, nhận ra thay đổi để chăm sóc kịp thời."),
                new Feature("Tiêm phòng & sức khỏe", "Quản lý lịch tiêm, điều trị và tái khám để không bỏ sót mốc sức khỏe quan trọng."),
                new Feature("Sinh sản & đẻ", "Theo dõi phối giống, khám thai và ngày dự kiến sinh theo từng cá thể."),
                new Feature("Nhắc việc & thông báo trại", "Nắm việc sắp đến hạn, ưu tiên đúng việc và phối hợp cả đội chủ động hơn."),
                new Feature("Nhiều trại độc lập", "Tách dữ liệu, quyền truy cập và phần việc rõ ràng cho từng trại.")
            ),
            List.of(
                new Faq("BeefCare phù hợp với quy mô trại nào?", "Tối ưu nhất cho trại bò thịt 150–300 con — quy mô đủ lớn để cần một hệ thống bài bản, đủ gọn để áp dụng nhanh. Trại nhỏ hơn vẫn bắt đầu nhẹ nhàng, số hóa từng hồ sơ và mở rộng khi đội ngũ sẵn sàng. Trại lớn hơn vẫn vận hành mạch lạc với quy trình chuẩn, phân quyền rõ và dữ liệu luôn trong tầm kiểm soát."),
                new Faq("Có cần cài ứng dụng để sử dụng BeefCare không?", "BeefCare chạy trực tiếp trên trình duyệt nên bạn không cần cài ứng dụng. Kỹ thuật viên có thể mở hồ sơ và ghi nhận ngay tại chuồng bằng điện thoại. Trên máy tính hoặc máy tính bảng, đội ngũ vẫn theo dõi được toàn cảnh của trại."),
                new Faq("Các kỳ hạn 1, 2 và 3 năm khác nhau như thế nào?", "Bạn có thể chọn kỳ hạn 1, 2 hoặc 3 năm cho từng trại theo kế hoạch vận hành. Giá hiển thị là tổng theo trại và theo kỳ hạn, không tính theo tháng hay theo đầu bò. Chọn kỳ hạn phù hợp để chủ động ngân sách và tập trung vào việc chăm đàn."),
                new Faq("Thanh toán và kích hoạt gói dịch vụ diễn ra ra sao?", "Chủ trại khởi tạo thanh toán bằng chuyển khoản ngân hàng theo gói đã chọn. BeefCare đối soát giao dịch và ghi nhận kỳ hạn khi khoản thanh toán được xác nhận. Không có tự động trừ tiền hay gia hạn ngoài ý muốn, nên mọi quyết định vẫn nằm trong tay bạn."),
                new Faq("Dữ liệu giữa các trại được tách riêng như thế nào?", "Mỗi trại có dữ liệu và quyền truy cập độc lập, kể cả khi một tài khoản tham gia nhiều trại. Thành viên chỉ nhìn thấy thông tin trong phạm vi membership và vai trò được cấp. Bạn có thể mở rộng quản lý mà không trộn lẫn hồ sơ, lịch sử hay công việc giữa các trại.")
            ),
            prices.current(),
            contactEmail == null || contactEmail.isBlank() ? null : contactEmail.trim(),
            contactPhone == null || contactPhone.isBlank() ? null : contactPhone.trim()
        );
    }

    public PlanPriceService.PriceVersion prices() {
        return prices.current();
    }

    public record Feature(String title, String description) {}
    public record Faq(String question, String answer) {}
    public record LandingContent(String name, String introduction, List<Feature> features, List<Faq> faq, PlanPriceService.PriceVersion prices, String contactEmail, String contactPhone) {}
}
