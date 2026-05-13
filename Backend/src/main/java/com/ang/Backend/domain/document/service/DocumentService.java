package com.ang.Backend.domain.document.service;

import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.file.service.FileService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.entity.UserMembership;
import com.ang.Backend.domain.scope.service.ScopeService;
import com.ang.Backend.common.enums.DocumentStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
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

    @Transactional
    public Long create(String title, MultipartFile file, User user, Integer targetScopeId) throws Exception {
        var storedFile = fileService.storeFile(file, user); // 유저 정보 전달

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

    public List<DocumentDto.Response> getMyDocuments(User user) {
        // 개인 문서함: 내가 주인이면서 부서 공유가 안 된(scope is null) 문서들
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

        // 사용자가 속한 모든 부서와 그 하위 부서의 ID를 통합
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

        // 연결된 실제 파일도 삭제
        if (doc.getFile() != null) {
            fileService.deletePhysicalFile(doc.getFile());
        }
        documentRepository.delete(doc);
    }
}