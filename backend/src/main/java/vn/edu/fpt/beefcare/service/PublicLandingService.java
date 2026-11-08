package vn.edu.fpt.beefcare.service;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Published, read-only copy for guests. No account, farm or payment data is exposed here. */
@Service
public class PublicLandingService {
    private final PlanPriceService prices;
    private final String contactEmail;
    private final String contactPhone;

    public PublicLandingService(PlanPriceService prices,
        @Value("$" + "{beefcare.public.contact-email:}") String contactEmail,
        @Value("$" + "{beefcare.public.contact-phone:}") String contactPhone) {
        this.prices = prices;
        this.contactEmail = contactEmail;
        this.contactPhone = contactPhone;
    }

    public LandingContent get() {
        return new LandingContent(
            "BeefCare",
            "Quản lý đàn bò và vận hành trang trại trên cùng một nền tảng.",
            List.of(
                new Feature("Hồ sơ cá thể", "Mã QR mở nhanh hồ sơ, thông tin và lịch sử theo từng con."),
                new Feature("Đàn và chuồng", "Quản lý nhóm đàn, vị trí chuồng và tình trạng hiện tại."),
                new Feature("Tăng trưởng và BCS", "Ghi cân nặng, thể trạng và theo dõi thay đổi theo thời gian."),
                new Feature("Tiêm phòng và sức khỏe", "Lưu lịch tiêm, điều trị và lịch tái khám."),
                new Feature("Sinh sản", "Theo dõi động dục, phối giống, khám thai và ngày dự kiến sinh."),
                new Feature("Nhắc việc và báo cáo", "Xem việc sắp đến hạn và tổng hợp tình hình trại.")
            ),
            List.of(
                new Faq("BeefCare phù hợp với quy mô trại nào?", "BeefCare hướng tới các trang trại bò thịt quy mô khoảng 150–300 con và vẫn dùng được cho trại nhỏ hơn hoặc lớn hơn."),
                new Faq("Quản lý được những thông tin nào của đàn bò?", "Hồ sơ từng cá thể, chuồng trại, cân nặng và thể trạng, tiêm phòng, sức khỏe, sinh sản, thức ăn và nhắc việc."),
                new Faq("Thành viên trại được phân quyền ra sao?", "Mỗi trại có Chủ trại, Quản lý và Kỹ thuật viên với quyền cố định theo vai trò. Chủ trại mời và quản lý thành viên."),
                new Faq("Có thể dùng trên điện thoại không?", "Có. BeefCare chạy trên trình duyệt, không cần cài ứng dụng; Kỹ thuật viên có giao diện điện thoại để ghi nhận tại chuồng."),
                new Faq("Tôi cần hỗ trợ khi bắt đầu từ đâu?", "Liên hệ BeefCare qua email hoặc điện thoại ở cuối trang; chúng tôi hướng dẫn tạo trại và mời thành viên.")
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
