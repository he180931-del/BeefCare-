package vn.edu.fpt.beefcare.web.rest;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.edu.fpt.beefcare.service.PlatformFinanceService;
import vn.edu.fpt.beefcare.service.PlatformFinanceService.*;

/** Purpose-built PM finance workflow; generated entity CRUD endpoints remain denied. */
@RestController
@RequestMapping("/api/platform/finance")
public class PlatformFinanceResource {
    private final PlatformFinanceService service;
    public PlatformFinanceResource(PlatformFinanceService service) { this.service = service; }

    @GetMapping("/records")
    public Page<RecordDTO> records(
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String state,
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) Long farmId,
        @RequestParam(required = false) java.time.LocalDate from,
        @RequestParam(required = false) java.time.LocalDate to,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "25") int size
    ) { return service.search(type, state, category, scope, farmId, from, to, page, size); }

    @GetMapping("/records/{id}")
    public RecordDetail detail(@PathVariable Long id) { return service.detail(id); }

    @GetMapping("/bank-transactions")
    public List<BankTransactionChoice> bankTransactions() { return service.bankTransactions(); }

    @GetMapping("/categories")
    public PlatformFinanceService.FinanceCategories categories() { return service.categories(); }

    @PostMapping("/records")
    public ResponseEntity<RecordDTO> create(@RequestBody CreateRecord command) { return ResponseEntity.status(201).body(service.create(command)); }

    @PutMapping("/records/{id}")
    public RecordDTO update(@PathVariable Long id, @RequestBody VersionedRecord command) { return service.update(id, command); }

    @PostMapping("/records/{id}/discard")
    public RecordDTO discard(@PathVariable Long id, @RequestBody VersionedAction command) { return service.discard(id, command); }

    @PostMapping("/records/{id}/post")
    public RecordDTO post(@PathVariable Long id, @RequestBody VersionedAction command) { return service.post(id, command); }

    @PostMapping("/records/{id}/void")
    public RecordDTO voidPosted(@PathVariable Long id, @RequestBody VersionedAction command) { return service.voidPosted(id, command); }

    @PostMapping("/records/{id}/replacement")
    public ResponseEntity<RecordDTO> replacement(@PathVariable Long id, @RequestBody(required = false) VersionedAction command) {
        return ResponseEntity.status(201).body(service.createReplacement(id, command));
    }

    @PostMapping("/reports")
    public ResponseEntity<CashReport> runReport(@RequestBody ReportRequest request) { return ResponseEntity.status(201).body(service.runReport(request)); }

    @GetMapping("/reports/{id}")
    public CashReport report(@PathVariable Long id) { return service.report(id); }

    @GetMapping(value = "/reports/{id}/xlsx", produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<byte[]> export(@PathVariable Long id) {
        ExportSnapshot snapshot = service.exportSnapshot(id);
        try {
            byte[] bytes = workbook(snapshot);
            return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=beefcare-cash-report-" + id + ".xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
        } catch (Exception failure) {
            throw new IllegalStateException("Could not create cash report workbook", failure);
        }
    }

    private static byte[] workbook(ExportSnapshot snapshot) throws Exception {
        List<List<Object>> summary = new java.util.ArrayList<>();
        summary.add(List.of("BeefCare platform cash flow", "VND"));
        summary.add(List.of("Period", snapshot.dateFrom().toString() + " – " + snapshot.dateTo()));
        summary.add(List.of("Farm filter", snapshot.criteria().farmId() == null ? "All farms" : snapshot.criteria().farmId()));
        summary.add(List.of("Source filter", snapshot.criteria().sourceFilter()));
        summary.add(List.of("Generated at", snapshot.asOf().toString()));
        summary.add(List.of("Currency", "VND"));
        summary.add(List.of("Subscription receipts", snapshot.summary().subscriptionReceipts()));
        summary.add(List.of("Other income", snapshot.summary().otherIncome()));
        summary.add(List.of("Total income", snapshot.summary().totalIncome()));
        summary.add(List.of("Total expense", snapshot.summary().totalExpense()));
        summary.add(List.of("Net cash flow", snapshot.summary().netCashFlow()));
        summary.add(List.of("Note", "Cash flow only; not statutory profit."));
        summary.add(List.of("Scope", "Farm ID", "Farm", "Subscription receipts", "Other income", "Expense", "Net"));
        for (ScopeTotals s : snapshot.summary().scopes()) summary.add(List.of(s.scope(), s.farmId() == null ? "" : s.farmId(), s.farmName() == null ? "" : s.farmName(), s.subscriptionReceipts(), s.otherIncome(), s.expense(), s.subscriptionReceipts().add(s.otherIncome()).subtract(s.expense())));

        List<List<Object>> details = new java.util.ArrayList<>();
        details.add(List.of("Source type", "Code", "Scope", "Farm", "Direction", "Category", "Description", "Amount VND", "Cash date", "Status", "Source reference"));
        for (ReportLine line : snapshot.lines()) details.add(List.of(line.sourceType(), line.code(), line.scope(), line.farmName() == null ? "" : line.farmName(), line.direction(), line.category(), line.description() == null ? "" : line.description(), line.amount(), line.cashDate().toString(), line.status(), line.sourceReference() == null ? "" : line.sourceReference()));

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            entry(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/worksheets/sheet2.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            entry(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            entry(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Summary\" sheetId=\"1\" r:id=\"rId1\"/><sheet name=\"Details\" sheetId=\"2\" r:id=\"rId2\"/></sheets></workbook>");
            entry(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet2.xml\"/></Relationships>");
            entry(zip, "xl/worksheets/sheet1.xml", sheet(summary));
            entry(zip, "xl/worksheets/sheet2.xml", sheet(details));
        }
        return bytes.toByteArray();
    }

    private static String sheet(List<List<Object>> rows) {
        StringBuilder xml = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
        for (int r = 0; r < rows.size(); r++) {
            xml.append("<row r=\"").append(r + 1).append("\">");
            for (int c = 0; c < rows.get(r).size(); c++) {
                Object value = rows.get(r).get(c);
                String ref = column(c + 1) + (r + 1);
                if (value instanceof Number) xml.append("<c r=\"").append(ref).append("\"><v>").append(value).append("</v></c>");
                else xml.append("<c r=\"").append(ref).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(escape(String.valueOf(value))).append("</t></is></c>");
            }
            xml.append("</row>");
        }
        return xml.append("</sheetData></worksheet>").toString();
    }

    private static String column(int index) { StringBuilder value = new StringBuilder(); while (index > 0) { int rem = (index - 1) % 26; value.insert(0, (char) ('A' + rem)); index = (index - 1) / 26; } return value.toString(); }
    private static String escape(String s) {
        StringBuilder out = new StringBuilder();
        s.codePoints().filter(cp -> cp == 0x9 || cp == 0xA || cp == 0xD || cp >= 0x20 && cp <= 0xD7FF || cp >= 0xE000 && cp <= 0xFFFD || cp >= 0x10000 && cp <= 0x10FFFF)
            .forEach(cp -> {
                switch (cp) {
                    case '&' -> out.append("&amp;");
                    case '<' -> out.append("&lt;");
                    case '>' -> out.append("&gt;");
                    case '"' -> out.append("&quot;");
                    case '\'' -> out.append("&apos;");
                    default -> out.appendCodePoint(cp);
                }
            });
        return out.toString();
    }
    private static void entry(ZipOutputStream zip, String name, String content) throws Exception { zip.putNextEntry(new ZipEntry(name)); zip.write(content.getBytes(StandardCharsets.UTF_8)); zip.closeEntry(); }
}
