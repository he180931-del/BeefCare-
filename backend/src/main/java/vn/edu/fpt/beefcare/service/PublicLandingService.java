package vn.edu.fpt.beefcare.service;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Published, read-only copy for guests. No account, farm or payment data is exposed here. */
@Service
public class PublicLandingService {
    private final PlanPriceService prices;
    private final String contactEmail;

    public PublicLandingService(PlanPriceService prices, @Value("$" + "{beefcare.public.contact-email:}") String contactEmail) {
        this.prices = prices;
        this.contactEmail = contactEmail;
    }

    public LandingContent get() {
        return new LandingContent(
            "BeefCare",
            "Quản lý đàn bò và vận hành trang trại trên cùng một nền tảng.",
            List.of(
                new Feature("Quản lý đàn", "Hồ sơ bò, nhập xuất đàn, chuồng và dòng thời gian hoạt động."),
                new Feature("Chăm sóc và sinh sản", "Theo dõi tiêm phòng, điều trị, sức khỏe và sự kiện sinh sản."),
                new Feature("Thức ăn và báo cáo", "Quản lý tồn kho, khẩu phần, ghi nhận cho ăn và chi phí."),
                new Feature("Làm việc theo vai trò", "Chủ trại quản lý thành viên; nhân viên chỉ xem hoặc cập nhật phần được giao.")
            ),
            List.of(
                new Faq("BeefCare dùng cho ai?", "Cho chủ trại bò và các thành viên được mời vào trang trại."),
                new Faq("Có thể quản lý nhiều trang trại không?", "Một tài khoản Chủ trại có thể đăng ký và quản lý nhiều trang trại."),
                new Faq("Khi nào trang trại được kích hoạt?", "Sau khi khoản thanh toán đăng ký được xác nhận.")
            ),
            prices.current(),
            contactEmail == null || contactEmail.isBlank() ? null : contactEmail.trim()
        );
    }

    public PlanPriceService.PriceVersion prices() {
        return prices.current();
    }

    public record Feature(String title, String description) {}
    public record Faq(String question, String answer) {}
    public record LandingContent(String name, String introduction, List<Feature> features, List<Faq> faq, PlanPriceService.PriceVersion prices, String contactEmail) {}
}
