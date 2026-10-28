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
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;

/**
 * Minimal .xlsx reader / writer using only the JDK (the template of the Excel import, GBR-96): strings (shared or
 * inline) and numbers of the first worksheet. External entities and DTDs are disabled and entry sizes are capped.
 */
public final class XlsxSupport {

    /** value is the raw cell text; numeric is true for number cells (dates are numbers: Excel day serials). */
    public record Cell(String value, boolean numeric) {}

    private static final int MAX_ENTRY_BYTES = 30 * 1024 * 1024;
    private static final int MAX_ENTRIES = 200;

    private XlsxSupport() {}

    // ------------------------------------------------------------------ write

    public static byte[] write(List<? extends List<?>> rows) {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            put(zip, "[Content_Types].xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            put(zip, "_rels/.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            put(zip, "xl/workbook.xml", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Cattle\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
            put(zip, "xl/_rels/workbook.xml.rels", "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/></Relationships>");
            StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
            int r = 0;
            for (List<?> row : rows) {
                r++;
                sheet.append("<row r=\"").append(r).append("\">");
                for (int c = 0; c < row.size(); c++) {
                    Object value = row.get(c);
                    if (value == null) {
                        continue;
                    }
                    if (value instanceof Number n) {
                        sheet.append("<c r=\"").append(columnName(c)).append(r).append("\"><v>").append(n).append("</v></c>");
                        continue;
                    }
                    String v = value.toString();
                    sheet.append("<c r=\"").append(columnName(c)).append(r).append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">").append(escape(v)).append("</t></is></c>");
                }
                sheet.append("</row>");
            }
            sheet.append("</sheetData></worksheet>");
            put(zip, "xl/worksheets/sheet1.xml", sheet.toString());
            zip.finish();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
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
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
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
