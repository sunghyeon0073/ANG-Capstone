package com.ang.Backend.domain.document.service;

import com.ang.Backend.domain.document.dto.DocumentDto;
import com.ang.Backend.domain.document.entity.DocumentEntity;
import com.ang.Backend.domain.document.repository.DocumentRepository;
import com.ang.Backend.domain.file.service.FileService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.scope.entity.UserMembership;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DocumentService {
    private final DocumentRepository documentRepository;
    private final FileService fileService;
    private final UserMembershipRepository userMembershipRepository;

    @Transactional
    public Long create(String title, MultipartFile file, User user) throws Exception {
        var storedFile = fileService.storeFile(file);

        com.ang.Backend.domain.scope.entity.Scope userScope = null;
        if (user != null) {
            userScope = userMembershipRepository.findByUser(user).stream()
                    .findFirst()
                    .map(UserMembership::getScope)
                    .orElse(null);
        }

        DocumentEntity doc = DocumentEntity.builder()
                .title(title)
                .file(storedFile)
                .owner(user)
                .scope(userScope)
                .originalContent("")
                .build();

        return documentRepository.save(doc).getDocId();
    }

    @Transactional
    public void update(Long id, DocumentDto.UpdateRequest dto) {
        DocumentEntity doc = documentRepository.findById(id).orElseThrow();
        doc.updateContent(dto.getTitle(), dto.getContent());
    }

    // [이 메서드가 누락되어 에러 발생]
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