package org.example.capstoneBack.domain.document.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.document.dto.DocumentCreateRequest;
import org.example.capstoneBack.domain.document.dto.DocumentDto;
import org.example.capstoneBack.domain.document.entity.Document;
import org.example.capstoneBack.domain.document.repository.DocumentRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
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
        User user = findUserByEmpNo(empNo);
        return documentRepository.findByOwnerUserId(user.getUserId())
                .stream().map(DocumentDto::from).toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocument(Long docId) {
        return DocumentDto.from(findById(docId));
    }

    @Transactional
    public DocumentDto createDocument(String empNo, DocumentCreateRequest request) {
        User owner = findUserByEmpNo(empNo);
        Scope scope = null;
        if (request.getScopeId() != null) {
            scope = scopeRepository.findById(request.getScopeId())
                    .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
        }
        Document doc = Document.builder()
                .owner(owner).scope(scope)
                .title(request.getTitle())
                .originalContent(request.getOriginalContent())
                .isAiGenerated(request.isAiGenerated())
                .build();
        return DocumentDto.from(documentRepository.save(doc));
    }

    @Transactional
    public DocumentDto updateDocument(Long docId, String empNo, String title, String content) {
        Document doc = findById(docId);
        if (!doc.getOwner().getEmpNo().equals(empNo)) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        doc.update(title, content);
        return DocumentDto.from(doc);
    }

    @Transactional
    public void deleteDocument(Long docId, String empNo) {
        Document doc = findById(docId);
        if (!doc.getOwner().getEmpNo().equals(empNo)) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        documentRepository.delete(doc);
    }

    @Transactional
    public DocumentDto applyOcr(Long docId, String ocrText) {
        Document doc = findById(docId);
        doc.update(null, ocrText);
        doc.markOcrProcessed();
        return DocumentDto.from(doc);
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> searchDocuments(String empNo, String keyword) {
        User user = findUserByEmpNo(empNo);
        return documentRepository.searchByKeyword(user.getUserId(), keyword)
                .stream().map(DocumentDto::from).toList();
    }

    private Document findById(Long id) {
        return documentRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.DOCUMENT_NOT_FOUND));
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
