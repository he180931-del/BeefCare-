from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation


HEADERS = [
    "Số thẻ tai",
    "Tên gọi",
    "Giống *",
    "Giới tính *",
    "Tháng sinh (MM/YYYY) *",
    "Độ chính xác ngày sinh *",
    "Giai đoạn sống *",
    "Mục đích nuôi *",
    "Cân nhập (kg) *",
    "Cơ sở cân *",
    "Chuồng nhận *",
    "Đơn giá (đ/kg)",
]

EXAMPLE = [
    "VN-0601",
    "Bò 601",
    "Lai Sind",
    "Cái",
    "04/2025",
    "Ước tính",
    "Bò tơ",
    "Bò sinh sản · loại Sinh sản",
    236,
    "Cân thực tế",
    "A1",
    85000,
]


def add_list_validation(sheet, column, values):
    validation = DataValidation(type="list", formula1=f'"{",".join(values)}"', allow_blank=False)
    validation.error = "Hãy chọn một giá trị có trong danh sách."
    validation.errorTitle = "Giá trị không hợp lệ"
    validation.prompt = "Chọn giá trị từ danh sách."
    validation.promptTitle = "BeefCare"
    sheet.add_data_validation(validation)
    validation.add(f"{column}2:{column}201")


def create_template():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Danh sách bò"
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = "A1:L201"
    sheet.sheet_view.showGridLines = False

    required_fill = PatternFill("solid", fgColor="FFF2CC")
    optional_fill = PatternFill("solid", fgColor="D9EAD3")
    header_font = Font(name="Arial", size=10, bold=True, color="183528")
    input_font = Font(name="Arial", size=10, color="0000FF")

    for index, header in enumerate(HEADERS, start=1):
        cell = sheet.cell(1, index, header)
        cell.font = header_font
        cell.fill = required_fill if header.endswith("*") else optional_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.comment = Comment(
            "Bắt buộc" if header.endswith("*") else "Không bắt buộc",
            "BeefCare",
        )

    for index, value in enumerate(EXAMPLE, start=1):
        cell = sheet.cell(2, index, value)
        cell.font = input_font
        cell.alignment = Alignment(vertical="center", wrap_text=True)

    for row in sheet.iter_rows(min_row=3, max_row=201, min_col=1, max_col=12):
        for cell in row:
            cell.font = input_font

    widths = [16, 18, 18, 13, 23, 25, 20, 34, 18, 18, 17, 19]
    for index, width in enumerate(widths, start=1):
        sheet.column_dimensions[chr(64 + index)].width = width
    sheet.row_dimensions[1].height = 42
    sheet.row_dimensions[2].height = 26
    sheet["I2"].number_format = "0.00"
    sheet["L2"].number_format = "#,##0"

    add_list_validation(sheet, "D", ["Đực", "Cái"])
    add_list_validation(sheet, "F", ["Chính xác", "Ước tính", "Không rõ"])
    add_list_validation(sheet, "G", ["Bê theo mẹ", "Bò tơ", "Vỗ béo", "Bò cái", "Đực giống", "Chưa xác định"])
    add_list_validation(sheet, "H", ["Bò sinh sản · loại Sinh sản", "Nuôi thương phẩm · loại Vỗ béo", "Giữ giống · loại Đực giống", "Chưa xác định"])
    add_list_validation(sheet, "J", ["Cân thực tế", "Ước tính"])
    add_list_validation(sheet, "K", ["A1", "A2", "B1", "B2", "C1"])

    guide = workbook.create_sheet("Hướng dẫn")
    guide.sheet_view.showGridLines = False
    guide.column_dimensions["A"].width = 24
    guide.column_dimensions["B"].width = 92
    guide["A1"] = "MẪU NHẬP ĐÀN BEEFCARE"
    guide["A1"].font = Font(name="Arial", size=14, bold=True, color="183528")
    guide.merge_cells("A1:B1")
    notes = [
        ("Cách sử dụng", "Nhập dữ liệu tại sheet 'Danh sách bò'. Giữ nguyên tên và thứ tự cột."),
        ("Dòng ví dụ", "Dòng 2 là ví dụ đúng định dạng. Hãy thay bằng dữ liệu thật hoặc xóa trước khi tải lên."),
        ("Màu vàng", "Cột bắt buộc phải có dữ liệu."),
        ("Màu xanh", "Cột không bắt buộc; số thẻ tai có thể để trống để gắn sau."),
        ("Giới hạn", "Tối đa 200 con mỗi file; cân nhập từ 1 đến 1500 kg; chỉ dùng file .xlsx."),
        ("Tháng sinh", "Nhập đúng định dạng MM/YYYY, ví dụ 04/2025."),
        ("Không sửa", "Không đổi tên sheet 'Danh sách bò' và không đổi tiêu đề cột."),
    ]
    for row, (title, description) in enumerate(notes, start=3):
        guide.cell(row, 1, title).font = Font(name="Arial", size=10, bold=True, color="183528")
        guide.cell(row, 2, description).font = Font(name="Arial", size=10)
        guide.cell(row, 2).alignment = Alignment(wrap_text=True, vertical="top")
        guide.row_dimensions[row].height = 32

    output = Path(__file__).resolve().parents[1] / "public" / "templates" / "beefcare-herd-entry-template.xlsx"
    output.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output)
    print(output)


if __name__ == "__main__":
    create_template()
