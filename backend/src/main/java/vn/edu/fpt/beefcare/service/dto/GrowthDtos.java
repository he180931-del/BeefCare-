package vn.edu.fpt.beefcare.service.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** DTO của FE-08 – Cân nặng &amp; thể trạng (request ghi / sửa và response hồ sơ tăng trưởng). */
public final class GrowthDtos {

    private GrowthDtos() {}

    /**
     * Một lần cân và/hoặc chấm BCS người dùng nhập (A3 ghi mới, và phần {@code values} khi sửa).
     *
     * @param measuredAt              thời điểm đo, bắt buộc, không ở tương lai
     * @param measuredBy              id người đo; bỏ trống là người đang thao tác
     * @param method                  {@code SCALE} / {@code TAPE} / {@code OTHER}; bắt buộc khi có cân nặng
     * @param weightKg                cân nặng (kg), 1 – 1.500, tối đa 1 chữ số thập phân; thước dây có thể để trống để tự tính
     * @param heartGirthCm            vòng ngực (cm), chỉ khi đo thước dây
     * @param bodyLengthCm            dài thân chéo (cm), chỉ khi đo thước dây
     * @param bcs                     điểm thể trạng theo thang của trại
     * @param note                    ghi chú của lần đo
     * @param acknowledgedLargeChange {@code true} khi người dùng đã xác nhận cảnh báo chênh lệch lớn (MSG-FE08-04)
     */
    public record Measurement(
        @NotNull Instant measuredAt,
        Long measuredBy,
        String method,
        @DecimalMin("1") @DecimalMax("1500") @Digits(integer = 4, fraction = 1) BigDecimal weightKg,
        BigDecimal heartGirthCm,
        BigDecimal bodyLengthCm,
        BigDecimal bcs,
        @Size(max = 500) String note,
        boolean acknowledgedLargeChange
    ) {}

    /**
     * A4 – sửa hoặc xóa (loại trừ mềm) một bản ghi cân.
     *
     * @param action          {@code CORRECT} (sửa) hoặc {@code EXCLUDE} (xóa khỏi lịch sử đo)
     * @param values          giá trị mới, bắt buộc khi {@code CORRECT}
     * @param reason          ghi chú, <b>không bắt buộc</b> (D43), tối đa 500 ký tự
     * @param expectedVersion phiên bản bản ghi người dùng đã đọc, để chặn sửa đè
     */
    public record Correction(
        @NotBlank String action,
        @Valid Measurement values,
        @Size(max = 500) String reason,
        @NotNull Integer expectedVersion
    ) {}

    /**
     * A2 – một dòng lịch sử đo. {@code revisions} (GAP-FE08-01, BR-D15): các lần sửa / xóa của bản ghi, cũ trước
     * mới sau, kèm giá trị trước khi đổi; chỉ có ở màn một con và trong response sửa (không có trong snapshot lịch sử).
     */
    public record Record(
        Long id,
        Long cattleId,
        Instant measuredAt,
        Instant recordedAt,
        Long measuredBy,
        String measuredByName,
        String method,
        BigDecimal weightKg,
        String basis,
        BigDecimal heartGirthCm,
        BigDecimal bodyLengthCm,
        BigDecimal bcs,
        String note,
        String status,
        boolean corrected,
        Integer version,
        @JsonInclude(JsonInclude.Include.NON_NULL) List<Revision> revisions
    ) {
        /** Dòng không kèm lịch sử sửa ({@code revisions} bị bỏ khỏi JSON). */
        public Record(
            Long id,
            Long cattleId,
            Instant measuredAt,
            Instant recordedAt,
            Long measuredBy,
            String measuredByName,
            String method,
            BigDecimal weightKg,
            String basis,
            BigDecimal heartGirthCm,
            BigDecimal bodyLengthCm,
            BigDecimal bcs,
            String note,
            String status,
            boolean corrected,
            Integer version
        ) {
            this(
                id,
                cattleId,
                measuredAt,
                recordedAt,
                measuredBy,
                measuredByName,
                method,
                weightKg,
                basis,
                heartGirthCm,
                bodyLengthCm,
                bcs,
                note,
                status,
                corrected,
                version,
                null
            );
        }

        /** Bản sao của dòng này kèm danh sách lịch sử sửa. */
        public Record withRevisions(List<Revision> list) {
            return new Record(
                id,
                cattleId,
                measuredAt,
                recordedAt,
                measuredBy,
                measuredByName,
                method,
                weightKg,
                basis,
                heartGirthCm,
                bodyLengthCm,
                bcs,
                note,
                status,
                corrected,
                version,
                list
            );
        }
    }

    /**
     * Một lần sửa / xóa, không đổi được: ai, khi nào, ghi chú (có thể {@code null}), giá trị trước và sau
     * (UC-FE08-03, TC-08-13).
     */
    public record Revision(
        Long id,
        Instant changedAt,
        String changedBy,
        String action,
        String reason,
        Map<String, Object> before,
        Map<String, Object> after
    ) {}

    /**
     * A2 – hồ sơ tăng trưởng của một con bò.
     *
     * <p>{@code targetKg} / {@code missingKg} / {@code adg60} / {@code finishingDays} (GAP-FE08-02, GBR-107): cân xuất
     * mục tiêu của bò Vỗ béo theo tham số trại {@code TARGET_FINISHING_WEIGHT_KG}, số kg còn thiếu so với lần cân hợp lệ
     * mới nhất, ADG 60 ngày dùng để tính và số ngày từ lần cân đó tới ngày dự kiến; {@code null} khi không áp dụng.
     *
     * <p>Tên schema là {@code GrowthSummary} vì tên {@code Summary} đã thuộc tóm tắt trại của FE-02 trong OpenAPI.
     */
    @Schema(name = "GrowthSummary")
    public record Summary(
        Record currentWeight,
        BigDecimal latestBcs,
        BigDecimal adg,
        Integer windowDays,
        LocalDate nextWeighing,
        LocalDate projectedFinishingDate,
        String finishingStatus,
        int measurements,
        List<Record> records,
        BigDecimal targetKg,
        BigDecimal missingKg,
        BigDecimal adg60,
        Integer finishingDays
    ) {}
}
