package com.ang.Backend.domain.document.service;

import com.ang.Backend.common.enums.DocumentStatus;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.file.service.FileService;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.service.ScopeService;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentService {
    private final DocumentRepository documentRepository;
    private final FileService fileService;
    private final UserMembershipRepository userMembershipRepository;
    private final ScopeRepository scopeRepository;
    private final ScopeService scopeService;
    private final RestTemplate restTemplate;

    @Value("${ai.base-url}")
    private String aiBaseUrl;

    @Transactional
    public Long create(String title, MultipartFile file, User user, Integer targetScopeId) throws Exception {
        var storedFile = fileService.storeFile(file, user);

        Scope targetScope = null;
        if (targetScopeId != null) {
            targetScope = scopeRepository.findById(targetScopeId)
                    .orElseThrow(() -> new RuntimeException("대상 부서를 찾을 수 없습니다."));
        }

        DocumentEntity doc = DocumentEntity.builder()
                .title(title)
                .file(storedFile)
                .owner(user)
                .scope(targetScope)
                .status(DocumentStatus.DRAFT)
                .originalContent("")
                .build();

        return documentRepository.save(doc).getDocId();
    }

    public List<DocumentDto.Response> getAllDocuments() {
        return documentRepository.findAll().stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public DocumentDto.Response generateWithAi(String prompt, User user) {
        if (prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("Prompt is required.");
        }

        Map<String, String> aiRequest = Map.of("message", prompt);
        @SuppressWarnings("unchecked")
        Map<String, Object> aiResponse = restTemplate.postForObject(
                aiBaseUrl + "/chat",
                aiRequest,
                Map.class
        );

        String answer = aiResponse != null && aiResponse.get("reply") != null
                ? aiResponse.get("reply").toString()
                : "";

        DocumentEntity doc = DocumentEntity.builder()
                .title(makeAiTitle(prompt))
                .owner(user)
                .status(DocumentStatus.DRAFT)
                .originalContent(answer)
                .aiSummary(answer)
                .isAiGenerated(true)
                .build();

        return DocumentDto.Response.fromEntity(documentRepository.save(doc));
    }

    public List<DocumentDto.Response> getMyDocuments(User user) {
        return documentRepository.findByOwner(user).stream()
                .filter(d -> d.getScope() == null)
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
    }

    public List<DocumentDto.Response> getDepartmentDocuments(User user, String keyword) {
        List<Scope> userScopes = userMembershipRepository.findByUser(user).stream()
                .map(UserMembership::getScope)
                .collect(Collectors.toList());

        if (userScopes.isEmpty()) {
            throw new RuntimeException("사용자의 부서 정보를 찾을 수 없습니다.");
        }

        List<Integer> allSubScopeIds = userScopes.stream()
                .flatMap(scope -> scopeService.getAllSubScopeIds(scope).stream())
                .distinct()
                .collect(Collectors.toList());

        return documentRepository.searchByScopes(allSubScopeIds, keyword).stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
    }

    public DocumentDto.Response getDocument(Long id) {
        return documentRepository.findById(id)
                .map(DocumentDto.Response::fromEntity)
                .orElseThrow(() -> new RuntimeException("문서를 찾을 수 없습니다."));
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
    public void delete(Long id) {
        DocumentEntity doc = documentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("문서를 찾을 수 없습니다."));

        if (doc.getFile() != null) {
            fileService.deletePhysicalFile(doc.getFile());
        }
        documentRepository.delete(doc);
    }

    private String makeAiTitle(String prompt) {
        String normalized = prompt.strip().replaceAll("\\s+", " ");
        if (normalized.length() <= 40) {
            return normalized;
        }
        return normalized.substring(0, 40);
    }
}
