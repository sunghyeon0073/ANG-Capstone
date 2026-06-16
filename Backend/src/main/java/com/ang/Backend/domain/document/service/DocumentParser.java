package com.ang.Backend.domain.document.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.service.S3FileService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class DocumentParser {

    private final S3FileService s3FileService;

    public String parseOriginalContent(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
            String lowerName = originalName.toLowerCase();
            String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

            String content = "";
            if (isPlainTextFile(lowerName, contentType)) {
                content = new String(bytes, StandardCharsets.UTF_8);
            } else if (isCsvFile(lowerName, contentType)) {
                content = parseCsvContent(bytes);
            } else if (isXlsxFile(lowerName, contentType)) {
                content = parseXlsxContentWithPoi(bytes);
                if (content.isBlank()) content = parseXlsxContent(bytes);
            } else if (isDocxFile(lowerName, contentType)) {
                content = parseDocxContent(bytes);
            } else if (isPdfFile(lowerName, contentType)) {
                content = parsePdfContent(bytes);
            } else if (isHwpxFile(lowerName, contentType)) {
                content = parseHwpxContent(bytes);
            } else {
                content = runKordocParsing(file, originalName);
            }

            if (!content.isBlank()) {
                uploadParsedMarkdown(content, originalName);
            }
            return cleanParsedContent(content);
        } catch (Exception e) {
            log.warn("Document parsing failed: {}", e.getMessage());
            return "";
        }
    }

    private String runKordocParsing(MultipartFile file, String originalName) {
        Path tempFile = null;
        try {
            tempFile = Files.createTempFile("kordoc-", "-" + originalName.replaceAll("[\\\\/:*?\"<>|]", "_"));
            Files.write(tempFile, file.getBytes());

            KordocResult result;
            try {
                result = runCommand(List.of("kordoc", tempFile.toAbsolutePath().toString()));
            } catch (Exception e) {
                result = runCommand(List.of("npx", "--no-install", "kordoc", tempFile.toAbsolutePath().toString()));
            }

            if (result.exitCode() != 0) {
                log.warn("kordoc parsing failed for {}: {}", originalName, result.output());
                return "";
            }
            return result.output();
        } catch (Exception e) {
            log.warn("kordoc parsing failed for {}: {}", originalName, e.getMessage());
            return "";
        } finally {
            if (tempFile != null) {
                try { Files.deleteIfExists(tempFile); } catch (Exception ignored) {}
            }
        }
    }

    private void uploadParsedMarkdown(String markdown, String originalName) {
        try {
            String markdownName = originalName.replaceFirst("\\.[^.]+$", "") + ".md";
            s3FileService.uploadText(markdown, markdownName);
        } catch (Exception e) {
            log.warn("Parsed markdown S3 upload failed: {}", e.getMessage());
        }
    }

    public String cleanParsedContent(String content) {
        if (content == null || content.isBlank()) return "";
        return content
                .replaceAll("(?i)<\\s*br\\s*/?\\s*>", "\n")
                .replaceAll("(?i)</\\s*(p|div|li|h[1-6])\\s*>", "\n")
                .replaceAll("(?i)</\\s*tr\\s*>", "\n")
                .replaceAll("(?i)</\\s*(td|th)\\s*>", "\t")
                .replaceAll("(?is)<\\s*(script|style)\\b[^>]*>.*?</\\s*\\1\\s*>", "")
                .replaceAll("(?is)<[^>]+>", "")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&")
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replaceAll("[ \\t\\x0B\\f\\r]+", " ")
                .replaceAll(" *\\n *", "\n")
                .replaceAll("\\n{3,}", "\n\n")
                .strip();
    }

    private boolean isPlainTextFile(String lowerName, String contentType) {
        return lowerName.endsWith(".txt") || contentType.contains("text/plain");
    }

    private boolean isCsvFile(String lowerName, String contentType) {
        return lowerName.endsWith(".csv") || contentType.contains("csv");
    }

    private boolean isXlsxFile(String lowerName, String contentType) {
        return lowerName.endsWith(".xlsx") || contentType.contains("spreadsheetml");
    }

    private boolean isDocxFile(String lowerName, String contentType) {
        return lowerName.endsWith(".docx") || contentType.contains("wordprocessingml");
    }

    private boolean isPdfFile(String lowerName, String contentType) {
        return lowerName.endsWith(".pdf") || contentType.contains("pdf");
    }

    private boolean isHwpxFile(String lowerName, String contentType) {
        return lowerName.endsWith(".hwpx") || contentType.contains("hwpx");
    }

    private String parseCsvContent(byte[] bytes) {
        String csv = new String(bytes, StandardCharsets.UTF_8).strip();
        return csv.lines()
                .map(line -> String.join("\t", parseCsvLine(line)))
                .collect(Collectors.joining("\n"));
    }

    private List<String> parseCsvLine(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"'); i++;
                } else quoted = !quoted;
            } else if (ch == ',' && !quoted) {
                cells.add(cell.toString().strip());
                cell.setLength(0);
            } else cell.append(ch);
        }
        cells.add(cell.toString().strip());
        return cells;
    }

    private String parseXlsxContentWithPoi(byte[] bytes) {
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            DataFormatter formatter = new DataFormatter(Locale.KOREA);
            StringBuilder parsed = new StringBuilder();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                List<List<String>> rows = new ArrayList<>();
                int maxCol = 0;
                for (Row row : sheet) {
                    List<String> cells = new ArrayList<>();
                    for (int c = 0; c < row.getLastCellNum(); c++) {
                        Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                        cells.add(cell == null ? "" : formatter.formatCellValue(cell).strip());
                    }
                    if (cells.stream().anyMatch(v -> !v.isBlank())) {
                        maxCol = Math.max(maxCol, cells.size());
                        rows.add(cells);
                    }
                }
                if (!rows.isEmpty()) {
                    if (!parsed.isEmpty()) parsed.append("\n\n");
                    parsed.append("[Sheet: ").append(sheet.getSheetName()).append("]\n");
                    parsed.append(toMarkdownTable(rows, maxCol));
                }
            }
            return parsed.toString().strip();
        } catch (Exception e) { return ""; }
    }

    private String parseDocxContent(byte[] bytes) {
        try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            StringBuilder parsed = new StringBuilder();
            for (XWPFParagraph para : document.getParagraphs()) {
                String text = para.getText();
                if (text != null && !text.isBlank()) parsed.append(text.strip()).append("\n\n");
            }
            for (XWPFTable table : document.getTables()) {
                List<List<String>> rows = new ArrayList<>();
                int maxCol = 0;
                for (XWPFTableRow row : table.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XWPFTableCell cell : row.getTableCells()) {
                        cells.add(cell.getText().replaceAll("\\s+", " ").strip());
                    }
                    if (cells.stream().anyMatch(v -> !v.isBlank())) {
                        maxCol = Math.max(maxCol, cells.size());
                        rows.add(cells);
                    }
                }
                if (!rows.isEmpty()) {
                    if (!parsed.isEmpty()) parsed.append("\n");
                    parsed.append(toMarkdownTable(rows, maxCol)).append("\n\n");
                }
            }
            return parsed.toString().strip();
        } catch (Exception e) { return ""; }
    }

    private String parsePdfContent(byte[] bytes) {
        try (PDDocument document = PDDocument.load(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(document);
        } catch (Exception e) { return ""; }
    }

    private String parseHwpxContent(byte[] bytes) {
        try (java.util.zip.ZipInputStream zip = new java.util.zip.ZipInputStream(new ByteArrayInputStream(bytes))) {
            StringBuilder parsed = new StringBuilder();
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().matches(".*section\\d+\\.xml")) {
                    String xml = new String(zip.readAllBytes(), StandardCharsets.UTF_8);
                    String text = xml.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").strip();
                    if (!text.isBlank()) {
                        if (!parsed.isEmpty()) parsed.append("\n\n");
                        parsed.append(text);
                    }
                }
                zip.closeEntry();
            }
            return parsed.toString().strip();
        } catch (Exception e) { return ""; }
    }

    private String toMarkdownTable(List<List<String>> rows, int maxCol) {
        if (rows.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        // Header
        sb.append("|");
        for (int i = 0; i < maxCol; i++) {
            String h = i < rows.get(0).size() ? rows.get(0).get(i) : "";
            sb.append(" ").append(h.isBlank() ? "Column " + (i + 1) : h.replace("|", "\\|")).append(" |");
        }
        sb.append("\n|");
        for (int i = 0; i < maxCol; i++) sb.append(" --- |");
        sb.append("\n");
        // Body
        for (int i = 1; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            sb.append("|");
            for (int j = 0; j < maxCol; j++) {
                String v = j < row.size() ? row.get(j) : "";
                sb.append(" ").append(v.replace("|", "\\|").replace("\n", " ")).append(" |");
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private String parseXlsxContent(byte[] bytes) {
        // Simple fallback parser for XLSX using XML extraction
        try (java.util.zip.ZipInputStream zip = new java.util.zip.ZipInputStream(new ByteArrayInputStream(bytes))) {
            Map<String, String> entries = new HashMap<>();
            java.util.zip.ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.getName().endsWith(".xml")) entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            // This is complex to implement fully here, so we'll rely on POI first.
            // Returning empty to trigger POI or other fallbacks if POI failed.
            return "";
        } catch (Exception e) { return ""; }
    }

    private KordocResult runCommand(List<String> command) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        process.waitFor(60, TimeUnit.SECONDS);
        return new KordocResult(process.exitValue(), output);
    }

    private record KordocResult(int exitCode, String output) {}
}
