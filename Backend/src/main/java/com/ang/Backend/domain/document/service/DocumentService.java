package com.ang.Backend.domain.document.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.dto.DocumentParseResponse;
import com.ang.Backend.domain.document.dto.DocumentSaveRequest;
import com.ang.Backend.domain.document.entity.Document;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;
    private final RestTemplate restTemplate;

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Value("${ai.base-url}")
    private String aiBaseUrl;

    private static final String CONTAINER_UPLOAD_DIR = "/app/uploads";

    @Transactional(readOnly = true)
    public List<DocumentDto> getMyDocuments(String empNo) {
        User user = findUser(empNo);
        return documentRepository.findByOwnerOrderByCreatedAtDesc(user)
                .stream().map(DocumentDto::from).toList();
    }

    @Transactional
    public DocumentDto saveDocument(String empNo, DocumentSaveRequest req) {
        User user = findUser(empNo);
        Scope scope = resolveScope(req.getScopeId());

        Document doc = Document.builder()
                .owner(user)
                .scope(scope)
                .title(req.getTitle())
                .originalContent(req.getContent())
                .isAiGenerated(Boolean.TRUE.equals(req.getIsAiGenerated()))
                .build();
        return DocumentDto.from(documentRepository.save(doc));
    }

    @Transactional
    public DocumentDto saveOcrDocument(String empNo, String title, String content) {
        User user = findUser(empNo);

        Document doc = Document.builder()
                .owner(user)
                .title(title)
                .originalContent(content)
                .isOcrProcessed(true)
                .build();
        return DocumentDto.from(documentRepository.save(doc));
    }

    public DocumentParseResponse saveAndParse(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }

        String savedName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path savePath = Paths.get(uploadDir, savedName);

        try {
            Files.createDirectories(savePath.getParent());
            file.transferTo(savePath);
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String containerFilePath = CONTAINER_UPLOAD_DIR + "/" + savedName;
        @SuppressWarnings("unchecked")
        Map<String, String> aiResult = restTemplate.postForObject(
                aiBaseUrl + "/analyze-document",
                Map.of("file_path", containerFilePath),
                Map.class);

        String aiResponse = (aiResult != null) ? aiResult.getOrDefault("answer", "") : "";

        return new DocumentParseResponse(savedName, containerFilePath, aiResponse);
    }

    private User findUser(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private Scope resolveScope(Integer scopeId) {
        if (scopeId == null) return null;
        return scopeRepository.findById(scopeId)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
    }
}
