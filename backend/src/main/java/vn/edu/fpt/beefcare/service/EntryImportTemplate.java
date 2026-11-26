package vn.edu.fpt.beefcare.service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import vn.edu.fpt.beefcare.domain.Pen;
import vn.edu.fpt.beefcare.service.XlsxSupport.ListValidation;
import vn.edu.fpt.beefcare.service.XlsxSupport.Sheet;

/**
 * The workbook of the Excel import template (GBR-96, FE-06 popup Nhập bò từ Excel #1). Sheet 1 is the only sheet that is
 * imported; its columns follow {@link HerdEntryImportService#COLUMNS_VI}. Values the importer accepts are listed in the
 * guide so the file and the importer stay in step.
 */
final class EntryImportTemplate {

    /** Drop-downs cover the data rows the importer accepts (row 2 to 1 + MAX_ROWS). */
    private static final int LAST_ROW = 1 + HerdEntryImportService.MAX_ROWS;

    private EntryImportTemplate() {}

    static byte[] build(List<String> breeds, List<Pen> pens, List<String> purposes) {
        return XlsxSupport.writeWorkbook(List.of(dataSheet(breeds, pens, purposes), guideSheet(breeds, pens, purposes), catalogSheet(breeds, pens, purposes)));
    }

    private static Sheet dataSheet(List<String> breeds, List<Pen> pens, List<String> purposes) {
        List<ListValidation> validations = new ArrayList<>();
        validations.add(inline("C", "Đực,Cái"));
        validations.add(inline("E", "Chính xác,Ước tính,Không rõ"));
        validations.add(inline("H", "Cân thực tế,Ước tính"));
        if (!breeds.isEmpty()) {
            validations.add(catalog("B", "A", breeds.size()));
        }
        if (!pens.isEmpty()) {
            validations.add(catalog("I", "B", pens.size()));
        }
        if (!purposes.isEmpty()) {
            validations.add(catalog("J", "E", purposes.size()));
        }
        return new Sheet(
            HerdEntryImportService.DATA_SHEET,
            List.of(HerdEntryImportService.COLUMNS_VI),
            List.of(14, 18, 11, 26, 14, 20, 10, 14, 12, 20, 14, 14),
            true,
            Set.of(),
            Set.of(0),
            validations
        );
    }

    private static Sheet guideSheet(List<String> breeds, List<Pen> pens, List<String> purposes) {
        String breed = breeds.isEmpty() ? "Brahman" : breeds.get(0);
        String pen = pens.isEmpty() ? "A1" : pens.get(0).getCode();
        String purpose = purposes.isEmpty() ? "Vỗ béo" : purposes.get(0);
        List<List<Object>> rows = new ArrayList<>();
        rows.add(row("MẪU NHẬP DANH SÁCH BÒ VÀO PHIẾU NHẬP – BEEFCARE"));
        rows.add(row());
        rows.add(row("Cách dùng"));
        rows.add(row("1. Nhập mỗi con một dòng ở trang \"" + HerdEntryImportService.DATA_SHEET + "\", từ dòng 2. Không đổi tên, thứ tự cột hay dòng tiêu đề; giữ trang này là trang đầu tiên."));
        rows.add(row("2. Tối đa " + HerdEntryImportService.MAX_ROWS + " dòng dữ liệu; file .xlsx không quá 5 MB."));
        rows.add(row("3. Trên BeefCare: mở phiếu nhập NHÁP loại Mua ngoài → \"Nhập từ Excel\" → chọn file → xem kết quả từng dòng → \"Thêm n con vào phiếu\"."));
        rows.add(row("4. Dòng lỗi không được thêm (sửa file rồi tải lại). Dòng cảnh báo được thêm với giá trị mặc định; có thể sửa từng con trước khi ghi sổ."));
        rows.add(row("5. Giai đoạn sống không có cột: hệ thống đề xuất theo tuổi; không rõ tuổi thì để Trưởng thành (cảnh báo)."));
        rows.add(row());
        rows.add(row("Cột", "Bắt buộc", "Cách nhập", "Giá trị hợp lệ"));
        rows.add(row("Số tai", "Không", "Số thẻ tai; không trùng trong file, trong phiếu và với bò đang nuôi. Để trống nếu chưa gắn thẻ.", "Chữ, số (ô dạng văn bản, giữ số 0 ở đầu)"));
        rows.add(row("Giống", "Có", "Tên hoặc mã giống trong danh mục của trại.", "Xem trang \"" + HerdEntryImportService.CATALOG_SHEET + "\""));
        rows.add(row("Giới tính", "Có", "", "Đực, Cái"));
        rows.add(row("Ngày sinh hoặc Tuổi (tháng)", "Không", "Ngày sinh, tháng sinh hoặc tuổi theo tháng. Để trống → Không rõ (cảnh báo).", "dd/mm/yyyy · mm/yyyy · số tháng 1–240"));
        rows.add(row("Độ chính xác", "Không", "Độ chính xác của ngày sinh. Trống: ngày đủ → Chính xác; tháng/năm hoặc tuổi → Ước tính.", "Chính xác, Ước tính, Không rõ"));
        rows.add(row("Màu lông", "Không", "Màu lông, đặc điểm nhận dạng.", "Chữ tự do"));
        rows.add(row("Cân", "Có khi phiếu tính theo kg", "Cân nhập (kg).", "Số từ 1 đến 1500"));
        rows.add(row("Cơ sở cân", "Không", "Có cân mà để trống → Ước tính (cảnh báo).", "Cân thực tế, Ước tính"));
        rows.add(row("Chuồng", "Có", "Mã chuồng nhận đang hoạt động và còn chỗ.", "Xem trang \"" + HerdEntryImportService.CATALOG_SHEET + "\""));
        rows.add(row("Mục đích", "Không", "Tên hoặc mã mục đích nuôi. Để trống → mục đích \"Chưa xác định\" mặc định (cảnh báo).", "Xem trang \"" + HerdEntryImportService.CATALOG_SHEET + "\""));
        rows.add(row("Đơn giá", "Không", "Số tiền (đồng). Phiếu theo kg: đơn giá đ/kg. Phiếu theo con: thành tiền của con đó. Để trống → cảnh báo chưa có giá.", "Số nguyên ≥ 0, ví dụ 85000"));
        rows.add(row("Cách ly đến", "Không", "Ngày hết cách ly, không trước ngày nhập.", "dd/mm/yyyy"));
        rows.add(row());
        rows.add(row("Ví dụ (chép sang trang \"" + HerdEntryImportService.DATA_SHEET + "\" rồi sửa theo thực tế)"));
        rows.add(new ArrayList<>(HerdEntryImportService.COLUMNS_VI));
        rows.add(row("BC-0101", breed, "Cái", "15/03/2024", "Chính xác", "Vàng, đốm trắng trán", 245, "Cân thực tế", pen, purpose, 85000, null));
        rows.add(row(null, breed, "Đực", 18, null, null, 300, "Ước tính", pen, null, 85000, null));
        int tableHeader = 9;
        int exampleHeader = rows.size() - 3;
        return new Sheet(
            HerdEntryImportService.GUIDE_SHEET,
            rows,
            List.of(28, 16, 60, 34, 14, 20, 10, 14, 12, 20, 14, 14),
            false,
            Set.of(0, 2, tableHeader, exampleHeader - 1, exampleHeader),
            Set.of(),
            List.of()
        );
    }

    private static Sheet catalogSheet(List<String> breeds, List<Pen> pens, List<String> purposes) {
        List<List<Object>> rows = new ArrayList<>();
        rows.add(row("Giống", "Chuồng (mã)", "Tên chuồng", "Sức chứa", "Mục đích"));
        int size = Math.max(breeds.size(), Math.max(pens.size(), purposes.size()));
        for (int i = 0; i < size; i++) {
            Pen pen = i < pens.size() ? pens.get(i) : null;
            rows.add(row(
                i < breeds.size() ? breeds.get(i) : null,
                pen == null ? null : pen.getCode(),
                pen == null ? null : pen.getName(),
                pen == null ? null : pen.getCapacity(),
                i < purposes.size() ? purposes.get(i) : null
            ));
        }
        return new Sheet(HerdEntryImportService.CATALOG_SHEET, rows, List.of(24, 14, 24, 10, 24), true, Set.of(), Set.of(), List.of());
    }

    private static ListValidation inline(String column, String values) {
        return new ListValidation(column + "2:" + column + LAST_ROW, values, true);
    }

    private static ListValidation catalog(String column, String catalogColumn, int count) {
        return new ListValidation(column + "2:" + column + LAST_ROW, "'" + HerdEntryImportService.CATALOG_SHEET + "'!$" + catalogColumn + "$2:$" + catalogColumn + "$" + (count + 1), false);
    }

    private static List<Object> row(Object... cells) {
        return new ArrayList<>(Arrays.asList(cells));
    }
}
