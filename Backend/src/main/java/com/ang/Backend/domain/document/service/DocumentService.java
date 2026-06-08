package com.ang.Backend.domain.document.service;

import com.ang.Backend.common.enums.DocumentStatus;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.file.service.FileService;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.service.ScopeService;
import com.ang.Backend.domain.user.entity.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.MultiValueMap;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.service.S3FileService;
import org.springframework.scheduling.annotation.Scheduled;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentService {
    private static final double DOCX_MIN_INFLATE_RATIO = 0.001;

    private final DocumentRepository documentRepository;
    private final FileItemRepository fileItemRepository;
    private final FileService fileService;
    private final UserMembershipRepository userMembershipRepository;
    private final com.ang.Backend.domain.role.repository.UserRoleRepository userRoleRepository;
    private final ScopeRepository scopeRepository;
    private final ScopeService scopeService;
    private final RestTemplate restTemplate;
    private final com.ang.Backend.domain.user.repository.UserRepository userRepository;
    private final S3FileService s3FileService;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;

    @Value("${ai.base-url}")
    private String aiBaseUrl;

    @Value("${hwp.edit-base-url:}")
    private String hwpEditBaseUrl;

    @PostConstruct
    @Transactional
    public void syncDocumentsFromFiles() {
        // fileItem 중 문서(Document)와 연결되지 않은 파일들을 찾아서 문서로 변환
        List<FileItem> allFiles = fileItemRepository.findAll();
        for (FileItem file : allFiles) {
            if (file.getOriginalFileName() != null && file.getOriginalFileName().toLowerCase().endsWith(".pdf")) {
                if (!documentRepository.existsByFile(file)) {
                    DocumentEntity doc = DocumentEntity.builder()
                            .title(file.getOriginalFileName())
                            .file(file)
                            .owner(file.getUploader()) // Set owner to prevent null constraint violation
                            .status(DocumentStatus.DRAFT)
                            .originalContent("Extracted content from PDF: " + file.getOriginalFileName())
                            .build();
                    
                    // If owner is null and DB requires it, we fallback to finding admin
                    if (doc.getOwner() == null) {
                        userRepository.findByEmpNo("admin").ifPresent(doc::setOwner);
                    }
                    
                    documentRepository.save(doc);
                    log.info("Synced File to Document: {}", file.getOriginalFileName());
                }
            }
        }
    }

    @Transactional
    public void manualSync() {
        fileService.syncPdfFilesFromUploadsDir();
        syncDocumentsFromFiles();
    }

    @Transactional
    public Long create(String title, MultipartFile file, User user, Integer targetScopeId) throws Exception {
        Scope targetScope = null;
        String subPath = null;

        if (targetScopeId != null) {
            targetScope = scopeRepository.findById(targetScopeId)
                    .orElseThrow(() -> new RuntimeException("대상 부서를 찾을 수 없습니다."));
            subPath = "Scopes" + File.separator + targetScope.getScopeCode();
        }

        String originalContent = parseOriginalContent(file);

        var storedFile = fileService.storeFile(file, user, subPath);
        FileItem previewFile = createPreviewFile(file, user, storedFile, originalContent);

        DocumentEntity doc = DocumentEntity.builder()
                .title(title)
                .file(storedFile)
                .previewFile(previewFile)
                .owner(user)
                .scope(targetScope)
                .status(DocumentStatus.DRAFT)
                .originalContent(originalContent)
                .build();

        return documentRepository.save(doc).getDocId();
    }

    public List<DocumentDto.Response> getAllDocuments(User requester) {
        List<DocumentDto.Response> list = documentRepository.findAllByDeletedAtIsNull().stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
        setCanDeleteFlags(list, requester);
        return list;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public DocumentDto.Response generateWithAi(String prompt, User user, Long sourceDocId, List<Long> attachedDocIds, String outputFormat, String mode) {
        if (user == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED, "AI 생성을 위해서는 로그인이 필요합니다.");
        }
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt is required.");
        }

        AiOutputFormat format = AiOutputFormat.from(outputFormat);
        boolean editMode = "edit".equalsIgnoreCase(mode);
        if (editMode) {
            if (format == AiOutputFormat.HWP) {
                return editHwpWithAi(prompt, user, sourceDocId, attachedDocIds);
            }
            if (format == AiOutputFormat.DOCX) {
                DocxEditSource docxSource = findDocxEditSource(sourceDocId, attachedDocIds);
                if (docxSource != null) {
                    return editDocxWithAi(prompt, user, docxSource);
                }
            }
            throw new IllegalArgumentException("AI 문서 수정은 HWP 또는 DOCX 원본 문서만 지원합니다.");
        }

        String finalPrompt = buildAiPrompt(prompt, sourceDocId, attachedDocIds, format);
        log.info("AI document generation started: format={}, promptChars={}", format.extension, finalPrompt.length());

        Map<String, String> aiRequest = Map.of("message", finalPrompt);
        @SuppressWarnings("unchecked")
        Map<String, Object> aiResponse = restTemplate.postForObject(
                aiBaseUrl + "/chat",
                aiRequest,
                Map.class
        );

        String answer = aiResponse != null && aiResponse.get("reply") != null
                ? aiResponse.get("reply").toString()
                : "";
        log.info("AI document generation finished: format={}, answerChars={}", format.extension, answer.length());
        if (cleanParsedContent(answer).isBlank()) {
            throw new IllegalStateException("AI returned an empty document.");
        }

        String aiTitle = makeAiTitle(answer);

        return saveAiDocument(aiTitle, answer, user, format);
    }

    private DocumentDto.Response editHwpWithAi(String prompt, User user, Long sourceDocId, List<Long> attachedDocIds) {
        HwpEditSource source = findHwpEditSource(sourceDocId, attachedDocIds);
        String finalPrompt = buildHwpEditPrompt(prompt, source);
        log.info("AI HWP edit plan started: sourceDocId={}, promptChars={}", source.docId(), finalPrompt.length());

        Map<String, String> aiRequest = Map.of("message", finalPrompt);
        @SuppressWarnings("unchecked")
        Map<String, Object> aiResponse = restTemplate.postForObject(
                aiBaseUrl + "/chat",
                aiRequest,
                Map.class
        );

        String answer = aiResponse != null && aiResponse.get("reply") != null
                ? aiResponse.get("reply").toString()
                : "";
        AiTextEditPlan plan = parseAiTextEditPlan(answer);
        log.info("AI HWP edit plan finished: sourceDocId={}, replacements={}", source.docId(), plan.replacements().size());

        try {
            Resource resource = fileService.loadFileAsResource(source.fileId());
            byte[] originalBytes = resource.getInputStream().readAllBytes();
            ResponseEntity<byte[]> response = callHwpBridge(originalBytes, source.originalName(), plan.replacements(), "hwp");
            byte[] body = response.getBody();
            if (body == null || body.length == 0) {
                throw new IllegalStateException("HWP bridge returned an empty file.");
            }

            String title = plan.title().isBlank()
                    ? safeDocumentTitle(source.title() + "-AI edited")
                    : safeDocumentTitle(plan.title());
            String fileName = buildEditedFileName(source.originalName(), "hwp");
            AiGeneratedFile generatedFile = new AiGeneratedFile(fileName, resolveEditedContentType("hwp", response.getHeaders().getContentType()), body);

            return saveAiEditedHwpDocument(title, prompt, answer, source, generatedFile, user);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read original HWP file.", e);
        }
    }

    private DocumentDto.Response editDocxWithAi(String prompt, User user, DocxEditSource source) {
        byte[] originalBytes;
        List<DocxTextBlock> blocks;
        try {
            Resource resource = fileService.loadFileAsResource(source.fileId());
            originalBytes = resource.getInputStream().readAllBytes();
            blocks = extractDocxTextBlocks(originalBytes);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read original DOCX file.", e);
        }

        String finalPrompt = buildDocxEditPrompt(prompt, source, blocks);
        log.info("AI DOCX edit plan started: sourceDocId={}, blocks={}, promptChars={}", source.docId(), blocks.size(), finalPrompt.length());

        Map<String, String> aiRequest = Map.of("message", finalPrompt);
        @SuppressWarnings("unchecked")
        Map<String, Object> aiResponse = restTemplate.postForObject(
                aiBaseUrl + "/chat",
                aiRequest,
                Map.class
        );

        String answer = aiResponse != null && aiResponse.get("reply") != null
                ? aiResponse.get("reply").toString()
                : "";
        AiTextEditPlan plan = parseAiTextEditPlan(answer);
        log.info("AI DOCX edit plan finished: sourceDocId={}, replacements={}", source.docId(), plan.replacements().size());
        log.info("AI DOCX replacements: {}", plan.replacements());

        try {
            byte[] editedBytes = applyDocxReplacements(originalBytes, plan.replacements());
            String title = plan.title().isBlank()
                    ? safeDocumentTitle(source.title() + "-AI edited")
                    : safeDocumentTitle(plan.title());
            String fileName = buildEditedFileName(source.originalName(), "docx");
            AiGeneratedFile generatedFile = new AiGeneratedFile(fileName, AiOutputFormat.DOCX.contentType, editedBytes);

            return saveAiEditedDocxDocument(title, prompt, answer, source, generatedFile, user);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to edit original DOCX file.", e);
        }
    }

    private HwpEditSource findHwpEditSource(Long sourceDocId, List<Long> attachedDocIds) {
        LinkedHashSet<Long> docIds = new LinkedHashSet<>();
        if (sourceDocId != null) {
            docIds.add(sourceDocId);
        }
        if (attachedDocIds != null) {
            attachedDocIds.stream()
                    .filter(Objects::nonNull)
                    .forEach(docIds::add);
        }
        if (docIds.isEmpty()) {
            throw new IllegalArgumentException("HWP AI editing requires an attached original HWP document.");
        }

        HwpEditSource source = transactionTemplate.execute(status -> {
            for (Long docId : docIds) {
                DocumentEntity doc = documentRepository.findById(docId).orElse(null);
                if (doc == null || doc.getFile() == null) {
                    continue;
                }
                FileItem file = doc.getFile();
                String originalName = file.getOriginalFileName() != null ? file.getOriginalFileName() : "document.hwp";
                String lowerName = originalName.toLowerCase();
                String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
                if (isHwpFile(lowerName, contentType)) {
                    return new HwpEditSource(
                            doc.getDocId(),
                            doc.getTitle() != null ? doc.getTitle() : originalName,
                            doc.getOriginalContent() != null ? doc.getOriginalContent() : "",
                            file.getFileId(),
                            originalName,
                            file.getContentType() != null ? file.getContentType() : "application/x-hwp"
                    );
                }
            }
            return null;
        });

        if (source == null) {
            throw new IllegalArgumentException("Attached documents do not include an editable HWP file.");
        }
        return source;
    }

    private DocxEditSource findDocxEditSource(Long sourceDocId, List<Long> attachedDocIds) {
        LinkedHashSet<Long> docIds = new LinkedHashSet<>();
        if (sourceDocId != null) {
            docIds.add(sourceDocId);
        }
        if (attachedDocIds != null) {
            attachedDocIds.stream()
                    .filter(Objects::nonNull)
                    .forEach(docIds::add);
        }
        if (docIds.isEmpty()) {
            return null;
        }

        return transactionTemplate.execute(status -> {
            for (Long docId : docIds) {
                DocumentEntity doc = documentRepository.findById(docId).orElse(null);
                if (doc == null || doc.getFile() == null) {
                    continue;
                }
                FileItem file = doc.getFile();
                String originalName = file.getOriginalFileName() != null ? file.getOriginalFileName() : "document.docx";
                String lowerName = originalName.toLowerCase();
                String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
                if (isDocxFile(lowerName, contentType)) {
                    return new DocxEditSource(
                            doc.getDocId(),
                            doc.getTitle() != null ? doc.getTitle() : originalName,
                            doc.getOriginalContent() != null ? doc.getOriginalContent() : "",
                            file.getFileId(),
                            originalName
                    );
                }
            }
            return null;
        });
    }

    private String buildHwpEditPrompt(String prompt, HwpEditSource source) {
        String content = source.originalContent();
        if (content.length() > 18000) {
            content = content.substring(0, 18000);
        }

        return """
                You are editing an existing Korean HWP document.
                Do not rewrite the whole document.
                Return JSON only. Do not include Markdown, code fences, explanations, or prose.

                Your job:
                - Keep the original HWP file and layout.
                - Produce only minimal find/replace operations.
                - The "find" value must be exact text that exists in the parsed original text.
                - The "replace" value should contain the edited text.
                - For insertion, choose a nearby existing sentence as "find" and replace it with that same sentence plus the inserted text.
                - Do not add Markdown headings, bullets, or tables unless the user explicitly asks for those literal characters.

                JSON schema:
                {
                  "title": "short edited document title",
                  "replacements": [
                    {"find": "exact original text", "replace": "new text"}
                  ]
                }

                [Original HWP Title]
                %s

                [Parsed Original HWP Text]
                %s

                [User Edit Request]
                %s
                """.formatted(source.title(), content, prompt);
    }

    private String buildDocxEditPrompt(String prompt, DocxEditSource source, List<DocxTextBlock> blocks) {
        String content = formatDocxBlocksForPrompt(blocks);
        if (content.isBlank()) {
            content = source.originalContent();
            if (content.length() > 18000) {
                content = content.substring(0, 18000);
            }
        }

        return """
                You are editing an existing Korean DOCX document.
                Do not rewrite the whole document.
                Return JSON only. Do not include Markdown, code fences, explanations, or prose.

                Your job:
                - Keep the original DOCX layout, tables, images, and styles.
                - Produce only minimal block-scoped find/replace operations.
                - The "blockId" value must be one of the listed block IDs.
                - The "find" value must be exact text that exists inside that block only.
                - Prefer short, unique "find" values instead of whole paragraphs.
                - The "replace" value should contain only the replacement text for that exact "find" value.
                - For insertion, choose a short nearby existing phrase as "find" and replace it with that phrase plus the inserted text.
                - Do not add Markdown headings, bullets, or tables unless the user explicitly asks for those literal characters.

                JSON schema:
                {
                  "title": "short edited document title",
                  "replacements": [
                    {"blockId": "B001", "find": "exact text inside that block", "replace": "new text"}
                  ]
                }

                [Original DOCX Title]
                %s

                [Original DOCX Blocks]
                %s

                [User Edit Request]
                %s
                """.formatted(source.title(), content, prompt);
    }

    private List<DocxTextBlock> extractDocxTextBlocks(byte[] bytes) throws IOException {
        List<DocxTextBlock> blocks = new ArrayList<>();
        int[] blockCounter = {0};
        try (XWPFDocument document = openDocxDocument(bytes)) {
            collectDocxParagraphBlocks(document.getParagraphs(), blocks, blockCounter);
            collectDocxTableBlocks(document.getTables(), blocks, blockCounter);

            for (var header : document.getHeaderList()) {
                collectDocxParagraphBlocks(header.getParagraphs(), blocks, blockCounter);
                collectDocxTableBlocks(header.getTables(), blocks, blockCounter);
            }
            for (var footer : document.getFooterList()) {
                collectDocxParagraphBlocks(footer.getParagraphs(), blocks, blockCounter);
                collectDocxTableBlocks(footer.getTables(), blocks, blockCounter);
            }
        }
        return blocks;
    }

    private void collectDocxTableBlocks(List<XWPFTable> tables, List<DocxTextBlock> blocks, int[] blockCounter) {
        for (XWPFTable table : tables) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    collectDocxParagraphBlocks(cell.getParagraphs(), blocks, blockCounter);
                    collectDocxTableBlocks(cell.getTables(), blocks, blockCounter);
                }
            }
        }
    }

    private void collectDocxParagraphBlocks(List<XWPFParagraph> paragraphs, List<DocxTextBlock> blocks, int[] blockCounter) {
        for (XWPFParagraph paragraph : paragraphs) {
            String blockId = nextDocxBlockId(blockCounter);
            String text = normalizeDocxBlockText(paragraph.getText());
            if (!text.isBlank()) {
                blocks.add(new DocxTextBlock(blockId, text));
            }
        }
    }

    private String formatDocxBlocksForPrompt(List<DocxTextBlock> blocks) {
        StringBuilder formatted = new StringBuilder();
        for (DocxTextBlock block : blocks) {
            String line = "[%s] %s%n".formatted(block.blockId(), block.text());
            if (formatted.length() + line.length() > 18000) {
                break;
            }
            formatted.append(line);
        }
        return formatted.toString().strip();
    }

    @SuppressWarnings("unchecked")
    private AiTextEditPlan parseAiTextEditPlan(String answer) {
        if (answer == null || answer.isBlank()) {
            throw new IllegalStateException("AI returned an empty HWP edit plan.");
        }

        String json = extractJsonObject(answer);
        try {
            Map<String, Object> parsed = objectMapper.readValue(json, Map.class);
            String title = parsed.get("title") != null ? parsed.get("title").toString().strip() : "";
            Object rawReplacements = parsed.get("replacements");
            if (!(rawReplacements instanceof List<?> rawList)) {
                throw new IllegalArgumentException("AI HWP edit plan must include replacements.");
            }

            List<Map<String, String>> replacements = new ArrayList<>();
            for (Object item : rawList) {
                if (!(item instanceof Map<?, ?> rawMap)) {
                    continue;
                }
                Object findValue = rawMap.get("find");
                Object replaceValue = rawMap.get("replace");
                Object blockIdValue = rawMap.get("blockId");
                String find = findValue != null ? findValue.toString().strip() : "";
                String replace = replaceValue != null ? replaceValue.toString() : "";
                if (!find.isBlank() && !find.equals(replace)) {
                    String blockId = blockIdValue != null ? blockIdValue.toString().strip() : "";
                    Map<String, String> replacement = new HashMap<>();
                    replacement.put("find", find);
                    replacement.put("replace", replace);
                    if (!blockId.isBlank()) {
                        replacement.put("blockId", blockId);
                    }
                    replacements.add(replacement);
                }
            }

            if (replacements.isEmpty()) {
                throw new IllegalStateException("AI returned no usable HWP replacements.");
            }
            return new AiTextEditPlan(title, replacements);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("AI returned an invalid HWP edit plan: " + answer, e);
        }
    }

    private String extractJsonObject(String answer) {
        String normalized = answer.replaceAll("(?s)<think>.*?</think>", "").strip();
        int first = normalized.indexOf('{');
        int last = normalized.lastIndexOf('}');
        if (first < 0 || last <= first) {
            throw new IllegalStateException("AI HWP edit plan did not contain a JSON object.");
        }
        return normalized.substring(first, last + 1);
    }

    private DocumentDto.Response saveAiEditedHwpDocument(
            String title,
            String prompt,
            String aiPlan,
            HwpEditSource source,
            AiGeneratedFile generatedFile,
            User user) {
        return transactionTemplate.execute(status -> {
            FileItem fileItem = saveGeneratedFileItem(generatedFile, user, "documents");

            DocumentEntity doc = DocumentEntity.builder()
                    .title(title)
                    .file(fileItem)
                    .previewFile(fileItem)
                    .owner(user)
                    .status(DocumentStatus.DRAFT)
                    .originalContent("""
                            AI HWP edit based on source document: %s

                            User request:
                            %s
                            """.formatted(source.title(), prompt))
                    .aiSummary(aiPlan)
                    .isAiGenerated(true)
                    .build();

            DocumentDto.Response res = DocumentDto.Response.fromEntity(documentRepository.save(doc));
            res.setCanDelete(true);
            return res;
        });
    }

    private DocumentDto.Response saveAiEditedDocxDocument(
            String title,
            String prompt,
            String aiPlan,
            DocxEditSource source,
            AiGeneratedFile generatedFile,
            User user) {
        return transactionTemplate.execute(status -> {
            FileItem fileItem = saveGeneratedFileItem(generatedFile, user, "documents");
            FileItem previewFile = createAiPreviewFile(title, """
                    AI DOCX edit based on source document: %s

                    User request:
                    %s
                    """.formatted(source.title(), prompt), user);

            DocumentEntity doc = DocumentEntity.builder()
                    .title(title)
                    .file(fileItem)
                    .previewFile(previewFile)
                    .owner(user)
                    .status(DocumentStatus.DRAFT)
                    .originalContent("""
                            AI DOCX edit based on source document: %s

                            User request:
                            %s
                            """.formatted(source.title(), prompt))
                    .aiSummary(aiPlan)
                    .isAiGenerated(true)
                    .build();

            DocumentDto.Response res = DocumentDto.Response.fromEntity(documentRepository.save(doc));
            res.setCanDelete(true);
            return res;
        });
    }

    private String buildAiPrompt(String prompt, Long sourceDocId, List<Long> attachedDocIds, AiOutputFormat format) {
        LinkedHashSet<Long> docIds = new LinkedHashSet<>();
        if (sourceDocId != null) {
            docIds.add(sourceDocId);
        }
        if (attachedDocIds != null) {
            attachedDocIds.stream()
                    .filter(Objects::nonNull)
                    .forEach(docIds::add);
        }

        if (docIds.isEmpty()) {
            return buildAiInstruction(prompt, format);
        }

        List<DocumentEntity> sources = transactionTemplate.execute(status -> {
            List<DocumentEntity> docs = new ArrayList<>();
            for (Long docId : docIds) {
                documentRepository.findById(docId).ifPresent(docs::add);
            }
            return docs;
        });

        if (sources == null || sources.isEmpty()) {
            return buildAiInstruction(prompt, format);
        }

        StringBuilder builder = new StringBuilder();
        builder.append("Use the parsed document content below as reference when creating the document.\n\n");

        int index = 1;
        for (DocumentEntity source : sources) {
            String content = source.getOriginalContent();
            if (content == null || content.isBlank()) {
                continue;
            }

            builder.append("[Reference Document ")
                    .append(index++)
                    .append(": ")
                    .append(source.getTitle() != null ? source.getTitle() : source.getDocId())
                    .append("]\n")
                    .append(content)
                    .append("\n\n");
        }

        if (index == 1) {
            return buildAiInstruction(prompt, format);
        }

        builder.append("[User Prompt]\n")
                .append(buildAiInstruction(prompt, format));

        return builder.toString();
    }

    private String buildAiInstruction(String prompt, AiOutputFormat format) {
        String formatInstruction = format == AiOutputFormat.XLSX
                ? """
                For XLSX output, write the useful content as one or more Markdown pipe tables.
                Use clear header rows and data rows. Do not describe the table in prose unless necessary.
                Include enough rows and columns to preserve the source document's useful detail.
                """
                : """
                If the source document contains tables, preserve them as Markdown pipe tables.
                Use clear header rows and data rows instead of describing table data in prose.
                After each important table, add concise interpretation, decisions, and next steps.
                """;

        return """
                Create a polished Korean business document.
                The first line must be a concise document title as a Markdown H1 heading.
                Do not use the user's prompt verbatim as the title.
                Target file format: %s.
                %s

                Length and completeness requirements:
                - Do not summarize unless the user explicitly asks for a summary.
                - Produce a complete business document, not a short answer.
                - Include at least 5 substantial sections when the format is PDF or DOCX.
                - Each major section should contain 3 to 5 concrete sentences or bullet points.
                - Preserve important names, dates, amounts, counts, decisions, risks, and action items from the source.
                - If information is missing, keep useful placeholders such as [담당자], [일자], [금액], or [부서] instead of omitting the section.
                - For table-heavy sources, keep the table and add a short analysis or follow-up section.

                User request:
                %s
                """.formatted(format.extension.toUpperCase(), formatInstruction, prompt);
    }

    private DocumentDto.Response saveAiDocument(String aiTitle, String answer, User user, AiOutputFormat format) {
        AiGeneratedFile generatedFile = createAiGeneratedFile(aiTitle, answer, format);

        return transactionTemplate.execute(status -> {
            FileItem fileItem = saveGeneratedFileItem(generatedFile, user, "documents");
            FileItem previewFile = (format == AiOutputFormat.PDF || format == AiOutputFormat.HWP)
                    ? fileItem
                    : createAiPreviewFile(aiTitle, answer, user);

            DocumentEntity doc = DocumentEntity.builder()
                    .title(aiTitle)
                    .file(fileItem)
                    .previewFile(previewFile)
                    .owner(user)
                    .status(DocumentStatus.DRAFT)
                    .originalContent(answer)
                    .aiSummary(answer)
                    .isAiGenerated(true)
                    .build();

            DocumentDto.Response res = DocumentDto.Response.fromEntity(documentRepository.save(doc));
            res.setCanDelete(true); // AI로 본인이 생성한 것이므로 삭제 가능
            return res;
        });
    }

    private FileItem saveGeneratedFileItem(AiGeneratedFile generatedFile, User user, String prefix) {
        String s3Key = s3FileService.uploadBytes(
                generatedFile.bytes(),
                generatedFile.fileName(),
                generatedFile.contentType(),
                prefix
        );

        return fileItemRepository.save(FileItem.builder()
                .originalFileName(generatedFile.fileName())
                .storedFileName(s3Key)
                .filePath(s3Key)
                .fileSize((long) generatedFile.bytes().length)
                .contentType(generatedFile.contentType())
                .uploader(user)
                .ownerId(user != null ? user.getUserId() : null)
                .ownerType(com.ang.Backend.common.enums.OwnerType.USER)
                .build());
    }

    private FileItem createAiPreviewFile(String aiTitle, String answer, User user) {
        try {
            byte[] pdfBytes = createPdfBytesFromText(answer, aiTitle);
            AiGeneratedFile preview = new AiGeneratedFile(
                    safeDocumentFileName(aiTitle) + ".pdf",
                    "application/pdf",
                    pdfBytes
            );
            return saveGeneratedFileItem(preview, user, "previews");
        } catch (Exception e) {
            log.warn("AI document preview PDF generation failed: {}", e.getMessage());
            return null;
        }
    }

    @Transactional(readOnly = true)
    public String getOriginalContent(Long docId) {
        return documentRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.DOCUMENT_NOT_FOUND))
                .getOriginalContent();
    }

    @Transactional(readOnly = true)
    public DocumentDto.FileDownload replaceHwp(Long docId, DocumentDto.HwpReplaceRequest request, User requester) {
        if (hwpEditBaseUrl == null || hwpEditBaseUrl.isBlank()) {
            throw new IllegalStateException("HWP_EDIT_BASE_URL is not configured.");
        }
        if (request == null || request.getReplacements() == null || request.getReplacements().isEmpty()) {
            throw new IllegalArgumentException("Replacement list is required.");
        }

        DocumentEntity doc = documentRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.DOCUMENT_NOT_FOUND));

        if (doc.getFile() == null) {
            throw new CustomException(ErrorCode.FILE_NOT_FOUND);
        }

        FileItem sourceFile = doc.getFile();
        String originalName = sourceFile.getOriginalFileName() != null ? sourceFile.getOriginalFileName() : "document.hwp";
        String lowerName = originalName.toLowerCase();
        String contentType = sourceFile.getContentType() != null ? sourceFile.getContentType().toLowerCase() : "";
        if (!lowerName.endsWith(".hwp") && !contentType.contains("hwp")) {
            throw new IllegalArgumentException("Only HWP documents can be edited through the HWP bridge.");
        }

        String outputFormat = normalizeHwpOutputFormat(request.getOutputFormat());

        try {
            Resource resource = fileService.loadFileAsResource(sourceFile.getFileId());
            byte[] originalBytes = resource.getInputStream().readAllBytes();
            ResponseEntity<byte[]> response = callHwpBridge(originalBytes, originalName, request, outputFormat);
            byte[] body = response.getBody();
            if (body == null || body.length == 0) {
                throw new IllegalStateException("HWP bridge returned an empty file.");
            }

            return DocumentDto.FileDownload.builder()
                    .fileName(buildEditedFileName(originalName, outputFormat))
                    .contentType(resolveEditedContentType(outputFormat, response.getHeaders().getContentType()))
                    .bytes(body)
                    .build();
        } catch (IOException e) {
            throw new IllegalStateException("Failed to read original HWP file.", e);
        }
    }

    private ResponseEntity<byte[]> callHwpBridge(
            byte[] originalBytes,
            String originalName,
            DocumentDto.HwpReplaceRequest request,
            String outputFormat) {
        return callHwpBridge(originalBytes, originalName, request.getReplacements(), outputFormat);
    }

    private ResponseEntity<byte[]> callHwpBridge(
            byte[] originalBytes,
            String originalName,
            Object replacements,
            String outputFormat) {
        String replacementsJson;
        try {
            replacementsJson = objectMapper.writeValueAsString(replacements);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize replacement list.", e);
        }

        ByteArrayResource fileResource = new ByteArrayResource(originalBytes) {
            @Override
            public String getFilename() {
                return originalName;
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", fileResource);
        body.add("replacements", replacementsJson);
        body.add("output_format", outputFormat);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        return restTemplate.postForEntity(
                hwpEditBaseUrl.replaceAll("/+$", "") + "/hwp/replace",
                new HttpEntity<>(body, headers),
                byte[].class
        );
    }

    private String normalizeHwpOutputFormat(String outputFormat) {
        if (outputFormat == null || outputFormat.isBlank()) {
            return "hwp";
        }
        String normalized = outputFormat.toLowerCase().strip();
        if (!List.of("hwp", "pdf", "docx").contains(normalized)) {
            throw new IllegalArgumentException("outputFormat must be hwp, pdf, or docx.");
        }
        return normalized;
    }

    private String buildEditedFileName(String originalName, String outputFormat) {
        String baseName = originalName.replaceFirst("\\.[^.]+$", "");
        return sanitizeFileName(baseName + "-edited." + outputFormat);
    }

    private String resolveEditedContentType(String outputFormat, MediaType bridgeContentType) {
        if (bridgeContentType != null) {
            return bridgeContentType.toString();
        }
        return switch (outputFormat) {
            case "pdf" -> "application/pdf";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> "application/x-hwp";
        };
    }

    public List<DocumentDto.Response> getMyDocuments(User user) {
        List<DocumentDto.Response> list = documentRepository.findByOwnerAndDeletedAtIsNull(user).stream()
                .filter(d -> d.getScope() == null)
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
        setCanDeleteFlags(list, user);
        return list;
    }

    public List<DocumentDto.Response> getDepartmentDocuments(User user, Integer targetScopeId, String keyword) {
        List<Integer> scopeIds;

        // 사용자가 속한 모든 부서 정보 가져오기 (보안 검증용)
        List<Scope> myScopes = userMembershipRepository.findByUser(user).stream()
                .map(UserMembership::getScope)
                .collect(Collectors.toList());

        // 최고관리자 권한 확인
        List<com.ang.Backend.domain.role.entity.UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        boolean isSuperAdmin = roles.stream().anyMatch(r -> r.getRole().getRoleLevel() >= 100);

        if (targetScopeId != null) {
            // 특정 부서 필터링 시 보안 검증: 요청한 부서가 사용자의 권한 범위 내에 있는지 확인
            Scope targetScope = scopeRepository.findById(targetScopeId)
                    .orElseThrow(() -> new RuntimeException("해당 부서를 찾을 수 없습니다."));
            
            if (!isSuperAdmin) {
                // 새로운 로직: 사용자가 속한 부서의 Level 2 조상을 찾음
                // 예: 영진전문대학교(L1) -> 평생교육원(L2) -> 교육팀(L3)
                // 사용자가 교육팀 소속이면 평생교육원 산하 모든 부서 문서를 볼 수 있음
                
                boolean hasAccess = false;
                for (Scope myScope : myScopes) {
                    Scope myLevel2 = scopeService.getLevel2Ancestor(myScope);
                    Scope targetLevel2 = scopeService.getLevel2Ancestor(targetScope);
                    
                    if (myLevel2 != null && targetLevel2 != null && 
                        myLevel2.getScopeId().equals(targetLevel2.getScopeId())) {
                        hasAccess = true;
                        break;
                    }
                    // 혹은 기존처럼 직계 부모-자식 관계인 경우도 허용
                    if (scopeService.isSameOrParent(myScope, targetScope)) {
                        hasAccess = true;
                        break;
                    }
                }
                
                if (!hasAccess) {
                    throw new RuntimeException("해당 부서의 문서에 접근할 권한이 없습니다.");
                }
            }
            
            scopeIds = scopeService.getAllSubScopeIds(targetScope);
        } else {
            // 전체 조회 시
            if (isSuperAdmin) {
                // 최고관리자는 모든 부서 ID 가져오기
                scopeIds = scopeRepository.findAll().stream().map(Scope::getScopeId).collect(Collectors.toList());
            } else {
                if (myScopes.isEmpty()) {
                    return List.of();
                }

                // 사용자가 속한 모든 L2 조상들의 모든 하위 부서 ID를 모음
                scopeIds = myScopes.stream()
                        .map(scopeService::getLevel2Ancestor)
                        .filter(java.util.Objects::nonNull)
                        .flatMap(l2 -> scopeService.getAllSubScopeIds(l2).stream())
                        .distinct()
                        .collect(Collectors.toList());
                
                // 본인이 속한 부서의 하위 부서들도 포함 (L2가 없는 경우 대비)
                List<Integer> myDirectSubScopes = myScopes.stream()
                        .flatMap(scope -> scopeService.getAllSubScopeIds(scope).stream())
                        .distinct()
                        .toList();
                
                scopeIds.addAll(myDirectSubScopes);
                scopeIds = scopeIds.stream().distinct().collect(Collectors.toList());
            }
        }

        List<DocumentDto.Response> list = documentRepository.searchByScopesAndDeletedAtIsNull(scopeIds, keyword).stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
        setCanDeleteFlags(list, user);
        return list;
    }

    public DocumentDto.Response getDocument(Long id, User requester) {
        DocumentDto.Response res = documentRepository.findById(id)
                .map(DocumentDto.Response::fromEntity)
                .orElseThrow(() -> new RuntimeException("문서를 찾을 수 없습니다."));
        
        if (requester != null) {
            setCanDeleteFlags(List.of(res), requester);
        }
        return res;
    }

    @Transactional
    public void update(Long id, DocumentDto.UpdateRequest dto) {
        DocumentEntity doc = documentRepository.findById(id).orElseThrow();
        doc.updateContent(dto.getTitle(), dto.getContent());
        if (dto.getStatus() != null) {
            doc.setStatus(dto.getStatus());
        }
    }

    @Transactional
    public void delete(Long id, User requester) {
        DocumentEntity doc = documentRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.DOCUMENT_NOT_FOUND));

        // 삭제 권한 체크
        if (!canUserDelete(doc, requester)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED, "해당 문서를 휴지통으로 이동할 권한이 없습니다.");
        }

        LocalDateTime now = LocalDateTime.now(java.time.ZoneId.of("Asia/Seoul"));
        doc.setDeletedAt(now);
        if (doc.getFile() != null) {
            doc.getFile().setDeletedAt(now);
        }
        if (doc.getPreviewFile() != null) {
            doc.getPreviewFile().setDeletedAt(now);
        }
        // 물리 파일은 남겨둡니다. 30일 후 완전 삭제 시 제거됩니다.
    }

    @Transactional
    public void permanentDelete(Long id, User requester) {
        DocumentEntity doc = documentRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.DOCUMENT_NOT_FOUND));

        // 완전 삭제 권한 체크
        if (!canUserDelete(doc, requester)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED, "해당 문서를 완전 삭제할 권한이 없습니다.");
        }

        FileItem file = doc.getFile();
        FileItem previewFile = doc.getPreviewFile();

        // 1. 문서 엔티티를 먼저 삭제하고 DB에 즉시 반영하여 파일 참조를 제거합니다.
        documentRepository.delete(doc);
        documentRepository.flush();
        
        // 2. 다른 문서에서 사용하지 않는 경우에만 물리 파일과 파일 정보를 삭제합니다.
        if (file != null && !documentRepository.existsByFile(file)) {
            fileService.deletePhysicalFile(file);
        }
        
        if (previewFile != null && !previewFile.equals(file)) {
            // Note: existsByFile checks if ANY document uses this FileItem as its 'file' field.
            if (!documentRepository.existsByFile(previewFile)) {
                fileService.deletePhysicalFile(previewFile);
            }
        }
    }

    @Transactional
    public void restore(Long id, User requester) {
        DocumentEntity doc = documentRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.DOCUMENT_NOT_FOUND));

        // 복구 권한 체크 (삭제 권한과 동일)
        if (!canUserDelete(doc, requester)) {
            throw new CustomException(ErrorCode.ACCESS_DENIED, "해당 문서를 복구할 권한이 없습니다.");
        }

        doc.setDeletedAt(null);
        if (doc.getFile() != null) {
            doc.getFile().setDeletedAt(null);
        }
        if (doc.getPreviewFile() != null) {
            doc.getPreviewFile().setDeletedAt(null);
        }
    }

    @Scheduled(cron = "0 0 0 * * ?") // 매일 자정에 실행
    @Transactional
    public void autoDeleteTrashDocuments() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(30);
        List<DocumentEntity> oldTrashDocuments = documentRepository.findByDeletedAtBefore(cutoffDate);
        
        for (DocumentEntity doc : oldTrashDocuments) {
            try {
                if (doc.getFile() != null) {
                    fileService.deletePhysicalFile(doc.getFile());
                }
                if (doc.getPreviewFile() != null
                        && (doc.getFile() == null || !doc.getPreviewFile().getFileId().equals(doc.getFile().getFileId()))) {
                    fileService.deletePhysicalFile(doc.getPreviewFile());
                }
                documentRepository.delete(doc);
                log.info("Auto-deleted trash document: {}", doc.getDocId());
            } catch (Exception e) {
                log.error("Failed to auto-delete document {}: {}", doc.getDocId(), e.getMessage());
            }
        }
    }

    public List<DocumentDto.Response> getTrashDocuments(User user) {
        // 본인의 휴지통 문서
        List<DocumentDto.Response> list = documentRepository.findByOwnerAndDeletedAtIsNotNull(user).stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
        
        // 만약 관리자라면 해당 부서의 삭제된 문서도 볼 수 있어야 함
        List<com.ang.Backend.domain.role.entity.UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(user);
        int maxLevel = roles.stream().mapToInt(r -> r.getRole().getRoleLevel()).max().orElse(0);
        
        if (maxLevel >= 50) {
            List<Integer> managedScopeIds = roles.stream()
                    .filter(r -> r.getRole().getRoleLevel() >= 50)
                    .flatMap(r -> scopeService.getAllSubScopeIds(r.getScope()).stream())
                    .distinct()
                    .collect(Collectors.toList());
            
            if (!managedScopeIds.isEmpty()) {
                List<DocumentDto.Response> deptTrash = documentRepository.searchByScopesAndDeletedAtIsNotNull(managedScopeIds, null).stream()
                        .map(DocumentDto.Response::fromEntity)
                        .collect(Collectors.toList());
                // 중복 제거 (본인이 올린 문서가 부서 문서일 수 있음)
                for (DocumentDto.Response r : deptTrash) {
                    if (list.stream().noneMatch(existing -> existing.getDocId().equals(r.getDocId()))) {
                        list.add(r);
                    }
                }
            }
        }
        
        setCanDeleteFlags(list, user);
        return list;
    }

    private boolean canUserDelete(DocumentEntity doc, User requester) {
        List<com.ang.Backend.domain.role.entity.UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(requester);
        int maxLevel = roles.stream().mapToInt(r -> r.getRole().getRoleLevel()).max().orElse(0);

        // 1. 최고 관리자 (Lv 100): 모든 파일 삭제 가능
        if (maxLevel >= 100) return true;

        // 2. 본인 파일인 경우: 삭제 가능
        if (doc.getOwner() != null && doc.getOwner().getUserId().equals(requester.getUserId())) return true;

        // 3. 중간 관리자 (Lv 50): 본인 팀(소속된 부서 및 하위 부서)의 파일 삭제 가능
        if (maxLevel >= 50) {
            if (doc.getScope() == null) return false;
            
            // 매니저가 관리하는 모든 부서(하위 포함) ID 목록
            List<Integer> managedScopeIds = roles.stream()
                    .filter(r -> r.getRole().getRoleLevel() >= 50)
                    .flatMap(r -> scopeService.getAllSubScopeIds(r.getScope()).stream())
                    .distinct()
                    .collect(Collectors.toList());
            
            return managedScopeIds.contains(doc.getScope().getScopeId());
        }

        return false;
    }

    private void setCanDeleteFlags(List<DocumentDto.Response> responses, User requester) {
        if (responses == null || requester == null) return;
        
        List<com.ang.Backend.domain.role.entity.UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(requester);
        int maxLevel = roles.stream().mapToInt(r -> r.getRole().getRoleLevel()).max().orElse(0);
        
        List<Integer> managedScopeIds = roles.stream()
                .filter(r -> r.getRole().getRoleLevel() >= 50)
                .flatMap(r -> scopeService.getAllSubScopeIds(r.getScope()).stream())
                .distinct()
                .collect(Collectors.toList());

        for (DocumentDto.Response res : responses) {
            boolean canDelete = false;
            if (maxLevel >= 100) {
                canDelete = true;
            } else if (res.getOwnerId() != null && res.getOwnerId().equals(requester.getUserId())) {
                canDelete = true;
            } else if (maxLevel >= 50 && res.getScopeId() != null) {
                canDelete = managedScopeIds.contains(res.getScopeId());
            }
            res.setCanDelete(canDelete);
        }
    }

    private String makeAiTitle(String answer) {
        String fallback = "AI 문서 " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm"));
        if (answer == null || answer.isBlank()) {
            return fallback;
        }

        return answer.lines()
                .map(line -> line.replaceFirst("^#+\\s*", "").strip())
                .filter(line -> !line.isBlank())
                .filter(line -> line.length() <= 80)
                .findFirst()
                .map(line -> line.length() <= 40 ? line : line.substring(0, 40))
                .map(this::safeDocumentTitle)
                .filter(title -> !title.isBlank())
                .orElse(fallback);
    }

    private String safeDocumentTitle(String title) {
        return title.replaceAll("[\\\\/:*?\"<>|]", "_").strip();
    }

    private AiGeneratedFile createAiGeneratedFile(String title, String content, AiOutputFormat format) {
        try {
            String fileName = safeDocumentFileName(title) + "." + format.extension;
            byte[] bytes = switch (format) {
                case PDF -> createPdfBytesFromText(content, title);
                case DOCX -> createDocxBytes(content);
                case XLSX -> createXlsxBytes(content);
                case HWP -> createHwpBytes(content, title);
                case TXT -> cleanParsedContent(content).getBytes(StandardCharsets.UTF_8);
            };
            return new AiGeneratedFile(fileName, format.contentType, bytes);
        } catch (Exception e) {
            throw new RuntimeException("AI document file generation failed.", e);
        }
    }

    private String safeDocumentFileName(String title) {
        String name = safeDocumentTitle(title);
        if (name.isBlank()) {
            name = "ai-document";
        }
        return name.length() <= 60 ? name : name.substring(0, 60);
    }

    private byte[] createHwpBytes(String content, String title) {
        if (hwpEditBaseUrl == null || hwpEditBaseUrl.isBlank()) {
            throw new IllegalStateException("HWP_EDIT_BASE_URL is not configured.");
        }

        Map<String, String> request = Map.of(
                "title", safeDocumentTitle(title),
                "content", cleanParsedContent(content)
        );

        ResponseEntity<byte[]> response = restTemplate.postForEntity(
                hwpEditBaseUrl.replaceAll("/+$", "") + "/hwp/create",
                request,
                byte[].class
        );

        byte[] body = response.getBody();
        if (body == null || body.length == 0) {
            throw new IllegalStateException("HWP bridge returned an empty file.");
        }
        return body;
    }

    private byte[] createPdfBytesFromText(String content, String title) throws IOException, InterruptedException {
        Path tempDir = Files.createTempDirectory("ai-pdf-");
        Path htmlFile = null;
        try {
            htmlFile = tempDir.resolve(sanitizeFileName(safeDocumentFileName(title) + ".html"));
            Files.writeString(htmlFile, toPreviewHtml(content), StandardCharsets.UTF_8);

            KordocResult result = runLibreOffice(htmlFile, tempDir);
            if (result.exitCode() != 0) {
                throw new IOException("LibreOffice PDF conversion failed: " + result.output());
            }

            Path pdfFile = findConvertedPdf(tempDir, htmlFile);
            if (pdfFile == null || !Files.exists(pdfFile)) {
                throw new IOException("LibreOffice PDF conversion produced no PDF.");
            }

            return Files.readAllBytes(pdfFile);
        } finally {
            deleteQuietly(htmlFile);
            deleteDirectoryQuietly(tempDir);
        }
    }

    private byte[] createDocxBytes(String content) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            addZipEntry(zip, "[Content_Types].xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                      <Default Extension="xml" ContentType="application/xml"/>
                      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
                    </Types>
                    """);
            addZipEntry(zip, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
                    </Relationships>
                    """);
            addZipEntry(zip, "word/document.xml", buildDocxDocumentXml(content));
        }
        return out.toByteArray();
    }

    private byte[] applyDocxReplacements(byte[] originalBytes, List<Map<String, String>> replacements) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int applied = 0;
        int[] blockCounter = {0};

        try (XWPFDocument document = openDocxDocument(originalBytes)) {
            applied += applyDocxParagraphReplacements(document.getParagraphs(), replacements, blockCounter);
            applied += applyDocxTableReplacements(document.getTables(), replacements, blockCounter);

            for (var header : document.getHeaderList()) {
                applied += applyDocxParagraphReplacements(header.getParagraphs(), replacements, blockCounter);
                applied += applyDocxTableReplacements(header.getTables(), replacements, blockCounter);
            }
            for (var footer : document.getFooterList()) {
                applied += applyDocxParagraphReplacements(footer.getParagraphs(), replacements, blockCounter);
                applied += applyDocxTableReplacements(footer.getTables(), replacements, blockCounter);
            }

            document.write(out);
        }

        if (applied == 0) {
            throw new IllegalStateException("No DOCX replacement text matched the original document.");
        }
        return out.toByteArray();
    }

    private int applyDocxTableReplacements(List<XWPFTable> tables, List<Map<String, String>> replacements, int[] blockCounter) {
        int applied = 0;
        for (XWPFTable table : tables) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    applied += applyDocxParagraphReplacements(cell.getParagraphs(), replacements, blockCounter);
                    applied += applyDocxTableReplacements(cell.getTables(), replacements, blockCounter);
                }
            }
        }
        return applied;
    }

    private int applyDocxParagraphReplacements(List<XWPFParagraph> paragraphs, List<Map<String, String>> replacements, int[] blockCounter) {
        int applied = 0;
        for (XWPFParagraph paragraph : paragraphs) {
            String blockId = nextDocxBlockId(blockCounter);
            List<Map<String, String>> blockReplacements = replacementsForBlock(replacements, blockId);
            if (blockReplacements.isEmpty()) {
                continue;
            }
            applied += replaceDocxRunsInPlace(paragraph, blockReplacements);
            applied += replaceDocxParagraphFallback(paragraph, blockReplacements);
        }
        return applied;
    }

    private List<Map<String, String>> replacementsForBlock(List<Map<String, String>> replacements, String blockId) {
        return replacements.stream()
                .filter(replacement -> {
                    String replacementBlockId = replacement.getOrDefault("blockId", "").strip();
                    return replacementBlockId.isBlank() || replacementBlockId.equals(blockId);
                })
                .toList();
    }

    private String nextDocxBlockId(int[] blockCounter) {
        blockCounter[0]++;
        return "B%03d".formatted(blockCounter[0]);
    }

    private String normalizeDocxBlockText(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").strip();
    }

    private int replaceDocxRunsInPlace(XWPFParagraph paragraph, List<Map<String, String>> replacements) {
        int applied = 0;
        for (XWPFRun run : paragraph.getRuns()) {
            String text = run.getText(0);
            if (text == null || text.isEmpty()) {
                continue;
            }

            String replaced = text;
            for (Map<String, String> replacement : replacements) {
                String find = replacement.getOrDefault("find", "");
                if (find.isBlank()) {
                    continue;
                }
                String replace = replacement.getOrDefault("replace", "");
                if (replaced.contains(find)) {
                    replaced = replaced.replace(find, replace);
                    applied++;
                }
            }

            if (!replaced.equals(text)) {
                setRunText(run, replaced);
            }
        }
        return applied;
    }

    private int replaceDocxParagraphFallback(XWPFParagraph paragraph, List<Map<String, String>> replacements) {
        String text = paragraph.getText();
        if (text == null || text.isEmpty()) {
            return 0;
        }

        String replaced = text;
        int applied = 0;
        for (Map<String, String> replacement : replacements) {
            String find = replacement.getOrDefault("find", "");
            if (find.isBlank()) {
                continue;
            }
            String replace = replacement.getOrDefault("replace", "");
            if (replaced.contains(find)) {
                replaced = replaced.replace(find, replace);
                applied++;
            }
        }

        if (applied == 0 || replaced.equals(text)) {
            return 0;
        }

        var firstRunProperties = paragraph.getRuns().isEmpty()
                ? null
                : paragraph.getRuns().get(0).getCTR().getRPr();
        var copiedProperties = firstRunProperties != null
                ? (org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRPr) firstRunProperties.copy()
                : null;

        for (int i = paragraph.getRuns().size() - 1; i >= 0; i--) {
            paragraph.removeRun(i);
        }

        XWPFRun run = paragraph.createRun();
        if (copiedProperties != null) {
            run.getCTR().setRPr(copiedProperties);
        }
        setRunText(run, replaced);
        return applied;
    }

    private void setRunText(XWPFRun run, String text) {
        String[] lines = text.split("\\R", -1);
        run.setText(lines.length > 0 ? lines[0] : "", 0);
        for (int i = 1; i < lines.length; i++) {
            run.addBreak();
            run.setText(lines[i]);
        }
    }

    private String buildDocxDocumentXml(String content) {
        String body = buildDocxBodyXml(content);

        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body>
                    %s
                    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
                  </w:body>
                </w:document>
                """.formatted(body);
    }

    private String buildDocxBodyXml(String content) {
        List<String> lines = cleanParsedContent(content).lines().toList();
        StringBuilder body = new StringBuilder();
        List<List<String>> tableRows = new ArrayList<>();

        for (String line : lines) {
            String trimmed = line.strip();
            if (isMarkdownTableRow(trimmed)) {
                if (!isMarkdownTableSeparator(trimmed)) {
                    tableRows.add(splitMarkdownTableRow(trimmed));
                }
                continue;
            }

            if (!tableRows.isEmpty()) {
                body.append(buildDocxTableXml(tableRows));
                tableRows.clear();
            }
            if (!trimmed.isBlank()) {
                body.append(buildDocxParagraphXml(trimmed));
            }
        }

        if (!tableRows.isEmpty()) {
            body.append(buildDocxTableXml(tableRows));
        }

        return body.toString();
    }

    private String buildDocxParagraphXml(String text) {
        return """
                <w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>
                """.formatted(escapeXml(text));
    }

    private String buildDocxTableXml(List<List<String>> rows) {
        int columnCount = rows.stream().mapToInt(List::size).max().orElse(1);
        StringBuilder table = new StringBuilder("""
                <w:tbl>
                  <w:tblPr>
                    <w:tblStyle w:val="TableGrid"/>
                    <w:tblW w:w="0" w:type="auto"/>
                    <w:tblBorders>
                      <w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                      <w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                      <w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/>
                    </w:tblBorders>
                  </w:tblPr>
                """);

        for (List<String> row : rows) {
            table.append("<w:tr>");
            for (int i = 0; i < columnCount; i++) {
                String value = i < row.size() ? row.get(i) : "";
                table.append("<w:tc><w:tcPr><w:tcW w:w=\"2400\" w:type=\"dxa\"/></w:tcPr>")
                        .append(buildDocxParagraphXml(value))
                        .append("</w:tc>");
            }
            table.append("</w:tr>");
        }

        table.append("</w:tbl>");
        return table.toString();
    }

    private byte[] createXlsxBytes(String content) throws IOException {
        XlsxSheet sheet = parseXlsxSheet(content);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            addZipEntry(zip, "[Content_Types].xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                      <Default Extension="xml" ContentType="application/xml"/>
                      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
                      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
                      <Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>
                    </Types>
                    """);
            addZipEntry(zip, "_rels/.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
                    </Relationships>
                    """);
            addZipEntry(zip, "xl/_rels/workbook.xml.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
                      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
                    </Relationships>
                    """);
            addZipEntry(zip, "xl/worksheets/_rels/sheet1.xml.rels", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
                      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>
                    </Relationships>
                    """);
            addZipEntry(zip, "xl/workbook.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                      <sheets><sheet name="AI Document" sheetId="1" r:id="rId1"/></sheets>
                    </workbook>
                    """);
            addZipEntry(zip, "xl/styles.xml", buildXlsxStylesXml());
            addZipEntry(zip, "xl/tables/table1.xml", buildXlsxTableXml(sheet));
            addZipEntry(zip, "xl/worksheets/sheet1.xml", buildXlsxSheetXml(sheet));
        }
        return out.toByteArray();
    }

    private XlsxSheet parseXlsxSheet(String content) {
        String cleanedContent = cleanParsedContent(content);
        List<String> lines = cleanedContent.lines().toList();
        List<List<String>> tableRows = extractMarkdownTableRows(lines);
        if (tableRows.isEmpty()) {
            tableRows = lines.stream()
                    .map(String::strip)
                    .filter(line -> !line.isBlank())
                    .map(this::splitSpreadsheetLine)
                    .toList();
        }

        if (tableRows.isEmpty()) {
            tableRows = List.of(
                    List.of("내용"),
                    List.of(cleanedContent.isBlank() ? "AI 응답이 비어 있습니다." : cleanedContent)
            );
        }

        int columnCount = tableRows.stream().mapToInt(List::size).max().orElse(1);
        List<String> headers = normalizeXlsxHeaders(tableRows.get(0), columnCount);
        List<List<String>> rows = new ArrayList<>();
        rows.add(headers);

        for (int i = 1; i < tableRows.size(); i++) {
            rows.add(normalizeXlsxRow(tableRows.get(i), columnCount));
        }

        if (rows.size() == 1) {
            rows.add(normalizeXlsxRow(List.of(""), columnCount));
        }

        return new XlsxSheet(rows, columnCount);
    }

    private List<List<String>> extractMarkdownTableRows(List<String> lines) {
        List<List<String>> rows = new ArrayList<>();
        boolean inTable = false;

        for (String line : lines) {
            String trimmed = line.strip();
            if (isMarkdownTableRow(trimmed)) {
                inTable = true;
                if (!isMarkdownTableSeparator(trimmed)) {
                    rows.add(splitMarkdownTableRow(trimmed));
                }
                continue;
            }

            if (inTable && !rows.isEmpty()) {
                break;
            }
        }

        return rows;
    }

    private boolean isMarkdownTableRow(String line) {
        return line.startsWith("|") && line.endsWith("|") && line.indexOf('|', 1) > 0;
    }

    private boolean isMarkdownTableSeparator(String line) {
        return line.replace("|", "")
                .replace(":", "")
                .replace("-", "")
                .replace(" ", "")
                .isBlank();
    }

    private List<String> splitMarkdownTableRow(String line) {
        String trimmed = line.substring(1, line.length() - 1);
        return java.util.Arrays.stream(trimmed.split("\\|", -1))
                .map(String::strip)
                .toList();
    }

    private List<String> splitSpreadsheetLine(String line) {
        String delimiter = line.contains("\t") ? "\\t" : ",";
        String[] cells = line.split(delimiter, -1);
        if (cells.length == 1) {
            return List.of(line);
        }
        return java.util.Arrays.stream(cells)
                .map(String::strip)
                .toList();
    }

    private List<String> normalizeXlsxHeaders(List<String> headers, int columnCount) {
        List<String> normalized = new ArrayList<>();
        for (int i = 0; i < columnCount; i++) {
            String header = i < headers.size() ? headers.get(i).strip() : "";
            String candidate = header.isBlank() ? "Column " + (i + 1) : header;
            String uniqueHeader = candidate;
            int duplicateIndex = 2;
            while (normalized.contains(uniqueHeader)) {
                uniqueHeader = candidate + " " + duplicateIndex++;
            }
            normalized.add(uniqueHeader);
        }
        return normalized;
    }

    private List<String> normalizeXlsxRow(List<String> row, int columnCount) {
        List<String> normalized = new ArrayList<>();
        for (int i = 0; i < columnCount; i++) {
            normalized.add(i < row.size() ? row.get(i) : "");
        }
        return normalized;
    }

    private String buildXlsxSheetXml(XlsxSheet sheet) {
        StringBuilder cols = new StringBuilder();
        for (int i = 1; i <= sheet.columnCount(); i++) {
            cols.append("<col min=\"").append(i)
                    .append("\" max=\"").append(i)
                    .append("\" width=\"24\" customWidth=\"1\"/>");
        }

        StringBuilder rows = new StringBuilder();
        for (int i = 0; i < sheet.rows().size(); i++) {
            List<String> cells = sheet.rows().get(i);
            int rowNumber = i + 1;
            rows.append("<row r=\"").append(rowNumber).append("\">");
            for (int j = 0; j < sheet.columnCount(); j++) {
                rows.append("<c r=\"").append(excelColumnName(j + 1)).append(rowNumber)
                        .append("\"")
                        .append(rowNumber == 1 ? " s=\"1\"" : "")
                        .append(" t=\"inlineStr\"><is><t>")
                        .append(escapeXml(cells.get(j)))
                        .append("</t></is></c>");
            }
            rows.append("</row>");
        }

        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                  <dimension ref="A1:%s%d"/>
                  <cols>%s</cols>
                  <sheetData>%s</sheetData>
                  <tableParts count="1"><tablePart r:id="rId1"/></tableParts>
                </worksheet>
                """.formatted(excelColumnName(sheet.columnCount()), sheet.rows().size(), cols, rows);
    }

    private String buildXlsxStylesXml() {
        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <fonts count="2">
                    <font><sz val="11"/><name val="Calibri"/></font>
                    <font><b/><sz val="11"/><name val="Calibri"/></font>
                  </fonts>
                  <fills count="2">
                    <fill><patternFill patternType="none"/></fill>
                    <fill><patternFill patternType="gray125"/></fill>
                  </fills>
                  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
                  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
                  <cellXfs count="2">
                    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
                    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
                  </cellXfs>
                  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
                </styleSheet>
                """;
    }

    private String buildXlsxTableXml(XlsxSheet sheet) {
        String ref = "A1:" + excelColumnName(sheet.columnCount()) + sheet.rows().size();
        StringBuilder columns = new StringBuilder();
        List<String> headers = sheet.rows().get(0);
        for (int i = 0; i < sheet.columnCount(); i++) {
            columns.append("<tableColumn id=\"").append(i + 1)
                    .append("\" name=\"")
                    .append(escapeXml(headers.get(i)))
                    .append("\"/>");
        }

        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" name="AITable" displayName="AITable" ref="%s" totalsRowShown="0">
                  <autoFilter ref="%s"/>
                  <tableColumns count="%d">%s</tableColumns>
                  <tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/>
                </table>
                """.formatted(ref, ref, sheet.columnCount(), columns);
    }

    private String excelColumnName(int index) {
        StringBuilder name = new StringBuilder();
        while (index > 0) {
            index--;
            name.insert(0, (char) ('A' + (index % 26)));
            index /= 26;
        }
        return name.toString();
    }

    private void addZipEntry(ZipOutputStream zip, String name, String content) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(content.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }

    private String escapeXml(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private String parseOriginalContent(MultipartFile file) {
        Path tempFile = null;
        try {
            String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
            String lowerName = originalName.toLowerCase();
            String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

            if (isPlainTextFile(lowerName, contentType)) {
                String text = new String(file.getBytes(), StandardCharsets.UTF_8);
                uploadParsedMarkdown(text, originalName);
                return text;
            }
            if (isCsvFile(lowerName, contentType)) {
                String csv = parseCsvContent(file.getBytes());
                uploadParsedMarkdown(csv, originalName);
                return csv;
            }
            if (isXlsxFile(lowerName, contentType)) {
                String xlsx = parseXlsxContentWithPoi(file.getBytes());
                if (xlsx.isBlank()) {
                    xlsx = parseXlsxContent(file.getBytes());
                }
                if (!xlsx.isBlank()) {
                    uploadParsedMarkdown(xlsx, originalName);
                    return xlsx;
                }
            }
            if (isDocxFile(lowerName, contentType)) {
                String docx = parseDocxContent(file.getBytes());
                if (!docx.isBlank()) {
                    uploadParsedMarkdown(docx, originalName);
                    return docx;
                }
            }
            if (isPdfFile(lowerName, contentType)) {
                String pdf = parsePdfContent(file.getBytes());
                if (!pdf.isBlank()) {
                    uploadParsedMarkdown(pdf, originalName);
                    return pdf;
                }
            }
            if (isHwpxFile(lowerName, contentType)) {
                String hwpx = parseHwpxContent(file.getBytes());
                if (!hwpx.isBlank()) {
                    uploadParsedMarkdown(hwpx, originalName);
                    return hwpx;
                }
            }

            tempFile = Files.createTempFile("kordoc-", "-" + sanitizeFileName(originalName));
            Files.write(tempFile, file.getBytes());

            KordocResult result = runKordoc(tempFile);
            if (result.exitCode() != 0) {
                log.warn("kordoc parsing failed with exit code {}: {}", result.exitCode(), result.output());
                return "";
            }

            String markdown = cleanParsedContent(result.output());
            if (markdown == null || markdown.isBlank()) {
                log.warn("kordoc parsing returned empty markdown for {}", originalName);
                return "";
            }

            uploadParsedMarkdown(markdown, originalName);
            return markdown;
        } catch (Exception e) {
            log.warn("kordoc parsing failed, upload will continue: {}", e.getMessage());
            return "";
        } finally {
            if (tempFile != null) {
                try { Files.deleteIfExists(tempFile); } catch (Exception ignored) {}
            }
        }
    }

    private KordocResult runKordoc(Path file) throws IOException, InterruptedException {
        try {
            return runCommand(List.of("kordoc", file.toAbsolutePath().toString()));
        } catch (IOException e) {
            log.debug("Direct kordoc command failed, retrying with npx: {}", e.getMessage());
            return runCommand(List.of("npx", "--no-install", "kordoc", file.toAbsolutePath().toString()));
        }
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
        if (csv.isBlank()) {
            return "";
        }
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
                    cell.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                cells.add(cell.toString().strip());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        cells.add(cell.toString().strip());
        return cells;
    }

    private String parseXlsxContentWithPoi(byte[] bytes) {
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            DataFormatter formatter = new DataFormatter(java.util.Locale.KOREA);
            StringBuilder parsed = new StringBuilder();
            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                List<List<String>> rows = new ArrayList<>();
                int maxColumn = 0;
                for (Row row : sheet) {
                    int lastCell = row.getLastCellNum();
                    if (lastCell <= 0) {
                        continue;
                    }
                    List<String> cells = new ArrayList<>();
                    for (int c = 0; c < lastCell; c++) {
                        Cell cell = row.getCell(c, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                        cells.add(cell == null ? "" : formatter.formatCellValue(cell).strip());
                    }
                    if (cells.stream().anyMatch(value -> !value.isBlank())) {
                        maxColumn = Math.max(maxColumn, cells.size());
                        rows.add(cells);
                    }
                }

                if (!rows.isEmpty()) {
                    if (!parsed.isEmpty()) {
                        parsed.append("\n\n");
                    }
                    parsed.append("[Sheet: ").append(sheet.getSheetName()).append("]\n");
                    parsed.append(toMarkdownTable(rows, maxColumn));
                }
            }
            return parsed.toString().strip();
        } catch (Exception e) {
            log.warn("XLSX POI parsing failed: {}", e.getMessage());
            return "";
        }
    }

    private String parseDocxContent(byte[] bytes) {
        try (XWPFDocument document = openDocxDocument(bytes)) {
            StringBuilder parsed = new StringBuilder();

            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                if (text != null && !text.isBlank()) {
                    parsed.append(text.strip()).append("\n\n");
                }
            }

            for (XWPFTable table : document.getTables()) {
                List<List<String>> rows = new ArrayList<>();
                int maxColumn = 0;
                for (XWPFTableRow row : table.getRows()) {
                    List<String> cells = new ArrayList<>();
                    for (XWPFTableCell cell : row.getTableCells()) {
                        cells.add(cell.getText().replaceAll("\\s+", " ").strip());
                    }
                    if (cells.stream().anyMatch(value -> !value.isBlank())) {
                        maxColumn = Math.max(maxColumn, cells.size());
                        rows.add(cells);
                    }
                }
                if (!rows.isEmpty()) {
                    if (!parsed.isEmpty()) {
                        parsed.append("\n");
                    }
                    parsed.append(toMarkdownTable(rows, maxColumn)).append("\n\n");
                }
            }

            return parsed.toString().strip();
        } catch (Exception e) {
            log.warn("DOCX POI parsing failed: {}", e.getMessage());
            return "";
        }
    }

    private String parsePdfContent(byte[] bytes) {
        try (PDDocument document = PDDocument.load(bytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return cleanParsedContent(stripper.getText(document));
        } catch (Exception e) {
            log.warn("PDFBox parsing failed: {}", e.getMessage());
            return "";
        }
    }

    private XWPFDocument openDocxDocument(byte[] bytes) throws IOException {
        double originalRatio = ZipSecureFile.getMinInflateRatio();
        ZipSecureFile.setMinInflateRatio(DOCX_MIN_INFLATE_RATIO);
        try {
            return new XWPFDocument(new ByteArrayInputStream(bytes));
        } finally {
            ZipSecureFile.setMinInflateRatio(originalRatio);
        }
    }

    private String parseHwpxContent(byte[] bytes) {
        try {
            Map<String, String> entries = unzipXmlEntries(bytes);
            StringBuilder parsed = new StringBuilder();
            entries.entrySet().stream()
                    .filter(entry -> entry.getKey().matches(".*Contents/section\\d+\\.xml") || entry.getKey().matches(".*section\\d+\\.xml"))
                    .sorted(Map.Entry.comparingByKey())
                    .forEach(entry -> {
                        String sectionText = extractXmlText(entry.getValue());
                        if (!sectionText.isBlank()) {
                            if (!parsed.isEmpty()) {
                                parsed.append("\n\n");
                            }
                            parsed.append(sectionText);
                        }
                    });
            return parsed.toString().strip();
        } catch (Exception e) {
            log.warn("HWPX parsing failed: {}", e.getMessage());
            return "";
        }
    }

    private String toMarkdownTable(List<List<String>> rows, int maxColumn) {
        if (rows.isEmpty()) {
            return "";
        }

        int columnCount = Math.max(1, maxColumn);
        List<String> headers = normalizeMarkdownHeader(rows.get(0), columnCount);
        StringBuilder table = new StringBuilder();
        appendMarkdownRow(table, headers, columnCount);
        appendMarkdownSeparator(table, columnCount);

        if (rows.size() == 1) {
            appendMarkdownRow(table, List.of(""), columnCount);
        } else {
            for (int i = 1; i < rows.size(); i++) {
                appendMarkdownRow(table, rows.get(i), columnCount);
            }
        }
        return table.toString().strip();
    }

    private List<String> normalizeMarkdownHeader(List<String> row, int columnCount) {
        List<String> headers = new ArrayList<>();
        for (int i = 0; i < columnCount; i++) {
            String value = i < row.size() ? row.get(i) : "";
            headers.add(value.isBlank() ? "Column " + (i + 1) : value);
        }
        return headers;
    }

    private void appendMarkdownRow(StringBuilder table, List<String> row, int columnCount) {
        table.append("|");
        for (int i = 0; i < columnCount; i++) {
            String value = i < row.size() ? row.get(i) : "";
            table.append(" ").append(escapeMarkdownTableCell(value)).append(" |");
        }
        table.append("\n");
    }

    private void appendMarkdownSeparator(StringBuilder table, int columnCount) {
        table.append("|");
        for (int i = 0; i < columnCount; i++) {
            table.append(" --- |");
        }
        table.append("\n");
    }

    private String escapeMarkdownTableCell(String value) {
        return value == null ? "" : value.replace("|", "\\|").replace("\n", " ").strip();
    }

    private String parseXlsxContent(byte[] bytes) {
        try {
            Map<String, String> entries = unzipXmlEntries(bytes);
            List<String> sharedStrings = parseSharedStrings(entries.getOrDefault("xl/sharedStrings.xml", ""));
            List<String> sheetNames = entries.keySet().stream()
                    .filter(name -> name.matches("xl/worksheets/sheet\\d+\\.xml"))
                    .sorted(Comparator.comparingInt(this::extractSheetIndex))
                    .toList();

            StringBuilder parsed = new StringBuilder();
            for (String sheetName : sheetNames) {
                String sheetText = parseXlsxSheetXml(entries.get(sheetName), sharedStrings);
                if (!sheetText.isBlank()) {
                    if (!parsed.isEmpty()) {
                        parsed.append("\n\n");
                    }
                    parsed.append("Sheet ").append(extractSheetIndex(sheetName)).append("\n");
                    parsed.append(sheetText);
                }
            }
            return parsed.toString().strip();
        } catch (Exception e) {
            log.warn("XLSX fallback parsing failed: {}", e.getMessage());
            return "";
        }
    }

    private Map<String, String> unzipXmlEntries(byte[] bytes) throws IOException {
        Map<String, String> entries = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(new java.io.ByteArrayInputStream(bytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (!entry.isDirectory() && entry.getName().endsWith(".xml")) {
                    entries.put(entry.getName(), new String(zip.readAllBytes(), StandardCharsets.UTF_8));
                }
                zip.closeEntry();
            }
        }
        return entries;
    }

    private int extractSheetIndex(String name) {
        Matcher matcher = Pattern.compile("sheet(\\d+)\\.xml").matcher(name);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : Integer.MAX_VALUE;
    }

    private List<String> parseSharedStrings(String xml) {
        List<String> strings = new ArrayList<>();
        Matcher itemMatcher = Pattern.compile("<si\\b[^>]*>(.*?)</si>", Pattern.DOTALL).matcher(xml);
        while (itemMatcher.find()) {
            strings.add(extractXmlText(itemMatcher.group(1)));
        }
        return strings;
    }

    private String parseXlsxSheetXml(String xml, List<String> sharedStrings) {
        if (xml == null || xml.isBlank()) {
            return "";
        }

        List<List<String>> rows = new ArrayList<>();
        Matcher rowMatcher = Pattern.compile("<row\\b[^>]*>(.*?)</row>", Pattern.DOTALL).matcher(xml);
        while (rowMatcher.find()) {
            Map<Integer, String> cells = new HashMap<>();
            Matcher cellMatcher = Pattern.compile("<c\\b([^>]*)>(.*?)</c>", Pattern.DOTALL).matcher(rowMatcher.group(1));
            int maxColumn = 0;
            while (cellMatcher.find()) {
                String attrs = cellMatcher.group(1);
                int column = extractCellColumn(attrs);
                if (column <= 0) {
                    column = maxColumn + 1;
                }
                maxColumn = Math.max(maxColumn, column);
                cells.put(column, parseXlsxCellValue(attrs, cellMatcher.group(2), sharedStrings));
            }

            if (!cells.isEmpty()) {
                List<String> row = new ArrayList<>();
                for (int i = 1; i <= maxColumn; i++) {
                    row.add(cells.getOrDefault(i, ""));
                }
                rows.add(row);
            }
        }

        return rows.stream()
                .map(row -> String.join("\t", row))
                .collect(Collectors.joining("\n"));
    }

    private int extractCellColumn(String attrs) {
        Matcher matcher = Pattern.compile("\\br=\"([A-Z]+)\\d+\"").matcher(attrs);
        if (!matcher.find()) {
            return 0;
        }
        int column = 0;
        for (char ch : matcher.group(1).toCharArray()) {
            column = column * 26 + (ch - 'A' + 1);
        }
        return column;
    }

    private String parseXlsxCellValue(String attrs, String body, List<String> sharedStrings) {
        if (body.contains("<is")) {
            return extractXmlText(body);
        }

        String rawValue = extractFirstTagText(body, "v");
        if (rawValue.isBlank()) {
            return "";
        }
        if (attrs.contains("t=\"s\"")) {
            try {
                int index = Integer.parseInt(rawValue.strip());
                return index >= 0 && index < sharedStrings.size() ? sharedStrings.get(index) : "";
            } catch (NumberFormatException ignored) {
                return "";
            }
        }
        return decodeXml(rawValue.strip());
    }

    private String extractXmlText(String xml) {
        Matcher matcher = Pattern.compile("<t\\b[^>]*>(.*?)</t>", Pattern.DOTALL).matcher(xml);
        List<String> parts = new ArrayList<>();
        while (matcher.find()) {
            parts.add(decodeXml(matcher.group(1)));
        }
        if (!parts.isEmpty()) {
            return String.join("", parts).strip();
        }
        return decodeXml(xml.replaceAll("<[^>]+>", "")).strip();
    }

    private String extractFirstTagText(String xml, String tagName) {
        Matcher matcher = Pattern.compile("<" + tagName + "\\b[^>]*>(.*?)</" + tagName + ">", Pattern.DOTALL).matcher(xml);
        return matcher.find() ? decodeXml(matcher.group(1)) : "";
    }

    private String decodeXml(String text) {
        return text
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&apos;", "'")
                .replace("&#39;", "'")
                .replace("&amp;", "&");
    }

    private KordocResult runCommand(List<String> command) throws IOException, InterruptedException {
        return runCommand(command, 60, command.isEmpty() ? "command" : command.get(0));
    }

    private KordocResult runCommand(List<String> command, long timeoutSeconds, String commandName)
            throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();

        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            return new KordocResult(-1, commandName + " timed out after " + timeoutSeconds + " seconds");
        }

        return new KordocResult(process.exitValue(), output);
    }

    private void uploadParsedMarkdown(String markdown, String originalName) {
        try {
            String markdownName = originalName.replaceFirst("\\.[^.]+$", "") + ".md";
            String key = s3FileService.uploadText(markdown, markdownName);
            log.info("Uploaded parsed markdown to S3: {}", key);
        } catch (Exception e) {
            log.warn("Parsed markdown S3 upload failed, originalContent will still be saved: {}", e.getMessage());
        }
    }

    private String cleanParsedContent(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }

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

    private FileItem createPreviewFile(MultipartFile file, User user, FileItem originalFile, String parsedContent) {
        if (originalFile == null || file == null || file.isEmpty()) {
            return null;
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : originalFile.getOriginalFileName();
        String lowerName = originalName != null ? originalName.toLowerCase() : "";
        String contentType = file.getContentType() != null ? file.getContentType().toLowerCase() : "";

        if (contentType.contains("pdf") || lowerName.endsWith(".pdf")) {
            return originalFile;
        }

        if (!isConvertibleToPdf(lowerName, contentType)) {
            return null;
        }

        if (isHwpFile(lowerName, contentType)) {
            FileItem hwpPreview = createHwpBridgePreviewFile(file, user, originalName);
            if (hwpPreview != null) {
                return hwpPreview;
            }
            throw new IllegalStateException("HWP preview PDF conversion failed. The document was not created.");
        }

        if (isWordFile(lowerName, contentType)) {
            FileItem wordPreview = createBridgePreviewFile(file, user, originalName, "/docx/preview-pdf", "DOCX");
            if (wordPreview != null) {
                return wordPreview;
            }
        }

        Path tempDir = null;
        Path tempFile = null;
        try {
            tempDir = Files.createTempDirectory("doc-preview-");
            tempFile = tempDir.resolve(sanitizeFileName(originalName));
            Files.write(tempFile, file.getBytes());

            KordocResult result = runLibreOffice(tempFile, tempDir);
            if (result.exitCode() != 0) {
                log.warn("Preview PDF conversion failed with exit code {}: {}", result.exitCode(), result.output());
            }

            Path pdfFile = findConvertedPdf(tempDir, tempFile);
            if (pdfFile == null || !Files.exists(pdfFile)) {
                log.warn("Preview PDF conversion finished but no PDF was created for {}", originalName);
            }

            if (pdfFile == null || !Files.exists(pdfFile)) {
                throw new IllegalStateException("Preview PDF conversion failed. The document was not created.");
            }

            byte[] pdfBytes = Files.readAllBytes(pdfFile);
            String previewName = originalName.replaceFirst("\\.[^.]+$", "") + ".pdf";
            String s3Key = s3FileService.uploadBytes(pdfBytes, previewName, "application/pdf", "previews");

            return fileItemRepository.save(FileItem.builder()
                    .originalFileName(previewName)
                    .storedFileName(s3Key)
                    .filePath(s3Key)
                    .fileSize((long) pdfBytes.length)
                    .contentType("application/pdf")
                    .uploader(user)
                    .ownerId(user != null ? user.getUserId() : null)
                    .ownerType(com.ang.Backend.common.enums.OwnerType.USER)
                    .build());
        } catch (Exception e) {
            throw new IllegalStateException("Preview PDF conversion failed. The document was not created.", e);
        } finally {
            deleteQuietly(tempFile);
            deleteDirectoryQuietly(tempDir);
        }
    }

    private FileItem createHwpBridgePreviewFile(MultipartFile file, User user, String originalName) {
        return createBridgePreviewFile(file, user, originalName, "/hwp/preview-pdf", "HWP");
    }

    private FileItem createBridgePreviewFile(MultipartFile file, User user, String originalName, String endpoint, String label) {
        if (hwpEditBaseUrl == null || hwpEditBaseUrl.isBlank()) {
            log.warn("{} preview skipped because HWP_EDIT_BASE_URL is not configured.", label);
            return null;
        }

        try {
            byte[] pdfBytes = callPreviewBridge(file.getBytes(), originalName, endpoint).getBody();
            if (pdfBytes == null || pdfBytes.length == 0) {
                log.warn("{} preview bridge returned an empty PDF for {}", label, originalName);
                return null;
            }

            String previewName = originalName.replaceFirst("\\.[^.]+$", "") + ".pdf";
            String s3Key = s3FileService.uploadBytes(pdfBytes, previewName, "application/pdf", "previews");

            return fileItemRepository.save(FileItem.builder()
                    .originalFileName(previewName)
                    .storedFileName(s3Key)
                    .filePath(s3Key)
                    .fileSize((long) pdfBytes.length)
                    .contentType("application/pdf")
                    .uploader(user)
                    .ownerId(user != null ? user.getUserId() : null)
                    .ownerType(com.ang.Backend.common.enums.OwnerType.USER)
                    .build());
        } catch (Exception e) {
            log.warn("{} preview bridge failed for {}: {}", label, originalName, e.getMessage());
            return null;
        }
    }

    private ResponseEntity<byte[]> callHwpPreviewBridge(byte[] originalBytes, String originalName) {
        return callPreviewBridge(originalBytes, originalName, "/hwp/preview-pdf");
    }

    private ResponseEntity<byte[]> callPreviewBridge(byte[] originalBytes, String originalName, String endpoint) {
        ByteArrayResource fileResource = new ByteArrayResource(originalBytes) {
            @Override
            public String getFilename() {
                return originalName;
            }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", fileResource);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        return restTemplate.postForEntity(
                hwpEditBaseUrl.replaceAll("/+$", "") + endpoint,
                new HttpEntity<>(body, headers),
                byte[].class
        );
    }

    private boolean isConvertibleToPdf(String lowerName, String contentType) {
        return lowerName.endsWith(".doc")
                || lowerName.endsWith(".docx")
                || lowerName.endsWith(".xls")
                || lowerName.endsWith(".xlsx")
                || lowerName.endsWith(".csv")
                || lowerName.endsWith(".hwp")
                || lowerName.endsWith(".txt")
                || contentType.contains("word")
                || contentType.contains("excel")
                || contentType.contains("spreadsheet")
                || contentType.contains("hwp")
                || contentType.contains("text/plain");
    }

    private boolean isHwpFile(String lowerName, String contentType) {
        return lowerName.endsWith(".hwp") || contentType.contains("hwp");
    }

    private boolean isWordFile(String lowerName, String contentType) {
        return lowerName.endsWith(".doc")
                || lowerName.endsWith(".docx")
                || contentType.contains("word");
    }

    private boolean isPlainTextFile(String lowerName, String contentType) {
        return lowerName.endsWith(".txt") || contentType.contains("text/plain");
    }

    private String toPreviewHtml(String content) {
        String cleaned = cleanParsedContent(content);
        boolean hasTable = cleaned.lines().map(String::strip).anyMatch(this::isMarkdownTableRow);
        String pageSize = hasTable ? "A4 landscape" : "A4";

        return """
                <!doctype html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    @page {
                      size: %s;
                      margin: 10mm 8mm;
                    }

                    html,
                    body {
                      margin: 0;
                      padding: 0;
                    }

                    body {
                      color: #111827;
                      font-family: 'Noto Sans CJK KR', 'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', Arial, sans-serif;
                      font-size: 9.5pt;
                      line-height: 1.35;
                      letter-spacing: 0;
                      overflow-wrap: anywhere;
                      word-break: keep-all;
                      print-color-adjust: exact;
                      -webkit-print-color-adjust: exact;
                    }

                    h1 {
                      margin: 0 0 10px;
                      font-size: 16pt;
                      line-height: 1.25;
                    }

                    p {
                      margin: 0 0 8px;
                      white-space: pre-wrap;
                    }

                    .table-wrap {
                      width: 100%%;
                      margin: 8px 0 14px;
                    }

                    table {
                      width: 100%%;
                      border-collapse: collapse;
                      table-layout: fixed;
                    }

                    th,
                    td {
                      border: 0.75pt solid #cbd5e1;
                      padding: 4px 5px;
                      vertical-align: top;
                      overflow-wrap: anywhere;
                      word-break: break-word;
                      white-space: pre-wrap;
                    }

                    th {
                      background: #eef2f7;
                      color: #111827;
                      font-weight: 700;
                    }

                    tr {
                      page-break-inside: avoid;
                    }

                    .preformatted {
                      margin: 0;
                      font: inherit;
                      white-space: pre-wrap;
                      tab-size: 4;
                    }
                  </style>
                </head>
                <body>%s</body></html>
                """.formatted(pageSize, renderPreviewHtmlBody(cleaned));
    }

    private String renderPreviewHtmlBody(String content) {
        if (content.isBlank()) {
            return "<p></p>";
        }

        List<String> lines = content.lines().toList();
        StringBuilder html = new StringBuilder();
        List<List<String>> tableRows = new ArrayList<>();

        for (String line : lines) {
            String trimmed = line.strip();
            if (isMarkdownTableRow(trimmed)) {
                if (!isMarkdownTableSeparator(trimmed)) {
                    tableRows.add(splitMarkdownTableRow(trimmed));
                }
                continue;
            }

            if (!tableRows.isEmpty()) {
                html.append(renderHtmlTable(tableRows));
                tableRows.clear();
            }

            if (trimmed.isBlank()) {
                continue;
            }

            if (trimmed.startsWith("# ")) {
                html.append("<h1>").append(escapeHtml(trimmed.substring(2).strip())).append("</h1>");
            } else {
                html.append("<p>").append(escapeHtml(trimmed)).append("</p>");
            }
        }

        if (!tableRows.isEmpty()) {
            html.append(renderHtmlTable(tableRows));
        }

        return html.isEmpty()
                ? "<div class=\"preformatted\">" + escapeHtml(content) + "</div>"
                : html.toString();
    }

    private String renderHtmlTable(List<List<String>> rows) {
        if (rows == null || rows.isEmpty()) {
            return "";
        }

        int columnCount = rows.stream().mapToInt(List::size).max().orElse(1);
        StringBuilder table = new StringBuilder("<div class=\"table-wrap\"><table>");

        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            List<String> row = rows.get(rowIndex);
            table.append("<tr>");
            String cellTag = rowIndex == 0 ? "th" : "td";
            for (int columnIndex = 0; columnIndex < columnCount; columnIndex++) {
                String value = columnIndex < row.size() ? row.get(columnIndex) : "";
                table.append("<")
                        .append(cellTag)
                        .append(">")
                        .append(escapeHtml(value))
                        .append("</")
                        .append(cellTag)
                        .append(">");
            }
            table.append("</tr>");
        }

        table.append("</table></div>");
        return table.toString();
    }

    private String escapeHtml(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private KordocResult runLibreOffice(Path file, Path outputDir) throws IOException, InterruptedException {
        Path userProfile = Files.createTempDirectory(outputDir, "lo-profile-");
        try {
            return runCommand(List.of(
                    "libreoffice",
                    "--headless",
                    "--nologo",
                    "--invisible",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--nolockcheck",
                    "--norestore",
                    "-env:UserInstallation=" + userProfile.toUri(),
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    outputDir.toAbsolutePath().toString(),
                    file.toAbsolutePath().toString()
            ), 180, "LibreOffice");
        } catch (IOException e) {
            log.debug("libreoffice command failed, retrying with soffice: {}", e.getMessage());
            return runCommand(List.of(
                    "soffice",
                    "--headless",
                    "--nologo",
                    "--invisible",
                    "--nodefault",
                    "--nofirststartwizard",
                    "--nolockcheck",
                    "--norestore",
                    "-env:UserInstallation=" + userProfile.toUri(),
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    outputDir.toAbsolutePath().toString(),
                    file.toAbsolutePath().toString()
            ), 180, "LibreOffice");
        }
    }

    private Path findConvertedPdf(Path outputDir, Path sourceFile) throws IOException {
        String sourceName = sourceFile.getFileName().toString().replaceFirst("\\.[^.]+$", ".pdf");
        Path expected = outputDir.resolve(sourceName);
        if (Files.exists(expected)) {
            return expected;
        }

        try (var files = Files.list(outputDir)) {
            return files
                    .filter(path -> path.getFileName().toString().toLowerCase().endsWith(".pdf"))
                    .findFirst()
                    .orElse(null);
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (Exception ignored) {
        }
    }

    private void deleteDirectoryQuietly(Path directory) {
        if (directory == null || !Files.exists(directory)) return;
        try (var paths = Files.walk(directory)) {
            paths.sorted(Comparator.reverseOrder()).forEach(this::deleteQuietly);
        } catch (Exception ignored) {
        }
    }

    private String sanitizeFileName(String fileName) {
        return fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private enum AiOutputFormat {
        PDF("pdf", "application/pdf"),
        DOCX("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        XLSX("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        HWP("hwp", "application/x-hwp"),
        TXT("txt", "text/plain; charset=UTF-8");

        private final String extension;
        private final String contentType;

        AiOutputFormat(String extension, String contentType) {
            this.extension = extension;
            this.contentType = contentType;
        }

        private static AiOutputFormat from(String value) {
            if (value == null || value.isBlank()) {
                return PDF;
            }
            try {
                return AiOutputFormat.valueOf(value.strip().toUpperCase());
            } catch (IllegalArgumentException e) {
                return PDF;
            }
        }
    }

    private record AiGeneratedFile(String fileName, String contentType, byte[] bytes) {}

    private record HwpEditSource(
            Long docId,
            String title,
            String originalContent,
            Long fileId,
            String originalName,
            String contentType) {}

    private record DocxEditSource(
            Long docId,
            String title,
            String originalContent,
            Long fileId,
            String originalName) {}

    private record DocxTextBlock(String blockId, String text) {}

    private record AiTextEditPlan(String title, List<Map<String, String>> replacements) {}

    private record XlsxSheet(List<List<String>> rows, int columnCount) {}

    private record KordocResult(int exitCode, String output) {}
}
