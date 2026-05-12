package com.ang.Backend.domain.document.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.dto.DocumentSaveRequest;
import com.ang.Backend.domain.document.entity.Document;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.scope.repository.ScopeRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;

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
