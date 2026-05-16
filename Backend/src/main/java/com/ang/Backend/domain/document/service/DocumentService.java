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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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

        var storedFile = fileService.storeFile(file, user, subPath);

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
                    Scope myLevel2 = getLevel2Ancestor(myScope);
                    Scope targetLevel2 = getLevel2Ancestor(targetScope);
                    
                    if (myLevel2 != null && targetLevel2 != null && 
                        myLevel2.getScopeId().equals(targetLevel2.getScopeId())) {
                        hasAccess = true;
                        break;
                    }
                    // 혹은 기존처럼 직계 부모-자식 관계인 경우도 허용
                    if (isSameOrChild(myScope, targetScope)) {
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
                        .map(this::getLevel2Ancestor)
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

        return documentRepository.searchByScopes(scopeIds, keyword).stream()
                .map(DocumentDto.Response::fromEntity)
                .collect(Collectors.toList());
    }

    private Scope getLevel2Ancestor(Scope scope) {
        if (scope == null) return null;
        
        // Root (Level 1)
        if (scope.getParentScope() == null) return null;
        
        // Level 2 (Parent is root)
        if (scope.getParentScope().getParentScope() == null) return scope;
        
        // Level 3 (Parent is Level 2)
        if (scope.getParentScope().getParentScope().getParentScope() == null) return scope.getParentScope();
        
        // 그 이상 깊이가 있다면 계속 위로 올라가서 Level 2를 찾음
        Scope current = scope;
        while (current.getParentScope() != null && current.getParentScope().getParentScope() != null) {
            current = current.getParentScope();
        }
        return current;
    }

    private boolean isSameOrChild(Scope parent, Scope target) {
        if (parent.getScopeId().equals(target.getScopeId())) return true;
        
        Scope current = target.getParentScope();
        while (current != null) {
            if (current.getScopeId().equals(parent.getScopeId())) return true;
            current = current.getParentScope();
        }
        return false;
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
