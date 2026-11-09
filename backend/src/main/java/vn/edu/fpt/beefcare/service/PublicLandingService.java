package vn.edu.fpt.beefcare.service;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Published, read-only copy for guests. No account, farm or payment data is exposed here. */
@Service
public class PublicLandingService {
    private static final String OFFICIAL_CONTACT_EMAIL = "tuanpqhe181869@fpt.edu.vn";
    private static final String OFFICIAL_CONTACT_PHONE = "0386 671 863";
    private final PlanPriceService prices;
    private final String contactEmail;
    private final String contactPhone;

    public PublicLandingService(PlanPriceService prices,
        @Value("$" + "{beefcare.public.contact-email:tuanpqhe181869@fpt.edu.vn}") String contactEmail,
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
                new Feature("Hồ sơ cá thể & thẻ QR", "Mã QR mở nhanh hồ sơ, thông tin và lịch sử theo từng con."),
                new Feature("Tăng trưởng & BCS", "Ghi cân nặng, thể trạng và theo dõi thay đổi theo thời gian."),
                new Feature("Tiêm phòng & sức khỏe", "Lưu lịch tiêm, điều trị và lịch tái khám."),
                new Feature("Sinh sản & đẻ", "Theo dõi động dục, phối giống, khám thai và ngày dự kiến sinh."),
                new Feature("Nhắc việc & thông báo trại", "Xem việc sắp đến hạn và tổng hợp tình hình trại."),
                new Feature("Nhiều trại độc lập", "Tách dữ liệu và phân quyền rõ ràng giữa các trại.")
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
