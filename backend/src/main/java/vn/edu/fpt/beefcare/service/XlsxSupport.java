package vn.edu.fpt.beefcare.service;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Minimal .xlsx reader / writer using only the JDK (the template of the Excel import, GBR-96): the writer makes
 * workbooks of strings and numbers with bold headers, column widths and drop-downs; the reader returns the strings (shared
 * or inline) and numbers of the first worksheet. External entities and DTDs are disabled and entry sizes are capped.
 */
public final class XlsxSupport {

    /** value is the raw cell text; numeric is true for number cells (dates are numbers: Excel day serials). */
    public record Cell(String value, boolean numeric) {}

    private static final int MAX_ENTRY_BYTES = 30 * 1024 * 1024;
    private static final int MAX_ENTRIES = 200;

    private XlsxSupport() {}

    // ------------------------------------------------------------------ write

    /** A drop-down (list validation) on a cell range: {@code source} is an inline list ("A,B") or a range ('Sheet'!$A$2:$A$9). */
    public record ListValidation(String range, String source, boolean inline) {}

    /**
     * One worksheet. {@code header} styles the first row bold and freezes it; {@code boldRows} (0-based) are bold too;
     * {@code textColumns} (0-based) are formatted as text so leading zeros survive; {@code widths} are column widths in
     * characters.
     */
    public record Sheet(
        String name,
        List<? extends List<?>> rows,
        List<Integer> widths,
        boolean header,
        Set<Integer> boldRows,
        Set<Integer> textColumns,
        List<ListValidation> validations
    ) {
        public Sheet(String name, List<? extends List<?>> rows) {
            this(name, rows, List.of(), false, Set.of(), Set.of(), List.of());
        }
    }

    private static final int STYLE_BOLD = 1;
    private static final int STYLE_WRAP = 2;
    private static final int STYLE_TEXT = 3;

    public static byte[] write(List<? extends List<?>> rows) {
        return writeWorkbook(List.of(new Sheet("Cattle", rows)));
    }

    /** Workbook with the sheets in order; the first sheet is the one {@link #read(byte[])} reads back. */
    public static byte[] writeWorkbook(List<Sheet> sheets) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            StringBuilder types = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/>");
            StringBuilder book = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets>");
            StringBuilder rels = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">");
            for (int i = 1; i <= sheets.size(); i++) {
                types.append("<Override PartName=\"/xl/worksheets/sheet").append(i).append(".xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>");
                book.append("<sheet name=\"").append(escape(sheets.get(i - 1).name())).append("\" sheetId=\"").append(i).append("\" r:id=\"rId").append(i).append("\"/>");
                rels.append("<Relationship Id=\"rId").append(i).append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet").append(i).append(".xml\"/>");
            }
            rels.append("<Relationship Id=\"rId").append(sheets.size() + 1).append("\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");
            put(zip, "[Content_Types].xml", types.append("</Types>").toString());
            put(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            put(zip, "xl/workbook.xml", book.append("</sheets></workbook>").toString());
            put(zip, "xl/_rels/workbook.xml.rels", rels.toString());
            put(zip, "xl/styles.xml", STYLES);
            for (int i = 1; i <= sheets.size(); i++) {
                put(zip, "xl/worksheets/sheet" + i + ".xml", sheetXml(sheets.get(i - 1), i == 1));
            }
            zip.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** 0 default · 1 bold on light green · 2 wrapped, top aligned · 3 text (@). */
    private static final String STYLES = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">"
        + "<fonts count=\"2\"><font><sz val=\"11\"/><name val=\"Calibri\"/></font><font><b/><sz val=\"11\"/><name val=\"Calibri\"/></font></fonts>"
        + "<fills count=\"3\"><fill><patternFill patternType=\"none\"/></fill><fill><patternFill patternType=\"gray125\"/></fill><fill><patternFill patternType=\"solid\"><fgColor rgb=\"FFE5F3E9\"/><bgColor indexed=\"64\"/></patternFill></fill></fills>"
        + "<borders count=\"1\"><border><left/><right/><top/><bottom/><diagonal/></border></borders>"
        + "<cellStyleXfs count=\"1\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\"/></cellStyleXfs>"
        + "<cellXfs count=\"4\"><xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\"/>"
        + "<xf numFmtId=\"0\" fontId=\"1\" fillId=\"2\" borderId=\"0\" xfId=\"0\" applyFont=\"1\" applyFill=\"1\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>"
        + "<xf numFmtId=\"0\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyAlignment=\"1\"><alignment vertical=\"top\" wrapText=\"1\"/></xf>"
        + "<xf numFmtId=\"49\" fontId=\"0\" fillId=\"0\" borderId=\"0\" xfId=\"0\" applyNumberFormat=\"1\"/></cellXfs>"
        + "<cellStyles count=\"1\"><cellStyle name=\"Normal\" xfId=\"0\" builtinId=\"0\"/></cellStyles></styleSheet>";

    private static String sheetXml(Sheet s, boolean selected) {
        StringBuilder x = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
        x.append("<sheetViews><sheetView workbookViewId=\"0\"").append(selected ? " tabSelected=\"1\"" : "").append(">");
        if (s.header()) {
            x.append("<pane ySplit=\"1\" topLeftCell=\"A2\" activePane=\"bottomLeft\" state=\"frozen\"/>");
        }
        x.append("</sheetView></sheetViews>");
        int columns = Math.max(s.widths().size(), s.textColumns().stream().mapToInt(c -> c + 1).max().orElse(0));
        if (columns > 0) {
            x.append("<cols>");
            for (int c = 0; c < columns; c++) {
                int width = c < s.widths().size() && s.widths().get(c) != null ? s.widths().get(c) : 12;
                x.append("<col min=\"").append(c + 1).append("\" max=\"").append(c + 1).append("\" width=\"").append(width).append("\" customWidth=\"1\"");
                if (s.textColumns().contains(c)) {
                    x.append(" style=\"").append(STYLE_TEXT).append('"');
                }
                x.append("/>");
            }
            x.append("</cols>");
        }
        x.append("<sheetData>");
        int r = 0;
        for (List<?> row : s.rows()) {
            r++;
            boolean bold = (s.header() && r == 1) || s.boldRows().contains(r - 1);
            x.append("<row r=\"").append(r).append("\">");
            for (int c = 0; c < row.size(); c++) {
                Object value = row.get(c);
                if (value == null) {
                    continue;
                }
                int style = bold ? STYLE_BOLD : s.textColumns().contains(c) ? STYLE_TEXT : s.widths().isEmpty() ? 0 : STYLE_WRAP;
                x.append("<c r=\"").append(columnName(c)).append(r).append('"');
                if (style != 0) {
                    x.append(" s=\"").append(style).append('"');
                }
                if (value instanceof Number n) {
                    x.append("><v>").append(n).append("</v></c>");
                } else {
                    x.append(" t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(escape(value.toString())).append("</t></is></c>");
                }
            }
            x.append("</row>");
        }
        x.append("</sheetData>");
        if (!s.validations().isEmpty()) {
            x.append("<dataValidations count=\"").append(s.validations().size()).append("\">");
            for (ListValidation v : s.validations()) {
                x.append("<dataValidation type=\"list\" errorStyle=\"warning\" allowBlank=\"1\" showErrorMessage=\"1\" sqref=\"").append(v.range()).append("\">");
                x.append("<formula1>").append(escape(v.inline() ? '"' + v.source() + '"' : v.source())).append("</formula1></dataValidation>");
            }
            x.append("</dataValidations>");
        }
        return x.append("</worksheet>").toString();
    }

    private static void put(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    static String columnName(int index) {
        StringBuilder sb = new StringBuilder();
        int n = index;
        do {
            sb.insert(0, (char) ('A' + n % 26));
            n = n / 26 - 1;
        } while (n >= 0);
        return sb.toString();
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    // ------------------------------------------------------------------ read

    /** Rows of the first worksheet; row index i is sheet row i + 1 (empty rows are kept as empty lists). */
    public static List<List<Cell>> read(byte[] data) {
        Map<String, byte[]> parts = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(data), StandardCharsets.UTF_8)) {
            ZipEntry e;
            int count = 0;
            while ((e = zip.getNextEntry()) != null) {
                if (++count > MAX_ENTRIES) {
                    throw new IllegalArgumentException("too many entries");
                }
                String name = e.getName();
                if (name.equals("xl/sharedStrings.xml") || name.startsWith("xl/worksheets/sheet")) {
                    parts.put(name, readLimited(zip));
                }
            }
        } catch (IOException ex) {
            throw new IllegalArgumentException("not a valid xlsx file", ex);
        }
        String sheetName = parts.containsKey("xl/worksheets/sheet1.xml") ? "xl/worksheets/sheet1.xml" : parts.keySet().stream().filter(n -> n.startsWith("xl/worksheets/sheet")).sorted().findFirst().orElse(null);
        if (sheetName == null) {
            throw new IllegalArgumentException("no worksheet");
        }
        try {
            List<String> shared = parts.containsKey("xl/sharedStrings.xml") ? readShared(parts.get("xl/sharedStrings.xml")) : List.of();
            return readSheet(parts.get(sheetName), shared);
        } catch (XMLStreamException ex) {
            throw new IllegalArgumentException("malformed worksheet", ex);
        }
    }

    private static byte[] readLimited(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
            if (out.size() > MAX_ENTRY_BYTES) {
                throw new IllegalArgumentException("entry too large");
            }
        }
        return out.toByteArray();
    }

    private static XMLStreamReader reader(byte[] xml) throws XMLStreamException {
        XMLInputFactory f = XMLInputFactory.newFactory();
        f.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        f.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
        return f.createXMLStreamReader(new ByteArrayInputStream(xml));
    }

    private static List<String> readShared(byte[] xml) throws XMLStreamException {
        List<String> out = new ArrayList<>();
        XMLStreamReader r = reader(xml);
        StringBuilder current = null;
        boolean inText = false;
        while (r.hasNext()) {
            int ev = r.next();
            if (ev == XMLStreamConstants.START_ELEMENT) {
                String n = r.getLocalName();
                if (n.equals("si")) {
                    current = new StringBuilder();
                } else if (n.equals("t") && current != null) {
                    inText = true;
                }
            } else if (ev == XMLStreamConstants.CHARACTERS && inText && current != null) {
                current.append(r.getText());
            } else if (ev == XMLStreamConstants.END_ELEMENT) {
                String n = r.getLocalName();
                if (n.equals("t")) {
                    inText = false;
                } else if (n.equals("si") && current != null) {
                    out.add(current.toString());
                    current = null;
                }
            }
        }
        return out;
    }

    private static List<List<Cell>> readSheet(byte[] xml, List<String> shared) throws XMLStreamException {
        List<List<Cell>> rows = new ArrayList<>();
        XMLStreamReader r = reader(xml);
        int rowIndex = -1;
        int col = -1;
        String type = null;
        StringBuilder text = null;
        boolean inValue = false;
        boolean inInline = false;
        while (r.hasNext()) {
            int ev = r.next();
            if (ev == XMLStreamConstants.START_ELEMENT) {
                switch (r.getLocalName()) {
                    case "row" -> {
                        String ref = r.getAttributeValue(null, "r");
                        int target = ref == null ? rows.size() : Integer.parseInt(ref) - 1;
                        while (rows.size() <= target) {
                            rows.add(new ArrayList<>());
                        }
                        rowIndex = target;
                    }
                    case "c" -> {
                        String ref = r.getAttributeValue(null, "r");
                        col = ref == null ? (rowIndex >= 0 ? rows.get(rowIndex).size() : 0) : columnIndex(ref);
                        type = r.getAttributeValue(null, "t");
                        text = new StringBuilder();
                    }
                    case "v" -> inValue = true;
                    case "t" -> inInline = text != null && "inlineStr".equals(type);
                    default -> {}
                }
            } else if (ev == XMLStreamConstants.CHARACTERS) {
                if ((inValue || inInline) && text != null) {
                    text.append(r.getText());
                }
            } else if (ev == XMLStreamConstants.END_ELEMENT) {
                switch (r.getLocalName()) {
                    case "v" -> inValue = false;
                    case "t" -> inInline = false;
                    case "c" -> {
                        if (rowIndex >= 0 && text != null) {
                            List<Cell> row = rows.get(rowIndex);
                            while (row.size() <= col) {
                                row.add(null);
                            }
                            String raw = text.toString();
                            Cell cell;
                            if ("s".equals(type)) {
                                int idx = raw.isBlank() ? -1 : Integer.parseInt(raw.trim());
                                cell = new Cell(idx >= 0 && idx < shared.size() ? shared.get(idx) : null, false);
                            } else if ("inlineStr".equals(type) || "str".equals(type)) {
                                cell = new Cell(raw, false);
                            } else if ("b".equals(type)) {
                                cell = new Cell(raw, false);
                            } else {
                                cell = new Cell(raw.isBlank() ? null : raw.trim(), true);
                            }
                            row.set(col, cell);
                        }
                        text = null;
                        type = null;
                    }
                    default -> {}
                }
            }
        }
        return rows;
    }

    static int columnIndex(String ref) {
        int n = 0;
        for (int i = 0; i < ref.length(); i++) {
            char ch = ref.charAt(i);
            if (ch < 'A' || ch > 'Z') {
                break;
            }
            n = n * 26 + (ch - 'A' + 1);
        }
        return n - 1;
    }
}
