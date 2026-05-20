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
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.service.S3FileService;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentService {
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

    @Value("${ai.base-url}")
    private String aiBaseUrl;

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
        List<DocumentDto.Response> list = documentRepository.findAll().stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
        setCanDeleteFlags(list, requester);
        return list;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public DocumentDto.Response generateWithAi(String prompt, User user, Long sourceDocId, List<Long> attachedDocIds, String outputFormat) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt is required.");
        }

        AiOutputFormat format = AiOutputFormat.from(outputFormat);
        String finalPrompt = buildAiPrompt(prompt, sourceDocId, attachedDocIds, format);

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

        String aiTitle = makeAiTitle(answer);

        return saveAiDocument(aiTitle, answer, user, format);
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
        return """
                Create a polished Korean business document.
                The first line must be a concise document title as a Markdown H1 heading.
                Do not use the user's prompt verbatim as the title.
                Target file format: %s.

                User request:
                %s
                """.formatted(format.extension.toUpperCase(), prompt);
    }

    private DocumentDto.Response saveAiDocument(String aiTitle, String answer, User user, AiOutputFormat format) {
        AiGeneratedFile generatedFile = createAiGeneratedFile(aiTitle, answer, format);

        return transactionTemplate.execute(status -> {
            FileItem fileItem = saveGeneratedFileItem(generatedFile, user, "documents");
            FileItem previewFile = format == AiOutputFormat.PDF
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

    public List<DocumentDto.Response> getMyDocuments(User user) {
        List<DocumentDto.Response> list = documentRepository.findByOwner(user).stream()
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

        List<DocumentDto.Response> list = documentRepository.searchByScopes(scopeIds, keyword).stream()
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
            throw new CustomException(ErrorCode.ACCESS_DENIED, "해당 문서를 삭제할 권한이 없습니다.");
        }

        if (doc.getFile() != null) {
            fileService.deletePhysicalFile(doc.getFile());
        }
        if (doc.getPreviewFile() != null
                && (doc.getFile() == null || !doc.getPreviewFile().getFileId().equals(doc.getFile().getFileId()))) {
            fileService.deletePhysicalFile(doc.getPreviewFile());
        }
        documentRepository.delete(doc);
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

    private String buildDocxDocumentXml(String content) {
        String paragraphs = cleanParsedContent(content).lines()
                .map(line -> """
                        <w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>
                        """.formatted(escapeXml(line)))
                .collect(Collectors.joining());

        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                  <w:body>
                    %s
                    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
                  </w:body>
                </w:document>
                """.formatted(paragraphs);
    }

    private byte[] createXlsxBytes(String content) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            addZipEntry(zip, "[Content_Types].xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
                      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
                      <Default Extension="xml" ContentType="application/xml"/>
                      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
                      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
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
                    </Relationships>
                    """);
            addZipEntry(zip, "xl/workbook.xml", """
                    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
                      <sheets><sheet name="AI Document" sheetId="1" r:id="rId1"/></sheets>
                    </workbook>
                    """);
            addZipEntry(zip, "xl/worksheets/sheet1.xml", buildXlsxSheetXml(content));
        }
        return out.toByteArray();
    }

    private String buildXlsxSheetXml(String content) {
        List<String> lines = cleanParsedContent(content).lines()
                .filter(line -> !line.isBlank())
                .toList();
        if (lines.isEmpty()) {
            lines = List.of("");
        }

        StringBuilder rows = new StringBuilder();
        for (int i = 0; i < lines.size(); i++) {
            String[] cells = lines.get(i).split("\\t|,");
            rows.append("<row r=\"").append(i + 1).append("\">");
            for (int j = 0; j < cells.length; j++) {
                rows.append("<c r=\"").append(excelColumnName(j + 1)).append(i + 1)
                        .append("\" t=\"inlineStr\"><is><t>")
                        .append(escapeXml(cells[j].strip()))
                        .append("</t></is></c>");
            }
            rows.append("</row>");
        }

        return """
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
                  <sheetData>%s</sheetData>
                </worksheet>
                """.formatted(rows);
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

    private KordocResult runCommand(List<String> command) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();

        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        boolean finished = process.waitFor(60, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            return new KordocResult(-1, "kordoc timed out after 60 seconds");
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
                if (shouldCreateParsedPreviewFallback(lowerName, contentType)) {
                    pdfFile = createParsedContentPreviewPdf(parsedContent, originalName, tempDir);
                }
            }

            if (pdfFile == null || !Files.exists(pdfFile)) {
                return null;
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
            log.warn("Preview PDF generation failed: {}", e.getMessage());
            return null;
        } finally {
            deleteQuietly(tempFile);
            deleteDirectoryQuietly(tempDir);
        }
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

    private boolean isPlainTextFile(String lowerName, String contentType) {
        return lowerName.endsWith(".txt") || contentType.contains("text/plain");
    }

    private boolean shouldCreateParsedPreviewFallback(String lowerName, String contentType) {
        return isPlainTextFile(lowerName, contentType);
    }

    private Path createParsedContentPreviewPdf(String parsedContent, String originalName, Path outputDir)
            throws IOException, InterruptedException {
        if (parsedContent == null || parsedContent.isBlank()) {
            return null;
        }

        String htmlName = originalName.replaceFirst("\\.[^.]+$", "") + "-parsed.html";
        Path htmlFile = outputDir.resolve(sanitizeFileName(htmlName));
        Files.writeString(htmlFile, toPreviewHtml(parsedContent), StandardCharsets.UTF_8);

        KordocResult result = runLibreOffice(htmlFile, outputDir);
        if (result.exitCode() != 0) {
            log.warn("Parsed content PDF conversion failed with exit code {}: {}", result.exitCode(), result.output());
            return null;
        }

        Path pdfFile = findConvertedPdf(outputDir, htmlFile);
        if (pdfFile == null || !Files.exists(pdfFile)) {
            log.warn("Parsed content PDF conversion finished but no PDF was created for {}", originalName);
            return null;
        }

        return pdfFile;
    }

    private String toPreviewHtml(String content) {
        return """
                <!doctype html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    body {
                      font-family: 'Noto Sans CJK KR', sans-serif;
                      font-size: 12pt;
                      line-height: 1.55;
                      white-space: pre-wrap;
                    }
                  </style>
                </head>
                <body>""" + escapeHtml(cleanParsedContent(content)) + "</body></html>";
    }

    private String escapeHtml(String text) {
        return text
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private KordocResult runLibreOffice(Path file, Path outputDir) throws IOException, InterruptedException {
        try {
            return runCommand(List.of(
                    "libreoffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    outputDir.toAbsolutePath().toString(),
                    file.toAbsolutePath().toString()
            ));
        } catch (IOException e) {
            log.debug("libreoffice command failed, retrying with soffice: {}", e.getMessage());
            return runCommand(List.of(
                    "soffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    outputDir.toAbsolutePath().toString(),
                    file.toAbsolutePath().toString()
            ));
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

    private record KordocResult(int exitCode, String output) {}
}
